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

export function SupabaseConnection() {
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
      const parsed = JSON.parse(savedConnection);
      updateSupabaseConnection(parsed);

      // Fetch stats if we have a token
      if (parsed.token) {
        fetchSupabaseStats(parsed.token).catch(console.error);
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
      className="bg-[#FFFFFF] dark:bg-[#0A0A0A] rounded-lg border border-[#E5E5E5] dark:border-[#1A1A1A]"
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
                value={connection.token}
                onChange={(e) => updateSupabaseConnection({ ...connection, token: e.target.value })}
                disabled={connecting}
                placeholder="Enter your Supabase access token"
                className={classNames(
                  'w-full px-3 py-2 rounded-lg text-sm',
                  'bg-[#F8F8F8] dark:bg-[#1A1A1A]',
                  'border border-[#E5E5E5] dark:border-[#333333]',
                  'text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary',
                  'focus:outline-none focus:ring-1 focus:ring-[#3ECF8E]',
                  'disabled:opacity-50',
                )}
              />
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

            <button
              onClick={handleConnect}
              disabled={connecting || !connection.token}
              className={classNames(
                'px-4 py-2 rounded-lg text-sm flex items-center gap-2',
                'bg-[#3ECF8E] text-white',
                'hover:bg-[#3BBF84]',
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
                    'bg-red-500 text-white',
                    'hover:bg-red-600',
                  )}
                >
                  <div className="i-ph:plug-x w-4 h-4" />
                  Disconnect
                </button>
                <span className="text-sm text-bolt-elements-textSecondary flex items-center gap-1">
                  <div className="i-ph:check-circle w-4 h-4 text-green-500" />
                  Connected to Supabase
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-[#F8F8F8] dark:bg-[#1A1A1A] rounded-lg">
              <div>
                <h4 className="text-sm font-medium text-bolt-elements-textPrimary">{connection.user.email}</h4>
                <p className="text-sm text-bolt-elements-textSecondary">Role: {connection.user.role}</p>
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
                        className="block p-4 rounded-lg border border-[#E5E5E5] dark:border-[#1A1A1A] hover:border-[#3ECF8E] dark:hover:border-[#3ECF8E] transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="text-sm font-medium text-bolt-elements-textPrimary flex items-center gap-2">
                              <div className="i-ph:database w-4 h-4 text-[#3ECF8E]" />
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
                            <div className="text-xs text-bolt-elements-textSecondary px-2 py-1 rounded-md bg-[#F0F0F0] dark:bg-[#252525]">
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
                                  ? 'bg-[#3ECF8E] text-white'
                                  : 'bg-[#F0F0F0] dark:bg-[#252525] text-bolt-elements-textSecondary hover:bg-[#3ECF8E] hover:text-white',
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
                ) : isProjectsExpanded ? (
                  <div className="text-sm text-bolt-elements-textSecondary flex items-center gap-2">
                    <div className="i-ph:info w-4 h-4" />
                    No projects found in your Supabase account
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
