// hooks/useChat.tsx - Complete version with job creation, cancellation, and worker job functionality
import { useLocalization } from '@/constants/localization';
import { useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAuth } from './useAuth';
import { useChatNavigation } from './useChat/useChatNavigation';
import { useWorkerJobs } from './useWorkerJobs';

// Define the bubble types to match Convex function constraints
type BubbleType = "text" | "voice" | "photo" | "confirmation" | "date" | "system_instruction" | "job" | "worker_job";
type SystemBubbleType = "system_instruction" | "system_prompt" | "system_notification";
type Language = "en" | "fr" | "ar";
type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

// User interface for sender data
interface ChatUser {
  _id: Id<'users'>;
  name: string;
  photo_url?: string;
  user_type: 'customer' | 'worker';
}

// Import Message type from centralized type file
import { Message } from './useChat/type';

interface Chat {
  _id: Id<'chats'>;
  customer_id?: Id<'users'>; // UPDATED: Optional for worker notification chats
  category_id: Id<'categories'>;
  job_id?: Id<'jobs'>;
  worker_id?: Id<'users'>; // UPDATED: Optional for customer service chats
  is_cleared: boolean;
  created_at: number;
}

interface LoadingStates {
  startingChat: boolean;
  sendingMessage: boolean;
  creatingJob: boolean;
  loadingMessages: boolean;
  submittingCategorization: boolean;
  submittingBid: boolean;
}

interface ChatError {
  type: 'start_chat' | 'send_message' | 'create_job' | 'connection' | 'worker_action';
  message: string;
  retryable: boolean;
}

interface OptimisticMessage {
  tempId: string;
  chatId: Id<'chats'>;
  senderId: Id<'users'>;
  bubbleType: BubbleType;
  content: string;
  metadata?: any;
  timestamp: number;
  status: 'sending' | 'failed';
  sender?: ChatUser; // Add sender data for consistency
}

interface PhotoItem {
  id: string;
  uri: string;
  type: string;
  size: number;
  width: number;
  height: number;
  fileName?: string;
  uploadId?: Id<'uploads'>;
  isUploading?: boolean;
  uploadProgress?: number;
  uploadError?: string;
}

interface ChatContextType {
  // State
  activeChat: Chat | null;
  messages: Message[];
  optimisticMessages: OptimisticMessage[];
  loading: LoadingStates;
  error: ChatError | null;
  
  // Customer Actions
  startChatForCategory: (categoryId: Id<'categories'>) => Promise<void>;
  loadSpecificChat: (chatId: Id<'chats'>) => Promise<void>; // NEW: For direct navigation
  sendMessage: (bubbleType: BubbleType, content: string, metadata?: any) => Promise<void>;
  sendSystemMessage: (messageKey: string, variables?: Record<string, string>, metadata?: any) => Promise<void>;
  createJobFromChat: (locationLat: number, locationLng: number, priceFloor: number, portfolioConsent: boolean) => Promise<void>;
  handleQuickReplySelection: (selection: 'yes' | 'no', voiceMessageId: Id<'messages'>, quickReplyMessageId: Id<'messages'>) => Promise<void>;
  handleDateSelection: (selectedDate: Date, datePickerMessageId: Id<'messages'>) => Promise<void>;
  handlePhotoSelection: (photos: PhotoItem[], photoSelectorMessageId: Id<'messages'>) => Promise<void>;
  handleJobCancellation: (jobId: Id<'jobs'>, phase: 'bidding' | 'matched' | 'in_progress') => Promise<void>;
  
  // Worker Actions
  handleCategorizationSubmit: (jobId: Id<'jobs'>, subcategoryId: Id<'categories'>) => Promise<void>;
  handleBidSubmit: (jobId: Id<'jobs'>, amount: number, equipmentCost?: number) => Promise<void>;
  validateWorkerBid: (subcategoryId: Id<'categories'>, amount: number) => Promise<{ isValid: boolean; minimumAmount: number; reason?: string }>;

  // Bid Actions
  handleBidAcceptance: (bidId: Id<'bids'>) => Promise<void>;
  handleBidRejection: (bidId: Id<'bids'>) => Promise<void>;

  // NEW: Completion workflow actions
  handleCompletionRequest: (jobId: Id<'jobs'>) => Promise<void>;
  handleCompletionConfirmation: (confirmed: boolean, jobId: Id<'jobs'>) => Promise<void>;
  validateCompletionCode: (code: string, jobId: Id<'jobs'>) => Promise<void>;
  
  // NEW: Onboarding code validation
  validateOnboardingCode: (code: string, jobId: Id<'jobs'>) => Promise<boolean>;

  // NEW: Bubble expiration
  expireWorkerJobBubble: (messageId: Id<'messages'>) => Promise<void>;

  // NEW: Rating submission
  handleRatingSubmission: (rating: number, review: string, jobId: Id<'jobs'>, targetUserId: Id<'users'>, ratingType: 'customer_rates_worker' | 'worker_rates_customer') => Promise<void>;

  // NEW: Chat state management
  checkChatNeedsReinit: (chatId: Id<'chats'>) => Promise<boolean>;
  reinitializeChat: (chatId: Id<'chats'>, categoryId: Id<'categories'>) => Promise<void>;

  // NEW: Explicit navigation methods
  viewJobFeedForCategory: (categoryId: Id<'categories'>) => Promise<void>;
  continueActiveJobInCategory: (categoryId: Id<'categories'>) => Promise<void>;

  // Utilities
  clearError: () => void;
  retryLastAction: () => Promise<void>;
  clearChat: () => void;
  clearChatAfterCancellation: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  // Dependencies
  const { user } = useAuth();
  const { locale, t } = useLocalization();
  const router = useRouter();
  const { workerChats } = useWorkerJobs();
  
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
  const lastActionRef = useRef<(() => Promise<void>) | null>(null);
  const optimisticIdCounter = useRef(0);
  
  // Get user language with fallback
  const userLanguage = useMemo((): Language => {
    return (locale === 'en' || locale === 'fr' || locale === 'ar') ? locale : 'en';
  }, [locale]);
  
  // Convex mutations - memoized to prevent recreation
  const getOrCreateCategoryChat = useMutation(api.chats.getOrCreateCategoryChat);
  const getOrCreateWorkerCategoryChat = useMutation(api.chats.getOrCreateWorkerCategoryChat); // NEW
  const sendMessageMutation = useMutation(api.messages.sendMessage);
  const sendSystemMessageMutation = useMutation(api.systemMessages.sendSystemMessage);
  const createJobFromChatMutation = useMutation(api.jobs.createJobFromChat);
  const sendInitialInstructions = useMutation(api.systemMessages.sendInitialInstructions);
  const deleteVoiceAndQuickReply = useMutation(api.messages.deleteVoiceAndQuickReply);
  const cancelJobAndClearChatMutation = useMutation(api.jobs.cancelJobAndClearChat);
  
  // Worker job mutations
  const submitCategorizationMutation = useMutation(api.workerJobs.submitCategorization);
  const submitBidMutation = useMutation(api.workerJobs.submitWorkerBid);
  
  // Bid management mutations
  const acceptBidMutation = useMutation(api.bids.acceptBid);
  const rejectBidMutation = useMutation(api.bids.rejectBid);
  
  // NEW: Completion workflow mutations
  const generateCompletionCode = useMutation(api.jobs.generateCompletionCode);
  const validateCompletionCodeMutation = useMutation(api.jobs.validateCompletionCode);
  
  // NEW: Onboarding code validation mutation
  const validateOnboardingCodeMutation = useMutation(api.jobs.validateOnboardingCode);
  
  // NEW: Worker job bubble expiration mutation
  const expireMessageMutation = useMutation(api.messages.expireMessage);
  
  // NEW: Job cancellation mutation
  const markJobAsCancelledMutation = useMutation(api.jobs.markJobAsCancelled);
  
  // NEW: Rating submission mutation
  const submitRating = useMutation(api.ratings.submitRating);

  // NEW: Chat state management
  const reinitializeChatMutation = useMutation(api.messages.reinitializeCustomerChat);

  // Messages query with conditional loading
  const messagesQuery = useQuery(
    api.chats.getChatMessages,
    activeChat ? { 
      chatId: activeChat._id, 
      paginationOpts: { numItems: 50, cursor: null } 
    } : 'skip'
  );



  // NEW: Check if chat needs reinitialization (FIXED: Only checks, doesn't send messages)
  const checkChatNeedsReinit = useCallback(async (chatId: Id<'chats'>): Promise<boolean> => {
    try {
      // Use the existing messages query to check if initial system messages exist
      if (!messagesQuery?.page) {
        // If no messages are loaded yet, assume chat needs reinitialization
        return true;
      }
      
      // Check if any initial system instruction messages exist
      const hasInitialMessages = messagesQuery.page.some(msg => 
        msg.bubble_type === "system_instruction" && 
        msg.metadata?.isInitialInstruction === true
      );
      
      // If no initial messages exist, chat needs reinitialization
      return !hasInitialMessages;
    } catch (error) {
      console.error('Failed to check chat reinit status:', error);
      return false;
    }
  }, [messagesQuery?.page]);

  // NEW: Reinitialize chat
  const reinitializeChat = useCallback(async (chatId: Id<'chats'>, categoryId: Id<'categories'>) => {
    if (!user?._id) return;

    try {
      await reinitializeChatMutation({
        chatId,
        categoryId,
        customerId: user._id,
        language: userLanguage,
      });

    } catch (error) {
    }
  }, [user?._id, userLanguage, reinitializeChatMutation]);


  
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
  
  // Generate optimistic message
  const createOptimisticMessage = useCallback((
    chatId: Id<'chats'>,
    senderId: Id<'users'>,
    bubbleType: BubbleType,
    content: string,
    metadata?: any
  ): OptimisticMessage => ({
    tempId: `opt_${++optimisticIdCounter.current}`,
    chatId,
    senderId,
    bubbleType,
    content,
    metadata,
    timestamp: Date.now(),
    status: 'sending',
    sender: user ? {
      _id: user._id,
      name: user.name,
      photo_url: (user as any).photo_url,
      user_type: user.user_type
    } : undefined,
  }), [user]);
  
  // Check if this is the first voice message in the chat
  const isFirstVoiceMessage = useCallback((chatId: Id<'chats'>) => {
    const voiceState = chatVoiceState.get(chatId);
    return !voiceState?.hasFirstVoice;
  }, [chatVoiceState]);
  
  // Handle worker categorization submission
  const handleCategorizationSubmit = useCallback(async (
    jobId: Id<'jobs'>,
    subcategoryId: Id<'categories'>
  ) => {
    if (!user?._id) {
      handleError('worker_action', 'User not authenticated', false);
      return;
    }
    
    const action = async () => {
      setLoadingState('submittingCategorization', true);
      setError(null);
      
      try {
        const result = await submitCategorizationMutation({
          jobId,
          workerId: user._id,
          subcategoryId,
        });
        
        
      } catch (err) {
        console.error('Failed to submit categorization:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to submit categorization';
        handleError('worker_action', errorMessage, true);
      } finally {
        setLoadingState('submittingCategorization', false);
      }
    };
    
    lastActionRef.current = action;
    await action();
  }, [user?._id, submitCategorizationMutation, setLoadingState, handleError]);
  
  // Handle worker bid submission
  const handleBidSubmit = useCallback(async (
    jobId: Id<'jobs'>,
    amount: number,
    equipmentCost = 0
  ) => {
    if (!user?._id) {
      handleError('worker_action', 'User not authenticated', false);
      return;
    }
    
    const action = async () => {
      setLoadingState('submittingBid', true);
      setError(null);
      
      try {
        const result = await submitBidMutation({
          jobId,
          workerId: user._id,
          amount,
          equipmentCost,
        });
        
        
        // ADD: Small success feedback (optional)
        // The UI state will automatically update via Convex reactivity
        // when the backend updates the worker_job message metadata
        
      } catch (err) {
        console.error('Failed to submit bid:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to submit bid';
        handleError('worker_action', errorMessage, true);
      } finally {
        setLoadingState('submittingBid', false);
      }
    };
    
    lastActionRef.current = action;
    await action();
  }, [user?._id, submitBidMutation, setLoadingState, handleError]);
  
  // Validate worker bid amount (simplified approach)
  const validateWorkerBid = useCallback(async (
    subcategoryId: Id<'categories'>,
    amount: number
  ): Promise<{ isValid: boolean; minimumAmount: number; reason?: string }> => {
    // Basic validation - components should use useQuery(api.workerJobs.validateBidAmount) directly
    if (amount <= 0) {
      return {
        isValid: false,
        minimumAmount: 0,
        reason: 'Bid amount must be greater than 0',
      };
    }
    
    return {
      isValid: true,
      minimumAmount: 0,
      reason: undefined,
    };
  }, []);

  // Handle bid acceptance
  const handleBidAcceptance = useCallback(async (bidId: Id<'bids'>) => {
    if (!user?._id) {
      handleError('worker_action', 'User not authenticated', false);
      return;
    }

    const action = async () => {
      setLoadingState('creatingJob', true); // Reuse existing loading state
      setError(null);

      try {
        const result = await acceptBidMutation({
          bidId,
          customerId: user._id,
        });


      } catch (err) {
        console.error('Failed to accept bid:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to accept bid';
        handleError('create_job', errorMessage, true);
      } finally {
        setLoadingState('creatingJob', false);
      }
    };

    lastActionRef.current = action;
    await action();
  }, [user?._id, acceptBidMutation, setLoadingState, handleError]);

  // Handle bid rejection
  const handleBidRejection = useCallback(async (bidId: Id<'bids'>) => {
    if (!user?._id) {
      handleError('worker_action', 'User not authenticated', false);
      return;
    }

    const action = async () => {
      setLoadingState('creatingJob', true);
      setError(null);

      try {
        const result = await rejectBidMutation({
          bidId,
          customerId: user._id,
        });


      } catch (err) {
        console.error('Failed to reject bid:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to reject bid';
        handleError('create_job', errorMessage, true);
      } finally {
        setLoadingState('creatingJob', false);
      }
    };

    lastActionRef.current = action;
    await action();
  }, [user?._id, rejectBidMutation, setLoadingState, handleError]);
  
  // Handle job cancellation and chat clearing
  const handleJobCancellation = useCallback(async (
    jobId: Id<'jobs'>,
    phase: 'bidding' | 'matched' | 'in_progress'
  ) => {
    if (!user?._id || !activeChat) {
      handleError('create_job', 'User not authenticated or no active chat', false);
      return;
    }
    
    const action = async () => {
      setLoadingState('creatingJob', true);
      setError(null);
      
      try {
        // NEW: Use the updated cancellation mutation
        const result = await markJobAsCancelledMutation({
          jobId,
          cancelledBy: user._id,
          phase,
        });
        
        
        setOptimisticMessages([]);
        
        setChatVoiceState(prev => {
          const newMap = new Map(prev);
          newMap.set(activeChat._id, { hasFirstVoice: false });
          return newMap;
        });
        
        setLoading({
          startingChat: false,
          sendingMessage: false,
          creatingJob: false,
          loadingMessages: false,
          submittingCategorization: false,
          submittingBid: false,
        });
        
        
      } catch (err) {
        console.error('Failed to cancel job and clear chat:', err);
        handleError('create_job', 'Failed to cancel job. Please try again.', true);
      } finally {
        setLoadingState('creatingJob', false);
      }
    };
    
    lastActionRef.current = action;
    await action();
  }, [user?._id, activeChat, markJobAsCancelledMutation, setLoadingState, handleError]);
  
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

// Navigation functions
const { loadSpecificChat: loadSpecificChatNavigation } = useChatNavigation({
  user,
  userLanguage,
  setActiveChat,
  setChatVoiceState,
  setLoadingState,
  handleError
});

/**
 * Navigate to job feed for a category (always shows WorkerJobBubbles)
 */
const viewJobFeedForCategory = useCallback(async (categoryId: Id<'categories'>) => {
  if (!user?._id) {
    handleError('start_chat', 'User not authenticated', false);
    return;
  }

  if (user.user_type !== 'worker') {
    // For customers, use existing startChatForCategory
    await startChatForCategory(categoryId);
    return;
  }

  const action = async () => {
    setLoadingState('startingChat', true);
    setError(null);
    
    try {
      // Always navigate to notification chat (job feed) regardless of active conversations
      const chat = await getOrCreateWorkerCategoryChat({ 
        workerId: user._id,
        categoryId 
      });
      
      if (chat) {
        setActiveChat(chat);
        setChatVoiceState(prev => {
          const newMap = new Map(prev);
          if (!newMap.has(chat._id)) {
            newMap.set(chat._id, { hasFirstVoice: false });
          }
          return newMap;
        });
        
        
        // Navigate to chat screen with categoryId parameter
        router.push(`/(app)/chat?categoryId=${categoryId}`);
      }
    } catch (err) {
      console.error('Failed to view job feed:', err);
      handleError('start_chat', 'Failed to view job feed. Please try again.', true);
    } finally {
      setLoadingState('startingChat', false);
    }
  };
  
  lastActionRef.current = action;
  await action();
}, [user, getOrCreateWorkerCategoryChat, setActiveChat, setChatVoiceState, setLoadingState, handleError, router]);

/**
 * Navigate to active job conversation in a category
 */
const continueActiveJobInCategory = useCallback(async (categoryId: Id<'categories'>) => {
  if (!user?._id || user.user_type !== 'worker') {
    handleError('start_chat', 'Invalid user for job continuation', false);
    return;
  }

  // Find active conversation chat for this category using the workerChats from top level
  const activeChat = workerChats.find((chat: any) => 
    chat.category_id === categoryId && 
    chat.customer_id && 
    chat.job_id
  );

  if (!activeChat) {
    await viewJobFeedForCategory(categoryId);
    return;
  }

  const action = async () => {
    setLoadingState('startingChat', true);
    setError(null);
    
    try {
      setActiveChat(activeChat);
      setChatVoiceState(prev => {
        const newMap = new Map(prev);
        if (!newMap.has(activeChat._id)) {
          newMap.set(activeChat._id, { hasFirstVoice: false });
        }
        return newMap;
      });
      
      
      // Navigate to chat screen with chatId parameter
      router.push(`/(app)/chat?chatId=${activeChat._id}`);
    } catch (err) {
      console.error('Failed to continue active job:', err);
      handleError('start_chat', 'Failed to continue job. Please try again.', true);
    } finally {
      setLoadingState('startingChat', false);
    }
  };
  
  lastActionRef.current = action;
  await action();
}, [user, workerChats, setActiveChat, setChatVoiceState, setLoadingState, handleError, viewJobFeedForCategory, router]);
  
  // Handle QuickReply selection response
  const handleQuickReplySelection = useCallback(async (
    selection: 'yes' | 'no',
    voiceMessageId: Id<'messages'>,
    quickReplyMessageId: Id<'messages'>
  ) => {
    if (!activeChat) return;
    
    if (selection === 'no') {
      try {
        await deleteVoiceAndQuickReply({ 
          voiceMessageId, 
          quickReplyMessageId 
        });
        
        setChatVoiceState(prev => {
          const newMap = new Map(prev);
          newMap.set(activeChat._id, { hasFirstVoice: false });
          return newMap;
        });
        
      } catch (error) {
        console.error('Failed to delete voice message and quick reply:', error);
        handleError('send_message', 'Failed to delete messages. Please try again.', true);
      }
    } else {
      setChatVoiceState(prev => {
        const newMap = new Map(prev);
        const current = newMap.get(activeChat._id) || { hasFirstVoice: false };
        newMap.set(activeChat._id, { 
          ...current, 
          hasFirstVoice: true,
          pendingVoiceMessageId: undefined,
          pendingQuickReplyId: undefined
        });
        return newMap;
      });
      
      try {
        await sendSystemMessageMutation({
          chatId: activeChat._id,
          bubbleType: 'system_prompt',
          messageKey: 'date_selection',
          language: userLanguage,
          variables: {},
          metadata: {
            step: 4,
            nextAction: 'date_selection',
            promptType: 'date_picker',
            minDate: new Date().toISOString(),
            maxDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          }
        });
      } catch (error) {
        console.error('Failed to send date selection prompt:', error);
        handleError('send_message', 'Failed to continue conversation. Please try again.', true);
      }
    }
  }, [activeChat, deleteVoiceAndQuickReply, handleError, sendSystemMessageMutation, userLanguage]);
  
  // Handle date selection from DatePickerBubble
  const handleDateSelection = useCallback(async (
    selectedDate: Date,
    datePickerMessageId: Id<'messages'>
  ) => {
    if (!activeChat || !user?._id) {
      handleError('send_message', 'Chat not ready', false);
      return;
    }
    
    const action = async () => {
      setLoadingState('sendingMessage', true);
      setError(null);
      
      try {
        await sendMessageMutation({ 
          chatId: activeChat._id,
          senderId: user._id,
          bubbleType: 'date',
          content: selectedDate.toISOString(),
          metadata: {
            selectedDate: selectedDate.toISOString(),
            datePickerMessageId: datePickerMessageId,
            formattedDate: selectedDate.toLocaleDateString(userLanguage === 'ar' ? 'ar' : userLanguage, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })
          }
        });
        
        await sendSystemMessageMutation({
          chatId: activeChat._id,
          bubbleType: 'system_prompt',
          messageKey: 'photo_selection',
          language: userLanguage,
          variables: {},
          metadata: {
            step: 5,
            nextAction: 'photo_selection',
            promptType: 'photo_selector',
            maxPhotos: 5,
          }
        });
        
      } catch (err) {
        console.error('Failed to process date selection:', err);
        handleError('send_message', 'Failed to process date selection. Please try again.', true);
      } finally {
        setLoadingState('sendingMessage', false);
      }
    };
    
    lastActionRef.current = action;
    await action();
  }, [activeChat, user?._id, sendMessageMutation, sendSystemMessageMutation, userLanguage, setLoadingState, handleError]);
  
  // Handle photo selection from PhotoSelectorBubble
  const handlePhotoSelection = useCallback(async (
    photos: PhotoItem[],
    photoSelectorMessageId: Id<'messages'>
  ) => {
    if (!activeChat || !user?._id) {
      handleError('send_message', 'Chat not ready', false);
      return;
    }
    
    const action = async () => {
      setLoadingState('sendingMessage', true);
      setError(null);
      
      try {
        if (photos.length > 0) {
          for (const photo of photos) {
            await sendMessageMutation({ 
              chatId: activeChat._id,
              senderId: user._id,
              bubbleType: 'photo',
              content: photo.uri,
              metadata: {
                uploadId: photo.uploadId,
                photoSelectorMessageId: photoSelectorMessageId,
                fileName: photo.fileName,
                size: photo.size,
                width: photo.width,
                height: photo.height,
                type: photo.type,
              }
            });
          }
        }
        
        await sendSystemMessageMutation({
          chatId: activeChat._id,
          bubbleType: 'system_instruction',
          messageKey: photos.length > 0 ? 'photos_received' : 'photos_skipped',
          language: userLanguage,
          variables: {
            photoCount: photos.length.toString()
          },
          metadata: {
            step: 6,
            nextAction: 'job_creation',
            photoCount: photos.length,
            readyForJobCreation: true
          }
        });
        
        await createJobFromChatMutation({
          chatId: activeChat._id,
          locationLat: 18.0735,
          locationLng: -15.9582,
          priceFloor: 5000,
          portfolioConsent: true,
        });
        
      } catch (err) {
        console.error('Failed to process photo selection:', err);
        handleError('send_message', 'Failed to process photo selection. Please try again.', true);
      } finally {
        setLoadingState('sendingMessage', false);
      }
    };
    
    lastActionRef.current = action;
    await action();
  }, [activeChat, user?._id, sendMessageMutation, sendSystemMessageMutation, userLanguage, setLoadingState, handleError, createJobFromChatMutation]);
  
  // UPDATED: Start chat for category (now supports both customers and workers)
  const startChatForCategory = useCallback(async (categoryId: Id<'categories'>) => {
    if (!user?._id) {
      handleError('start_chat', 'User not authenticated', false);
      return;
    }
    
    const action = async () => {

      
      setLoadingState('startingChat', true);
      setError(null);
      
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
        console.error('Failed to start chat:', err);
        handleError('start_chat', 'Failed to start conversation. Please try again.', true);
        setLoadingState('startingChat', false);
      }
    };
    
    lastActionRef.current = action;
    await action();
  }, [user, getOrCreateCategoryChat, getOrCreateWorkerCategoryChat, setLoadingState, handleError, activeChat]);
  
  // Send initial instructions only when chat is set and has no messages
  useEffect(() => {
    const sendInitialInstructionsIfNeeded = async () => {
      if (activeChat && messagesQuery?.page && messagesQuery.page.length === 0) {
        // Check if this is a customer chat that needs reinitialization
        if (activeChat.customer_id && !activeChat.worker_id) {
          try {
            // Check if chat needs reinitialization
            const needsReinit = await checkChatNeedsReinit(activeChat._id);
            
            if (needsReinit) {
              console.log('[CHAT_LOADING] Chat needs reinitialization');
              await reinitializeChat(activeChat._id, activeChat.category_id);
            } else {
              // Send normal initial instructions
              await sendInitialInstructions({ 
                chatId: activeChat._id, 
                categoryId: activeChat.category_id, 
                language: userLanguage
              });
            }
          } catch (err) {
            console.error('Failed to handle chat initialization:', err);
            handleError('start_chat', 'Failed to initialize conversation', true);
          } finally {
            setLoadingState('startingChat', false);
          }
        } else {
          // For worker chats, just stop loading
          setLoadingState('startingChat', false);
        }
      } else if (activeChat && messagesQuery?.page && messagesQuery.page.length > 0) {
        setLoadingState('startingChat', false);
      }
    };

    sendInitialInstructionsIfNeeded();
  }, [activeChat, messagesQuery?.page, userLanguage, sendInitialInstructions, handleError, setLoadingState, checkChatNeedsReinit, reinitializeChat]);
  
  // Send user message
  const sendMessage = useCallback(async (
    bubbleType: BubbleType,
    content: string,
    metadata?: any
  ) => {
    if (!activeChat || !user?._id) {
      handleError('send_message', 'Chat not ready', false);
      return;
    }
    
    const optimisticMsg = createOptimisticMessage(
      activeChat._id,
      user._id,
      bubbleType,
      content,
      metadata
    );
    
    const action = async () => {
      setLoadingState('sendingMessage', true);
      setError(null);
      
      setOptimisticMessages(prev => [...prev, optimisticMsg]);
      
      try {
        const sentMessage = await sendMessageMutation({ 
          chatId: activeChat._id,
          senderId: user._id,
          bubbleType,
          content,
          metadata 
        });
        
        setOptimisticMessages(prev => 
          prev.filter(msg => msg.tempId !== optimisticMsg.tempId)
        );
        
        // UPDATED: Only handle voice completeness check for customer chats
        if (bubbleType === 'voice' && 
            isFirstVoiceMessage(activeChat._id) && 
            sentMessage &&
            activeChat.customer_id && 
            !activeChat.worker_id) {
          try {
            const quickReplyMessage = await sendSystemMessageMutation({
              chatId: activeChat._id,
              bubbleType: 'system_prompt',
              messageKey: 'voice_completeness_check',
              language: userLanguage,
              variables: {},
              metadata: {
                step: 3,
                nextAction: 'quick_reply',
                options: [
                  { label: t('quickReply.yes') || 'Yes', value: 'yes' },
                  { label: t('quickReply.no') || 'No', value: 'no' }
                ],
                pendingVoiceMessageId: sentMessage._id
              }
            });
            
            if (quickReplyMessage && sentMessage) {
              setChatVoiceState(prev => {
                const newMap = new Map(prev);
                const current = newMap.get(activeChat._id) || { hasFirstVoice: false };
                newMap.set(activeChat._id, {
                  ...current,
                  pendingVoiceMessageId: sentMessage._id as Id<'messages'>,
                  pendingQuickReplyId: quickReplyMessage._id as Id<'messages'>
                });
                return newMap;
              });
            }
            
          } catch (quickReplyError) {
            console.error('Failed to send voice completeness check:', quickReplyError);
          }
        }
        
      } catch (err) {
        console.error('Failed to send message:', err);
        
        setOptimisticMessages(prev => 
          prev.map(msg => 
            msg.tempId === optimisticMsg.tempId 
              ? { ...msg, status: 'failed' as const }
              : msg
          )
        );
        
        handleError('send_message', 'Failed to send message. Please try again.', true);
      } finally {
        setLoadingState('sendingMessage', false);
      }
    };
    
    lastActionRef.current = action;
    await action();
  }, [activeChat, user?._id, sendMessageMutation, createOptimisticMessage, setLoadingState, handleError, isFirstVoiceMessage, sendSystemMessageMutation, userLanguage, t, setOptimisticMessages, setChatVoiceState, setError]);
  
  // Send system message
  const sendSystemMessage = useCallback(async (
    messageKey: string,
    variables?: Record<string, string>,
    metadata?: any
  ) => {
    if (!activeChat) {
      handleError('send_message', 'Chat not ready', false);
      return;
    }
    
    const action = async () => {
      setError(null);
      
      try {
        await sendSystemMessageMutation({
          chatId: activeChat._id,
          bubbleType: messageKey.includes('question') ? 'system_prompt' : 'system_instruction',
          messageKey,
          language: userLanguage,
          variables,
          metadata
        });
      } catch (err) {
        console.error('Failed to send system message:', err);
        handleError('send_message', 'Failed to send system message', true);
      }
    };
    
    lastActionRef.current = action;
    await action();
  }, [activeChat, userLanguage, sendSystemMessageMutation, handleError, setError]);
  
  // Create job from chat
  const createJobFromChat = useCallback(async (
    locationLat: number,
    locationLng: number,
    priceFloor: number,
    portfolioConsent: boolean
  ) => {
    if (!activeChat) {
      handleError('create_job', 'Chat not ready', false);
      return;
    }
    
    const action = async () => {
      setLoadingState('creatingJob', true);
      setError(null);
      
      try {
        await createJobFromChatMutation({
          chatId: activeChat._id,
          locationLat,
          locationLng,
          priceFloor,
          portfolioConsent
        });
        
      } catch (err) {
        console.error('Failed to create job:', err);
        handleError('create_job', 'Failed to create job posting. Please try again.', true);
      } finally {
        setLoadingState('creatingJob', false);
      }
    };
    
    lastActionRef.current = action;
    await action();
  }, [activeChat, createJobFromChatMutation, setLoadingState, handleError, setError]);
  
  // Retry last failed action
  const retryLastAction = useCallback(async () => {
    if (lastActionRef.current) {
      await lastActionRef.current();
    }
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

  // NEW: Handle completion confirmation
  const handleCompletionConfirmation = useCallback(async (
    confirmed: boolean, 
    jobId: Id<'jobs'>
  ) => {
    
    if (!confirmed) {
      // User said no - just expire the confirmation message
      return;
    }
    
    // User confirmed completion - generate completion code and send to customer
    const action = async () => {
      setLoadingState('sendingMessage', true);
      setError(null);
      
      try {
        // Generate completion code
        const codeResult = await generateCompletionCode({ jobId });
        
        if (!codeResult.success) {
          throw new Error('Failed to generate completion code');
        }
        
        
        // Send completion code to customer's original chat
        await sendCompletionCodeToCustomer(jobId, codeResult.code);
        
        // Send completion code input bubble to worker
        await sendCompletionCodeInputToWorker(jobId);
        
      } catch (err) {
        console.error('Failed to process completion confirmation:', err);
        handleError('send_message', 'Failed to process completion. Please try again.', true);
      } finally {
        setLoadingState('sendingMessage', false);
      }
    };
    
    lastActionRef.current = action;
    await action();
  }, [setLoadingState, handleError, setError]);

  // NEW: Validate completion code
  const validateCompletionCode = useCallback(async (
    code: string, 
    jobId: Id<'jobs'>
  ) => {
    
    const action = async () => {
      setLoadingState('sendingMessage', true);
      setError(null);
      
      try {
        // Validate the completion code
        const validationResult = await validateCompletionCodeMutation({
          jobId,
          inputCode: code,
        });
        
        if (!validationResult.isValid) {
          throw new Error('Invalid completion code');
        }
        
        
        // Job is now completed - the system will handle rating flow and chat cleanup
        
      } catch (err) {
        console.error('Failed to validate completion code:', err);
        const errorMessage = err instanceof Error ? err.message : 'Invalid code';
        throw new Error(errorMessage); // Re-throw for CompletionCodeBubble to handle
      } finally {
        setLoadingState('sendingMessage', false);
      }
    };
    
    lastActionRef.current = action;
    await action();
  }, [setLoadingState, handleError, setError]);

  // Helper function to send completion code to customer
  const sendCompletionCodeToCustomer = useCallback(async (jobId: Id<'jobs'>, code: string) => {
    if (!user?._id || !activeChat?.job_id) return;
    
    // For now, we'll send the completion code to the current chat
    // In a real implementation, we'd find the customer's service chat
    await sendSystemMessageMutation({
      chatId: activeChat._id,
      bubbleType: 'system_instruction',
      messageKey: 'completion_code_delivery',
      language: userLanguage,
      variables: { code },
      metadata: {
        completionCode: code,
        jobId: jobId,
        isSystemGenerated: true,
        automated: true,
      }
    });
  }, [user?._id, activeChat, sendSystemMessageMutation, userLanguage]);

  // Helper function to send completion code input to worker
  const sendCompletionCodeInputToWorker = useCallback(async (jobId: Id<'jobs'>) => {
    if (!activeChat) return;
    
    // Send completion code input bubble to current worker chat
    await sendSystemMessageMutation({
      chatId: activeChat._id,
      bubbleType: 'system_prompt', // Use system_prompt instead of completion_code_input
      messageKey: 'completion_code_input',
      language: userLanguage,
      variables: {},
      metadata: {
        jobId: jobId,
        maxLength: 6,
        isSystemGenerated: true,
        automated: true,
      }
    });
  }, [activeChat, sendSystemMessageMutation, userLanguage]);

  // NEW: Handle completion request (*1# trigger) - placeholder since it's handled by message interception
  const handleCompletionRequest = useCallback(async (jobId: Id<'jobs'>) => {
    // This is handled by the message interception system in messages.ts
    // Workers send "*1#" which triggers the completion confirmation flow
  }, []);

  // NEW: Validate onboarding code
  const validateOnboardingCode = useCallback(async (
    code: string, 
    jobId: Id<'jobs'>
  ): Promise<boolean> => {
    
    try {
      const validationResult = await validateOnboardingCodeMutation({
        jobId,
        inputCode: code,
      });
      
      return validationResult.isValid;
      
    } catch (err) {
      console.error('Failed to validate onboarding code:', err);
      const errorMessage = err instanceof Error ? err.message : 'Invalid code';
      throw new Error(errorMessage); // Re-throw for CompletionCodeBubble to handle
    }
  }, [validateOnboardingCodeMutation]);

  // NEW: Expire worker job bubble
  const expireWorkerJobBubble = useCallback(async (messageId: Id<'messages'>) => {
    try {
      await expireMessageMutation({ messageId });
    } catch (error) {
      console.error('[CHAT_CONTEXT] Failed to expire worker job bubble:', error);
      throw error;
    }
  }, [expireMessageMutation]);

  // NEW: Handle rating submission
  const handleRatingSubmission = useCallback(async (
    rating: number,
    review: string,
    jobId: Id<'jobs'>,
    targetUserId: Id<'users'>,
    ratingType: 'customer_rates_worker' | 'worker_rates_customer'
  ) => {
    if (!user?._id) {
      handleError('send_message', 'User not authenticated', false);
      return;
    }

    const action = async () => {
      setLoadingState('sendingMessage', true);
      setError(null);

      try {
        await submitRating({
          jobId,
          raterId: user._id,
          ratedId: targetUserId,
          rating,
          reviewText: review || undefined,
          ratingType,
        });



      } catch (err) {
        console.error('Failed to submit rating:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to submit rating';
        handleError('send_message', errorMessage, true);
        throw err; // Re-throw for RatingBubble to handle
      } finally {
        setLoadingState('sendingMessage', false);
      }
    };

    lastActionRef.current = action;
    await action();
  }, [user?._id, submitRating, setLoadingState, handleError]);

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
        is_expired: false, // Add is_expired property
        created_at: opt.timestamp,
        status: opt.status,
        delivered_at: undefined,
        read_at: undefined,
        sender: opt.sender,
        isOptimistic: true,
        optimisticStatus: opt.status,
      }))
    ];
    
    const sorted = combinedMessages.sort((a, b) => a.created_at - b.created_at);
    

    
    return sorted;
  }, [messagesQuery?.page, optimisticMessages]);
  
  // Optional: Debug logging for bid status changes in worker messages
  useEffect(() => {
    if (user?.user_type === 'worker' && allMessages.length > 0) {
      const workerJobMessages = allMessages.filter((m: Message) => m.bubble_type === 'worker_job');
      workerJobMessages.forEach((msg: Message) => {
        if (msg.metadata?.jobData?.bidStatus) {
          console.log(`[CHAT_DEBUG] Worker job ${msg.metadata.jobData.jobId} has bid status: ${msg.metadata.jobData.bidStatus}`);
        }
      });
    }
  }, [user?.user_type, allMessages]);
  
  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<ChatContextType>(() => ({
    // State
    activeChat,
    messages: allMessages,
    optimisticMessages,
    loading,
    error,
    
    // Customer Actions
    startChatForCategory,
    loadSpecificChat: loadSpecificChatNavigation, // NEW: For direct navigation
    sendMessage,
    sendSystemMessage,
    createJobFromChat,
    handleQuickReplySelection,
    handleDateSelection,
    handlePhotoSelection,
    handleJobCancellation,
    
    // Worker Actions
    handleCategorizationSubmit,
    handleBidSubmit,
    validateWorkerBid,
    
    // Bid Actions
    handleBidAcceptance,
    handleBidRejection,
    
    // NEW: Completion workflow actions
    handleCompletionRequest,
    handleCompletionConfirmation,
    validateCompletionCode,
    
    // NEW: Onboarding code validation
    validateOnboardingCode,

    // NEW: Bubble expiration
    expireWorkerJobBubble,

    // NEW: Rating submission
    handleRatingSubmission,

    // NEW: Chat state management
    checkChatNeedsReinit,
    reinitializeChat,

    // NEW: Explicit navigation methods
    viewJobFeedForCategory,
    continueActiveJobInCategory,

    // Utilities
    clearError,
    retryLastAction,
    clearChat,
    clearChatAfterCancellation,
  }), [
    activeChat,
    allMessages,
    optimisticMessages,
    loading,
    error,
    startChatForCategory,
    loadSpecificChatNavigation, // NEW: Include in dependencies
    sendMessage,
    sendSystemMessage,
    createJobFromChat,
    handleQuickReplySelection,
    handleDateSelection,
    handlePhotoSelection,
    handleJobCancellation,
    handleCategorizationSubmit,
    handleBidSubmit,
    validateWorkerBid,
    handleBidAcceptance,
    handleBidRejection,
    handleCompletionRequest,
    handleCompletionConfirmation,
    validateCompletionCode,
    validateOnboardingCode, // NEW: Add to dependencies
    expireWorkerJobBubble, // NEW: Add to dependencies
    handleRatingSubmission, // NEW: Add to dependencies
    checkChatNeedsReinit, // NEW: Add to dependencies
    reinitializeChat, // NEW: Add to dependencies
    viewJobFeedForCategory, // NEW: Add to dependencies
    continueActiveJobInCategory, // NEW: Add to dependencies
    clearError,
    retryLastAction,
    clearChat,
    clearChatAfterCancellation,
  ]);
  
  return (
    <ChatContext.Provider value={contextValue}>
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
