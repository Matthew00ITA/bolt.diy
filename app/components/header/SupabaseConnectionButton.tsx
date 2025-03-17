import { useEffect, useRef } from 'react';
import { useSupabaseConnection } from '~/lib/hooks/useSupabaseConnection';
import { classNames } from '~/utils/classNames';
import { useStore } from '@nanostores/react';
import { chatId } from '~/lib/persistence/useChatHistory';
import { fetchSupabaseStats } from '~/lib/stores/supabase';

export function SupabaseConnectionButton() {
  const supabaseDropdownRef = useRef<HTMLDivElement>(null);
  const {
    connection: supabaseConn,
    connecting,
    fetchingStats,
    isProjectsExpanded,
    setIsProjectsExpanded,
    isDropdownOpen,
    setIsDropdownOpen,
    handleConnect,
    handleDisconnect,
    selectProject,
    handleCreateProject,
    updateToken,
    isConnected,
    buttonLabel,
  } = useSupabaseConnection();

  const currentChatId = useStore(chatId);

  // Load the selected project from localStorage when connected or chat changes
  useEffect(() => {
    if (isConnected && currentChatId) {
      const savedProjectId = localStorage.getItem(`supabase-project-${currentChatId}`);

      if (savedProjectId && savedProjectId !== supabaseConn.selectedProjectId) {
        selectProject(savedProjectId);
      } else if (!savedProjectId && supabaseConn.selectedProjectId) {
        selectProject('');
      }
    }
  }, [isConnected, currentChatId]);

  useEffect(() => {
    if (currentChatId && supabaseConn.selectedProjectId) {
      localStorage.setItem(`supabase-project-${currentChatId}`, supabaseConn.selectedProjectId);
    } else if (currentChatId && !supabaseConn.selectedProjectId) {
      localStorage.removeItem(`supabase-project-${currentChatId}`);
    }
  }, [currentChatId, supabaseConn.selectedProjectId]);

  useEffect(() => {
    if (isConnected && supabaseConn.token) {
      fetchSupabaseStats(supabaseConn.token).catch(console.error);
    }
  }, [isConnected, supabaseConn.token]);

  return (
    <div className="relative" ref={supabaseDropdownRef}>
      <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden mr-2 text-sm">
        <Button
          active
          disabled={connecting}
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="px-4 hover:bg-bolt-elements-item-backgroundActive flex items-center gap-2"
        >
          <img
            className="w-4 h-4 mr-1"
            height="20"
            width="20"
            crossOrigin="anonymous"
            src="https://cdn.simpleicons.org/supabase"
          />
          {buttonLabel}
          <div
            className={classNames('i-ph:caret-down w-4 h-4 transition-transform', isDropdownOpen ? 'rotate-180' : '')}
          />
        </Button>
      </div>

      {isDropdownOpen && (
        <div className="absolute right-0 flex flex-col gap-1 z-50 p-4 mt-1 min-w-[20rem] bg-bolt-elements-background-depth-2 rounded-md shadow-lg bg-bolt-elements-backgroundDefault border border-bolt-elements-borderColor">
          {!isConnected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <img
                  className="w-5 h-5"
                  height="24"
                  width="24"
                  crossOrigin="anonymous"
                  src="https://cdn.simpleicons.org/supabase"
                />
                <h3 className="text-base font-medium text-bolt-elements-textPrimary">Connect to Supabase</h3>
              </div>

              <div>
                <label className="block text-sm text-bolt-elements-textSecondary mb-2">Access Token</label>
                <input
                  type="password"
                  value={supabaseConn.token}
                  onChange={(e) => updateToken(e.target.value)}
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
                disabled={connecting || !supabaseConn.token}
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
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
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
                <button
                  onClick={handleDisconnect}
                  className={classNames(
                    'px-3 py-1 rounded-lg text-xs flex items-center gap-1',
                    'bg-red-500 text-white',
                    'hover:bg-red-600',
                  )}
                >
                  <div className="i-ph:plug-x w-3 h-3" />
                  Disconnect
                </button>
              </div>

              <div className="flex items-center gap-4 p-3 bg-[#F8F8F8] dark:bg-[#1A1A1A] rounded-lg">
                <div>
                  <h4 className="text-sm font-medium text-bolt-elements-textPrimary">{supabaseConn.user?.email}</h4>
                  <p className="text-xs text-bolt-elements-textSecondary">Role: {supabaseConn.user?.role}</p>
                </div>
              </div>

              {fetchingStats ? (
                <div className="flex items-center gap-2 text-sm text-bolt-elements-textSecondary">
                  <div className="i-ph:spinner-gap w-4 h-4 animate-spin" />
                  Fetching projects...
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
                      className="bg-transparent text-left text-sm font-medium text-bolt-elements-textPrimary flex items-center gap-2"
                    >
                      <div className="i-ph:database w-4 h-4" />
                      Your Projects ({supabaseConn.stats?.totalProjects || 0})
                      <div
                        className={classNames(
                          'i-ph:caret-down w-4 h-4 transition-transform',
                          isProjectsExpanded ? 'rotate-180' : '',
                        )}
                      />
                    </button>
                    <button
                      onClick={() => handleCreateProject()}
                      className="px-2 py-1 rounded-md text-xs bg-[#3ECF8E] text-white hover:bg-[#3BBF84] flex items-center gap-1"
                    >
                      <div className="i-ph:plus w-3 h-3" />
                      New Project
                    </button>
                  </div>

                  {isProjectsExpanded && (
                    <>
                      {!supabaseConn.selectedProjectId && (
                        <div className="mb-2 p-3 bg-[#F8F8F8] dark:bg-[#1A1A1A] rounded-lg text-sm text-bolt-elements-textSecondary">
                          Select a project or create a new one for this chat
                        </div>
                      )}

                      {supabaseConn.stats?.projects?.length ? (
                        <div className="grid gap-2 max-h-60 overflow-y-auto">
                          {supabaseConn.stats.projects.map((project) => (
                            <div
                              key={project.id}
                              className="block p-3 rounded-lg border border-[#E5E5E5] dark:border-[#1A1A1A] hover:border-[#3ECF8E] dark:hover:border-[#3ECF8E] transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <h5 className="text-sm font-medium text-bolt-elements-textPrimary flex items-center gap-1">
                                    <div className="i-ph:database w-3 h-3 text-[#3ECF8E]" />
                                    {project.name}
                                  </h5>
                                  <div className="text-xs text-bolt-elements-textSecondary mt-1">{project.region}</div>
                                </div>
                                <button
                                  onClick={() => selectProject(project.id)}
                                  className={classNames(
                                    'px-3 py-1 rounded-md text-xs',
                                    supabaseConn.selectedProjectId === project.id
                                      ? 'bg-[#3ECF8E] text-white'
                                      : 'bg-[#F0F0F0] dark:bg-[#252525] text-bolt-elements-textSecondary hover:bg-[#3ECF8E] hover:text-white',
                                  )}
                                >
                                  {supabaseConn.selectedProjectId === project.id ? (
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
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-bolt-elements-textSecondary flex items-center gap-2">
                          <div className="i-ph:info w-4 h-4" />
                          No projects found
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ButtonProps {
  active?: boolean;
  disabled?: boolean;
  children?: any;
  onClick?: VoidFunction;
  className?: string;
}

function Button({ active = false, disabled = false, children, onClick, className }: ButtonProps) {
  return (
    <button
      className={classNames(
        'flex items-center p-1.5',
        {
          'bg-bolt-elements-item-backgroundDefault hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary':
            !active,
          'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent': active && !disabled,
          'bg-bolt-elements-item-backgroundDefault text-alpha-gray-20 dark:text-alpha-white-20 cursor-not-allowed':
            disabled,
        },
        className,
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
