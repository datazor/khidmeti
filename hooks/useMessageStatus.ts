import { useCallback, useEffect, useRef } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAuth } from './useAuth';

export function useMessageStatus(activeChat: any) {
  const { user } = useAuth();
  const markAsDelivered = useMutation(api.messageStatus.markMessageAsDelivered);
  const markAsRead = useMutation(api.messageStatus.markMessageAsRead);
  const markBatchDelivered = useMutation(api.messageStatus.markMessagesAsDelivered);
  
  const deliveredMessages = useRef(new Set<string>());
  const readMessages = useRef(new Set<string>());

  // Mark messages as delivered when chat loads
  const handleMessagesDelivered = useCallback(async (messages: any[]) => {
    if (!user?._id || !activeChat) return;

    // Only process conversation chats (both customer_id and worker_id defined)
    const isConversationChat = !!(activeChat.customer_id && activeChat.worker_id);
    if (!isConversationChat) return;

    const undeliveredMessages = messages.filter(msg => 
      msg.sender_id !== user._id && 
      msg.status === 'sent' &&
      !deliveredMessages.current.has(msg._id)
    );

    if (undeliveredMessages.length > 0) {
      try {
        const messageIds = undeliveredMessages.map(msg => msg._id);
        await markBatchDelivered({
          messageIds,
          recipientId: user._id,
        });

        // Track locally to prevent duplicate calls
        undeliveredMessages.forEach(msg => 
          deliveredMessages.current.add(msg._id)
        );

      } catch (error) {
        console.error('[MESSAGE_STATUS] Failed to mark messages as delivered:', error);
      }
    }
  }, [user?._id, activeChat, markBatchDelivered]);

  // Mark individual message as read when it comes into view
  const handleMessageRead = useCallback(async (messageId: Id<'messages'>) => {
    if (!user?._id || readMessages.current.has(messageId)) return;

    try {
      await markAsRead({
        messageId,
        recipientId: user._id,
      });

      readMessages.current.add(messageId);
    } catch (error) {
      console.error('[MESSAGE_STATUS] Failed to mark message as read:', error);
    }
  }, [user?._id, markAsRead]);

  // Clear tracking when chat changes
  useEffect(() => {
    deliveredMessages.current.clear();
    readMessages.current.clear();
  }, [activeChat?._id]);

  return {
    handleMessagesDelivered,
    handleMessageRead,
  };
}
