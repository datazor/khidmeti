// components/onboarding/DocumentStep.tsx - Clean document upload with proper Expo patterns
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
import * as ImagePicker from 'expo-image-picker';
import { useWorkerOnboarding } from '../../hooks/useWorkerOnboarding';
import { COLORS, SPACING, SHADOWS } from '../../constants/design';

interface DocumentStepProps {
  onNext: () => void;
  onBack: () => void;
}

type DocumentType = 'id' | 'passport' | 'residency';

interface DocumentOption {
  key: DocumentType;
  label: string;
  icon: string;
  description: string;
}

export const DocumentStep = ({ onNext, onBack }: DocumentStepProps) => {
  const { uploadIdDocument, loading, error, documentUploads } = useWorkerOnboarding();
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>('id');

  const documentOptions: DocumentOption[] = [
    { 
      key: 'id', 
      label: 'National ID Card', 
      icon: 'card-outline',
      description: 'Government-issued national identity card'
    },
    { 
      key: 'passport', 
      label: 'Passport', 
      icon: 'airplane-outline',
      description: 'International travel document'
    },
    { 
      key: 'residency', 
      label: 'Residency Permit', 
      icon: 'home-outline',
      description: 'Residence or work permit document'
    },
  ];

  /**
   * Launches device camera to capture document photo
   * Uses expo-image-picker with proper error handling
   */
  const captureFromCamera = useCallback(async (side?: 'front' | 'back'): Promise<string | null> => {
    try {
      // Request camera permissions
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Please allow camera access to take document photos.',
          [{ text: 'OK' }]
        );
        return null;
      }

      // Launch camera with optimized settings
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'], // Updated from deprecated MediaTypeOptions
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8, // Good quality for document readability
      });

      if (!result.canceled && result.assets[0]) {

        return result.assets[0].uri;
      }

      return null;
    } catch (error) {
      console.error('Camera capture failed:', error);
      Alert.alert(
        'Camera Error',
        'Failed to capture photo. Please try again.',
        [{ text: 'OK' }]
      );
      return null;
    }
  }, []);

  /**
   * Launches photo library to select document image
   * Uses expo-image-picker with proper error handling
   */
  const selectFromLibrary = useCallback(async (side?: 'front' | 'back'): Promise<string | null> => {
    try {
      // Launch image library with optimized settings
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], // Updated from deprecated MediaTypeOptions
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {

        return result.assets[0].uri;
      }

      return null;
    } catch (error) {
      console.error('Library selection failed:', error);
      Alert.alert(
        'Selection Error',
        'Failed to select image. Please try again.',
        [{ text: 'OK' }]
      );
      return null;
    }
  }, []);

  /**
   * Shows options for capturing/selecting document image
   * Provides camera and library options
   */
  const handleDocumentCapture = useCallback(async (side?: 'front' | 'back') => {
    Alert.alert(
      'Add Document Photo',
      `Select how you want to add the ${side ? `${side} side of your ` : ''}${documentOptions.find(opt => opt.key === selectedDocType)?.label?.toLowerCase()}`,
      [
        {
          text: 'Camera',
          onPress: async () => {
            const photoUri = await captureFromCamera(side);
            if (photoUri) {
              await uploadDocument(photoUri, side);
            }
          },
        },
        {
          text: 'Photo Library',
          onPress: async () => {
            const photoUri = await selectFromLibrary(side);
            if (photoUri) {
              await uploadDocument(photoUri, side);
            }
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  }, [selectedDocType, captureFromCamera, selectFromLibrary]);

  /**
   * Uploads document using the clean URI-based pattern
   * Converts selected document type and side to proper database format
   */
  const uploadDocument = useCallback(async (photoUri: string, side?: 'front' | 'back') => {
    try {
      // Convert UI document type to database document type
      let documentType: string;
      if (selectedDocType === 'id') {
        documentType = side === 'front' ? 'id_front' : 'id_back';
      } else if (selectedDocType === 'passport') {
        documentType = 'passport';
      } else {
        documentType = side === 'front' ? 'residency_permit_front' : 'residency_permit_back';
      }

      const fileName = `${documentType}_${Date.now()}.jpg`;
      
      
      // Use the clean upload pattern from useWorkerOnboarding
      await uploadIdDocument(documentType as any, photoUri, fileName);
      
    } catch (error) {
      console.error('Document upload failed:', error);
      Alert.alert(
        'Upload Failed',
        'Failed to upload document. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }, [selectedDocType, uploadIdDocument]);

  /**
   * Checks if all required documents for selected type are uploaded
   * Different document types have different requirements
   */
  const isComplete = useCallback(() => {
    if (selectedDocType === 'passport') {
      return documentUploads.some(doc => doc.documentType === 'passport' && !doc.uploadError);
    } else if (selectedDocType === 'id') {
      const frontUploaded = documentUploads.some(doc => doc.documentType === 'id_front' && !doc.uploadError);
      const backUploaded = documentUploads.some(doc => doc.documentType === 'id_back' && !doc.uploadError);
      return frontUploaded && backUploaded;
    } else {
      const frontUploaded = documentUploads.some(doc => doc.documentType === 'residency_permit_front' && !doc.uploadError);
      const backUploaded = documentUploads.some(doc => doc.documentType === 'residency_permit_back' && !doc.uploadError);
      return frontUploaded && backUploaded;
    }
  }, [selectedDocType, documentUploads]);

  /**
   * Gets count of uploaded documents for selected type
   * Used for progress indication in UI
   */
  const getUploadedCount = useCallback(() => {
    if (selectedDocType === 'passport') {
      return documentUploads.some(doc => doc.documentType === 'passport' && !doc.uploadError) ? 1 : 0;
    } else if (selectedDocType === 'id') {
      const frontUploaded = documentUploads.some(doc => doc.documentType === 'id_front' && !doc.uploadError);
      const backUploaded = documentUploads.some(doc => doc.documentType === 'id_back' && !doc.uploadError);
      return (frontUploaded ? 1 : 0) + (backUploaded ? 1 : 0);
    } else {
      const frontUploaded = documentUploads.some(doc => doc.documentType === 'residency_permit_front' && !doc.uploadError);
      const backUploaded = documentUploads.some(doc => doc.documentType === 'residency_permit_back' && !doc.uploadError);
      return (frontUploaded ? 1 : 0) + (backUploaded ? 1 : 0);
    }
  }, [selectedDocType, documentUploads]);

  /**
   * Checks if a specific document side is uploaded
   * Used for individual upload button states
   */
  const isDocumentUploaded = useCallback((side: 'front' | 'back' | 'main') => {
    if (selectedDocType === 'passport') {
      return documentUploads.some(doc => doc.documentType === 'passport' && !doc.uploadError);
    } else if (selectedDocType === 'id') {
      const docType = side === 'front' ? 'id_front' : 'id_back';
      return documentUploads.some(doc => doc.documentType === docType && !doc.uploadError);
    } else {
      const docType = side === 'front' ? 'residency_permit_front' : 'residency_permit_back';
      return documentUploads.some(doc => doc.documentType === docType && !doc.uploadError);
    }
  }, [selectedDocType, documentUploads]);

  const isUploading = loading.uploadingDocument;
  const requiresTwoSides = selectedDocType !== 'passport';
  const maxDocuments = requiresTwoSides ? 2 : 1;

  return (
    <View style={styles.stepContainer}>
      <View style={styles.stepContent}>
        <View style={styles.stepHeader}>
          <View style={styles.stepIcon}>
            <Ionicons name="document-outline" size={32} color={COLORS.primary} />
          </View>
          <Text style={styles.stepTitle}>ID Documents</Text>
          <Text style={styles.stepSubtitle}>
            Upload clear photos of your identification document
          </Text>
        </View>

        {/* Document Type Selection */}
        <View style={styles.documentTypeContainer}>
          <Text style={styles.sectionLabel}>Document Type</Text>
          <View style={styles.documentTypeOptions}>
            {documentOptions.map((option) => (
              <Pressable
                key={option.key}
                onPress={() => setSelectedDocType(option.key)}
                style={[
                  styles.documentTypeOption,
                  selectedDocType === option.key && styles.documentTypeOptionSelected,
                ]}
                disabled={isUploading}
              >
                <View style={styles.documentTypeIcon}>
                  <Ionicons
                    name={option.icon as any}
                    size={24}
                    color={selectedDocType === option.key ? COLORS.primary : COLORS.gray500}
                  />
                </View>
                <View style={styles.documentTypeInfo}>
                  <Text style={[
                    styles.documentTypeLabel,
                    selectedDocType === option.key && styles.documentTypeLabelSelected,
                  ]}>
                    {option.label}
                  </Text>
                  <Text style={styles.documentTypeDescription}>
                    {option.description}
                  </Text>
                </View>
                {selectedDocType === option.key && (
                  <View style={styles.selectedIndicator}>
                    <Ionicons name="checkmark" size={16} color={COLORS.primary} />
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {/* Upload Progress */}
        <View style={styles.uploadContainer}>
          <Text style={styles.sectionLabel}>
            Upload Photos ({getUploadedCount()}/{maxDocuments})
          </Text>

          {/* Single Document Upload (Passport) */}
          {selectedDocType === 'passport' && (
            <Pressable
              onPress={() => handleDocumentCapture()}
              style={[
                styles.uploadArea,
                isDocumentUploaded('main') && styles.uploadAreaComplete
              ]}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator size="large" color={COLORS.primary} />
              ) : isDocumentUploaded('main') ? (
                <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
              ) : (
                <Ionicons name="cloud-upload-outline" size={48} color={COLORS.gray400} />
              )}
              <Text style={[
                styles.uploadText,
                isDocumentUploaded('main') && styles.uploadTextComplete
              ]}>
                {isDocumentUploaded('main') ? 'Passport Uploaded' : 'Upload Passport Photo'}
              </Text>
              <Text style={styles.uploadSubtext}>
                Take a clear photo of your passport's main page
              </Text>
            </Pressable>
          )}

          {/* Two-sided Document Upload (ID Card, Residency Permit) */}
          {requiresTwoSides && (
            <View style={styles.doubleUploadContainer}>
              <Pressable
                onPress={() => handleDocumentCapture('front')}
                style={[
                  styles.uploadArea,
                  styles.uploadAreaHalf,
                  isDocumentUploaded('front') && styles.uploadAreaComplete
                ]}
                disabled={isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : isDocumentUploaded('front') ? (
                  <Ionicons name="checkmark-circle" size={32} color={COLORS.success} />
                ) : (
                  <Ionicons name="cloud-upload-outline" size={32} color={COLORS.gray400} />
                )}
                <Text style={[
                  styles.uploadTextSmall,
                  isDocumentUploaded('front') && styles.uploadTextComplete
                ]}>
                  Front Side
                </Text>
              </Pressable>

              <Pressable
                onPress={() => handleDocumentCapture('back')}
                style={[
                  styles.uploadArea,
                  styles.uploadAreaHalf,
                  isDocumentUploaded('back') && styles.uploadAreaComplete
                ]}
                disabled={isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : isDocumentUploaded('back') ? (
                  <Ionicons name="checkmark-circle" size={32} color={COLORS.success} />
                ) : (
                  <Ionicons name="cloud-upload-outline" size={32} color={COLORS.gray400} />
                )}
                <Text style={[
                  styles.uploadTextSmall,
                  isDocumentUploaded('back') && styles.uploadTextComplete
                ]}>
                  Back Side
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <Text style={styles.instructionsTitle}>Photography Tips:</Text>
          <View style={styles.instructionItem}>
            <Ionicons name="checkmark" size={16} color={COLORS.success} />
            <Text style={styles.instructionText}>Ensure document is fully visible and flat</Text>
          </View>
          <View style={styles.instructionItem}>
            <Ionicons name="checkmark" size={16} color={COLORS.success} />
            <Text style={styles.instructionText}>Use good lighting, avoid shadows and glare</Text>
          </View>
          <View style={styles.instructionItem}>
            <Ionicons name="checkmark" size={16} color={COLORS.success} />
            <Text style={styles.instructionText}>Keep text clear and readable</Text>
          </View>
          <View style={styles.instructionItem}>
            <Ionicons name="checkmark" size={16} color={COLORS.success} />
            <Text style={styles.instructionText}>Hold camera steady and straight</Text>
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
          onPress={onNext}
          style={[styles.primaryButton, !isComplete() && styles.buttonDisabled]}
          disabled={!isComplete() || isUploading}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Continue</Text>
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

  // Document Type Selection
  documentTypeContainer: {
    marginBottom: SPACING.xl,
  },

  documentTypeOptions: {
    gap: SPACING.sm,
  },

  documentTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray50,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.gray200,
    padding: SPACING.md,
    ...SHADOWS.sm,
  },

  documentTypeOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },

  documentTypeIcon: {
    marginRight: SPACING.md,
  },

  documentTypeInfo: {
    flex: 1,
  },

  documentTypeLabel: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    color: COLORS.gray700,
    marginBottom: SPACING.xs,
  },

  documentTypeLabelSelected: {
    color: COLORS.primary,
  },

  documentTypeDescription: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: COLORS.gray500,
  },

  selectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.gray50,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Upload Areas
  uploadContainer: {
    marginBottom: SPACING.xl,
  },

  uploadArea: {
    backgroundColor: COLORS.gray50,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.gray200,
    borderStyle: 'dashed',
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },

  uploadAreaComplete: {
    backgroundColor: `${COLORS.success}10`,
    borderColor: COLORS.success,
    borderStyle: 'solid',
  },

  uploadAreaHalf: {
    flex: 1,
    minHeight: 120,
    paddingHorizontal: SPACING.md,
  },

  uploadText: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    color: COLORS.gray600,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },

  uploadTextSmall: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    color: COLORS.gray600,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },

  uploadTextComplete: {
    color: COLORS.success,
  },

  uploadSubtext: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    color: COLORS.gray500,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },

  doubleUploadContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
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

  buttonDisabled: {
    backgroundColor: COLORS.gray300,
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