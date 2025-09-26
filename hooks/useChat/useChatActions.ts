// hooks/useChat/useChatActions.ts - Chat action handlers
import { useCallback, useRef } from 'react';
import { Id } from '../../convex/_generated/dataModel';

import { useChatHooks } from './useChatHooks';
import { Chat, Language, LoadingStates, ChatError, OptimisticMessage, BubbleType, PhotoItem } from './type';

interface UseChatActionsProps {
  user: any;
  activeChat: Chat | null;
  userLanguage: Language;
  setLoadingState: (key: keyof LoadingStates, value: boolean) => void;
  handleError: (type: ChatError['type'], message: string, retryable?: boolean) => void;
  setOptimisticMessages: React.Dispatch<React.SetStateAction<OptimisticMessage[]>>;
  setChatVoiceState: React.Dispatch<React.SetStateAction<Map<Id<'chats'>, { 
    hasFirstVoice: boolean; 
    pendingVoiceMessageId?: Id<'messages'>;
    pendingQuickReplyId?: Id<'messages'>;
  }>>>;
  chatVoiceState: Map<Id<'chats'>, { 
    hasFirstVoice: boolean; 
    pendingVoiceMessageId?: Id<'messages'>;
    pendingQuickReplyId?: Id<'messages'>;
  }>;
  setError: React.Dispatch<React.SetStateAction<ChatError | null>>;
  setLoading: React.Dispatch<React.SetStateAction<LoadingStates>>;
  optimisticIdCounter: React.MutableRefObject<number>;
  t: (key: string) => string;
}

export function useChatActions({
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
}: UseChatActionsProps) {
  const {
    sendMessageMutation,
    sendSystemMessageMutation,
    createJobFromChatMutation,
    deleteVoiceAndQuickReply,
    cancelJobAndClearChatMutation,
    submitCategorizationMutation,
    submitBidMutation,
    acceptBidMutation,
    rejectBidMutation
  } = useChatHooks();
  
  // Refs for retry functionality
  const lastActionRef = useRef<(() => Promise<void>) | null>(null);
  
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
  }), [user, optimisticIdCounter]);
  
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
  }, [user?._id, submitCategorizationMutation, setLoadingState, handleError, setError]);
  
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
  }, [user?._id, submitBidMutation, setLoadingState, handleError, setError]);
  
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
  }, [user?._id, acceptBidMutation, setLoadingState, handleError, setError]);

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
  }, [user?._id, rejectBidMutation, setLoadingState, handleError, setError]);

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
        
        const result = await cancelJobAndClearChatMutation({
          jobId,
          userId: user._id,
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
        console.error('[DEBUG] Failed to cancel job and clear chat:', err);
        handleError('create_job', 'Failed to cancel job. Please try again.', true);
      } finally {
        setLoadingState('creatingJob', false);
      }
    };
    
    lastActionRef.current = action;
    await action();
  }, [user?._id, activeChat, cancelJobAndClearChatMutation, setLoadingState, handleError, setOptimisticMessages, setChatVoiceState, setError, setLoading]);

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
  }, [activeChat, deleteVoiceAndQuickReply, handleError, sendSystemMessageMutation, userLanguage, setChatVoiceState]);

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
  }, [activeChat, user?._id, sendMessageMutation, sendSystemMessageMutation, userLanguage, setLoadingState, handleError, setError]);
  
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
  }, [activeChat, user?._id, sendMessageMutation, sendSystemMessageMutation, userLanguage, setLoadingState, handleError, createJobFromChatMutation, setError]);

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
                pendingVoiceMessageId: sentMessage._id as Id<'messages'>
              }
            });
            
            if (quickReplyMessage) {
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

  return {
    handleCategorizationSubmit,
    handleBidSubmit,
    validateWorkerBid,
    handleJobCancellation,
    handleQuickReplySelection,
    handleDateSelection,
    handlePhotoSelection,
    sendMessage,
    sendSystemMessage,
    createJobFromChat,
    retryLastAction,
    handleBidAcceptance,
    handleBidRejection,
  };
}
