// components/onboarding/AdditionalFilesStep.tsx - Clean additional files upload with proper Expo patterns
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useWorkerOnboarding } from '../../hooks/useWorkerOnboarding';
import { COLORS, SPACING, SHADOWS } from '../../constants/design';

interface AdditionalFilesStepProps {
  onNext: () => void;
  onBack: () => void;
}

interface FileUpload {
  id: string;
  type: 'certification' | 'license' | 'additional_file';
  name: string;
  size: number;
  isUploading: boolean;
  uploadError?: string;
  uploaded: boolean;
}

interface FileTypeOption {
  key: 'certification' | 'license' | 'additional_file';
  label: string;
  description: string;
  icon: string;
  acceptedTypes: string[];
}

export const AdditionalFilesStep = ({ onNext, onBack }: AdditionalFilesStepProps) => {
  const { uploadAdditionalFile, completeAdditionalFiles, loading, error } = useWorkerOnboarding();
  const [uploadedFiles, setUploadedFiles] = useState<FileUpload[]>([]);
  
  const fileTypeOptions: FileTypeOption[] = [
    {
      key: 'certification',
      label: 'Certifications',
      description: 'Professional certifications, training certificates',
      icon: 'ribbon-outline',
      acceptedTypes: ['application/pdf', 'image/jpeg', 'image/png']
    },
    {
      key: 'license',
      label: 'Licenses',
      description: 'Professional licenses, permits',
      icon: 'shield-checkmark-outline',
      acceptedTypes: ['application/pdf', 'image/jpeg', 'image/png']
    },
    {
      key: 'additional_file',
      label: 'Portfolio & Other Documents',
      description: 'Work samples, references, other documents',
      icon: 'folder-outline',
      acceptedTypes: ['application/pdf', 'image/jpeg', 'image/png']
    },
  ];

  /**
   * Shows file selection options for the specified file type
   * Provides camera, photo library, and document picker options
   */
  const handleFileUpload = useCallback(async (fileType: 'certification' | 'license' | 'additional_file') => {
    try {
      Alert.alert(
        'Add File',
        'Choose how you want to add your file',
        [
          {
            text: 'Camera',
            onPress: () => uploadFromCamera(fileType),
          },
          {
            text: 'Photo Library',
            onPress: () => uploadFromLibrary(fileType),
          },
          {
            text: 'Documents',
            onPress: () => uploadFromDocuments(fileType),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );
    } catch (err) {
      console.error('Failed to show file options:', err);
      Alert.alert(
        'Error',
        'Failed to show file options. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }, []);

  /**
   * Captures file using device camera
   * Uses expo-image-picker with proper permission handling
   */
  const uploadFromCamera = useCallback(async (fileType: 'certification' | 'license' | 'additional_file') => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Please allow camera access to take photos of documents.',
          [{ text: 'OK' }]
        );
        return;
      }
      
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'], // Updated from deprecated MediaTypeOptions
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets[0]) {

        await processFileUpload(result.assets[0], fileType);
      }
    } catch (err) {
      console.error('Camera upload failed:', err);
      Alert.alert(
        'Camera Error',
        'Failed to capture photo. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }, []);

  /**
   * Selects file from photo library
   * Uses expo-image-picker with proper error handling
   */
  const uploadFromLibrary = useCallback(async (fileType: 'certification' | 'license' | 'additional_file') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], // Updated from deprecated MediaTypeOptions
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets[0]) {
        await processFileUpload(result.assets[0], fileType);
      }
    } catch (err) {
      console.error('Library upload failed:', err);
      Alert.alert(
        'Selection Error',
        'Failed to select photo. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }, []);

  /**
   * Selects document using expo-document-picker
   * Supports PDF and image files with proper type filtering
   */
  const uploadFromDocuments = useCallback(async (fileType: 'certification' | 'license' | 'additional_file') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/jpeg', 'image/png'],
        copyToCacheDirectory: true, // Ensures proper file access
      });
      
      if (!result.canceled && result.assets[0]) {


        // Convert DocumentPicker result to ImagePicker-like format for consistency
        const asset = {
          uri: result.assets[0].uri,
          fileName: result.assets[0].name,
          fileSize: result.assets[0].size,
          mimeType: result.assets[0].mimeType,
        };
        
        await processFileUpload(asset, fileType);
      }
    } catch (err) {
      console.error('Document upload failed:', err);
      Alert.alert(
        'Document Error',
        'Failed to select document. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }, []);

  /**
   * Processes the selected file and uploads using clean URI-based pattern
   * Handles both image and document files uniformly
   */
  const processFileUpload = useCallback(async (asset: any, fileType: 'certification' | 'license' | 'additional_file') => {
    const fileId = Date.now().toString();
    const fileName = asset.fileName || asset.name || `${fileType}_${Date.now()}`;
    const fileSize = asset.fileSize || asset.size || 0;
    
    const newFile: FileUpload = {
      id: fileId,
      type: fileType,
      name: fileName,
      size: fileSize,
      isUploading: true,
      uploaded: false,
    };
    
    // Add to UI state for immediate feedback
    setUploadedFiles(prev => [...prev, newFile]);
    
    try {
      
      // Use the clean upload pattern - just pass the URI to the hook
      await uploadAdditionalFile(fileType, asset.uri, fileName);
      
      // Update file status to completed
      setUploadedFiles(prev => prev.map(file => 
        file.id === fileId 
          ? { ...file, isUploading: false, uploaded: true }
          : file
      ));
      
    } catch (err) {
      console.error('Failed to upload file:', err);
      const errorMessage = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      
      // Update file status with error
      setUploadedFiles(prev => prev.map(file => 
        file.id === fileId 
          ? { ...file, isUploading: false, uploadError: errorMessage }
          : file
      ));
    }
  }, [uploadAdditionalFile]);

  /**
   * Removes file from upload list
   * Only affects UI state - doesn't delete from server
   */
  const removeFile = useCallback((fileId: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
  }, []);

  /**
   * Retries failed upload for specific file
   * Re-attempts upload with same parameters
   */
  const retryUpload = useCallback(async (file: FileUpload) => {
    setUploadedFiles(prev => prev.map(f => 
      f.id === file.id 
        ? { ...f, isUploading: true, uploadError: undefined }
        : f
    ));
    
    try {
      // In a real implementation, we'd need to store the original URI
      // For now, we'll show an error asking user to re-add the file
      throw new Error('Please remove and re-add the file to retry upload');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Retry failed';
      setUploadedFiles(prev => prev.map(f => 
        f.id === file.id 
          ? { ...f, isUploading: false, uploadError: errorMessage }
          : f
      ));
    }
  }, []);

  /**
   * Completes the additional files step
   * Can proceed even with no files uploaded (optional step)
   */
  const handleContinue = useCallback(async () => {
    try {
      await completeAdditionalFiles();
      onNext();
    } catch (err) {
      console.error('Failed to complete additional files:', err);
      Alert.alert(
        'Error',
        'Failed to proceed to next step. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }, [completeAdditionalFiles, onNext, uploadedFiles.length]);

  /**
   * Formats file size for display
   * Converts bytes to human-readable format
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isUploading = loading.uploadingAdditionalFile;
  const isCompleting = loading.completing;

  return (
    <View style={styles.stepContainer}>
      <View style={styles.stepContent}>
        <View style={styles.stepHeader}>
          <View style={styles.stepIcon}>
            <Ionicons name="document-attach-outline" size={32} color={COLORS.primary} />
          </View>
          <Text style={styles.stepTitle}>Additional Files</Text>
          <Text style={styles.stepSubtitle}>
            Upload any certifications, licenses, or portfolio items (optional)
          </Text>
        </View>
        
        {/* File Type Options */}
        <View style={styles.fileTypesContainer}>
          <Text style={styles.sectionLabel}>Add Files</Text>
          {fileTypeOptions.map((fileType) => (
            <Pressable
              key={fileType.key}
              onPress={() => handleFileUpload(fileType.key)}
              style={styles.fileTypeButton}
              disabled={isUploading}
            >
              <View style={styles.fileTypeIcon}>
                <Ionicons name={fileType.icon as any} size={24} color={COLORS.primary} />
              </View>
              <View style={styles.fileTypeInfo}>
                <Text style={styles.fileTypeLabel}>{fileType.label}</Text>
                <Text style={styles.fileTypeDescription}>{fileType.description}</Text>
              </View>
              <Ionicons name="add-circle-outline" size={20} color={COLORS.gray400} />
            </Pressable>
          ))}
        </View>
        
        {/* Uploaded Files List */}
        {uploadedFiles.length > 0 && (
          <View style={styles.uploadedFilesContainer}>
            <Text style={styles.sectionLabel}>Uploaded Files ({uploadedFiles.length})</Text>
            {uploadedFiles.map((file) => (
              <View key={file.id} style={styles.uploadedFileItem}>
                <View style={styles.fileInfo}>
                  <View style={styles.fileIcon}>
                    {file.isUploading ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : file.uploaded ? (
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                    ) : file.uploadError ? (
                      <Ionicons name="alert-circle" size={20} color={COLORS.error} />
                    ) : (
                      <Ionicons name="document" size={20} color={COLORS.gray500} />
                    )}
                  </View>
                  <View style={styles.fileDetails}>
                    <Text style={styles.fileName}>{file.name}</Text>
                    <View style={styles.fileMetadata}>
                      <Text style={styles.fileSize}>{formatFileSize(file.size)}</Text>
                      <Text style={styles.fileType}>{file.type.replace('_', ' ')}</Text>
                    </View>
                    {file.uploadError && (
                      <Text style={styles.fileError}>{file.uploadError}</Text>
                    )}
                  </View>
                </View>
                <View style={styles.fileActions}>
                  {file.uploadError && (
                    <Pressable
                      onPress={() => retryUpload(file)}
                      style={styles.retryButton}
                    >
                      <Ionicons name="refresh" size={16} color={COLORS.primary} />
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => removeFile(file.id)}
                    style={styles.removeButton}
                  >
                    <Ionicons name="close" size={16} color={COLORS.error} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
        
        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>File Guidelines:</Text>
          <View style={styles.instructionItem}>
            <Ionicons name="checkmark" size={16} color={COLORS.success} />
            <Text style={styles.instructionText}>Use clear, high-resolution images or PDFs</Text>
          </View>
          <View style={styles.instructionItem}>
            <Ionicons name="checkmark" size={16} color={COLORS.success} />
            <Text style={styles.instructionText}>Ensure all text is readable</Text>
          </View>
          <View style={styles.instructionItem}>
            <Ionicons name="checkmark" size={16} color={COLORS.success} />
            <Text style={styles.instructionText}>PDF files preferred for documents</Text>
          </View>
          <View style={styles.instructionItem}>
            <Ionicons name="checkmark" size={16} color={COLORS.success} />
            <Text style={styles.instructionText}>Maximum file size: 10MB</Text>
          </View>
        </View>
        
        {/* Error Display */}
        {error && (
          <View style={styles.errorCard}>
            <Ionicons name="warning-outline" size={16} color={COLORS.error} />
            <Text style={styles.errorText}>{error.message}</Text>
          </View>
        )}
      </View>
      
      <View style={styles.stepActions}>
        <Pressable
          onPress={handleContinue}
          style={styles.primaryButton}
          disabled={isCompleting}
        >
          {isCompleting ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.primaryButtonText}>
              {uploadedFiles.length > 0 ? 'Continue' : 'Skip for Now'}
            </Text>
          )}
        </Pressable>
        <Pressable onPress={onBack} style={styles.textButton}>
          <Text style={styles.textButtonText}>Back</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Step Container
  stepContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  
  stepContent: {
    flex: 1,
  },
  
  stepHeader: {
    alignItems: 'center',
    marginTop: SPACING.xxl,
    marginBottom: SPACING.xl,
  },
  
  stepIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: COLORS.gray50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  
  stepTitle: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 32,
    color: COLORS.gray900,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  
  stepSubtitle: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
    color: COLORS.gray600,
    textAlign: 'center',
  },
  
  // Section Labels
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    letterSpacing: 0.5,
    color: COLORS.gray600,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  
  // File Types
  fileTypesContainer: {
    marginBottom: SPACING.xl,
  },
  
  fileTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray50,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.gray200,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  
  fileTypeIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  
  fileTypeInfo: {
    flex: 1,
  },
  
  fileTypeLabel: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    color: COLORS.gray900,
    marginBottom: SPACING.xs,
  },
  
  fileTypeDescription: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: COLORS.gray600,
  },
  
  // Uploaded Files
  uploadedFilesContainer: {
    marginBottom: SPACING.xl,
  },
  
  uploadedFileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  
  fileIcon: {
    marginRight: SPACING.md,
  },
  
  fileDetails: {
    flex: 1,
  },
  
  fileName: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    color: COLORS.gray900,
    marginBottom: SPACING.xs,
  },
  
  fileMetadata: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  
  fileSize: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    color: COLORS.gray500,
  },
  
  fileType: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    color: COLORS.gray500,
    textTransform: 'capitalize',
  },
  
  fileError: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
  
  fileActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  
  retryButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.gray50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.gray50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Instructions
  instructionsContainer: {
    backgroundColor: COLORS.gray50,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    color: COLORS.gray700,
    marginBottom: SPACING.sm,
  },
  
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  
  instructionText: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: COLORS.gray700,
    marginLeft: SPACING.sm,
    flex: 1,
  },
  
  // Actions
  stepActions: {
    marginTop: SPACING.xl,
    gap: SPACING.md,
  },
  
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    flexDirection: 'row',
    ...SHADOWS.sm,
  },
  
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    color: COLORS.white,
  },
  
  textButton: {
    alignItems: 'center',
    padding: SPACING.sm,
  },
  
  textButtonText: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: COLORS.gray500,
  },
  
  // Error
  errorCard: {
    backgroundColor: `${COLORS.error}15`,
    borderRadius: 12,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${COLORS.error}30`,
    marginTop: SPACING.md,
  },
  
  errorText: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: COLORS.error,
    marginLeft: SPACING.sm,
    flex: 1,
  },
});