// hooks/useChat/index.tsx - Main useChat hook with debug logging
import { useLocalization } from '@/constants/localization';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Id } from '../../convex/_generated/dataModel';
import { useAuth } from '../useAuth';
import {
  Chat,
  ChatContextType,
  ChatError,
  Language,
  LoadingStates,
  Message,
  MessageStatus,
  OptimisticMessage
} from './type';
import { useChatActions } from './useChatActions';
import { useChatHooks, useChatMessages } from './useChatHooks';
import { useChatNavigation } from './useChatNavigation';

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  // Dependencies
  const { user } = useAuth();
  const { locale, t } = useLocalization();
  
  // State
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);
  const [loading, setLoading] = useState<LoadingStates>({
    startingChat: false,
    sendingMessage: false,
    creatingJob: false,
    loadingMessages: false,
    submittingCategorization: false,
    submittingBid: false,
  });
  const [error, setError] = useState<ChatError | null>(null);
  
  // Track first voice message state per chat
  const [chatVoiceState, setChatVoiceState] = useState<Map<Id<'chats'>, { 
    hasFirstVoice: boolean; 
    pendingVoiceMessageId?: Id<'messages'>;
    pendingQuickReplyId?: Id<'messages'>;
  }>>(new Map());
  
  // Refs for retry functionality
  const optimisticIdCounter = useRef(0);
  
  // Track which chats have been initialized to prevent duplicates
  const initializedChatsRef = useRef(new Set<string>());
  
  // Get user language with fallback
  const userLanguage = useMemo((): Language => {
    return (locale === 'en' || locale === 'fr' || locale === 'ar') ? locale : 'en';
  }, [locale]);
  
  // Get Convex hooks
  const { sendInitialInstructions } = useChatHooks();
  
  // Messages query with conditional loading
  const messagesQuery = useChatMessages(activeChat);
  
  // Update loading state for messages
  useEffect(() => {
    setLoading(prev => ({
      ...prev,
      loadingMessages: messagesQuery === undefined && activeChat !== null
    }));
  }, [messagesQuery, activeChat]);
  
  // Clear optimistic messages when real messages load
  useEffect(() => {
    if (messagesQuery?.page) {
      setOptimisticMessages(prev => 
        prev.filter(opt => opt.status === 'sending')
      );
    }
  }, [messagesQuery]);
  
  // Memoized loading helper
  const setLoadingState = useCallback((key: keyof LoadingStates, value: boolean) => {
    setLoading(prev => ({ ...prev, [key]: value }));
  }, []);
  
  // Error handling helper
  const handleError = useCallback((type: ChatError['type'], message: string, retryable = true) => {
    setError({ type, message, retryable });
    setLoading({
      startingChat: false,
      sendingMessage: false,
      creatingJob: false,
      loadingMessages: false,
      submittingCategorization: false,
      submittingBid: false,
    });
  }, []);
  
  // Get chat navigation functions
  const { startChatForCategory } = useChatNavigation({
    user,
    userLanguage,
    setActiveChat,
    setChatVoiceState,
    setLoadingState,
    handleError
  });
  
  // Get chat actions
  const chatActions = useChatActions({
    user,
    activeChat,
    userLanguage,
    setLoadingState,
    handleError,
    setOptimisticMessages,
    setChatVoiceState,
    chatVoiceState,
    setError,
    setLoading,
    optimisticIdCounter,
    t
  });
  
  // Send initial instructions only when chat is set and has no messages
  useEffect(() => {
    const sendInitialInstructionsIfNeeded = async () => {
      
      if (activeChat && messagesQuery?.page && messagesQuery.page.length === 0) {
        
        // UPDATED: Only send initial instructions for customer chats
        if (activeChat.customer_id && !activeChat.worker_id) {
          // Prevent duplicate initialization for the same chat
          if (initializedChatsRef.current.has(activeChat._id)) {
            setLoadingState('startingChat', false);
            return;
          }
          
          try {
            // Mark this chat as initialized before sending instructions
            initializedChatsRef.current.add(activeChat._id);
            
            await sendInitialInstructions({ 
              chatId: activeChat._id, 
              categoryId: activeChat.category_id, 
              language: userLanguage
            });
          } catch (err) {
            console.error('[DEBUG_INIT] Failed to send initial instructions:', err);
            // Remove from initialized set if failed, so it can be retried
            initializedChatsRef.current.delete(activeChat._id);
            handleError('start_chat', 'Failed to initialize conversation', true);
          } finally {
            setLoadingState('startingChat', false);
          }
        } else {
          // WORKER CHAT DEBUG: Log when worker chat loads
          setLoadingState('startingChat', false);
        }
      } else if (activeChat && messagesQuery?.page && messagesQuery.page.length > 0) {
        // MESSAGES DEBUG: Log when messages query returns  
        setLoadingState('startingChat', false);
      } else {
      }
    };

    sendInitialInstructionsIfNeeded();
  }, [activeChat, messagesQuery?.page, userLanguage, sendInitialInstructions, handleError, setLoadingState]);
  
  // Helper function for clearing chat state after cancellation
  const clearChatAfterCancellation = useCallback(() => {
    setActiveChat(null);
    setOptimisticMessages([]);
    setError(null);
    setChatVoiceState(new Map());
    setLoading({
      startingChat: false,
      sendingMessage: false,
      creatingJob: false,
      loadingMessages: false,
      submittingCategorization: false,
      submittingBid: false,
    });
  }, []);
  
  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  // Clear chat (useful for navigation cleanup)
  const clearChat = useCallback(() => {
    setActiveChat(null);
    setOptimisticMessages([]);
    setError(null);
    setLoading({
      startingChat: false,
      sendingMessage: false,
      creatingJob: false,
      loadingMessages: false,
      submittingCategorization: false,
      submittingBid: false,
    });
  }, []);
  
  // Combine real and optimistic messages, sorted by timestamp
  const allMessages = useMemo(() => {
    const realMessages = messagesQuery?.page || [];
    const combinedMessages: Message[] = [
      ...realMessages.map(msg => ({ 
        ...msg, 
        isOptimistic: false,
        status: msg.status || 'sent' as MessageStatus
      })),
      ...optimisticMessages.map(opt => ({
        _id: opt.tempId as Id<'messages'>,
        chat_id: opt.chatId,
        sender_id: opt.senderId,
        bubble_type: opt.bubbleType,
        content: opt.content,
        metadata: opt.metadata,
        is_dismissed: false,
        is_expired: false, // ADD THIS LINE - optimistic messages are never expired
        created_at: opt.timestamp,
        status: opt.status,
        delivered_at: undefined,
        read_at: undefined,
        sender: opt.sender,
        isOptimistic: true,
        optimisticStatus: opt.status,
      }))
    ];
    
    return combinedMessages.sort((a, b) => a.created_at - b.created_at);
  }, [messagesQuery?.page, optimisticMessages]);
  
  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<ChatContextType>(() => ({
    // State
    activeChat,
    messages: allMessages,
    optimisticMessages,
    loading,
    error,
    
    // Navigation
    startChatForCategory,
    
    // Actions from chatActions
    ...chatActions,
    
    // Utilities
    clearError,
    clearChat,
    clearChatAfterCancellation,
  }), [
    activeChat,
    allMessages,
    optimisticMessages,
    loading,
    error,
    startChatForCategory,
    chatActions,
    clearError,
    clearChat,
    clearChatAfterCancellation,
  ]);
  
  return React.createElement(
    ChatContext.Provider, 
    { value: contextValue }, 
    children
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}

// Export types for use in other files
export * from './type';
