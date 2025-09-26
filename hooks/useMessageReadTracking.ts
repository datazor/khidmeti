import { useCallback, useRef } from 'react';
import { Id } from '../convex/_generated/dataModel';

export function useMessageReadTracking(onMessageRead: (messageId: Id<'messages'>) => void) {
  const observedMessages = useRef(new Set<string>());

  const trackMessageRead = useCallback((messageId: Id<'messages'>) => {
    if (!observedMessages.current.has(messageId)) {
      observedMessages.current.add(messageId);
      // Delay to ensure message was actually viewed
      setTimeout(() => {
        onMessageRead(messageId);
      }, 1000);
    }
  }, [onMessageRead]);

  return { trackMessageRead };
}
