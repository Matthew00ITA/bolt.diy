import { json } from '@remix-run/node';
import type { ActionFunction, LoaderFunction } from '@remix-run/node';
import type { SupabaseProject } from '~/types/supabase';

// Add a loader function to handle preflight requests
export const loader: LoaderFunction = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};

export const action: ActionFunction = async ({ request }) => {
  // Handle OPTIONS requests for CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  // Inside the action function
  try {
    const { token } = (await request.json()) as any;

    if (!token) {
      return json({ error: 'Missing token' }, { status: 400 });
    }

    const projectsResponse = await fetch('https://api.supabase.com/v1/projects', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!projectsResponse.ok) {
      const errorText = await projectsResponse.text();
      console.error('Projects fetch failed:', errorText);

      // More descriptive error message based on status code
      const errorMessage =
        projectsResponse.status === 401
          ? 'Invalid Supabase token'
          : projectsResponse.status === 403
            ? 'Permission denied for Supabase API'
            : 'Failed to fetch projects';

      return json({ error: errorMessage }, { status: projectsResponse.status });
    }

    const projects = (await projectsResponse.json()) as SupabaseProject[];

    // Create a Map to store unique projects by ID
    const uniqueProjectsMap = new Map<string, SupabaseProject>();

    // Only keep the latest version of each project
    for (const project of projects) {
      if (!uniqueProjectsMap.has(project.id)) {
        uniqueProjectsMap.set(project.id, project);
      }
    }

    const uniqueProjects = Array.from(uniqueProjectsMap.values());

    // Sort projects by creation date (newest first)
    uniqueProjects.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Create a user object with all the required fields
    const now = new Date().toISOString();

    return json({
      user: {
        id: 'supabase-user',
        email: 'Connected',
        role: 'Admin',
        created_at: now,
        last_sign_in_at: now,
      },
      stats: {
        projects: uniqueProjects,
        totalProjects: uniqueProjects.length,
      },
    });
  } catch (error) {
    console.error('Supabase API error:', error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Authentication failed',
      },
      { status: 500 },
    );
  }
};
