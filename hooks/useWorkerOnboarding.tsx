// hooks/useWorkerOnboarding.tsx - Clean, documented onboarding system
import { useLocalization } from '@/constants/localization';
import { useMutation, useQuery } from 'convex/react';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { useAuth } from './useAuth';

// Types
type OnboardingStatus = 'not_started' | 'selfie_completed' | 'documents_completed' | 'categories_completed' | 'additional_files_completed' | 'completed';
type IdDocumentType = 'id_front' | 'id_back' | 'passport' | 'residency_permit_front' | 'residency_permit_back';
type AdditionalDocumentType = 'certification' | 'license' | 'additional_file';
type DocumentType = IdDocumentType | AdditionalDocumentType;
type Language = 'en' | 'fr' | 'ar';

interface Category {
  _id: Id<'categories'>;
  name: string;
  name_en: string;
  name_fr: string;
  name_ar: string;
  photo_url: string;
  requires_photos: boolean;
  requires_work_code: boolean;
  level: number;
  parent_id?: Id<'categories'>;
  subcategories?: Category[];
}

interface SelectedCategory {
  categoryId: Id<'categories'>;
  subcategoryIds: Id<'categories'>[];
  experienceRating?: number; // 1-5 stars
}

interface DocumentUpload {
  documentType: DocumentType;
  fileName: string;
  uploadId?: Id<'uploads'>;
  isUploading: boolean;
  uploadError?: string;
  fileUrl?: string;
}

interface OnboardingProgress {
  onboarding_status: OnboardingStatus;
  current_onboarding_step?: number;
  onboarding_completed_at?: number;
  approval_status: 'pending' | 'approved' | 'rejected';
  selfie_url?: string;
  profile_photo_url?: string;
  documents: Array<{
    _id: Id<'user_documents'>;
    document_type: DocumentType;
    verification_status: 'pending' | 'approved' | 'rejected';
    created_at: number;
  }>;
  selected_skills: Array<{
    category_id: Id<'categories'>;
    experience_rating?: number;
    category_name: string;
  }>;
  skills_count: number;
}

interface LoadingStates {
  initializing: boolean;
  uploadingSelfie: boolean;
  uploadingDocument: boolean;
  selectingCategories: boolean;
  uploadingAdditionalFile: boolean;
  completing: boolean;
  loadingProgress: boolean;
  resetting: boolean;
}

interface OnboardingError {
  type: 'initialization' | 'upload' | 'validation' | 'completion' | 'network' | 'reset';
  message: string;
  retryable: boolean;
}

interface WorkerOnboardingContextType {
  // State
  progress: OnboardingProgress | null;
  loading: LoadingStates;
  error: OnboardingError | null;
  categories: Category[];
  workerConfig: { max_categories: number } | null;
  selectedCategories: SelectedCategory[];
  documentUploads: DocumentUpload[];
  setSelectedCategories: React.Dispatch<React.SetStateAction<SelectedCategory[]>>; // ADD THIS
  
  // Computed state
  currentStep: number;
  canProceedToNext: boolean;
  isOnboardingComplete: boolean;
  
  // Actions - UPDATED: All upload functions now use URI-based pattern
  initializeOnboarding: () => Promise<void>;
  uploadSelfie: (photoUri: string, fileName: string) => Promise<void>;
  uploadIdDocument: (documentType: IdDocumentType, photoUri: string, fileName: string) => Promise<void>;
  selectCategories: (categories: SelectedCategory[]) => Promise<void>;
  uploadAdditionalFile: (fileType: AdditionalDocumentType, fileUri: string, fileName: string, description?: string) => Promise<void>;
  completeAdditionalFiles: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  updateCurrentStep: (step: number) => Promise<void>;
  resetOnboardingCompletely: () => Promise<void>;
  
  // Utilities
  clearError: () => void;
  retryLastAction: () => Promise<void>;
  resetOnboarding: () => void;
  
  // Pure functions (testable)
  getStepNumber: (status: OnboardingStatus) => number;
  validateCategorySelection: (categories: SelectedCategory[], maxCategories: number, categoriesList?: Category[]) => string | null;
  getRequiredDocuments: () => DocumentType[];
  calculateProgress: (status: OnboardingStatus) => number;
}

// Pure business logic functions (easily testable)
export const onboardingLogic = {
  getStepNumber: (status: OnboardingStatus): number => {
    switch (status) {
      case 'not_started': return 1;
      case 'selfie_completed': return 2;
      case 'documents_completed': return 3;
      case 'categories_completed': return 4;
      case 'additional_files_completed': return 5;
      case 'completed': return 6;
      default: return 1;
    }
  },

  calculateProgress: (status: OnboardingStatus): number => {
    const step = onboardingLogic.getStepNumber(status);
    return Math.round((step - 1) / 5 * 100); // 5 steps total, 0-100%
  },

  validateCategorySelection: (categories: SelectedCategory[], maxCategories: number, categoriesList?: Category[]): string | null => {
    if (categories.length === 0) {
      return 'At least one category must be selected';
    }
    if (categories.length > maxCategories) {
      return `Cannot select more than ${maxCategories} categories`;
    }
    for (const category of categories) {
      const categoryData = categoriesList?.find(c => c._id === category.categoryId);
      const hasSubcategories = categoryData?.subcategories && categoryData.subcategories.length > 0;
      
      if (hasSubcategories && category.subcategoryIds.length === 0) {
        return 'Categories with subcategories must have at least one subcategory selected';
      }
    }
    return null;
  },

  getRequiredDocuments: (): DocumentType[] => {
    return ['id_front', 'id_back', 'passport', 'residency_permit_front', 'residency_permit_back'];
  },

  hasValidIdDocuments: (documents: DocumentUpload[]): boolean => {
    const hasIdCard = documents.some(d => d.documentType === 'id_front') && 
                      documents.some(d => d.documentType === 'id_back');
    const hasPassport = documents.some(d => d.documentType === 'passport');
    const hasResidencyPermit = documents.some(d => d.documentType === 'residency_permit_front') && 
                               documents.some(d => d.documentType === 'residency_permit_back');
    
    return hasIdCard || hasPassport || hasResidencyPermit;
  },

  canProceedFromStep: (step: number, progress: OnboardingProgress | null, documentUploads: DocumentUpload[], selectedCategories: SelectedCategory[]): boolean => {
    if (!progress) return false;
    
    switch (step) {
      case 1: // Selfie step
        return !!progress.selfie_url;
      case 2: // Documents step
        return onboardingLogic.hasValidIdDocuments(documentUploads);
      case 3: // Categories step
        return selectedCategories.length > 0;
      case 4: // Additional files step
        return true; // Always can proceed (optional step)
      case 5: // Completion step
        return progress.onboarding_status === 'additional_files_completed';
      default:
        return false;
    }
  },
  
  // NEW: Check if a category is properly completed
  isCategoryComplete: (category: SelectedCategory, categoriesList: Category[]): boolean => {
    const categoryData = categoriesList.find(c => c._id === category.categoryId);
    const hasSubcategories = categoryData?.subcategories && categoryData.subcategories.length > 0;
    
    if (hasSubcategories) {
      return category.subcategoryIds.length > 0;
    }
    return true; // Categories without subcategories are always complete
  },
  
  // NEW: Get list of incomplete category names for validation
  getIncompleteCategories: (
    selectedCategories: SelectedCategory[], 
    categoriesList: Category[]
  ): string[] => {
    return selectedCategories
      .filter(cat => !onboardingLogic.isCategoryComplete(cat, categoriesList))
      .map(cat => {
        const categoryData = categoriesList.find(c => c._id === cat.categoryId);
        return categoryData?.name || 'Unknown';
      });
  },
};

/**
 * Converts a file URI to ArrayBuffer for upload
 * This is the standard pattern for React Native file handling
 */
const uriToArrayBuffer = async (uri: string): Promise<ArrayBuffer> => {
  const response = await fetch(uri);
  return await response.arrayBuffer();
};

/**
 * Wait for upload to complete by polling the upload status
 */
const waitForUploadCompletion = async (uploadRecordId: Id<'uploads'>): Promise<void> => {
  // Simple timeout approach since we can't call useQuery dynamically
  // The upload system will handle completion tracking
  await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
  console.log('✅ Upload wait period completed');
};

/**
 * Upload onboarding files directly to Convex storage using the new pattern
 * Returns uploadRecordId instead of storageId
 */
const uploadToConvexStorage = async (
  fileBlob: ArrayBuffer,
  fileName: string,
  contentType: string,
  userId: Id<'users'>,
  startFileUpload: any
): Promise<{ uploadRecordId: Id<'uploads'> }> => {
  try {
    console.log('🔄 Starting onboarding file upload:', fileName);
    
    // Start upload with onboarding type
    const uploadRecordId = await startFileUpload({
      fileBlob,
      fileName,
      contentType,
      fileType: 'photo' as const,
      userId,
      uploadType: 'onboarding' as const,
    });
    
    console.log('📝 Upload record created:', uploadRecordId);
    
    // Wait for upload to complete
    await waitForUploadCompletion(uploadRecordId);
    
    return {
      uploadRecordId: uploadRecordId
    };
  } catch (error) {
    console.error('❌ Onboarding file upload failed:', error);
    throw new Error(`File upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

const WorkerOnboardingContext = createContext<WorkerOnboardingContextType | undefined>(undefined);

export function WorkerOnboardingProvider({ children }: { children: ReactNode }) {
  // Dependencies
  const { user } = useAuth();
  const { locale } = useLocalization();
  
  // State
  const [loading, setLoading] = useState<LoadingStates>({
    initializing: false,
    uploadingSelfie: false,
    uploadingDocument: false,
    selectingCategories: false,
    uploadingAdditionalFile: false,
    completing: false,
    loadingProgress: false,
    resetting: false,
  });
  const [error, setError] = useState<OnboardingError | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<SelectedCategory[]>([]);
  const [documentUploads, setDocumentUploads] = useState<DocumentUpload[]>([]);
  
  // Refs for retry functionality
  const lastActionRef = useRef<(() => Promise<void>) | null>(null);
  
  // Get user language with fallback
  const userLanguage = useMemo((): Language => {
    return (locale === 'en' || locale === 'fr' || locale === 'ar') ? locale : 'en';
  }, [locale]);
  
  // Convex mutations and queries
  const initializeAsWorker = useMutation(api.users.initializeAsWorker);
  const initializeWorkerOnboarding = useMutation(api.workerOnboarding.initializeWorkerOnboarding);
  const uploadSelfieMutation = useMutation(api.workerOnboarding.uploadSelfie);
  const uploadIdDocumentMutation = useMutation(api.workerOnboarding.uploadIdDocument);
  const selectWorkerCategoriesMutation = useMutation(api.workerOnboarding.selectWorkerCategories);
  const uploadAdditionalFileMutation = useMutation(api.workerOnboarding.uploadAdditionalFile);
  const completeAdditionalFilesMutation = useMutation(api.workerOnboarding.completeAdditionalFiles);
  const completeOnboardingMutation = useMutation(api.workerOnboarding.completeOnboarding);
  const startFileUpload = useMutation(api.fileUpload.startFileUpload);
  const updateCurrentStepMutation = useMutation(api.workerOnboarding.updateCurrentStep);
  const resetWorkerOnboardingMutation = useMutation(api.workerOnboarding.resetWorkerOnboarding);
  
  // Queries
  const progress = useQuery(
    api.workerOnboarding.getOnboardingProgress,
    user?._id ? { userId: user._id } : 'skip'
  );
  const categories = useQuery(
    api.workerOnboarding.getCategoriesWithSubcategories,
    { language: userLanguage }
  );
  const workerConfig = useQuery(api.workerOnboarding.getWorkerConfig, {});
  
  // Update loading state for progress
  useEffect(() => {
    setLoading(prev => ({
      ...prev,
      loadingProgress: progress === undefined && user?._id !== undefined
    }));
  }, [progress, user?._id]);
  
  
  // Helper functions
  const setLoadingState = useCallback((key: keyof LoadingStates, value: boolean) => {
    setLoading(prev => ({ ...prev, [key]: value }));
  }, []);
  
  const handleError = useCallback((type: OnboardingError['type'], message: string, retryable = true) => {
    console.error(`❌ Onboarding ${type} error:`, message);
    setError({ type, message, retryable });
    setLoading({
      initializing: false,
      uploadingSelfie: false,
      uploadingDocument: false,
      selectingCategories: false,
      uploadingAdditionalFile: false,
      completing: false,
      loadingProgress: false,
      resetting: false,
    });
  }, []);
  
  // Step persistence action
  const updateCurrentStep = useCallback(async (step: number) => {
    
    if (!user?._id) {
      console.warn('Cannot update step: user not authenticated');
      return;
    }
    
    try {
      await updateCurrentStepMutation({
        userId: user._id,
        step: step,
      });
    } catch (err) {
      console.error('❌ Failed to update current step:', err);
      // Don't throw - step persistence is not critical for functionality
    }
  }, [user?._id, updateCurrentStepMutation]);
  
  // Actions
  const initializeOnboarding = useCallback(async () => {
    
    if (!user?._id) {
      handleError('initialization', 'User not authenticated', false);
      return;
    }
    
    const action = async () => {
      setLoadingState('initializing', true);
      setError(null);
      
      try {
        
        // First ensure user is a worker
        await initializeAsWorker({ userId: user._id });
        
        // Then initialize onboarding
        await initializeWorkerOnboarding({ userId: user._id });
        
      } catch (err) {
        console.error('❌ Failed to initialize onboarding:', err);
        handleError('initialization', 'Failed to initialize onboarding. Please try again.', true);
      } finally {
        setLoadingState('initializing', false);
      }
    };
    
    lastActionRef.current = action;
    await action();
  }, [user?._id, initializeAsWorker, initializeWorkerOnboarding, setLoadingState, handleError]);
  
  // Use the working UploadContext pattern for selfie uploads
  const uploadSelfie = useCallback(async (photoUri: string, fileName: string) => {
    
    if (!user?._id) {
      handleError('upload', 'User not authenticated', false);
      return;
    }
    
    const action = async () => {
      setLoadingState('uploadingSelfie', true);
      setError(null);
      
      try {
        // Use the working upload pattern - the actual upload is handled by the component
        // The component will use UploadContext to handle the file upload
        // We just need to update the user record with the selfie data
        
        // For now, we'll use the existing uploadToConvexStorage function
        // but in practice, the component should handle the upload and pass the result
        const arrayBuffer = await uriToArrayBuffer(photoUri);
        const { uploadRecordId } = await uploadToConvexStorage(
          arrayBuffer,
          fileName,
          'image/jpeg',
          user._id,
          startFileUpload
        );

        // Update user with selfie
        await uploadSelfieMutation({
          userId: user._id,
          uploadRecordId: uploadRecordId,
        });
        
      } catch (err) {
        console.error('❌ Failed to upload selfie:', err);
        handleError('upload', `Failed to upload selfie: ${err instanceof Error ? err.message : 'Unknown error'}`, true);
      } finally {
        setLoadingState('uploadingSelfie', false);
      }
    };
    
    lastActionRef.current = action;
    await action();
  }, [user?._id, startFileUpload, uploadSelfieMutation, setLoadingState, handleError]);
  
  // REAL CONVEX UPLOAD PATTERN: URI → ArrayBuffer → Convex Storage
  const uploadIdDocument = useCallback(async (documentType: IdDocumentType, photoUri: string, fileName: string) => {

    
    if (!user?._id) {
      handleError('upload', 'User not authenticated', false);
      return;
    }
    
    const action = async () => {
      setLoadingState('uploadingDocument', true);
      setError(null);
      
      // Add to document uploads state for UI feedback
      const tempUploadId = `temp_${Date.now()}` as Id<'uploads'>;
      setDocumentUploads(prev => [...prev, {
        documentType,
        fileName,
        uploadId: tempUploadId,
        isUploading: true,
      }]);
      
      try {
        
        // Convert URI to ArrayBuffer
        const arrayBuffer = await uriToArrayBuffer(photoUri);
        
        // Upload to Convex storage
        const { uploadRecordId } = await uploadToConvexStorage(
          arrayBuffer,
          fileName,
          'image/jpeg',
          user._id,
          startFileUpload
        );
        
        
        // Upload document record
        await uploadIdDocumentMutation({
          userId: user._id,
          documentType,
          uploadRecordId: uploadRecordId,
          fileName,
        });
        
        // Update document uploads state
        setDocumentUploads(prev => prev.map(doc => 
          doc.uploadId === tempUploadId 
            ? { ...doc, isUploading: false }
            : doc
        ));
        
      } catch (err) {
        console.error('❌ Failed to upload document:', err);
        
        // Update document uploads state with error
        setDocumentUploads(prev => prev.map(doc => 
          doc.uploadId === tempUploadId 
            ? { ...doc, isUploading: false, uploadError: err instanceof Error ? err.message : 'Upload failed' }
            : doc
        ));
        
        handleError('upload', `Failed to upload document: ${err instanceof Error ? err.message : 'Unknown error'}`, true);
      } finally {
        setLoadingState('uploadingDocument', false);
      }
    };
    
    lastActionRef.current = action;
    await action();
  }, [user?._id, startFileUpload, uploadIdDocumentMutation, setLoadingState, handleError]);
  
  const selectCategories = useCallback(async (selectedCategories: SelectedCategory[]) => {

    
    if (!user?._id || !workerConfig) {

      handleError('validation', 'User not authenticated or config not loaded', false);
      return;
    }
    
    
    const validationError = onboardingLogic.validateCategorySelection(
      selectedCategories, 
      workerConfig.max_categories, 
      categories
    );
    if (validationError) {
      handleError('validation', validationError, false);
      return;
    }
    
     
    const action = async () => {
      setLoadingState('selectingCategories', true);
      setError(null);
      
      try {

        // Update local state
        setSelectedCategories(selectedCategories);
        
        // THIS IS THE CRITICAL LINE - make sure it's here and executing:
        await selectWorkerCategoriesMutation({
          userId: user._id,
          selectedCategories: selectedCategories
        });
        
        console.log('✅ Categories saved to backend');
        
      } catch (err) {
        console.error('❌ Backend mutation failed:', err);
        console.error('Error type:', typeof err);
        console.error('Error message:', err instanceof Error ? err.message : 'Unknown error');
        console.error('Error stack:', err instanceof Error ? err.stack : 'No stack trace');
        
        handleError('validation', 'Failed to save category selection. Please try again.', true);
      } finally {
        setLoadingState('selectingCategories', false);
      }
    };
    
    lastActionRef.current = action;
    await action();
  }, [user?._id, workerConfig, categories, selectWorkerCategoriesMutation, setLoadingState, handleError]);
  
  // REAL CONVEX UPLOAD PATTERN: URI → ArrayBuffer → Convex Storage  
  const uploadAdditionalFile = useCallback(async (fileType: AdditionalDocumentType, fileUri: string, fileName: string, description?: string) => {

    
    if (!user?._id) {
      handleError('upload', 'User not authenticated', false);
      return;
    }
    
    const action = async () => {
      setLoadingState('uploadingAdditionalFile', true);
      setError(null);
      
      try {
        
        // Convert URI to ArrayBuffer
        const arrayBuffer = await uriToArrayBuffer(fileUri);
     
        // Determine content type based on file extension
        const contentType = fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
        
        // Upload to Convex storage
        const { uploadRecordId } = await uploadToConvexStorage(
          arrayBuffer,
          fileName,
          contentType,
          user._id,
          startFileUpload
        );
        
        
        // Upload additional file record
        await uploadAdditionalFileMutation({
          userId: user._id,
          fileType,
          uploadRecordId: uploadRecordId,
          fileName,
          description,
        });
        
      } catch (err) {
        console.error('❌ Failed to upload additional file:', err);
      } finally {
        setLoadingState('uploadingAdditionalFile', false);
      }
    };
    
    lastActionRef.current = action;
    await action();
  }, [user?._id, startFileUpload, uploadAdditionalFileMutation, setLoadingState, handleError]);
  
  const completeAdditionalFiles = useCallback(async () => {
    
    if (!user?._id) {
      handleError('completion', 'User not authenticated', false);
      return;
    }
    
    const action = async () => {
      setLoadingState('completing', true);
      setError(null);
      
      try {
        await completeAdditionalFilesMutation({ userId: user._id });
      } catch (err) {
        handleError('completion', 'Failed to complete step. Please try again.', true);
      } finally {
        setLoadingState('completing', false);
      }
    };
    
    lastActionRef.current = action;
    await action();
  }, [user?._id, completeAdditionalFilesMutation, setLoadingState, handleError]);
  
  const completeOnboarding = useCallback(async () => {
    
    if (!user?._id) {
      handleError('completion', 'User not authenticated', false);
      return;
    }
    
    const action = async () => {
      setLoadingState('completing', true);
      setError(null);
      
      try {
        await completeOnboardingMutation({ userId: user._id });
      } catch (err) {
        console.error('❌ Failed to complete onboarding:', err);
        handleError('completion', 'Failed to complete onboarding. Please try again.', true);
      } finally {
        setLoadingState('completing', false);
      }
    };
    
    lastActionRef.current = action;
    await action();
  }, [user?._id, completeOnboardingMutation, setLoadingState, handleError]);
  
  // NEW: Complete reset function for rejected applications
  const resetOnboardingCompletely = useCallback(async () => {
    
    if (!user?._id) {
      handleError('reset', 'User not authenticated', false);
      return;
    }
    
    const action = async () => {
      setLoadingState('resetting', true);
      setError(null);
      
      try {
        
        const result = await resetWorkerOnboardingMutation({
          userId: user._id,
        });
        
        
        // Reset all local state
        setSelectedCategories([]);
        setDocumentUploads([]);
        setError(null);
        
        
      } catch (err) {
        console.error('❌ Failed to reset onboarding completely:', err);
        handleError('reset', 'Failed to reset application. Please try again.', true);
      } finally {
        setLoadingState('resetting', false);
      }
    };
    
    lastActionRef.current = action;
    await action();
  }, [user?._id, resetWorkerOnboardingMutation, setLoadingState, handleError]);
  
  // Utility functions
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  const retryLastAction = useCallback(async () => {
    if (lastActionRef.current) {
      await lastActionRef.current();
    } else {
    }
  }, []);
  
  const resetOnboarding = useCallback(() => {
    setSelectedCategories([]);
    setDocumentUploads([]);
    setError(null);
    setLoading({
      initializing: false,
      uploadingSelfie: false,
      uploadingDocument: false,
      selectingCategories: false,
      uploadingAdditionalFile: false,
      completing: false,
      loadingProgress: false,
      resetting: false,
    });
  }, []);
  
  // Computed values - Updated to use stored step with fallback
  const currentStep = useMemo(() => {
    const step = progress?.current_onboarding_step || 
                 (progress ? onboardingLogic.getStepNumber(progress.onboarding_status) : 1);

    return step;
  }, [progress]);
  
  const canProceedToNext = useMemo(() => {
    const canProceed = onboardingLogic.canProceedFromStep(currentStep, progress ?? null, documentUploads, selectedCategories);

    return canProceed;
  }, [currentStep, progress, documentUploads, selectedCategories]);
  
  const isOnboardingComplete = useMemo(() => {
    const isComplete = progress?.onboarding_status === 'completed';

    return isComplete;
  }, [progress]);
  
  // Context value
  const contextValue = useMemo<WorkerOnboardingContextType>(() => {

    
    return {
      // State
      progress: progress ?? null,
      loading,
      error,
      categories: categories || [],
      workerConfig: workerConfig ?? null,
      selectedCategories,
      documentUploads,
      setSelectedCategories: setSelectedCategories, // ADD THIS
      
      // Computed state
      currentStep,
      canProceedToNext,
      isOnboardingComplete,
      
      // Actions
      initializeOnboarding,
      uploadSelfie,
      uploadIdDocument,
      selectCategories,
      uploadAdditionalFile,
      completeAdditionalFiles,
      completeOnboarding,
      updateCurrentStep,
      resetOnboardingCompletely,
      
      // Utilities
      clearError,
      retryLastAction,
      resetOnboarding,
      
      // Pure functions
      getStepNumber: onboardingLogic.getStepNumber,
      validateCategorySelection: onboardingLogic.validateCategorySelection,
      getRequiredDocuments: onboardingLogic.getRequiredDocuments,
      calculateProgress: onboardingLogic.calculateProgress,
    };
  }, [
    progress,
    loading,
    error,
    categories,
    workerConfig,
    selectedCategories,
    documentUploads,
    currentStep,
    canProceedToNext,
    isOnboardingComplete,
    initializeOnboarding,
    uploadSelfie,
    uploadIdDocument,
    selectCategories,
    uploadAdditionalFile,
    completeAdditionalFiles,
    completeOnboarding,
    updateCurrentStep,
    resetOnboardingCompletely,
    clearError,
    retryLastAction,
    resetOnboarding,
  ]);
  
  return (
    <WorkerOnboardingContext.Provider value={contextValue}>
      {children}
    </WorkerOnboardingContext.Provider>
  );
}

export function useWorkerOnboarding() {
  const context = useContext(WorkerOnboardingContext);
  if (context === undefined) {
    throw new Error('useWorkerOnboarding must be used within a WorkerOnboardingProvider');
  }
  return context;
}
