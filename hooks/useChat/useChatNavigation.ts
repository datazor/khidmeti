// hooks/useChat/useChatNavigation.ts - Chat navigation and initialization
import { useCallback } from 'react';
import { Id } from '../../convex/_generated/dataModel';
import { Chat, ChatError, LoadingStates, Language } from './type';
import { useChatHooks } from './useChatHooks';
import { useWorkerJobs } from '../useWorkerJobs';
import { api } from '../../convex/_generated/api';
import { useQuery } from 'convex/react';

interface UseChatNavigationProps {
  user: any;
  userLanguage: Language;
  setActiveChat: React.Dispatch<React.SetStateAction<Chat | null>>;
  setChatVoiceState: React.Dispatch<React.SetStateAction<Map<Id<'chats'>, { 
    hasFirstVoice: boolean; 
    pendingVoiceMessageId?: Id<'messages'>;
    pendingQuickReplyId?: Id<'messages'>;
  }>>>;
  setLoadingState: (key: keyof LoadingStates, value: boolean) => void;
  handleError: (type: ChatError['type'], message: string, retryable?: boolean) => void;
}

export function useChatNavigation({
  user,
  userLanguage,
  setActiveChat,
  setChatVoiceState,
  setLoadingState,
  handleError
}: UseChatNavigationProps) {
  const {
    getOrCreateCategoryChat,
    getOrCreateWorkerCategoryChat,
    loadSpecificChatMutation,
  } = useChatHooks();
  
  const { getActiveJobChat, shouldBypassJobFeed } = useWorkerJobs();

  // UPDATED: Start chat for category (now supports both customers and workers)
  const startChatForCategory = useCallback(async (categoryId: Id<'categories'>) => {
    
    if (!user?._id) {
      handleError('start_chat', 'User not authenticated', false);
      return;
    }
    
    const action = async () => {
      setLoadingState('startingChat', true);
      
      try {
        let chat;
        
        if (user.user_type === 'worker') {
          // For workers, get or create their notification/conversation chat
          chat = await getOrCreateWorkerCategoryChat({ 
            workerId: user._id,
            categoryId 
          });
        } else {
          // Existing customer logic
          chat = await getOrCreateCategoryChat({ 
            customerId: user._id,
            categoryId 
          });
        }
        
        if (chat) {
          setActiveChat(chat);
          setChatVoiceState(prev => {
            const newMap = new Map(prev);
            if (!newMap.has(chat._id)) {
              newMap.set(chat._id, { hasFirstVoice: false });
            }
            return newMap;
          });
        } else {
        }
      } catch (err) {
        console.error("[DEBUG_NAV] Error starting chat:", err);
        handleError('start_chat', 'Failed to start conversation. Please try again.', true);
        setLoadingState('startingChat', false);
      }
    };
    
    await action();
  }, [user, getOrCreateCategoryChat, getOrCreateWorkerCategoryChat, setLoadingState, handleError, setActiveChat, setChatVoiceState]);

  // NEW: Load specific chat by ID (for direct navigation from WorkerJobBubble)
  const loadSpecificChat = useCallback(async (chatId: Id<'chats'>) => {
    if (!user?._id) {
      handleError('start_chat', 'User not authenticated', false);
      return;
    }

    setLoadingState('startingChat', true);
    
    try {
      // Use the mutation to load the specific chat
      const chat = await loadSpecificChatMutation({ chatId, userId: user._id });
      
      if (chat) {
        setActiveChat(chat);
        setChatVoiceState(prev => {
          const newMap = new Map(prev);
          if (!newMap.has(chat._id)) {
            newMap.set(chat._id, { hasFirstVoice: false });
          }
          return newMap;
        });
      } else {
        handleError('start_chat', 'Chat not found or access denied', false);
      }
    } catch (err) {
      console.error('Failed to load specific chat:', err);
      handleError('start_chat', 'Failed to load conversation', true);
    } finally {
      setLoadingState('startingChat', false);
    }
  }, [user, handleError, setLoadingState, setActiveChat, setChatVoiceState, loadSpecificChatMutation]);

  // NEW: Smart category navigation for workers
  const navigateToCategory = useCallback(async (
    categoryId: Id<'categories'>,
    forceJobFeed: boolean = false
  ) => {
    if (!user || user.user_type !== 'worker') {
      return { action: 'show_job_feed', categoryId };
    }

    // If user explicitly wants job feed, always show it
    if (forceJobFeed) {
      return { action: 'show_job_feed', categoryId };
    }

    // Check for active job in this category
    const activeJobChat = getActiveJobChat(categoryId);
    
    // If no active job, show job feed
    if (!activeJobChat) {
      return { action: 'show_job_feed', categoryId };
    }

    // If has active job but user accessed via normal navigation, show job feed
    // Only bypass to conversation if coming from active job indicator
    if (!shouldBypassJobFeed(categoryId)) {
      return { action: 'show_job_feed', categoryId, hasActiveJob: true };
    }

    // Navigate to active conversation
    const chat = await loadSpecificChat(activeJobChat._id);
    return { action: 'show_conversation', chat };

  }, [user, getActiveJobChat, shouldBypassJobFeed, loadSpecificChat]);

  return {
    startChatForCategory,
    loadSpecificChat,
    navigateToCategory, // NEW method
  };
}
