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
      // Parse the error response
      const errorData = (await response.json()) as any;

      console.error('Query failed:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
      });

      /*
       * Extract the error message from the structured response
       * The API returns error in format { error: { message: string, ... } }
       */
      let errorMessage = 'Failed to execute query';

      if (errorData && errorData.error) {
        // The API route wraps the error in an error object
        errorMessage = errorData.error.message || errorMessage;
      }

      // Create an error object that action-runner can use directly
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('Query result:', result);

    return result;
  } catch (error) {
    console.error('Query execution error:', error);
    throw error;
  }
}
