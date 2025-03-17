import type { Message } from 'ai';
import { useCallback, useState, useEffect } from 'react';
import { StreamingMessageParser } from '~/lib/runtime/message-parser';
import { workbenchStore } from '~/lib/stores/workbench';
import { createScopedLogger } from '~/utils/logger';
import type { SupabaseConnectionState } from '~/lib/stores/supabase';

const logger = createScopedLogger('useMessageParser');

// Create a message parser instance that will be configured with the connection
let messageParser: StreamingMessageParser;

export function useMessageParser(supabaseConnection?: SupabaseConnectionState) {
  const [parsedMessages, setParsedMessages] = useState<{ [key: number]: string }>({});

  // Initialize or update the message parser when the connection changes
  useEffect(() => {
    messageParser = new StreamingMessageParser({
      callbacks: {
        onArtifactOpen: (data) => {
          logger.trace('onArtifactOpen', data);

          workbenchStore.showWorkbench.set(true);
          workbenchStore.addArtifact(data, supabaseConnection);
        },
        onArtifactClose: (data) => {
          logger.trace('onArtifactClose');

          workbenchStore.updateArtifact(data, { closed: true });
        },
        onActionOpen: (data) => {
          logger.trace('onActionOpen', data.action);

          // we only add shell actions when when the close tag got parsed because only then we have the content
          if (data.action.type === 'file') {
            workbenchStore.addAction(data);
          }
        },
        onActionClose: (data) => {
          logger.trace('onActionClose', data.action);

          if (data.action.type !== 'file') {
            workbenchStore.addAction(data);
          }

          workbenchStore.runAction(data);
        },
        onActionStream: (data) => {
          logger.trace('onActionStream', data.action);
          workbenchStore.runAction(data, true);
        },
      },
    });
  }, [supabaseConnection]);

  const parseMessages = useCallback((messages: Message[], isLoading: boolean) => {
    let reset = false;

    if (import.meta.env.DEV && !isLoading) {
      reset = true;
      messageParser.reset();
    }

    for (const [index, message] of messages.entries()) {
      if (message.role === 'assistant') {
        const newParsedContent = messageParser.parse(message.id, message.content);

        setParsedMessages((prevParsed) => ({
          ...prevParsed,
          [index]: !reset ? (prevParsed[index] || '') + newParsedContent : newParsedContent,
        }));
      }
    }
  }, []);

  return { parsedMessages, parseMessages };
}
