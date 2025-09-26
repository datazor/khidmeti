// hooks/useChat/types.ts - Type definitions for chat system
import { Id } from '../../convex/_generated/dataModel';

// Define the bubble types to match Convex function constraints
export type BubbleType = "text" | "voice" | "photo" | "confirmation" | "date" | "system_instruction" | "job" | "worker_job";
export type SystemBubbleType = "system_instruction" | "system_prompt" | "system_notification";
export type Language = "en" | "fr" | "ar";
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

// User interface for sender data
export interface ChatUser {
  _id: Id<'users'>;
  name: string;
  photo_url?: string;
  user_type: 'customer' | 'worker';
}

export interface Message {
  _id: Id<'messages'>;
  chat_id: Id<'chats'>;
  sender_id: Id<'users'>;
  bubble_type: string; // Keep as string to match Convex query return
  content: string;
  metadata?: any;
  is_dismissed: boolean;
  is_expired: boolean; // ADD THIS LINE - Keep the one with is_expired flag
  created_at: number;
  status: MessageStatus; // Add message status
  delivered_at?: number; // Add delivery timestamp
  read_at?: number; // Add read timestamp
  sender?: ChatUser; // Add sender data from backend join
  isOptimistic?: boolean;
  optimisticStatus?: 'sending' | 'failed';
}

export interface Chat {
  _id: Id<'chats'>;
  customer_id?: Id<'users'>; // UPDATED: Optional for worker notification chats
  category_id: Id<'categories'>;
  job_id?: Id<'jobs'>;
  worker_id?: Id<'users'>; // UPDATED: Optional for customer service chats
  is_cleared: boolean;
  created_at: number;
}

export interface LoadingStates {
  startingChat: boolean;
  sendingMessage: boolean;
  creatingJob: boolean;
  loadingMessages: boolean;
  submittingCategorization: boolean;
  submittingBid: boolean;
}

export interface ChatError {
  type: 'start_chat' | 'send_message' | 'create_job' | 'connection' | 'worker_action';
  message: string;
  retryable: boolean;
}

export interface OptimisticMessage {
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

export interface PhotoItem {
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

export interface ChatContextType {
  // State
  activeChat: Chat | null;
  messages: Message[];
  optimisticMessages: OptimisticMessage[];
  loading: LoadingStates;
  error: ChatError | null;
  
  // Customer Actions
  startChatForCategory: (categoryId: Id<'categories'>) => Promise<void>;
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
  
  // Bid Actions - ADD THESE LINES
  handleBidAcceptance: (bidId: Id<'bids'>) => Promise<void>;
  handleBidRejection: (bidId: Id<'bids'>) => Promise<void>;
  
  // Utilities
  clearError: () => void;
  retryLastAction: () => Promise<void>;
  clearChat: () => void;
  clearChatAfterCancellation: () => void;
}
