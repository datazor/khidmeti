// hooks/useChat/useChatHooks.ts - Convex mutations and queries for chat
import React from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { Chat } from './type';

export function useChatHooks() {
  // Convex mutations - memoized to prevent recreation
  const getOrCreateCategoryChat = useMutation(api.chats.getOrCreateCategoryChat);
  const getOrCreateWorkerCategoryChat = useMutation(api.chats.getOrCreateWorkerCategoryChat);
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

  // Chat mutations
  const loadSpecificChatMutation = useMutation(api.chats.loadSpecificChat);

  return {
    getOrCreateCategoryChat,
    getOrCreateWorkerCategoryChat,
    sendMessageMutation,
    sendSystemMessageMutation,
    createJobFromChatMutation,
    sendInitialInstructions,
    deleteVoiceAndQuickReply,
    cancelJobAndClearChatMutation,
    submitCategorizationMutation,
    submitBidMutation,
    acceptBidMutation,
    rejectBidMutation,
    loadSpecificChatMutation,
  };
}

export function useChatMessages(activeChat: Chat | null) {
  // Messages query with conditional loading
  const messagesQuery = useQuery(
    api.chats.getChatMessages,
    activeChat ? { 
      chatId: activeChat._id, 
      paginationOpts: { numItems: 50, cursor: null } 
    } : 'skip'
  );

  return messagesQuery;
}
