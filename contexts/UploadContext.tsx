// contexts/UploadContext.tsx - Global upload management
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { getInfoAsync, readAsStringAsync } from 'expo-file-system/legacy';

interface UploadJob {
  id: string;
  uploadId: Id<'uploads'> | null;
  fileUri: string;
  fileName: string;
  contentType: string;
  fileType: 'voice' | 'photo';
  userId: Id<'users'>;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  progress: number;
  error?: string;
  result?: {
    uploadId: Id<'uploads'>;
    fileUrl: string;
    storageId: string;
  };
}

interface UploadContextValue {
  // State
  activeUploads: Map<string, UploadJob>;
  
  // Actions
  startUpload: (job: Omit<UploadJob, 'id' | 'uploadId' | 'status' | 'progress'>) => Promise<string>;
  cancelUpload: (jobId: string) => void;
  retryUpload: (jobId: string) => void;
  
  // Utilities
  getUploadStatus: (jobId: string) => UploadJob | undefined;
  isUploading: boolean;
}

const UploadContext = createContext<UploadContextValue | null>(null);

export function UploadProvider({ children }: { children: React.ReactNode }) {
  // Add render counter to track excessive re-renders
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;

  const [activeUploads, setActiveUploads] = useState<Map<string, UploadJob>>(new Map());
  
  // Convex mutations
  const startFileUpload = useMutation(api.fileUpload.startFileUpload);
  
  // Track all active upload IDs for queries
  const uploadIds = Array.from(activeUploads.values())
    .map(job => job.uploadId)
    .filter(Boolean) as Id<'uploads'>[];
  
  // Watch upload statuses
  const uploadStatuses = useQuery(
    api.fileUpload.getMultipleUploadStatuses,
    uploadIds.length > 0 ? { ids: uploadIds } : 'skip'
  );

  // Generate unique job ID
  const generateJobId = useCallback(() => {
    const jobId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return jobId;
  }, []);

  // Convert file to ArrayBuffer
  const convertFileToArrayBuffer = useCallback(async (fileUri: string): Promise<ArrayBuffer> => {
    const fileInfo = await getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error('File does not exist');
    }
    
    const base64Data = await readAsStringAsync(fileUri, { encoding: 'base64' });
    const binaryString = atob(base64Data);
    const arrayBuffer = new ArrayBuffer(binaryString.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    
    for (let i = 0; i < binaryString.length; i++) {
      uint8Array[i] = binaryString.charCodeAt(i);
    }
    
    return arrayBuffer;
  }, []);

  // 🚀 Track pending cleanups to prevent duplicates
  const pendingCleanupsRef = useRef<Set<string>>(new Set());

  // Update job status - FIXED VERSION
  const updateJob = useCallback((jobId: string, updates: Partial<UploadJob>) => {
    setActiveUploads(prev => {
      const newMap = new Map(prev);
      const existingJob = newMap.get(jobId);
      
      if (existingJob) {
        const updatedJob = { ...existingJob, ...updates };
        newMap.set(jobId, updatedJob);
      }
      
      return newMap;
    });
  }, []); // 🚀 FIXED: No dependencies = stable function

  // Remove completed/failed jobs after delay - FIXED VERSION
  const cleanupJob = useCallback((jobId: string) => {
    // Prevent duplicate cleanups
    if (pendingCleanupsRef.current.has(jobId)) {
      return;
    }
    
    pendingCleanupsRef.current.add(jobId);
    
    setTimeout(() => {
      pendingCleanupsRef.current.delete(jobId); // Remove from pending
      
      setActiveUploads(prev => {
        const newMap = new Map(prev);
        const existed = newMap.delete(jobId);
        return newMap;
      });
    }, 5000); // Remove after 5 seconds
  }, []); // 🚀 FIXED: No dependencies = stable function

  // Start upload
  const startUpload = useCallback(async (jobData: Omit<UploadJob, 'id' | 'uploadId' | 'status' | 'progress'>): Promise<string> => {
    const jobId = generateJobId();
    
    // Create initial job
    const job: UploadJob = {
      id: jobId,
      uploadId: null,
      status: 'pending',
      progress: 0,
      ...jobData,
    };
    
    setActiveUploads(prev => {
      const newMap = new Map(prev);
      newMap.set(jobId, job);
      return newMap;
    });
    
    try {
      // Convert file
      updateJob(jobId, { status: 'uploading', progress: 20 });
      const arrayBuffer = await convertFileToArrayBuffer(jobData.fileUri);
      
      // Start upload
      updateJob(jobId, { progress: 40 });
      const uploadId = await startFileUpload({
        fileBlob: arrayBuffer,
        fileName: jobData.fileName,
        contentType: jobData.contentType,
        fileType: jobData.fileType,
        userId: jobData.userId,
      });
      
      // Update with uploadId for status tracking
      updateJob(jobId, { uploadId, progress: 60 });
      
      return jobId;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      updateJob(jobId, { 
        status: 'failed', 
        progress: 0, 
        error: errorMessage 
      });
      cleanupJob(jobId);
      throw error;
    }
  }, [generateJobId, convertFileToArrayBuffer, startFileUpload, updateJob, cleanupJob]);

  // 🚨 CRITICAL: Handle upload status updates from Convex - FIXED VERSION
  useEffect(() => {
    if (!uploadStatuses) {
      return;
    }
    
    uploadStatuses.forEach(status => {
      // Find job by uploadId using current activeUploads from closure
      setActiveUploads(currentActiveUploads => {
        const job = Array.from(currentActiveUploads.values())
          .find(j => j.uploadId === status._id);
        
        if (!job) {
          return currentActiveUploads; // No change
        }
        
        let shouldUpdate = false;
        let updates: Partial<UploadJob> = {};
        
        switch (status.status) {
          case 'completed':
            if (status.fileUrl && status.storageId) {
              shouldUpdate = true;
              updates = {
                status: 'completed',
                progress: 100,
                result: {
                  uploadId: status._id,
                  fileUrl: status.fileUrl,
                  storageId: status.storageId,
                }
              };
              cleanupJob(job.id);
            }
            break;
            
          case 'failed':
            shouldUpdate = true;
            updates = {
              status: 'failed',
              progress: 0,
              error: status.errorMessage || 'Upload failed'
            };
            cleanupJob(job.id);
            break;
            
          case 'pending':
            shouldUpdate = true;
            updates = { progress: 80 };
            break;
        }
        
        if (shouldUpdate) {
          const newMap = new Map(currentActiveUploads);
          const updatedJob = { ...job, ...updates };
          newMap.set(job.id, updatedJob);
          return newMap;
        }
        
        return currentActiveUploads; // No change
      });
    });
  }, [uploadStatuses, cleanupJob]); // Only stable dependencies

  // Cancel upload
  const cancelUpload = useCallback((jobId: string) => {
    updateJob(jobId, { status: 'failed', error: 'Cancelled by user' });
    cleanupJob(jobId);
  }, [updateJob, cleanupJob]);

  // Retry upload - FIXED VERSION
  const retryUpload = useCallback((jobId: string) => {
    setActiveUploads(currentActiveUploads => {
      const job = currentActiveUploads.get(jobId);
      if (!job) {
        return currentActiveUploads;
      }
      
      // Reset job and restart
      const resetJob = { 
        ...job,
        status: 'pending' as const, 
        progress: 0, 
        error: undefined,
        uploadId: null 
      };
      
      const newMap = new Map(currentActiveUploads);
      newMap.set(jobId, resetJob);
      
      // Restart upload process
      startUpload({
        fileUri: job.fileUri,
        fileName: job.fileName,
        contentType: job.contentType,
        fileType: job.fileType,
        userId: job.userId,
      }).catch((error) => {
        // Error already handled in startUpload
      });
      
      return newMap;
    });
  }, [startUpload]);

  // Get upload status - FIXED VERSION using current activeUploads
  const getUploadStatus = useCallback((jobId: string) => {
    const job = activeUploads.get(jobId);
    return job;
  }, [activeUploads]); // Keep this dependency to return current data

  // Check if any uploads are active
  const isUploading = Array.from(activeUploads.values())
    .some(job => job.status === 'pending' || job.status === 'uploading');

  const value: UploadContextValue = {
    activeUploads,
    startUpload,
    cancelUpload,
    retryUpload,
    getUploadStatus,
    isUploading,
  };

  return (
    <UploadContext.Provider value={value}>
      {children}
    </UploadContext.Provider>
  );
}

export function useUpload() {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error('useUpload must be used within an UploadProvider');
  }
  return context;
}

// Convenience hooks for specific upload types
export function useVoiceUpload() {
  const { startUpload, getUploadStatus } = useUpload();
  
  const uploadVoice = useCallback(async (
    voiceData: {
      uri: string;
      duration: number;
      size: number;
      mimeType: string;
    },
    userId: Id<'users'>
  ) => {
    const extension = voiceData.mimeType.includes('mp4') ? 'mp4' : 
                     voiceData.mimeType.includes('m4a') ? 'm4a' : 
                     voiceData.mimeType.includes('wav') ? 'wav' : 'm4a';
    const fileName = `voice_${Date.now()}.${extension}`;
    
    return startUpload({
      fileUri: voiceData.uri,
      fileName,
      contentType: voiceData.mimeType,
      fileType: 'voice',
      userId,
    });
  }, [startUpload]);
  
  return { uploadVoice, getUploadStatus };
}

export function usePhotoUpload() {
  const { startUpload, getUploadStatus } = useUpload();
  
  const uploadPhoto = useCallback(async (
    photoData: {
      uri: string;
      type: string;
      size: number;
      width: number;
      height: number;
      fileName?: string;
    },
    userId: Id<'users'>
  ) => {
    const extension = photoData.type.includes('jpeg') ? 'jpg' : 
                     photoData.type.includes('png') ? 'png' : 
                     photoData.type.includes('webp') ? 'webp' : 'jpg';
    const fileName = photoData.fileName || `photo_${Date.now()}.${extension}`;
    
    return startUpload({
      fileUri: photoData.uri,
      fileName,
      contentType: photoData.type,
      fileType: 'photo',
      userId,
    });
  }, [startUpload]);
  
  return { uploadPhoto, getUploadStatus };
}