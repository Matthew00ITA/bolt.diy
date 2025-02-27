export async function executeSupabaseQuery(token: string, projectId: string, query: string) {
  console.log('Executing Supabase query:', {
    projectId,
    query,
    hasToken: !!token,
  });

  try {
    const response = await fetch('/api/supabase/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        projectId,
        query,
      }),
    });

    console.log('Supabase query response:', {
      status: response.status,
      ok: response.ok,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Query failed:', errorText);
      throw new Error(`Failed to execute query: ${errorText}`);
    }

    const result = await response.json();
    console.log('Query result:', result);

    return result;
  } catch (error) {
    console.error('Query execution error:', error);
    throw error;
  }
}
