import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';
import { json } from '@remix-run/node';

const logger = createScopedLogger('api.supabase.query');

// Simple in-memory cache
type CacheEntry = {
  data: any;
  timestamp: number;
};

// Types for better error handling
type SupabaseErrorResponse = {
  message?: string;
  error?: string;
  code?: string;
  hint?: string;
  details?: string;
  [key: string]: unknown;
};

// Cache with simple TTL
const queryCache = new Map<string, CacheEntry>();
const CACHE_TTL = 30 * 1000; // 30 seconds
const RATE_LIMIT_WINDOW = 5 * 1000; // 5 seconds window for rate limiting
const MAX_REQUESTS_PER_WINDOW = 5; // Maximum 5 requests per window

// Rate limiting mechanism
const requestTimestamps: { [key: string]: number[] } = {};

// Helper to generate a cache key
function generateCacheKey(projectId: string, query: string): string {
  return `${projectId}:${query}`;
}

// Check if request is rate limited
function isRateLimited(projectId: string): boolean {
  const now = Date.now();

  // Initialize if needed
  if (!requestTimestamps[projectId]) {
    requestTimestamps[projectId] = [];
  }

  // Filter out old timestamps
  requestTimestamps[projectId] = requestTimestamps[projectId].filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW,
  );

  // Check if over limit
  return requestTimestamps[projectId].length >= MAX_REQUESTS_PER_WINDOW;
}

// Record a request
function recordRequest(projectId: string): void {
  const now = Date.now();

  if (!requestTimestamps[projectId]) {
    requestTimestamps[projectId] = [];
  }

  requestTimestamps[projectId].push(now);
}

// Handle both GET and POST requests
export async function loader({ request }: ActionFunctionArgs) {
  // Handle CORS for OPTIONS requests
  if (request.method === 'OPTIONS') {
    return corsResponse();
  }

  // For GET requests, return a simple status
  return json({ status: 'API endpoint is active' });
}

// CORS response helper
function corsResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  logger.debug(`Handling ${request.method} request to query endpoint`);

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return corsResponse();
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader) {
      logger.error('No authorization token provided');
      return json({ error: 'No authorization token provided' }, { status: 401 });
    }

    // Extract the token (Bearer format expected)
    let token = authHeader;

    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }

    logger.debug('Token format validated');

    // Parse request body
    let body: { projectId?: string; query?: string } = {};

    try {
      body = (await request.json()) as { projectId?: string; query?: string };
    } catch (e) {
      logger.error('Error parsing request body:', e);
      return json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { projectId, query } = body;

    if (!projectId || !query) {
      logger.error('Missing required parameters', { projectId: !!projectId, query: !!query });
      return json({ error: 'Missing required parameters: projectId and query' }, { status: 400 });
    }

    // Log request details for debugging
    logger.debug('Query request:', {
      projectId,
      queryLength: query.length,
      queryType: query.trim().split(' ')[0]?.toUpperCase(), // Just log the type (SELECT, etc)
      queryFirstChars: query.substring(0, 30).replace(/\s+/g, ' ') + '...',
      queryHash: generateCacheKey(projectId, query).substring(0, 10), // Log partial hash for tracking
    });

    // Check rate limit
    if (isRateLimited(projectId)) {
      logger.warn('Rate limit exceeded for project:', { projectId });
      return json(
        {
          error: {
            message: 'Too many requests. Please slow down API calls.',
            details: { retryAfter: RATE_LIMIT_WINDOW / 1000 },
          },
        },
        {
          status: 429,
          headers: {
            'Retry-After': `${RATE_LIMIT_WINDOW / 1000}`,
          },
        },
      );
    }

    // Record this request for rate limiting
    recordRequest(projectId);

    // Check cache first
    const cacheKey = generateCacheKey(projectId, query);
    const now = Date.now();
    const cachedEntry = queryCache.get(cacheKey);

    if (cachedEntry && now - cachedEntry.timestamp < CACHE_TTL) {
      logger.debug('Cache hit for query');
      return json(cachedEntry.data);
    }

    // Detailed logging before the API call
    logger.debug('Making request to Supabase API', {
      endpoint: `https://api.supabase.com/v1/projects/${projectId}/database/query`,
      hasToken: !!token,
      queryLength: query.length,
      tokenPrefix: token.substring(0, 5) + '...',
    });

    // Use Supabase API for database queries - ensure proper JSON formatting
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Client-Info': 'bolt-diy', // Identify client to Supabase
      },
      body: JSON.stringify({ query: query.trim() }), // Ensure query is trimmed
    });

    logger.debug('Supabase API response received', { status: response.status });

    // Handle errors
    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      let errorMessage = `API error: ${response.status} ${response.statusText}`;
      let errorDetails = {};

      try {
        if (contentType && contentType.includes('application/json')) {
          const errorData = (await response.json()) as SupabaseErrorResponse;
          errorMessage = errorData.message || errorData.error || errorMessage;
          errorDetails = errorData;
        } else {
          const text = await response.text();
          errorMessage = text || errorMessage;
        }
      } catch (e) {
        logger.error('Error parsing error response:', e);
      }

      logger.error('Supabase API error:', {
        status: response.status,
        message: errorMessage,
      });

      return json({ error: { message: errorMessage, details: errorDetails } }, { status: response.status });
    }

    // Process successful response
    const data = await response.json();
    logger.debug('Successfully parsed response data');

    // Store in cache
    queryCache.set(cacheKey, {
      data,
      timestamp: now,
    });

    // Prevent cache from growing too large
    if (queryCache.size > 100) {
      // Remove oldest 20 entries
      const entries = Array.from(queryCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

      const entriesToRemove = entries.slice(0, 20);

      for (const [key] of entriesToRemove) {
        queryCache.delete(key);
      }
    }

    return json(data);
  } catch (error) {
    logger.error('Query execution error:', error);

    return json(
      {
        error: {
          message: error instanceof Error ? error.message : 'Query execution failed',
        },
      },
      { status: 500 },
    );
  }
}
