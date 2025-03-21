import { useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { netlifyConnection } from '~/lib/stores/netlify';
import { workbenchStore } from '~/lib/stores/workbench';
import { streamingState } from '~/lib/stores/streaming';
import { classNames } from '~/utils/classNames';
import { NetlifyDeploymentLink } from '~/components/chat/NetlifyDeploymentLink.client';
import { handleNetlifyDeploy } from '~/utils/deployment';
import { chatId } from '~/lib/persistence/useChatHistory';
import { toast } from 'react-toastify';

export function DeploymentButton() {
  const connection = useStore(netlifyConnection);
  const [activePreviewIndex] = useState(0);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];
  const [isDeploying, setIsDeploying] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isStreaming = useStore(streamingState);
  const currentChatId = useStore(chatId);

  const handleDeploy = async () => {
    if (!connection.user || !connection.token) {
      toast.error('Please connect to Netlify first in the settings tab!');
      return;
    }

    if (!currentChatId) {
      toast.error('No active chat found');
      return;
    }

    try {
      await handleNetlifyDeploy({
        token: connection.token,
        chatId: currentChatId,
        setIsDeploying,
      });
      setIsDropdownOpen(false);
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden mr-2 text-sm">
        <Button
          active
          disabled={isDeploying || !activePreview || isStreaming}
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="px-4 hover:bg-bolt-elements-item-backgroundActive flex items-center gap-2"
        >
          {isDeploying ? 'Deploying...' : 'Deploy'}
          <div
            className={classNames('i-ph:caret-down w-4 h-4 transition-transform', isDropdownOpen ? 'rotate-180' : '')}
          />
        </Button>
      </div>

      {isDropdownOpen && (
        <div className="absolute right-2 flex flex-col gap-1 z-50 p-1 mt-1 min-w-[13.5rem] bg-bolt-elements-background-depth-2 rounded-md shadow-lg bg-bolt-elements-backgroundDefault border border-bolt-elements-borderColor">
          <Button
            onClick={() => {
              handleDeploy();
              setIsDropdownOpen(false);
            }}
            disabled={isDeploying || !activePreview || !connection.user}
            className="flex items-center w-full px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive gap-2 rounded-md group relative"
          >
            <img
              className="w-5 h-5"
              height="24"
              width="24"
              crossOrigin="anonymous"
              src="https://cdn.simpleicons.org/netlify"
            />
            <span className="mx-auto">{!connection.user ? 'No Account Connected' : 'Deploy to Netlify'}</span>
            {connection.user && <NetlifyDeploymentLink />}
          </Button>
          <Button
            disabled
            className="flex items-center w-full rounded-md px-4 py-2 text-sm text-bolt-elements-textTertiary gap-2"
          >
            <span className="sr-only">Coming Soon</span>
            <img
              className="w-5 h-5 bg-black p-1 rounded"
              height="24"
              width="24"
              crossOrigin="anonymous"
              src="https://cdn.simpleicons.org/vercel/white"
              alt="vercel"
            />
            <span className="mx-auto">Deploy to Vercel (Coming Soon)</span>
          </Button>
          <Button
            disabled
            className="flex items-center w-full rounded-md px-4 py-2 text-sm text-bolt-elements-textTertiary gap-2"
          >
            <span className="sr-only">Coming Soon</span>
            <img
              className="w-5 h-5"
              height="24"
              width="24"
              crossOrigin="anonymous"
              src="https://cdn.simpleicons.org/cloudflare"
              alt="vercel"
            />
            <span className="mx-auto">Deploy to Cloudflare (Coming Soon)</span>
          </Button>
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
