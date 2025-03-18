import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '@nanostores/react';
import { toast } from 'react-toastify';
import { supabaseConnection, fetchSupabaseStats, updateSupabaseConnection } from '~/lib/stores/supabase';
import { classNames } from '~/utils/classNames';
import type { SupabaseUser, SupabaseProject } from '~/types/supabase';

// Types
type Project = {
  id: string;
  name: string;
  organization: { name: string };
  region: string;
};

type DatabaseStats = {
  tables: string;
  rows: string;
  storage: string;
  users: string;
};

type DatabaseTable = {
  name: string;
  schema: string;
  type: string;
};

// Supabase API response types
interface SupabaseConnectionResponse {
  user: SupabaseUser;
  stats: {
    projects: SupabaseProject[];
    totalProjects: number;
  };
  error?: string;
}

// Helper function to fetch service token
async function fetchServiceToken(_projectId: string): Promise<string | null> {
  try {
    // This should be replaced with actual implementation
    return supabaseConnection.get().token;
  } catch (error) {
    console.error('Error fetching service token:', error);
    return null;
  }
}

// Card component for displaying stats
const StatsCard = ({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: string;
  color: string;
}) => (
  <div className="p-4 rounded-lg border border-[#E5E5E5] dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A]">
    <div className="flex items-center justify-between">
      <div>
        <h4 className="text-sm text-bolt-elements-textSecondary mb-1">{title}</h4>
        <p className="text-lg font-semibold text-bolt-elements-textPrimary">{value}</p>
      </div>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${color}`}>
        <div className={`${icon} w-4 h-4 text-white`}></div>
      </div>
    </div>
  </div>
);

// Project card component for displaying project info
const ProjectCard = ({
  project,
  isSelected,
  onSelect,
}: {
  project: SupabaseProject;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) => (
  <div
    className={classNames(
      'p-4 rounded-lg border transition-colors',
      isSelected
        ? 'border-[#3ECF8E] bg-[#3ECF8E]/5 dark:bg-[#3ECF8E]/10'
        : 'border-[#E5E5E5] dark:border-[#1A1A1A] hover:border-[#3ECF8E] dark:hover:border-[#3ECF8E]',
    )}
  >
    <div className="flex items-center justify-between">
      <div>
        <h4 className="text-sm font-medium text-bolt-elements-textPrimary flex items-center gap-2">
          <div className="i-ph:database w-4 h-4 text-[#3ECF8E]" />
          {project.name}
        </h4>
        <div className="flex items-center gap-2 mt-2 text-xs text-bolt-elements-textSecondary">
          <span className="flex items-center gap-1">
            <div className="i-ph:map-pin w-3 h-3" />
            {project.region}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <div className="i-ph:clock w-3 h-3" />
            {new Date(project.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-xs text-bolt-elements-textSecondary px-2 py-1 rounded-md bg-[#F0F0F0] dark:bg-[#252525]">
          <span className="flex items-center gap-1">
            <div className="i-ph:circle-wavy-check w-3 h-3" />
            {project.status}
          </span>
        </div>
        <button
          onClick={() => onSelect(project.id)}
          className={classNames(
            'px-3 py-1 rounded-md text-xs',
            isSelected
              ? 'bg-[#3ECF8E] text-white'
              : 'bg-[#F0F0F0] dark:bg-[#252525] text-bolt-elements-textSecondary hover:bg-[#3ECF8E] hover:text-white',
          )}
        >
          {isSelected ? (
            <span className="flex items-center gap-1">
              <div className="i-ph:check w-3 h-3" />
              Selected
            </span>
          ) : (
            'Select'
          )}
        </button>
      </div>
    </div>
  </div>
);

// Database table component for displaying database schema info
function DatabaseTable({
  selectedProject,
  setDatabaseStats,
}: {
  selectedProject: Project;
  setDatabaseStats: (stats: DatabaseStats) => void;
}) {
  const [tables, setTables] = useState<DatabaseTable[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the last fetch time to avoid too many requests
  const lastFetchTimeRef = useRef<number>(0);
  const cooldownPeriod = 10000; // 10 seconds cooldown

  // Function to safely execute a query with proper error handling
  const executeQuery = async (token: string, projectId: string, query: string, errorContext: string) => {
    let retries = 0;
    const maxRetries = 2;
    const retryDelay = 1000; // 1 second

    const attemptQuery = async (): Promise<any> => {
      try {
        console.log(`[Supabase] Executing ${errorContext} query: ${query.substring(0, 30)}...`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

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
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        console.log(`[Supabase] ${errorContext} response status:`, response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[Supabase] API error (${response.status}) for ${errorContext}:`, errorText);

          // For 429 errors, add a longer cooldown
          if (response.status === 429) {
            lastFetchTimeRef.current = Date.now(); // Reset the cooldown timer
            console.warn(`[Supabase] Rate limit hit, cooling down for ${cooldownPeriod / 1000}s`);
          }

          return null;
        }

        // Parse the response and log it
        const responseData = (await response.json()) as any;
        console.log(`[Supabase] ${errorContext} response data:`, responseData);

        // Check if we have an error in the response
        if (responseData.error) {
          console.error(`[Supabase] Query error for ${errorContext}:`, responseData.error);
          return null;
        }

        // Extract the result data - Supabase sometimes returns it with or without .result
        let resultData;

        if (responseData.result) {
          resultData = responseData.result;
        } else if (Array.isArray(responseData)) {
          resultData = responseData; // Direct array
        } else if (responseData.data) {
          resultData = responseData.data; // Some endpoints use .data
        } else {
          // Fallback for any other structure
          resultData = responseData;
        }

        console.log(`[Supabase] ${errorContext} extracted result:`, resultData);

        return resultData;
      } catch (err) {
        console.error(`[Supabase] Error in ${errorContext}:`, err);

        // Check if we should retry
        if (
          retries < maxRetries &&
          ((err instanceof TypeError && err.message.includes('Failed to fetch')) ||
            (err instanceof DOMException && err.name === 'AbortError'))
        ) {
          retries++;
          console.log(`[Supabase] Retrying ${errorContext} (${retries}/${maxRetries}) after ${retryDelay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, retryDelay));

          return attemptQuery();
        }

        return null;
      }
    };

    return attemptQuery();
  };

  // Function to fetch database stats (memoized to prevent excessive renders)
  const fetchDatabaseStats = useCallback(async () => {
    // Implement request throttling
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;

    if (timeSinceLastFetch < cooldownPeriod) {
      console.log(
        `[Supabase] Rate limiting API calls (${Math.ceil((cooldownPeriod - timeSinceLastFetch) / 1000)}s remaining)`,
      );
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Mark fetch time at the beginning to ensure proper throttling
      lastFetchTimeRef.current = now;

      const token = await fetchServiceToken(selectedProject.id);

      if (!token) {
        throw new Error('Failed to get service token');
      }

      // Check if we're still connected
      const connectionState = supabaseConnection.get();

      if (!connectionState.isConnected) {
        console.error('[Supabase] Connection lost while fetching data');
        toast.error('Connection to Supabase has been lost. Please reconnect.');
        setError('Connection to Supabase has been lost. Please reconnect.');

        return;
      }

      console.log('[Supabase] Starting data fetch for project:', selectedProject.id);

      // DIRECT TEST QUERY - Try to access test_table directly to debug
      const testTableQuery = 'SELECT COUNT(*) FROM public.test_table';
      const testResult = await executeQuery(token, selectedProject.id, testTableQuery, 'test_table check');
      console.log('[Supabase] Test table check result:', testResult);

      // Simple queries - less likely to fail than a complex query
      const tableCountQuery =
        "SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public' AND table_name NOT LIKE 'pg_%'";
      const rowCountQuery =
        "SELECT COALESCE(SUM(n_live_tup), 0) as count FROM pg_stat_user_tables WHERE schemaname = 'public'";
      const storageQuery = 'SELECT pg_size_pretty(pg_database_size(current_database())) as size';
      const userCountQuery = 'SELECT COUNT(*) as count FROM auth.users';

      // Execute each query separately for better error isolation
      const tableResult = await executeQuery(token, selectedProject.id, tableCountQuery, 'table count');
      console.log('[Supabase] Table count result:', tableResult);

      // If all queries are failing, show a more helpful error
      if (!tableResult) {
        const networkIssueMsg =
          'Network issues connecting to Supabase. Please check your connection or token validity.';
        toast.error(networkIssueMsg);
        setError(networkIssueMsg);
        setIsLoading(false);

        return;
      }

      const rowResult = await executeQuery(token, selectedProject.id, rowCountQuery, 'row count');
      console.log('[Supabase] Row count result:', rowResult);

      const storageResult = await executeQuery(token, selectedProject.id, storageQuery, 'storage');
      console.log('[Supabase] Storage result:', storageResult);

      const userResult = await executeQuery(token, selectedProject.id, userCountQuery, 'user count');
      console.log('[Supabase] User count result:', userResult);

      // Use default values for any query that failed
      const stats = {
        tables: tableResult && tableResult[0]?.count ? tableResult[0].count.toString() : '0',
        rows: rowResult && rowResult[0]?.count ? formatNumber(rowResult[0].count) : '0',
        storage: storageResult && storageResult[0]?.size ? storageResult[0].size : '0 bytes',
        users: userResult && userResult[0]?.count ? userResult[0].count.toString() : '0',
      };

      console.log('[Supabase] Stats compiled:', stats);
      setDatabaseStats(stats);

      // Only fetch table list if we have tables and only once
      if (tableResult && tableResult[0]?.count > 0 && tables.length === 0) {
        await fetchTablesList(token, selectedProject.id);
      }
    } catch (err) {
      console.error('[Supabase] Error fetching database stats:', err);

      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);

      // Show different message based on error type
      if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
        toast.error('Network error connecting to Supabase. Please check your internet connection.');
      } else {
        toast.error(`Error fetching database stats: ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedProject, setDatabaseStats, tables.length]);

  // Helper function to format large numbers
  const formatNumber = (num: number | string): string => {
    const parsedNum = typeof num === 'string' ? parseInt(num, 10) : num;

    if (isNaN(parsedNum)) {
      return '0';
    }

    return new Intl.NumberFormat().format(parsedNum);
  };

  // Separate function to fetch tables list
  const fetchTablesList = async (token: string, projectId: string) => {
    try {
      // Try a simple direct query first
      const testQuery =
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'test_table'";
      const testResult = await executeQuery(token, projectId, testQuery, 'test_table check');
      console.log('[Supabase] Direct test_table check:', testResult);

      // Modified query - more compatible with Supabase
      const tablesQuery = `
        SELECT 
          table_name, 
          table_schema,
          table_type
        FROM 
          information_schema.tables 
        WHERE 
          table_schema = 'public' 
          AND table_name NOT LIKE 'pg_%' 
          AND table_name NOT LIKE '_prisma_%'
        ORDER BY 
          table_name
        LIMIT 20;
      `;

      console.log('[Supabase] Fetching tables with query:', tablesQuery.trim().replace(/\s+/g, ' '));

      const result = await executeQuery(token, projectId, tablesQuery, 'tables list');
      console.log('[Supabase] Raw table results:', JSON.stringify(result));

      if (result) {
        let tablesList: DatabaseTable[] = [];

        if (Array.isArray(result)) {
          // Process array result
          console.log('[Supabase] Found', result.length, 'tables as array');

          tablesList = result.map((table: any) => {
            // Handle different property naming conventions
            return {
              name: table.table_name || table.tableName || table.name,
              schema: table.table_schema || table.tableSchema || table.schema || 'public',
              type: table.table_type || table.tableType || table.type || 'BASE TABLE',
            };
          });
        } else if (typeof result === 'object') {
          // Handle single object result
          console.log('[Supabase] Found table as object');

          tablesList = [
            {
              name: result.table_name || result.tableName || result.name,
              schema: result.table_schema || result.tableSchema || result.schema || 'public',
              type: result.table_type || result.tableType || result.type || 'BASE TABLE',
            },
          ];
        }

        console.log('[Supabase] Processed tables:', tablesList);
        setTables(tablesList);
      } else {
        console.error('[Supabase] No tables found or invalid response format');
        setTables([]);
      }
    } catch (error) {
      console.error('[Supabase] Error fetching tables list:', error);

      // Don't show error for this - just show empty list
      setTables([]);
    }
  };

  // Add console logs for debugging
  useEffect(() => {
    if (selectedProject) {
      console.log('Selected project changed:', selectedProject.id);
      fetchDatabaseStats();
    }

    // Clean up effect
    return () => {
      console.log('DatabaseTable component unmounting');
    };
  }, [selectedProject, fetchDatabaseStats]);

  // Error display
  if (error) {
    return (
      <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
        <div className="flex items-center">
          <span className="mr-2 text-red-500 i-ph:warning-circle"></span>
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
        <div className="mt-2 flex gap-2">
          <button
            onClick={fetchDatabaseStats}
            className="text-xs font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
          >
            Try again
          </button>

          {error.includes('Connection') && (
            <button
              onClick={async () => {
                // Force reconnection flow
                const currentConnection = supabaseConnection.get();

                if (currentConnection.token) {
                  toast.info('Attempting to reconnect to Supabase...');

                  // Start fresh query after reconnection
                  setIsLoading(true);
                  setError(null);

                  try {
                    // Re-authenticate with existing token
                    const response = await fetch('/api/supabase', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        token: currentConnection.token.trim(),
                      }),
                    });

                    if (!response.ok) {
                      throw new Error('Failed to reconnect');
                    }

                    const data = (await response.json()) as SupabaseConnectionResponse;

                    updateSupabaseConnection({
                      user: data.user,
                      token: currentConnection.token,
                      stats: data.stats,
                    });

                    toast.success('Successfully reconnected to Supabase');
                    fetchDatabaseStats();
                  } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Failed to reconnect to Supabase';
                    console.error('[Supabase] Reconnection error:', errorMessage);
                    setError(errorMessage);
                    toast.error(errorMessage);
                  } finally {
                    setIsLoading(false);
                  }
                }
              }}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Reconnect
            </button>
          )}
        </div>
      </div>
    );
  }

  // Tables display
  return (
    <div className="mt-4" data-testid="database-table">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-medium">Database Tables</h3>
        <button
          onClick={fetchDatabaseStats}
          disabled={isLoading}
          className="flex items-center rounded-md bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700 dark:hover:bg-gray-700"
        >
          {isLoading ? (
            <span className="mr-1.5 inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"></span>
          ) : (
            <span className="mr-1.5 i-ph:arrow-clockwise"></span>
          )}
          Refresh
        </button>
      </div>

      {isLoading && tables.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col items-center">
            <div className="mb-2 h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600 dark:border-gray-700 dark:border-t-gray-300"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading tables...</p>
          </div>
        </div>
      ) : tables.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  Table Name
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  Schema
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400"
                >
                  Type
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {tables.map((table, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                    {table.name}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {table.schema}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{table.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">No tables found in this database.</p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              Create a table to get started with your database.
            </p>

            <div className="mt-3">
              <button
                onClick={() => {
                  const sqlQuery = `
CREATE TABLE public.test_table (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert some sample data
INSERT INTO public.test_table (name) VALUES 
  ('Example 1'),
  ('Example 2'),
  ('Example 3');

-- Grant permissions to make sure it's accessible
ALTER TABLE public.test_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous access" ON public.test_table FOR SELECT USING (true);
                  `.trim();

                  // Copy to clipboard
                  navigator.clipboard
                    .writeText(sqlQuery)
                    .then(() => toast.success('SQL copied to clipboard! Paste this in the Supabase SQL Editor.'))
                    .catch((err) => {
                      console.error('Failed to copy SQL:', err);
                      toast.error('Failed to copy SQL to clipboard');
                    });
                }}
                className="text-xs px-2 py-1 bg-[#3ECF8E] text-white rounded-md"
              >
                Copy test_table SQL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Main SupabaseDashboard component
export default function SupabaseDashboard() {
  const connection = useStore(supabaseConnection);
  const [isQueryHistoryExpanded, setIsQueryHistoryExpanded] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [databaseStats, setDatabaseStats] = useState<DatabaseStats>({
    tables: '–',
    rows: '–',
    storage: '–',
    users: '–',
  });
  const [dbKey, setDbKey] = useState(Date.now());

  // Handle refresh of Supabase stats
  const handleRefresh = async () => {
    if (!connection.token) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await fetchSupabaseStats(connection.token);
      setLastRefresh(new Date());
      toast.success('Supabase data refreshed');
    } catch (error: unknown) {
      console.error('Error refreshing Supabase data:', error);
      setError('Failed to refresh Supabase data');
      toast.error('Failed to refresh Supabase data');
    } finally {
      setIsLoading(false);
    }
  };

  // Select a project
  const selectProject = (projectId: string) => {
    updateSupabaseConnection({ selectedProjectId: projectId });
    toast.success('Project selected successfully');
  };

  // Handle token input change
  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateSupabaseConnection({ ...connection, token: e.target.value });
  };

  // Handle connect to Supabase
  const handleConnect = async () => {
    if (!connection.token) {
      toast.error('Please enter your Supabase access token');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('[Supabase] Connecting with token:', connection.token.substring(0, 5) + '...');

      const response = await fetch('/api/supabase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: connection.token.trim(),
        }),
      });

      console.log('[Supabase] Connection response status:', response.status);

      const data = (await response.json()) as SupabaseConnectionResponse;

      if (!response.ok) {
        console.error('[Supabase] Connection error:', data.error);
        throw new Error(data.error || 'Failed to connect');
      }

      console.log('[Supabase] Connection successful, projects found:', data.stats?.projects?.length || 0);

      updateSupabaseConnection({
        user: data.user,
        token: connection.token,
        stats: data.stats,
      });

      toast.success('Successfully connected to Supabase');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to Supabase';
      console.error('[Supabase] Connection error:', errorMessage);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle disconnect from Supabase
  const handleDisconnect = () => {
    updateSupabaseConnection({ user: null, token: '' });
    toast.success('Disconnected from Supabase');
  };

  // Open Supabase dashboard in new tab
  const openSupabaseDashboard = () => {
    if (connection.selectedProjectId) {
      window.open(`https://app.supabase.com/project/${connection.selectedProjectId}`, '_blank');
    } else {
      window.open('https://app.supabase.com', '_blank');
    }
  };

  // Create a new Supabase project
  const handleCreateProject = () => {
    window.open('https://app.supabase.com/new/new-project', '_blank');
  };

  // Handler for clearing error when token changes and refreshing stats on initial load
  useEffect(() => {
    // Clear existing error when token changes
    if (connection.token) {
      setError(null);
    }

    // Refresh stats when component mounts if we have a token and are connected
    if (connection.token && connection.isConnected && !lastRefresh) {
      handleRefresh().catch((e) => {
        console.error('Error during initial refresh:', e);

        // Don't show toast on initial load to avoid error spam
        setError('Could not load Supabase data. Please check your connection.');
      });
    }
  }, [connection.token, connection.isConnected, lastRefresh, handleRefresh]);

  // Handle database stats
  const handleDatabaseStats = useCallback((stats: DatabaseStats) => {
    setDatabaseStats(stats);
  }, []);

  // Helper function to check tables
  const checkTables = async () => {
    console.log('[Supabase] Force checking for tables...');

    if (!connection.selectedProjectId) {
      toast.error('No project selected');
      return;
    }

    // Reset database stats display
    setDatabaseStats({
      tables: '–',
      rows: '–',
      storage: '–',
      users: '–',
    });

    toast.info('Checking connection and test_table...');

    try {
      // Verify connection first
      const connectionState = supabaseConnection.get();

      if (!connectionState.isConnected || !connectionState.token) {
        toast.error('Not connected to Supabase. Please reconnect first.');
        return;
      }

      const token = connectionState.token;

      // Direct query to check if test_table exists
      const query = `
        SELECT EXISTS (
          SELECT 1 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'test_table'
        ) as exists;
      `;

      const response = await fetch('/api/supabase/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId: connection.selectedProjectId,
          query,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Supabase] API error:', errorText);
        toast.error('Error checking for test_table');

        return;
      }

      const data = (await response.json()) as any;
      console.log('[Supabase] Test table check response:', data);

      // Handle different response formats
      let exists = false;

      if (data.result && Array.isArray(data.result) && data.result.length > 0) {
        exists = data.result[0].exists === true || data.result[0].exists === 't';
      } else if (Array.isArray(data) && data.length > 0) {
        exists = data[0].exists === true || data[0].exists === 't';
      }

      if (exists) {
        toast.success('✅ test_table exists in database!');
        console.log('[Supabase] test_table exists, getting data...');

        // Try to count rows in test_table
        const countQuery = 'SELECT COUNT(*) as count FROM public.test_table';
        const countResponse = await fetch('/api/supabase/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            projectId: connection.selectedProjectId,
            query: countQuery,
          }),
        });

        if (countResponse.ok) {
          const countData = (await countResponse.json()) as any;
          console.log('[Supabase] Row count in test_table:', countData);

          let rowCount = '0';

          if (countData.result && Array.isArray(countData.result) && countData.result.length > 0) {
            rowCount = countData.result[0].count;
          } else if (Array.isArray(countData) && countData.length > 0) {
            rowCount = countData[0].count;
          }

          toast.info(`Found ${rowCount} rows in test_table`);
        }

        /*
         * After successful test, refresh all database stats
         * Find the selected project
         */
        const selectedProject = connection.stats?.projects?.find((p) => p.id === connection.selectedProjectId);

        if (selectedProject) {
          // Force update database tables component by creating new key
          setDbKey(Date.now());

          // Fetch full stats including tables
          handleDatabaseStats({
            tables: '–',
            rows: '–',
            storage: '–',
            users: '–',
          });
        }
      } else {
        toast.error('❌ test_table not found in database!');
        console.log('[Supabase] test_table not found');

        // Show SQL to create the table
        toast.info('Try running the CREATE TABLE SQL in Supabase SQL Editor', { autoClose: 8000 });
      }
    } catch (err) {
      console.error('[Supabase] Error checking for test_table:', err);
      toast.error(`Connection error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-2">
          <img
            className="w-5 h-5"
            height="24"
            width="24"
            crossOrigin="anonymous"
            src="https://cdn.simpleicons.org/supabase"
          />
          <h2 className="text-lg font-medium text-bolt-elements-textPrimary">Supabase Dashboard</h2>
        </div>

        <div className="flex items-center gap-2">
          {connection.isConnected && (
            <>
              <button
                onClick={handleRefresh}
                className="px-2 py-1 text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary flex items-center gap-1"
              >
                <div className="i-ph:arrow-clockwise w-4 h-4" />
                Refresh
              </button>
              <button
                onClick={openSupabaseDashboard}
                className="px-2 py-1 text-xs text-[#3ECF8E] hover:text-[#3BBF84] flex items-center gap-1"
              >
                <div className="i-ph:arrow-square-out w-4 h-4" />
                Open Dashboard
              </button>
            </>
          )}
        </div>
      </motion.div>

      {/* Connection Status */}
      <motion.div
        className="bg-white dark:bg-[#0A0A0A] rounded-lg border border-[#E5E5E5] dark:border-[#1A1A1A] p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {!connection.isConnected ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium text-bolt-elements-textPrimary">Connect to Supabase</h3>
              <div className="px-2 py-1 text-xs text-bolt-elements-textSecondary bg-[#F0F0F0] dark:bg-[#1A1A1A] rounded-md">
                Not Connected
              </div>
            </div>

            <div>
              <label className="block text-sm text-bolt-elements-textSecondary mb-2">Access Token</label>
              <input
                type="password"
                value={connection.token}
                onChange={handleTokenChange}
                placeholder="Enter your Supabase access token"
                className={classNames(
                  'w-full px-3 py-2 rounded-lg text-sm',
                  'bg-[#F8F8F8] dark:bg-[#1A1A1A]',
                  'border border-[#E5E5E5] dark:border-[#333333]',
                  'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                  'focus:outline-none focus:ring-1 focus:ring-[#3ECF8E]',
                  error ? 'border-red-400 dark:border-red-600' : '',
                )}
              />
              {error && <div className="mt-2 text-sm text-red-500">{error}</div>}
              <div className="mt-2 text-sm text-bolt-elements-textSecondary">
                <a
                  href="https://app.supabase.com/account/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#3ECF8E] hover:underline inline-flex items-center gap-1"
                >
                  Get your token
                  <div className="i-ph:arrow-square-out w-4 h-4" />
                </a>
              </div>
            </div>

            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={handleConnect}
                disabled={!connection.token || isLoading}
                className={classNames(
                  'px-4 py-2 rounded-lg text-sm flex items-center gap-2',
                  'bg-[#3ECF8E] text-white',
                  'hover:bg-[#3BBF84]',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                {isLoading ? (
                  <>
                    <div className="i-ph:circle-notch w-4 h-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <div className="i-ph:plug-charging w-4 h-4" />
                    Connect
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-medium text-bolt-elements-textPrimary">Connection Status</h3>
                <div className="px-2 py-1 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-md flex items-center gap-1">
                  <div className="i-ph:check-circle w-3 h-3" />
                  Connected
                </div>
              </div>

              <button
                onClick={handleDisconnect}
                className={classNames(
                  'px-3 py-1 rounded-lg text-xs flex items-center gap-2',
                  'text-red-500 border border-red-200 dark:border-red-900/30',
                  'hover:bg-red-50 dark:hover:bg-red-900/20',
                )}
              >
                <div className="i-ph:plug-x w-3 h-3" />
                Disconnect
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#3ECF8E] flex items-center justify-center">
                <div className="text-white font-medium">{connection.user?.email?.charAt(0)?.toUpperCase() || 'U'}</div>
              </div>
              <div>
                <p className="text-sm font-medium text-bolt-elements-textPrimary">{connection.user?.email || 'User'}</p>
                <p className="text-xs text-bolt-elements-textSecondary">Role: {connection.user?.role || 'User'}</p>
              </div>
            </div>

            {lastRefresh && (
              <div className="text-xs text-bolt-elements-textTertiary">
                Last refreshed: {lastRefresh.toLocaleTimeString()}
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Project Selection */}
      {connection.isConnected && (
        <motion.div
          className="bg-white dark:bg-[#0A0A0A] rounded-lg border border-[#E5E5E5] dark:border-[#1A1A1A] p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-medium text-bolt-elements-textPrimary">Projects</h3>
            <div className="flex items-center gap-2">
              {isLoading && (
                <div className="px-2 py-1 text-xs text-bolt-elements-textSecondary flex items-center gap-1">
                  <div className="i-ph:circle-notch w-3 h-3 animate-spin" />
                  Loading...
                </div>
              )}
              <button
                onClick={handleCreateProject}
                className="px-3 py-1 rounded-lg text-xs flex items-center gap-1 bg-[#3ECF8E] text-white hover:bg-[#3BBF84]"
              >
                <div className="i-ph:plus w-3 h-3" />
                New Project
              </button>
            </div>
          </div>

          {Array.isArray(connection.stats?.projects) && connection.stats.projects.length > 0 ? (
            <div className="grid gap-3">
              {connection.stats.projects.map((project: any) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  isSelected={connection.selectedProjectId === project.id}
                  onSelect={selectProject}
                />
              ))}
            </div>
          ) : (
            <div className="py-4 text-sm text-bolt-elements-textSecondary flex items-center justify-center gap-2">
              <div className="i-ph:info w-4 h-4" />
              {isLoading ? 'Loading projects...' : 'No projects found'}
            </div>
          )}
        </motion.div>
      )}

      {/* Stats Dashboard - Only show if connected and a project is selected */}
      {connection.isConnected && connection.selectedProjectId && (
        <motion.div
          className="bg-white dark:bg-[#0A0A0A] rounded-lg border border-[#E5E5E5] dark:border-[#1A1A1A] p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-medium text-bolt-elements-textPrimary">Database Dashboard</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={checkTables}
                className="px-2 py-1 text-xs flex items-center gap-1 bg-blue-500 text-white rounded-md"
              >
                <span className="i-ph:arrow-clockwise"></span>
                Check Tables
              </button>
              <div className="px-2 py-1 text-xs text-[#3ECF8E] bg-[#3ECF8E]/5 dark:bg-[#3ECF8E]/10 rounded-md">
                {connection.project?.name || 'Current Project'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <StatsCard title="Tables" value={databaseStats.tables} icon="i-ph:table" color="bg-purple-500" />
            <StatsCard title="Rows" value={databaseStats.rows} icon="i-ph:rows" color="bg-blue-500" />
            <StatsCard title="Storage" value={databaseStats.storage} icon="i-ph:hard-drive" color="bg-amber-500" />
            <StatsCard title="Auth Users" value={databaseStats.users} icon="i-ph:users" color="bg-emerald-500" />
          </div>

          {/* Database Tables */}
          <div className="space-y-4 border-t border-[#E5E5E5] dark:border-[#1A1A1A] pt-4 mt-2">
            <DatabaseTable
              key={dbKey}
              selectedProject={{
                id: connection.selectedProjectId,
                name: connection.project?.name || 'Unknown Project',
                organization: { name: 'Your Organization' },
                region: connection.project?.region || 'unknown',
              }}
              setDatabaseStats={handleDatabaseStats}
            />
          </div>

          <div className="space-y-2 mt-6">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-bolt-elements-textPrimary">Recent Operations</h4>
              <button
                onClick={() => setIsQueryHistoryExpanded(!isQueryHistoryExpanded)}
                className="text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary flex items-center gap-1"
              >
                {isQueryHistoryExpanded ? 'Collapse' : 'Expand'}
                <div
                  className={classNames(
                    'w-3 h-3 transition-transform',
                    isQueryHistoryExpanded ? 'i-ph:caret-up' : 'i-ph:caret-down',
                  )}
                />
              </button>
            </div>

            {isQueryHistoryExpanded && (
              <div className="border border-[#E5E5E5] dark:border-[#1A1A1A] rounded-lg p-3 bg-[#F8F8F8] dark:bg-[#0D0D0D]">
                <div className="text-xs text-bolt-elements-textSecondary text-center py-2">
                  No recent operations found
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
