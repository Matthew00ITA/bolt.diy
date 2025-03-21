import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { createScopedLogger } from '~/utils/logger';
import { json } from '@remix-run/node';

const logger = createScopedLogger('api.supabase.query');

// Add OPTIONS handler for CORS preflight
export async function loader() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function action({ request }: ActionFunctionArgs) {
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader) {
      return json({ error: 'No authorization token provided' }, { status: 401 });
    }

    const { projectId, query } = (await request.json()) as any;

    if (!projectId || !query) {
      return json({ error: 'Missing required parameters: projectId and query' }, { status: 400 });
    }

    logger.debug('Executing query:', { projectId, query });

    // Use REST API endpoint for database queries
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    // Handle errors
    if (!response.ok) {
      let errorMessage = `Error ${response.status}: ${response.statusText}`;
      let errorDetails = {};

      // Try to parse error as JSON, fallback to text
      try {
        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
          const errorData = (await response.json()) as Record<string, any>;
          errorMessage = errorData.message || errorData.error || errorMessage;
          errorDetails = errorData;
        } else {
          // Handle HTML or other responses
          const errorText = await response.text();

          // If it looks like HTML, provide a more helpful message
          if (errorText.includes('<!DOCTYPE') || errorText.includes('<html')) {
            errorMessage = 'Received HTML response instead of expected JSON. API endpoint may be invalid.';
          } else {
            errorMessage = errorText || errorMessage;
          }
        }
      } catch (parseError) {
        logger.error('Error parsing error response:', parseError);
      }

      logger.error('Supabase API error:', { status: response.status, message: errorMessage });

      return json(
        {
          error: {
            status: response.status,
            message: errorMessage,
            details: errorDetails,
          },
        },
        { status: response.status },
      );
    }

    // Process successful response
    const data = await response.json();

    return json(data);
  } catch (error) {
    logger.error('Query execution error:', error);

    return json(
      {
        error: {
          message: error instanceof Error ? error.message : 'Query execution failed',
          stack: error instanceof Error ? error.stack : undefined,
        },
      },
      { status: 500 },
    );
  }
}
