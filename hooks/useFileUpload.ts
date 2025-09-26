// hooks/useFileUpload.ts - Integrated with Context
import { useState, useCallback, useEffect, useRef } from 'react';
import { Id } from '../convex/_generated/dataModel';
import { usePhotoUpload, useUpload, useVoiceUpload } from '@/contexts/UploadContext';

interface FileUploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
}

interface FileUploadResult {
  uploadId: Id<'uploads'>;
  fileUrl: string;
  storageId: string;
}

interface UseFileUploadOptions {
  onUploadComplete?: (result: FileUploadResult) => void;
  onUploadError?: (error: string) => void;
  onProgressUpdate?: (progress: number) => void;
}

export function useFileUpload({
  onUploadComplete,
  onUploadError,
  onProgressUpdate,
}: UseFileUploadOptions = {}) {
  
  // Add render counter to track excessive re-renders
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  
  // Local state for component-specific UI
  const [uploadState, setUploadState] = useState<FileUploadState>({
    isUploading: false,
    progress: 0,
    error: null,
  });
  
  // Context hooks
  const { activeUploads, getUploadStatus } = useUpload();
  const { uploadVoice } = useVoiceUpload();
  const { uploadPhoto } = usePhotoUpload();
  
  // Track current job ID for this component instance
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  
  // STABLE CALLBACK REFS - Fix for infinite loop
  const callbacksRef = useRef({
    onUploadComplete,
    onUploadError,
    onProgressUpdate,
  });
  
  // Always keep refs updated with latest callbacks
  callbacksRef.current = {
    onUploadComplete,
    onUploadError,
    onProgressUpdate,
  };
  
  // Update local state based on current job status - FIXED VERSION
  useEffect(() => {
    
    if (!currentJobId) {
      const currentState = uploadState;
      const needsReset = currentState.isUploading || currentState.progress !== 0 || currentState.error !== null;
      
      if (needsReset) {
        setUploadState({ isUploading: false, progress: 0, error: null });
      }
      return;
    }
    
    const job = getUploadStatus(currentJobId);
    
    if (!job) {
      return;
    }
    
    const newState: FileUploadState = {
      isUploading: job.status === 'pending' || job.status === 'uploading',
      progress: job.progress,
      error: job.status === 'failed' ? job.error || 'Upload failed' : null,
    };
    
    // Check if state actually needs to change
    const stateChanged = 
      newState.isUploading !== uploadState.isUploading ||
      newState.progress !== uploadState.progress ||
      newState.error !== uploadState.error;
    
    if (stateChanged) {
      setUploadState(newState);
    }
    
    // Use stable callback refs instead of direct callbacks
    if (job.progress !== uploadState.progress) {
      callbacksRef.current.onProgressUpdate?.(job.progress);
    }
    
    if (job.status === 'completed' && job.result) {
      callbacksRef.current.onUploadComplete?.(job.result);
      setCurrentJobId(null); // Clear job ID after completion
    }
    
    if (job.status === 'failed' && job.error) {
      callbacksRef.current.onUploadError?.(job.error);
      setCurrentJobId(null); // Clear job ID after failure
    }
    
  }, [
    currentJobId, 
    getUploadStatus, 
    uploadState.progress  // Keep this to track progress changes
    // REMOVED: onUploadComplete, onUploadError, onProgressUpdate (now using refs)
  ]);
  
  // Upload voice message
  const uploadVoiceMessage = useCallback(async (
    voiceData: {
      uri: string;
      duration: number;
      size: number;
      mimeType: string;
    },
    userId: Id<'users'>
  ): Promise<FileUploadResult> => {
    
    try {
      const jobId = await uploadVoice(voiceData, userId);
      
      setCurrentJobId(jobId);
      
      // Return a Promise that resolves when upload completes
      return new Promise<FileUploadResult>((resolve, reject) => {
        
        const checkStatus = () => {
          const job = getUploadStatus(jobId);
          
          if (!job) {
            return;
          }
          
          if (job.status === 'completed' && job.result) {
            resolve(job.result);
          } else if (job.status === 'failed') {
            reject(new Error(job.error || 'Upload failed'));
          } else {
            // Still in progress, check again soon
            setTimeout(checkStatus, 100);
          }
        };
        
        // Start checking status
        setTimeout(checkStatus, 100);
      });
      
    } catch (error) {
      throw error;
    }
  }, [uploadVoice, getUploadStatus]);
  
  // Upload photo
  const uploadPhotoMessage = useCallback(async (
    photoData: {
      uri: string;
      type: string;
      size: number;
      width: number;
      height: number;
      fileName?: string;
    },
    userId: Id<'users'>
  ): Promise<FileUploadResult> => {
    
    try {
      const jobId = await uploadPhoto(photoData, userId);
      
      setCurrentJobId(jobId);
      
      // Return a Promise that resolves when upload completes
      return new Promise<FileUploadResult>((resolve, reject) => {
        
        const checkStatus = () => {
          const job = getUploadStatus(jobId);
          
          if (!job) {
            return;
          }
          
          if (job.status === 'completed' && job.result) {
            resolve(job.result);
          } else if (job.status === 'failed') {
            reject(new Error(job.error || 'Upload failed'));
          } else {
            // Still in progress, check again soon
            setTimeout(checkStatus, 100);
          }
        };
        
        // Start checking status
        setTimeout(checkStatus, 100);
      });
      
    } catch (error) {
      throw error;
    }
  }, [uploadPhoto, getUploadStatus]);
  
  // Cancel current upload
  const cancelUpload = useCallback(() => {
    
    if (currentJobId) {
      // Context will handle the cancellation
      const { cancelUpload: contextCancel } = useUpload();
      contextCancel(currentJobId);
      setCurrentJobId(null);
    }
  }, [currentJobId]);
  
  // Clear error
  const clearError = useCallback(() => {
    setUploadState(prev => {
      return { ...prev, error: null };
    });
  }, []);
  
  // Component cleanup - DON'T abort uploads, just clear local state
  useEffect(() => {
    
    return () => {
      // Don't abort uploads - let them continue in the context
      setCurrentJobId(null);
    };
  }, []);
  
  return {
    uploadState,
    uploadVoiceMessage,
    uploadPhoto: uploadPhotoMessage,
    cancelUpload,
    clearError,
  };
}