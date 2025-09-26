// contexts/ChatContext.tsx
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { Id } from '../convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';

// Define the bubble types to match Convex function constraints
type BubbleType = "text" | "voice" | "photo" | "confirmation" | "date" | "system_instruction";
type SystemBubbleType = "system_instruction" | "system_prompt" | "system_notification";

interface ChatContextType {
  activeChatId: Id<'chats'> | null;
  messages: any[];
  isLoading: {
    chat: boolean;
    messages: boolean;
  };
  error: string | null;
  
  startChatForCategory: (categoryId: Id<'categories'>, customerId: Id<'users'>) => Promise<void>;
  sendMessage: (chatId: Id<'chats'>, senderId: Id<'users'>, bubbleType: BubbleType, content: string, metadata?: any) => Promise<void>;
  createJobFromChat: (chatId: Id<'chats'>, locationLat: number, locationLng: number, priceFloor: number, portfolioConsent: boolean) => Promise<void>;
  clearError: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [activeChatId, setActiveChatId] = useState<Id<'chats'> | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Convex mutations
  const getOrCreateCategoryChat = useMutation(api.chats.getOrCreateCategoryChat);
  const sendMessageMutation = useMutation(api.messages.sendMessage);
  const createJobFromChatMutation = useMutation(api.jobs.createJobFromChat);
  const sendInitialInstructions = useMutation(api.systemMessages.sendInitialInstructions);
  
  // Chat messages query
  const messagesQuery = useQuery(
    api.chats.getChatMessages,
    activeChatId ? { 
      chatId: activeChatId, 
      paginationOpts: { numItems: 50, cursor: null } 
    } : 'skip'
  );
  
  // Memoized functions
  const startChatForCategory = useCallback(async (categoryId: Id<'categories'>, customerId: Id<'users'>) => {
    try {
      setError(null);
      const chat = await getOrCreateCategoryChat({ categoryId, customerId });
      if (chat) {
        setActiveChatId(chat._id);
        // Send initial system messages
        await sendInitialInstructions({ 
          chatId: chat._id, 
          categoryId, 
          language: 'en' // TODO: Get from user preferences
        });
      }
    } catch (err) {
      setError('Failed to start chat');
      console.error('Chat creation error:', err);
    }
  }, [getOrCreateCategoryChat, sendInitialInstructions]);
  
  const sendMessage = useCallback(async (
    chatId: Id<'chats'>, 
    senderId: Id<'users'>, 
    bubbleType: BubbleType, 
    content: string, 
    metadata?: any
  ) => {
    try {
      setError(null);
      await sendMessageMutation({ 
        chatId, 
        senderId, 
        bubbleType, 
        content, 
        metadata 
      });
    } catch (err) {
      setError('Failed to send message');
      console.error('Send message error:', err);
    }
  }, [sendMessageMutation]);
  
  const createJobFromChat = useCallback(async (
    chatId: Id<'chats'>,
    locationLat: number, 
    locationLng: number, 
    priceFloor: number, 
    portfolioConsent: boolean
  ) => {
    try {
      setError(null);
      await createJobFromChatMutation({ 
        chatId,
        locationLat, 
        locationLng, 
        priceFloor, 
        portfolioConsent 
      });
    } catch (err) {
      setError('Failed to create job');
      console.error('Create job error:', err);
    }
  }, [createJobFromChatMutation]);
  
  const clearError = useCallback(() => setError(null), []);
  
  // Memoized context value
  const value = useMemo(() => ({
    activeChatId,
    messages: messagesQuery?.page || [],
    isLoading: {
      chat: activeChatId === null && startChatForCategory !== undefined,
      messages: messagesQuery === undefined
    },
    error,
    startChatForCategory,
    sendMessage,
    createJobFromChat,
    clearError
  }), [
    activeChatId, 
    messagesQuery, 
    error, 
    startChatForCategory, 
    sendMessage, 
    createJobFromChat, 
    clearError
  ]);
  
  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}