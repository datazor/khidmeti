// hooks/useWorkerJobs.tsx - Production-ready worker job management hook
import React, { createContext, useContext, ReactNode, useState, useCallback, useMemo, useEffect } from 'react';
import { Id } from '../convex/_generated/dataModel';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { useAuth } from './useAuth';

// Job data interface matching backend response
interface WorkerJob {
  jobId: Id<'jobs'>;
  categoryId: Id<'categories'>;
  categoryName: string;
  categoryNameFr: string;
  categoryNameAr: string;
  voiceUrl?: string;
  voiceDuration: number;
  photos: string[];
  locationLat: number;
  locationLng: number;
  priceFloor: number;
  portfolioConsent: boolean;
  broadcastingPhase: number;
  customerName: string;
  createdAt: number;
  hasSubcategory: boolean;
  subcategoryId?: Id<'categories'>;
}

// Chat interface for unified worker interface
interface WorkerChat {
  _id: Id<'chats'>;
  customer_id?: Id<'users'>;
  worker_id?: Id<'users'>;
  category_id: Id<'categories'>;
  job_id?: Id<'jobs'>;
  is_cleared: boolean;
  created_at: number;
}

// Subcategory option from backend
interface SubcategoryOption {
  id: Id<'categories'>;
  nameEn: string;
  nameFr: string;
  nameAr: string;
  photoUrl: string;
  requiresPhotos: boolean;
  requiresWorkCode: boolean;
  level: number;
}

// Bid validation result from backend
interface BidValidationResult {
  isValid: boolean;
  minimumAmount: number;
  baselinePrice: number;
  minimumPercentage?: number;
  reason?: string;
}

// Loading states
interface WorkerLoadingStates {
  loadingJobs: boolean;
  loadingChats: boolean;
  submittingCategorization: boolean;
  submittingBid: boolean;
  loadingSubcategories: boolean;
}

// Error types
interface WorkerError {
  type: 'jobs' | 'chats' | 'categorization' | 'bidding' | 'validation';
  message: string;
  retryable: boolean;
}

// Context interface
interface WorkerJobsContextType {
  // State
  eligibleJobs: WorkerJob[];
  workerChats: WorkerChat[];
  notificationChats: WorkerChat[];
  conversationChats: WorkerChat[];
  loading: WorkerLoadingStates;
  error: WorkerError | null;
  
  // Actions
  refreshJobs: () => void;
  refreshChats: () => void;
  submitCategorization: (jobId: Id<'jobs'>, subcategoryId: Id<'categories'>) => Promise<void>;
  submitBid: (jobId: Id<'jobs'>, amount: number, equipmentCost?: number) => Promise<void>;
  
  // Utilities
  clearError: () => void;
  isWorkerEligible: () => boolean;
  getChatForCategory: (categoryId: Id<'categories'>) => WorkerChat | undefined;
  
  // NEW: Navigation control
  shouldBypassJobFeed: (categoryId: Id<'categories'>) => boolean;
  getActiveJobChat: (categoryId: Id<'categories'>) => WorkerChat | undefined;
  clearNavigationBypass: () => void;
  
  // NEW: Helper for navigation decisions
  getActiveJobInCategory: (categoryId: Id<'categories'>) => WorkerChat | null;
}

const WorkerJobsContext = createContext<WorkerJobsContextType | undefined>(undefined);

export function WorkerJobsProvider({ children }: { children: ReactNode }) {
  // Dependencies
  const { user } = useAuth();
  
  // State
  const [loading, setLoading] = useState<WorkerLoadingStates>({
    loadingJobs: false,
    loadingChats: false,
    submittingCategorization: false,
    submittingBid: false,
    loadingSubcategories: false,
  });
  const [error, setError] = useState<WorkerError | null>(null);
  
  // NEW: Navigation bypass tracking
  const [navigationBypass, setNavigationBypass] = useState<Set<Id<'categories'>>>(new Set());
  
  // Convex mutations
  const submitCategorizationMutation = useMutation(api.workerJobs.submitCategorization);
  const submitBidMutation = useMutation(api.workerJobs.submitWorkerBid);
  
  // Worker eligibility check
  const isWorkerEligible = useCallback(() => {
    return user?.user_type === 'worker' && (user.balance > 0);
  }, [user]);
  
  // UPDATED: Get eligible jobs using direct query (for backward compatibility)
  const eligibleJobsQuery = useQuery(
    api.workerJobs.getWorkerEligibleJobs,
    isWorkerEligible() && user ? { workerId: user._id } : 'skip'
  );
  
  // NEW: Get worker's chats for unified interface
  const workerChatsQuery = useQuery(
    api.chats.getWorkerChats,
    isWorkerEligible() && user ? { workerId: user._id } : 'skip'
  );
  
  // Memoized eligible jobs (for backward compatibility)
  const eligibleJobs = useMemo(() => {
    return eligibleJobsQuery || [];
  }, [eligibleJobsQuery]);
  
  // NEW: Memoized worker chats
  const workerChats = useMemo(() => {
    return workerChatsQuery || [];
  }, [workerChatsQuery]);
  
  // NEW: Separate notification chats from conversation chats
  const notificationChats = useMemo(() => 
    workerChats.filter(chat => !chat.customer_id)
  , [workerChats]);
  
  const conversationChats = useMemo(() => 
    workerChats.filter(chat => !!chat.customer_id)
  , [workerChats]);

  
  // Update loading states
  useEffect(() => {
    setLoading(prev => ({
      ...prev,
      loadingJobs: eligibleJobsQuery === undefined && isWorkerEligible(),
      loadingChats: workerChatsQuery === undefined && isWorkerEligible(),
    }));
  }, [eligibleJobsQuery, workerChatsQuery, isWorkerEligible]);
  
  // Loading helper
  const setLoadingState = useCallback((key: keyof WorkerLoadingStates, value: boolean) => {
    setLoading(prev => ({ ...prev, [key]: value }));
  }, []);
  
  // Error handling helper
  const handleError = useCallback((type: WorkerError['type'], message: string, retryable = true) => {
    setError({ type, message, retryable });
    // Clear all loading states on error
    setLoading({
      loadingJobs: false,
      loadingChats: false,
      submittingCategorization: false,
      submittingBid: false,
      loadingSubcategories: false,
    });
  }, []);
  
  // Refresh jobs (rely on Convex reactivity)
  const refreshJobs = useCallback(() => {
    // Convex queries automatically refresh, so we just clear any errors
    if (error?.type === 'jobs') {
      setError(null);
    }
  }, [error]);
  
  // NEW: Refresh chats
  const refreshChats = useCallback(() => {
    // Convex queries automatically refresh, so we just clear any errors
    if (error?.type === 'chats') {
      setError(null);
    }
  }, [error]);
  
  // Submit categorization
  const submitCategorization = useCallback(async (
    jobId: Id<'jobs'>, 
    subcategoryId: Id<'categories'>
  ) => {
    if (!user?._id) {
      handleError('categorization', 'User not authenticated', false);
      return;
    }
    
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
      handleError('categorization', errorMessage, true);
    } finally {
      setLoadingState('submittingCategorization', false);
    }
  }, [user?._id, submitCategorizationMutation, setLoadingState, handleError]);
  
  // Submit bid
  const submitBid = useCallback(async (
    jobId: Id<'jobs'>, 
    amount: number, 
    equipmentCost = 0
  ) => {
    if (!user?._id) {
      handleError('bidding', 'User not authenticated', false);
      return;
    }
    
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
      handleError('bidding', errorMessage, true);
    } finally {
      setLoadingState('submittingBid', false);
    }
  }, [user?._id, submitBidMutation, setLoadingState, handleError]);
  
  // NEW: Get chat for specific category (for navigation)
  const getChatForCategory = useCallback((categoryId: Id<'categories'>) => {
    return workerChats.find(chat => chat.category_id === categoryId);
  }, [workerChats]);
  
  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  // NEW: Check if navigation should bypass job feed for a category
  const shouldBypassJobFeed = useCallback((categoryId: Id<'categories'>): boolean => {
    return navigationBypass.has(categoryId);
  }, [navigationBypass]);

  // NEW: Get active job chat for direct navigation
  const getActiveJobChat = useCallback((categoryId: Id<'categories'>): WorkerChat | undefined => {
    return conversationChats.find(chat => 
      chat.category_id === categoryId && 
      chat.job_id && 
      chat.customer_id // Active conversation chat
    );
  }, [conversationChats]);

  // NEW: Clear navigation bypass (called when user manually chooses job feed)
  const clearNavigationBypass = useCallback(() => {
    setNavigationBypass(new Set());
  }, []);

  // NEW: Helper for navigation decisions
  const getActiveJobInCategory = useCallback((categoryId: Id<'categories'>): WorkerChat | null => {
    return conversationChats.find(chat => 
      chat.category_id === categoryId && 
      chat.customer_id && 
      chat.job_id
    ) || null;
  }, [conversationChats]);
  
  // Memoized context value
  const contextValue = useMemo<WorkerJobsContextType>(() => ({
    // State
    eligibleJobs,
    workerChats,
    notificationChats,
    conversationChats,
    loading,
    error,
    
    // Actions
    refreshJobs,
    refreshChats,
    submitCategorization,
    submitBid,
    
    // Utilities
    clearError,
    isWorkerEligible,
    getChatForCategory,
    
    // NEW: Navigation control
    shouldBypassJobFeed,
    getActiveJobChat,
    clearNavigationBypass,
    
    // NEW: Helper for navigation decisions
    getActiveJobInCategory,
  }), [
    eligibleJobs,
    workerChats,
    notificationChats,
    conversationChats,
    loading,
    error,
    refreshJobs,
    refreshChats,
    submitCategorization,
    submitBid,
    clearError,
    isWorkerEligible,
    getChatForCategory,
    shouldBypassJobFeed,
    getActiveJobChat,
    clearNavigationBypass,
    getActiveJobInCategory,
  ]);
  
  return (
    <WorkerJobsContext.Provider value={contextValue}>
      {children}
    </WorkerJobsContext.Provider>
  );
}

export function useWorkerJobs() {
  const context = useContext(WorkerJobsContext);
  if (context === undefined) {
    throw new Error('useWorkerJobs must be used within a WorkerJobsProvider');
  }
  return context;
}

// Specialized hooks for specific functionality

// Hook for real-time job feed (backward compatibility)
export function useWorkerJobFeed() {
  const { eligibleJobs, loading, error, refreshJobs, isWorkerEligible } = useWorkerJobs();
  
  return {
    jobs: eligibleJobs,
    isLoading: loading.loadingJobs,
    error: error?.type === 'jobs' ? error : null,
    refresh: refreshJobs,
    canReceiveJobs: isWorkerEligible(),
  };
}

// NEW: Hook for unified chat interface
export function useWorkerChats() {
  const { 
    workerChats, 
    notificationChats, 
    conversationChats, 
    loading, 
    error, 
    refreshChats,
    getChatForCategory 
  } = useWorkerJobs();
  
  return {
    allChats: workerChats,
    notificationChats,
    conversationChats,
    isLoading: loading.loadingChats,
    error: error?.type === 'chats' ? error : null,
    refresh: refreshChats,
    getChatForCategory,
  };
}

// Hook for subcategory selection - components should use useQuery directly
export function useSubcategorySelection() {
  const { submitCategorization, loading, error } = useWorkerJobs();
  
  return {
    submitCategorization,
    isSubmitting: loading.submittingCategorization,
    error: error?.type === 'categorization' ? error : null,
  };
}

// Hook for bid submission
export function useBidSubmission() {
  const { submitBid, loading, error } = useWorkerJobs();
  
  return {
    submitBid,
    isSubmitting: loading.submittingBid,
    error: error?.type === 'bidding' ? error : null,
  };
}

// Hook for bid validation - components should use useQuery directly
export function useBidValidation(subcategoryId?: Id<'categories'>, amount?: number) {
  // Use the validation query directly when both parameters are available
  const validationResult = useQuery(
    api.workerJobs.validateBidAmount,
    subcategoryId && amount !== undefined ? { subcategoryId, bidAmount: amount } : 'skip'
  );
  
  return {
    validationResult,
    isValidating: validationResult === undefined && subcategoryId && amount !== undefined,
  };
}

// Hook for subcategories - using existing categories API
export function useSubcategories(categoryId?: Id<'categories'>) {
  // For now, return empty until you add getSubcategories to convex/categories.ts
  // You'll need to add this query to your categories file:
  /*
  export const getSubcategories = query({
    args: { 
      categoryId: v.id('categories'),
      language: v.optional(v.union(v.literal("en"), v.literal("fr"), v.literal("ar")))
    },
    handler: async (ctx, args) => {
      const subcategories = await ctx.db
        .query('categories')
        .withIndex('by_parent', (q) => q.eq('parent_id', args.categoryId))
        .collect();
      
      const language = args.language || "en";
      
      return subcategories.map(subcategory => ({
        id: subcategory._id,
        nameEn: subcategory.name_en,
        nameFr: subcategory.name_fr,
        nameAr: subcategory.name_ar,
        photoUrl: subcategory.photo_url,
        requiresPhotos: subcategory.requires_photos,
        requiresWorkCode: subcategory.requires_work_code,
        level: subcategory.level,
      }));
    },
  });
  */
  
  return {
    subcategories: [],
    isLoading: false,
  };
}
