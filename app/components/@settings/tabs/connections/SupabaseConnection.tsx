import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { logStore } from '~/lib/stores/logs';
import { classNames } from '~/utils/classNames';
import {
  supabaseConnection,
  isConnecting,
  isFetchingStats,
  updateSupabaseConnection,
  fetchSupabaseStats,
} from '~/lib/stores/supabase';
import { Button } from '~/components/ui/Button';

// Supabase logo SVG component
const SupabaseLogo = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path
      d="M21.362 9.354H12V.396a.396.396 0 0 0-.716-.233L2.203 12.424l-.401.562a1.04 1.04 0 0 0 .836 1.659H12v8.959a.396.396 0 0 0 .716.233l9.081-12.261.401-.562a1.04 1.04 0 0 0-.836-1.66z"
      fill="currentColor"
    />
  </svg>
);

export default function SupabaseConnection() {
  const connection = useStore(supabaseConnection);
  const connecting = useStore(isConnecting);
  const fetchingStats = useStore(isFetchingStats);
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(false);
  const selectProject = (projectId: string) => {
    updateSupabaseConnection({ selectedProjectId: projectId });
    toast.success('Project selected successfully');
  };

  useEffect(() => {
    const savedConnection = localStorage.getItem('supabase_connection');

    if (savedConnection) {
      try {
        const parsed = JSON.parse(savedConnection);
        updateSupabaseConnection(parsed);

        // Fetch stats if we have a token
        if (parsed.token) {
          fetchSupabaseStats(parsed.token).catch(console.error);
        }
      } catch (error) {
        console.error('Error parsing saved Supabase connection:', error);
        localStorage.removeItem('supabase_connection');
      }
    }
  }, []);

  const handleConnect = async (event: React.FormEvent) => {
    event.preventDefault();
    isConnecting.set(true);

    try {
      const cleanToken = connection.token.trim();

      const response = await fetch('/api/supabase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: cleanToken,
        }),
      });

      const data = (await response.json()) as any;

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect');
      }

      updateSupabaseConnection({
        user: data.user,
        token: connection.token,
        stats: data.stats,
      });

      toast.success('Successfully connected to Supabase');
    } catch (error) {
      console.error('Connection error:', error);
      logStore.logError('Failed to authenticate with Supabase', { error });
      toast.error(error instanceof Error ? error.message : 'Failed to connect to Supabase');
      updateSupabaseConnection({ user: null, token: '' });
    } finally {
      isConnecting.set(false);
    }
  };

  const handleDisconnect = () => {
    updateSupabaseConnection({ user: null, token: '' });
    toast.success('Disconnected from Supabase');
  };

  return (
    <div className="space-y-6 bg-bolt-elements-background dark:bg-bolt-elements-background border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor rounded-lg">
      <motion.div
        className="flex items-center justify-between gap-2 p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {!connection.user ? (
          <>
            <div className="flex items-center gap-2">
              <div className="text-[#3ECF8E]">
                <SupabaseLogo />
              </div>
              <h2 className="text-lg font-medium text-bolt-elements-textPrimary">Supabase Connection</h2>
            </div>
            <Button
              onClick={handleConnect}
              variant="outline"
              className="flex items-center gap-2"
              disabled={connecting || !connection.token}
            >
              {connecting ? (
                <>
                  <div className="i-ph:spinner-gap w-4 h-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <div className="i-ph:plug-charging w-4 h-4" />
                  Connect
                </>
              )}
            </Button>
          </>
        ) : (
          <div className="flex flex-col w-full gap-4">
            <div className="flex items-center gap-2">
              <div className="text-[#3ECF8E]">
                <SupabaseLogo />
              </div>
              <h2 className="text-lg font-medium text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary">
                Supabase Connection
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleDisconnect} variant="destructive" className="flex items-center gap-2">
                <div className="i-ph:sign-out w-4 h-4" />
                Disconnect
              </Button>

              <div className="flex items-center gap-2">
                <div className="i-ph:check-circle w-4 h-4 text-green-500" />
                <span className="text-sm text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary">
                  Connected to Supabase
                </span>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <Button
                  variant="outline"
                  onClick={() => window.open('https://app.supabase.com', '_blank', 'noopener,noreferrer')}
                  className="flex items-center gap-2 hover:bg-bolt-elements-item-backgroundActive/10 hover:text-bolt-elements-textPrimary dark:hover:text-bolt-elements-textPrimary transition-colors"
                >
                  <div className="i-ph:layout-dashboard w-4 h-4" />
                  Dashboard
                </Button>
                <Button
                  onClick={() => fetchSupabaseStats(connection.token)}
                  disabled={fetchingStats}
                  variant="outline"
                  className="flex items-center gap-2 hover:bg-bolt-elements-item-backgroundActive/10 hover:text-bolt-elements-textPrimary dark:hover:text-bolt-elements-textPrimary transition-colors"
                >
                  {fetchingStats ? (
                    <>
                      <div className="i-ph:spinner-gap w-4 h-4 animate-spin" />
                      <span>Refreshing...</span>
                    </>
                  ) : (
                    <>
                      <div className="i-ph:arrows-clockwise w-4 h-4" />
                      <span>Refresh Stats</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {!connection.user ? (
        <div className="p-6">
          <label className="block text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary mb-2">
            API Token
          </label>
          <input
            type="password"
            value={connection.token || ''}
            onChange={(e) => updateSupabaseConnection({ ...connection, token: e.target.value })}
            placeholder="Enter your Supabase API token"
            className={classNames(
              'w-full px-3 py-2 rounded-lg text-sm',
              'bg-bolt-elements-background-depth-1 dark:bg-bolt-elements-background-depth-2',
              'border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor',
              'text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary dark:placeholder-bolt-elements-textTertiary',
              'focus:outline-none focus:ring-1 focus:ring-bolt-elements-item-contentAccent dark:focus:ring-bolt-elements-item-contentAccent',
            )}
          />
          <div className="mt-2 text-sm text-bolt-elements-textSecondary dark:text-bolt-elements-textSecondary">
            <a
              href="https://app.supabase.com/account/tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="text-bolt-elements-link-text dark:text-bolt-elements-link-text hover:text-bolt-elements-link-textHover dark:hover:text-bolt-elements-link-textHover flex items-center gap-1"
            >
              <div className="i-ph:key w-4 h-4" />
              Get your token
              <div className="i-ph:arrow-square-out w-3 h-3" />
            </a>
          </div>
        </div>
      ) : (
        <div className="space-y-6 p-6">
          {connection.user && (
            <div className="flex items-center gap-4 p-4 bg-bolt-elements-background-depth-1 dark:bg-bolt-elements-background-depth-2 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-bolt-elements-item-contentAccent flex items-center justify-center text-white text-lg font-medium">
                {connection.user.email?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div>
                <h4 className="text-sm font-medium text-bolt-elements-textPrimary">
                  {connection.user.email || 'User'}
                </h4>
                <p className="text-sm text-bolt-elements-textSecondary">Role: {connection.user.role || 'User'}</p>
              </div>
            </div>
          )}

          {fetchingStats ? (
            <div className="flex items-center gap-2 text-sm text-bolt-elements-textSecondary">
              <div className="i-ph:spinner-gap w-4 h-4 animate-spin" />
              Fetching Supabase projects...
            </div>
          ) : (
            connection.stats?.projects &&
            connection.stats.projects.length > 0 && (
              <div>
                <div
                  className="flex items-center justify-between p-4 rounded-lg bg-bolt-elements-background dark:bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive/70 dark:hover:border-bolt-elements-borderColorActive/70 transition-all duration-200 mb-4 cursor-pointer"
                  onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
                >
                  <div className="flex items-center gap-2">
                    <div className="i-ph:database w-4 h-4 text-bolt-elements-item-contentAccent dark:text-bolt-elements-item-contentAccent" />
                    <span className="text-sm font-medium text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary">
                      Your Projects ({connection.stats?.totalProjects || 0})
                    </span>
                  </div>
                  <div
                    className={classNames(
                      'i-ph:caret-down w-4 h-4 transform transition-transform duration-200 text-bolt-elements-textSecondary',
                      isProjectsExpanded ? 'rotate-180' : '',
                    )}
                  />
                </div>

                {isProjectsExpanded && (
                  <div className="space-y-3">
                    {connection.stats.projects.map((project) => (
                      <div
                        key={project.id}
                        className={classNames(
                          'bg-bolt-elements-background dark:bg-bolt-elements-background-depth-1 border rounded-lg p-4 transition-all',
                          connection.selectedProjectId === project.id
                            ? 'border-bolt-elements-item-contentAccent bg-bolt-elements-item-backgroundActive/10'
                            : 'border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive/70',
                        )}
                        onClick={() => selectProject(project.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="i-ph:database w-5 h-5 text-bolt-elements-item-contentAccent dark:text-bolt-elements-item-contentAccent" />
                            <span className="font-medium text-bolt-elements-textPrimary dark:text-bolt-elements-textPrimary">
                              {project.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-xs flex items-center gap-1 px-2 py-1 rounded-md bg-bolt-elements-background-depth-1 text-bolt-elements-textSecondary">
                              <div className="i-ph:map-pin w-3 h-3" />
                              {project.region}
                            </div>
                            {connection.selectedProjectId === project.id && (
                              <div className="text-xs flex items-center gap-1 px-2 py-1 rounded-md bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text">
                                <div className="i-ph:check w-3 h-3" />
                                Selected
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          )}

          {connection.stats?.totalProjects === 0 && (
            <div className="text-center p-4 border border-bolt-elements-borderColor rounded-lg bg-bolt-elements-background-depth-1 dark:bg-bolt-elements-background-depth-2">
              <p className="text-sm text-bolt-elements-textSecondary mb-2">No projects found</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('https://app.supabase.com/new/new-project', '_blank', 'noopener,noreferrer')}
                className="text-xs flex items-center gap-1"
              >
                <div className="i-ph:plus w-3 h-3" />
                Create a new project
                <div className="i-ph:arrow-square-out w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
