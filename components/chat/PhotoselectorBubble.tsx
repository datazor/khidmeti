// components/customer/PhotoSelectorBubble.tsx - Redesigned compact and sleek version
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ViewStyle,
  TextStyle,
  ImageStyle,
  Image,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Id } from '../../convex/_generated/dataModel';
import { useFileUpload } from '../../hooks/useFileUpload';
import { useAuth } from '../../hooks/useAuth';
import { usePhotoGallery } from '@/hooks/ussePhotoGallery';

// Design System - Aligned with other components
const COLORS = {
  primary: '#3b82f6',
  primaryLight: '#eff6ff',
  primaryDark: '#1e40af',
  success: '#10b981',
  successLight: '#f0fdf4',
  error: '#ef4444',
  white: '#ffffff',
  gray50: '#f8fafc',
  gray100: '#f1f5f9',
  gray200: '#e2e8f0',
  gray300: '#cbd5e1',
  gray400: '#94a3b8',
  gray500: '#64748b',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1e293b',
};

const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
};

const TYPOGRAPHY = {
  body: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  bodyMedium: {
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  captionMedium: {
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 16,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
};

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

interface PhotoSelectorBubbleProps {
  messageId: Id<'messages'>;
  question: string;
  timestamp: number;
  senderName?: string;
  isRTL?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  maxPhotos?: number;
  onPhotosSelect: (photos: PhotoItem[]) => void;
  onSkip?: () => void;
}

// Format time for timestamp display
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const PhotoSelectorBubble: React.FC<PhotoSelectorBubbleProps> = ({
  messageId,
  question,
  timestamp,
  senderName,
  isRTL = false,
  isFirst = true,
  isLast = true,
  maxPhotos = 5,
  onPhotosSelect,
  onSkip,
}) => {
  const { user } = useAuth();
  const [selectedPhotos, setSelectedPhotos] = useState<PhotoItem[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  
  // Initialize file upload hook
  const {
    uploadState,
    uploadPhoto: uploadPhotoFile,
  } = useFileUpload({
    onUploadComplete: (result) => {
      setSelectedPhotos(prev => prev.map(photo => 
        photo.isUploading && !photo.uploadId
          ? { 
              ...photo, 
              uploadId: result.uploadId,
              isUploading: false,
              uploadProgress: 100,
            }
          : photo
      ));
    },
    onUploadError: (error) => {
      setSelectedPhotos(prev => prev.map(photo => 
        photo.isUploading && !photo.uploadId
          ? { 
              ...photo, 
              isUploading: false,
              uploadError: error,
            }
          : photo
      ));
      Alert.alert('Upload Failed', error);
    },
    onProgressUpdate: (progress) => {
      setSelectedPhotos(prev => prev.map(photo => 
        photo.isUploading && !photo.uploadId
          ? { ...photo, uploadProgress: progress }
          : photo
      ));
    },
  });
  
  // Initialize photo gallery hook
  const {
    isSelecting,
    selectPhoto,
    takePhoto,
  } = usePhotoGallery({
    quality: 0.8,
    allowsEditing: false,
    onPhotoSelected: async (photoResult) => {
      if (selectedPhotos.length >= maxPhotos) {
        Alert.alert('Maximum reached', `You can only select up to ${maxPhotos} photos.`);
        return;
      }
      
      const photoItem: PhotoItem = {
        id: `photo_${Date.now()}`,
        uri: photoResult.uri,
        type: photoResult.type,
        size: photoResult.size,
        width: photoResult.width,
        height: photoResult.height,
        fileName: photoResult.fileName,
        isUploading: true,
        uploadProgress: 0,
      };
      
      setSelectedPhotos(prev => [...prev, photoItem]);
      
      if (user?._id) {
        try {
          await uploadPhotoFile({
            uri: photoResult.uri,
            type: photoResult.type,
            size: photoResult.size,
            width: photoResult.width,
            height: photoResult.height,
            fileName: photoResult.fileName,
          }, user._id);
        } catch (error) {
          setSelectedPhotos(prev => prev.map(photo => 
            photo.id === photoItem.id
              ? { ...photo, isUploading: false, uploadError: 'Upload failed' }
              : photo
          ));
        }
      }
    },
    onError: (error) => {
      Alert.alert('Photo Selection Failed', error);
    },
  });
  
  // Handle photo selection from gallery
  const handleSelectFromGallery = useCallback(async () => {
    if (selectedPhotos.length >= maxPhotos) {
      Alert.alert('Maximum reached', `You can only select up to ${maxPhotos} photos.`);
      return;
    }
    await selectPhoto();
  }, [selectPhoto, selectedPhotos.length, maxPhotos]);
  
  // Handle taking photo with camera
  const handleTakePhoto = useCallback(async () => {
    if (selectedPhotos.length >= maxPhotos) {
      Alert.alert('Maximum reached', `You can only select up to ${maxPhotos} photos.`);
      return;
    }
    await takePhoto();
  }, [takePhoto, selectedPhotos.length, maxPhotos]);
  
  // Remove a selected photo
  const removePhoto = useCallback((photoId: string) => {
    setSelectedPhotos(prev => prev.filter(photo => photo.id !== photoId));
  }, []);
  
  // Submit selected photos
  const handleSubmit = useCallback(() => {
    const uploadedPhotos = selectedPhotos.filter(photo => photo.uploadId && !photo.isUploading);
    
    if (uploadedPhotos.length === 0 && selectedPhotos.some(photo => photo.isUploading)) {
      Alert.alert('Please wait', 'Photos are still uploading. Please wait for uploads to complete.');
      return;
    }
    
    if (uploadedPhotos.length === 0) {
      Alert.alert('No photos uploaded', 'Please select at least one photo or skip this step.');
      return;
    }
    
    setIsCompleted(true);
    onPhotosSelect(uploadedPhotos);
  }, [selectedPhotos, onPhotosSelect]);
  
  // Skip photo selection
  const handleSkip = useCallback(() => {
    setIsCompleted(true);
    if (onSkip) {
      onSkip();
    } else {
      onPhotosSelect([]);
    }
  }, [onSkip, onPhotosSelect]);
  
  // Check if any photos are still uploading
  const hasUploadingPhotos = selectedPhotos.some(photo => photo.isUploading);
  const uploadedCount = selectedPhotos.filter(photo => photo.uploadId && !photo.isUploading).length;
  
  const containerStyle = [
    styles.container,
    isRTL && styles.containerRTL,
  ];

  const bubbleStyle = [
    styles.bubble,
    isFirst && styles.bubbleFirst,
    isLast && styles.bubbleLast,
    isCompleted && styles.bubbleCompleted,
  ];

  return (
    <View style={containerStyle}>
      <View style={styles.messageWrapper}>
        {/* Sender name */}
        {senderName && (
          <Text style={[styles.senderName, isRTL && styles.senderNameRTL]}>
            {senderName}
          </Text>
        )}

        <View style={bubbleStyle}>
          {/* Question text */}
          <Text style={[styles.questionText, isRTL && styles.questionTextRTL]}>
            {question}
          </Text>

          {/* Completed state - compact confirmation */}
          {isCompleted && (
            <View style={styles.selectedConfirmation}>
              <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
              <Text style={styles.confirmationText}>
                {uploadedCount > 0 
                  ? `${uploadedCount} photo${uploadedCount === 1 ? '' : 's'} selected`
                  : 'No photos added'
                }
              </Text>
            </View>
          )}

          {/* Photo selection buttons - horizontal layout like QuickReply */}
          {!isCompleted && (
            <View style={styles.buttonsContainer}>
              <Pressable
                style={[
                  styles.photoButton,
                  isSelecting && styles.photoButtonDisabled,
                ]}
                onPress={handleTakePhoto}
                disabled={isSelecting}
                accessibilityRole="button"
                accessibilityLabel="Take photo with camera"
              >
                <Ionicons 
                  name="camera" 
                  size={20} 
                  color={isSelecting ? COLORS.gray400 : COLORS.primary} 
                />
                <Text style={[
                  styles.buttonText,
                  isSelecting && styles.buttonTextDisabled,
                ]}>
                  Take Photo
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.photoButton,
                  isSelecting && styles.photoButtonDisabled,
                ]}
                onPress={handleSelectFromGallery}
                disabled={isSelecting}
                accessibilityRole="button"
                accessibilityLabel="Select from gallery"
              >
                <Ionicons 
                  name="images" 
                  size={20} 
                  color={isSelecting ? COLORS.gray400 : COLORS.primary} 
                />
                <Text style={[
                  styles.buttonText,
                  isSelecting && styles.buttonTextDisabled,
                ]}>
                  Gallery
                </Text>
              </Pressable>
            </View>
          )}

          {/* Compact photo counter */}
          {selectedPhotos.length > 0 && !isCompleted && (
            <View style={styles.photoCounter}>
              <Text style={styles.counterText}>
                {uploadedCount}/{maxPhotos} uploaded
                {hasUploadingPhotos && ' • uploading...'}
              </Text>
            </View>
          )}

          {/* Horizontal photo preview - compact thumbnails */}
          {selectedPhotos.length > 0 && !isCompleted && (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.photosPreview}
              contentContainerStyle={styles.photosPreviewContent}
            >
              {selectedPhotos.map((photo) => (
                <View key={photo.id} style={styles.photoThumbnail}>
                  <Image
                    source={{ uri: photo.uri }}
                    style={styles.thumbnailImage}
                    resizeMode="cover"
                  />
                  
                  {photo.isUploading && (
                    <View style={styles.uploadingOverlay}>
                      <Text style={styles.progressText}>
                        {Math.round(photo.uploadProgress || 0)}%
                      </Text>
                    </View>
                  )}
                  
                  {photo.uploadId && !photo.isUploading && (
                    <View style={styles.successBadge}>
                      <Ionicons name="checkmark" size={10} color={COLORS.white} />
                    </View>
                  )}
                  
                  {photo.uploadError && (
                    <View style={styles.errorBadge}>
                      <Ionicons name="close" size={10} color={COLORS.white} />
                    </View>
                  )}

                  <Pressable
                    style={styles.removeButton}
                    onPress={() => removePhoto(photo.id)}
                    accessibilityRole="button"
                    accessibilityLabel="Remove photo"
                  >
                    <Ionicons name="close" size={12} color={COLORS.white} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Action buttons - compact horizontal layout */}
          {!isCompleted && selectedPhotos.length > 0 && (
            <View style={styles.actionButtons}>
              <Pressable
                style={styles.skipButton}
                onPress={handleSkip}
                accessibilityRole="button"
                accessibilityLabel="Skip adding photos"
              >
                <Text style={styles.skipButtonText}>Skip</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.continueButton,
                  (uploadedCount === 0 || hasUploadingPhotos) && styles.continueButtonDisabled
                ]}
                onPress={handleSubmit}
                disabled={uploadedCount === 0 || hasUploadingPhotos}
                accessibilityRole="button"
                accessibilityLabel="Continue with selected photos"
              >
                <Text style={[
                  styles.continueButtonText,
                  (uploadedCount === 0 || hasUploadingPhotos) && styles.continueButtonTextDisabled
                ]}>
                  {hasUploadingPhotos ? 'Uploading...' : 'Continue'}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Skip-only button when no photos selected */}
          {!isCompleted && selectedPhotos.length === 0 && (
            <View style={styles.singleButtonContainer}>
              <Pressable
                style={styles.skipOnlyButton}
                onPress={handleSkip}
                accessibilityRole="button"
                accessibilityLabel="Skip photo selection"
              >
                <Text style={styles.skipOnlyButtonText}>Skip photos</Text>
              </Pressable>
            </View>
          )}

          {/* Timestamp */}
          <Text style={[styles.timestampText, isRTL && styles.timestampTextRTL]}>
            {formatTime(timestamp)}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.sm,
    alignSelf: 'flex-start',
    maxWidth: '85%',
  } as ViewStyle,

  containerRTL: {
    alignSelf: 'flex-end',
  } as ViewStyle,

  messageWrapper: {
    width: '100%',
  } as ViewStyle,

  senderName: {
    ...TYPOGRAPHY.senderName,
    color: COLORS.primary,
    marginBottom: 2,
    marginLeft: SPACING.xs,
  } as TextStyle,

  senderNameRTL: {
    marginLeft: 0,
    marginRight: SPACING.xs,
    textAlign: 'right',
  } as TextStyle,

  bubble: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    shadowColor: COLORS.gray800,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    minWidth: 260,
    maxWidth: 320,
  } as ViewStyle,

  bubbleFirst: {
    borderTopLeftRadius: 8,
  } as ViewStyle,

  bubbleLast: {
    borderBottomLeftRadius: 8,
  } as ViewStyle,

  bubbleCompleted: {
    backgroundColor: COLORS.successLight,
    borderColor: COLORS.success,
  } as ViewStyle,

  questionText: {
    ...TYPOGRAPHY.body,
    color: COLORS.gray700,
    marginBottom: SPACING.lg,
    lineHeight: 20,
  } as TextStyle,

  questionTextRTL: {
    textAlign: 'right',
  } as TextStyle,

  selectedConfirmation: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight,
    borderRadius: 8,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
  } as ViewStyle,

  confirmationText: {
    ...TYPOGRAPHY.captionMedium,
    color: COLORS.primaryDark,
  } as TextStyle,

  buttonsContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  } as ViewStyle,

  photoButton: {
    flex: 1,
    backgroundColor: COLORS.gray50,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.gray200,
    padding: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    gap: SPACING.xs,
  } as ViewStyle,

  photoButtonDisabled: {
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.gray300,
    opacity: 0.6,
  } as ViewStyle,

  buttonText: {
    ...TYPOGRAPHY.captionMedium,
    color: COLORS.gray700,
    textAlign: 'center',
  } as TextStyle,

  buttonTextDisabled: {
    color: COLORS.gray400,
  } as TextStyle,

  photoCounter: {
    backgroundColor: COLORS.gray50,
    borderRadius: 6,
    padding: SPACING.xs,
    alignItems: 'center',
    marginBottom: SPACING.sm,
  } as ViewStyle,

  counterText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
  } as TextStyle,

  photosPreview: {
    marginBottom: SPACING.md,
    maxHeight: 50,
  } as ViewStyle,

  photosPreviewContent: {
    paddingHorizontal: 2,
    gap: SPACING.sm,
  } as ViewStyle,

  photoThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  } as ViewStyle,

  thumbnailImage: {
    width: '100%',
    height: '100%',
  } as ImageStyle,

  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  progressText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 10,
  } as TextStyle,

  successBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  errorBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  removeButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.gray800,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  } as ViewStyle,

  skipButton: {
    flex: 1,
    backgroundColor: COLORS.gray100,
    borderRadius: 12,
    padding: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  } as ViewStyle,

  skipButtonText: {
    ...TYPOGRAPHY.captionMedium,
    color: COLORS.gray600,
  } as TextStyle,

  continueButton: {
    flex: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  } as ViewStyle,

  continueButtonDisabled: {
    backgroundColor: COLORS.gray300,
  } as ViewStyle,

  continueButtonText: {
    ...TYPOGRAPHY.captionMedium,
    color: COLORS.white,
  } as TextStyle,

  continueButtonTextDisabled: {
    color: COLORS.gray500,
  } as TextStyle,

  singleButtonContainer: {
    alignItems: 'center',
    marginBottom: SPACING.sm,
  } as ViewStyle,

  skipOnlyButton: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
  } as ViewStyle,

  skipOnlyButtonText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    textDecorationLine: 'underline',
  } as TextStyle,

  timestampText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray400,
    textAlign: 'right',
  } as TextStyle,

  timestampTextRTL: {
    textAlign: 'left',
  } as TextStyle,
});