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
    <motion.div
      className="bg-bolt-elements-background rounded-lg border border-bolt-elements-border"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              className="w-5 h-5"
              height="24"
              width="24"
              crossOrigin="anonymous"
              src="https://cdn.simpleicons.org/supabase"
            />
            <h3 className="text-base font-medium text-bolt-elements-textPrimary">Supabase Connection</h3>
          </div>
        </div>

        {!connection.user ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-bolt-elements-textSecondary mb-2">Access Token</label>
              <input
                type="password"
                value={connection.token || ''}
                onChange={(e) => updateSupabaseConnection({ ...connection, token: e.target.value })}
                disabled={connecting}
                placeholder="Enter your Supabase access token"
                className={classNames(
                  'w-full px-3 py-2 rounded-lg text-sm',
                  'bg-bolt-elements-background-depth-1 dark:bg-bolt-elements-background-depth-2',
                  'border border-bolt-elements-border',
                  'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                  'focus:outline-none focus:ring-1 focus:ring-bolt-elements-button-primary-text',
                  'disabled:opacity-50',
                )}
              />
              <div className="mt-2 text-sm text-bolt-elements-textSecondary">
                <a
                  href="https://app.supabase.com/account/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-bolt-elements-button-primary-text hover:underline inline-flex items-center gap-1"
                >
                  Get your token
                  <div className="i-ph:arrow-square-out w-4 h-4" />
                </a>
              </div>
            </div>

            <button
              onClick={handleConnect}
              disabled={connecting || !connection.token}
              className={classNames(
                'px-4 py-2 rounded-lg text-sm flex items-center gap-2',
                'bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text',
                'hover:bg-bolt-elements-button-primary-backgroundHover',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {connecting ? (
                <>
                  <div className="i-ph:spinner-gap animate-spin" />
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
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDisconnect}
                  className={classNames(
                    'px-4 py-2 rounded-lg text-sm flex items-center gap-2',
                    'bg-bolt-elements-button-danger-background text-bolt-elements-button-danger-text',
                    'hover:bg-bolt-elements-button-danger-backgroundHover',
                  )}
                >
                  <div className="i-ph:plug-x w-4 h-4" />
                  Disconnect
                </button>
                <span className="text-sm text-bolt-elements-textSecondary flex items-center gap-1">
                  <div className="i-ph:check-circle w-4 h-4 text-bolt-elements-button-success-text" />
                  Connected to Supabase
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-bolt-elements-background-depth-1 dark:bg-bolt-elements-background-depth-2 rounded-lg">
              <div>
                <h4 className="text-sm font-medium text-bolt-elements-textPrimary">
                  {connection.user?.email || 'User'}
                </h4>
                <p className="text-sm text-bolt-elements-textSecondary">Role: {connection.user?.role || 'User'}</p>
              </div>
            </div>

            {fetchingStats ? (
              <div className="flex items-center gap-2 text-sm text-bolt-elements-textSecondary">
                <div className="i-ph:spinner-gap w-4 h-4 animate-spin" />
                Fetching Supabase projects...
              </div>
            ) : (
              <div>
                <button
                  onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
                  className="w-full bg-transparent text-left text-sm font-medium text-bolt-elements-textPrimary mb-3 flex items-center gap-2"
                >
                  <div className="i-ph:database w-4 h-4" />
                  Your Projects ({connection.stats?.totalProjects || 0})
                  <div
                    className={classNames(
                      'i-ph:caret-down w-4 h-4 ml-auto transition-transform',
                      isProjectsExpanded ? 'rotate-180' : '',
                    )}
                  />
                </button>

                {isProjectsExpanded && connection.stats?.projects?.length ? (
                  <div className="grid gap-3">
                    {connection.stats.projects.map((project) => (
                      <div
                        key={project.id}
                        className="block p-4 rounded-lg border border-bolt-elements-border hover:border-bolt-elements-button-primary-text dark:hover:border-bolt-elements-button-primary-text transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="text-sm font-medium text-bolt-elements-textPrimary flex items-center gap-2">
                              <div className="i-ph:database w-4 h-4 text-bolt-elements-button-primary-text" />
                              {project.name}
                            </h5>
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
                            <div className="text-xs text-bolt-elements-textSecondary px-2 py-1 rounded-md bg-bolt-elements-background-depth-1 dark:bg-bolt-elements-background-depth-2">
                              <span className="flex items-center gap-1">
                                <div className="i-ph:circle-wavy-check w-3 h-3" />
                                {project.status}
                              </span>
                            </div>
                            <button
                              onClick={() => selectProject(project.id)}
                              className={classNames(
                                'px-3 py-1 rounded-md text-xs',
                                connection.selectedProjectId === project.id
                                  ? 'bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text'
                                  : 'bg-bolt-elements-background-depth-1 dark:bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-button-primary-background hover:text-bolt-elements-button-primary-text',
                              )}
                            >
                              {connection.selectedProjectId === project.id ? (
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
                    ))}
                  </div>
                ) : (
                  connection.stats?.totalProjects === 0 && (
                    <div className="text-center p-4 border border-bolt-elements-border rounded-lg bg-bolt-elements-background-depth-1 dark:bg-bolt-elements-background-depth-2">
                      <p className="text-sm text-bolt-elements-textSecondary mb-2">No projects found</p>
                      <a
                        href="https://app.supabase.com/new/new-project"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-bolt-elements-button-primary-text hover:underline inline-flex items-center gap-1"
                      >
                        Create a new project
                        <div className="i-ph:arrow-square-out w-3 h-3" />
                      </a>
                    </div>
                  )
                )}
              </div>
            )}

            <div className="text-xs text-bolt-elements-textTertiary mt-4">
              <div className="flex items-center gap-2">
                <div className="i-ph:info w-3 h-3" />
                <span>
                  Select a project to access the{' '}
                  <span className="text-bolt-elements-button-primary-text font-medium">Supabase Dashboard</span> in
                  settings.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
