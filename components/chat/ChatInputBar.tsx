// components/chat/ChatInputBar.tsx - Simplified version with larger record button
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  TextStyle,
  ViewStyle,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';

// Import hooks
import { useAudioRecording } from '@/hooks/useAudioRecording';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { usePhotoGallery } from '@/hooks/ussePhotoGallery';
import * as Haptics from 'expo-haptics';

// Design System
const COLORS = {
  primary: '#2563eb',
  primaryLight: '#3b82f6',
  primaryDark: '#1e40af',
  secondary: '#64748b',
  success: '#059669',
  error: '#dc2626',
  warning: '#d97706',
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
  gray900: '#0f172a',
};

const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

const TYPOGRAPHY = {
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodyMedium: {
    fontSize: 16,
    fontWeight: '500' as const,
    lineHeight: 24,
  },
  small: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
};

const SHADOWS = {
  sm: {
    shadowColor: COLORS.gray900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: COLORS.gray900,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
};

// Props interface
interface ChatInputBarProps {
  disabled?: boolean;
  isRTL?: boolean;
  maxLength?: number;
  placeholder?: string;
}

export function ChatInputBar({
  disabled = false,
  isRTL = false,
  maxLength = 500,
  placeholder = 'Type a message...',
}: ChatInputBarProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Hooks
  const { user } = useAuth();
  const { sendMessage, loading } = useChat();

  // Local state
  const [inputText, setInputText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [voicePhase, setVoicePhase] = useState<'idle' | 'holding' | 'recording' | 'processing' | 'uploading' | 'error'>('idle');

  // Animation values
  const inputScale = useSharedValue(1);
  const sendButtonScale = useSharedValue(1);
  const voiceButtonScale = useSharedValue(1);
  const recordingProgress = useSharedValue(0);
  const recordingOpacity = useSharedValue(0);

  // Refs
  const textInputRef = useRef<TextInput>(null);
  const lastFileTypeRef = useRef<'voice' | 'photo' | null>(null);

  const isSmallScreen = width < 375;

  // Upload handling callbacks
  const handleUploadComplete = useCallback((result: { uploadId: string; fileUrl: string; storageId: string }) => {
    const kind = lastFileTypeRef.current;
    if (kind === 'voice') {
      sendMessage('voice', result.fileUrl, { storageId: result.storageId });
    } else {
      sendMessage('photo', result.fileUrl, { storageId: result.storageId });
    }
    lastFileTypeRef.current = null;
    setVoicePhase('idle');
  }, [sendMessage]);

  const handleUploadError = useCallback((error: string) => {
    setVoicePhase('error');
    Alert.alert('Upload Failed', error);
  }, []);

  // Audio recording hook
  const {
    recordingState,
    startRecording,
    stopRecording,
    cancelRecording,
    formatDuration,
  } = useAudioRecording({
    maxDurationMs: 300000,
    onRecordingComplete: handleVoiceRecordingComplete,
    onRecordingError: handleVoiceRecordingError,
  });

  // Photo gallery hook
  const {
    selectPhoto,
    takePhoto,
    isSelecting,
    isCameraAvailable,
  } = usePhotoGallery({
    quality: 0.8,
    allowsEditing: true,
    onPhotoSelected: handlePhotoSelected,
    onError: handlePhotoError,
  });

  // File upload hook
  const {
    uploadState,
    uploadVoiceMessage,
    uploadPhoto,
  } = useFileUpload({
    onUploadComplete: handleUploadComplete,
    onUploadError: handleUploadError,
  });

  // Sync voice phase with recording and upload states
  useEffect(() => {
    if (recordingState.status === 'recording' && voicePhase !== 'recording') {
      setVoicePhase('recording');
    } else if (recordingState.status === 'processing' && voicePhase === 'recording') {
      setVoicePhase('processing');
    } else if (recordingState.status === 'error') {
      setVoicePhase('error');
    }
  }, [recordingState.status, voicePhase]);

  // Track upload phase
  useEffect(() => {
    if (uploadState.isUploading && voicePhase === 'processing') {
      setVoicePhase('uploading');
    } else if (!uploadState.isUploading && voicePhase === 'uploading') {
      setVoicePhase('idle');
    }
  }, [uploadState.isUploading, voicePhase]);

  // Recording overlay animation
  useEffect(() => {
    const shouldShow = voicePhase === 'recording' || voicePhase === 'processing' || voicePhase === 'uploading' || uploadState.isUploading;

    if (shouldShow) {
      recordingOpacity.value = withSpring(1);
      if (voicePhase === 'recording') {
        const progress = Math.min(recordingState.duration / 300000, 1);
        recordingProgress.value = withTiming(progress, { duration: 100 });
      } else if (voicePhase === 'uploading' || uploadState.isUploading) {
        recordingProgress.value = withTiming(uploadState.progress / 100, { duration: 200 });
      }
    } else {
      recordingOpacity.value = withSpring(0);
      recordingProgress.value = withTiming(0, { duration: 200 });
    }
  }, [voicePhase, recordingState.duration, uploadState.progress, uploadState.isUploading]);

  // File handling callbacks
  function handleVoiceRecordingComplete(audioData: { uri: string; duration: number; size: number; mimeType: string }) {
    if (!user?._id) {
      Alert.alert('Error', 'User not authenticated');
      setVoicePhase('error');
      return;
    }

    lastFileTypeRef.current = 'voice';
    uploadVoiceMessage(audioData, user._id)
      .catch((error) => {
        Alert.alert('Upload Failed', 'Could not upload voice message. Please try again.');
        setVoicePhase('error');
      });
  }

  function handleVoiceRecordingError(error: string) {
    setVoicePhase('error');
    Alert.alert('Recording Error', error);
  }

  function handlePhotoSelected(photoData: {
    uri: string;
    type: string;
    size: number;
    width: number;
    height: number;
    fileName?: string;
  }) {
    if (!user?._id) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }
    lastFileTypeRef.current = 'photo';
    uploadPhoto(photoData, user._id).catch(() => {
      Alert.alert('Upload Failed', 'Could not upload photo. Please try again.');
    });
  }

  function handlePhotoError(error: string) {
    Alert.alert('Photo Error', error);
  }

  // Voice recording handlers
  const handleVoicePressIn = useCallback(() => {
    if (disabled || inputText.trim() || voicePhase !== 'idle') return;

    setVoicePhase('holding');
    voiceButtonScale.value = withSpring(0.9);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [disabled, inputText, voicePhase]);

  const handleVoiceLongPress = useCallback(async () => {
    if (voicePhase !== 'holding') return;

    setVoicePhase('recording');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await startRecording();
  }, [voicePhase, startRecording]);

  const handleVoicePressOut = useCallback(async () => {
    voiceButtonScale.value = withSpring(1);

    if (voicePhase === 'holding') {
      setVoicePhase('idle');
    } else if (voicePhase === 'recording') {
      await stopRecording();
    }
  }, [voicePhase, stopRecording]);

  const handleRetryRecording = useCallback(() => {
    setVoicePhase('idle');
  }, []);

  // Text input handlers
  const handleTextChange = useCallback((text: string) => {
    setInputText(text);
    inputScale.value = withSpring(1.02, { duration: 100 });
    inputScale.value = withSpring(1, { duration: 200 });
  }, []);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    inputScale.value = withSpring(1.02, { damping: 15 });
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    inputScale.value = withSpring(1, { damping: 15 });
  }, []);

  const handleSendMessage = useCallback(() => {
    if (!inputText.trim() || disabled) return;

    sendButtonScale.value = withSpring(0.95, { duration: 100 });
    sendButtonScale.value = withSpring(1, { duration: 200 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    sendMessage('text', inputText.trim());
    setInputText('');
    textInputRef.current?.blur();
  }, [inputText, disabled, sendMessage]);

  const handlePhotoPress = useCallback(async () => {
    if (disabled || uploadState.isUploading) return;

    Alert.alert('Select Photo', 'Choose how you want to add a photo', [
      { text: 'Camera', onPress: takePhoto },
      { text: 'Gallery', onPress: selectPhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [disabled, uploadState.isUploading, takePhoto, selectPhoto]);

  const handleCameraPress = useCallback(async () => {
    if (disabled || uploadState.isUploading) return;

    const cameraAvailable = await isCameraAvailable();
    if (cameraAvailable) {
      takePhoto();
    } else {
      Alert.alert('Camera Unavailable', 'Camera is not available on this device');
    }
  }, [disabled, uploadState.isUploading, isCameraAvailable, takePhoto]);

  // Animated styles
  const inputAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: inputScale.value }],
  }));

  const sendButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendButtonScale.value }],
  }));

  const actionButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: voiceButtonScale.value }],
  }));

  const recordingOverlayStyle = useAnimatedStyle(() => ({
    opacity: recordingOpacity.value,
    transform: [{ translateY: interpolate(recordingOpacity.value, [0, 1], [-50, 0]) }],
  }));

  const recordingProgressStyle = useAnimatedStyle(() => ({
    width: `${interpolate(recordingProgress.value, [0, 1], [0, 100])}%`,
  }));

  // Computed values
  const hasText = inputText.trim().length > 0;
  const isRecordingFlowActive = ['recording', 'processing', 'uploading'].includes(voicePhase);
  const isRecordingActive = voicePhase === 'recording';
  const isProcessingOrUploading = voicePhase === 'processing' || voicePhase === 'uploading';

  const getStatusText = () => {
    if (uploadState.isUploading && voicePhase === 'idle') {
      return `Uploading photo... ${Math.round(uploadState.progress)}%`;
    }
    
    switch (voicePhase) {
      case 'holding':
        return 'Hold to record...';
      case 'recording':
        return 'Recording...';
      case 'processing':
        return 'Processing...';
      case 'uploading':
        return `Uploading... ${Math.round(uploadState.progress)}%`;
      case 'error':
        return 'Recording failed';
      default:
        return '';
    }
  };

  const getActionButtonIcon = () => {
    if (hasText) {
      return isRTL ? 'arrow-back' : 'arrow-forward';
    }
    
    switch (voicePhase) {
      case 'uploading':
        return 'cloud-upload';
      case 'processing':
        return 'hourglass';
      case 'recording':
        return 'stop';
      default:
        return 'mic';
    }
  };

  const getOverlayColor = () => {
    if (uploadState.isUploading && voicePhase === 'idle') {
      return COLORS.primary;
    }

    switch (voicePhase) {
      case 'recording':
        return COLORS.error;
      case 'processing':
        return COLORS.warning;
      case 'uploading':
        return COLORS.primary;
      case 'error':
        return COLORS.error;
      default:
        return COLORS.error;
    }
  };

  const getActionButtonStyle = () => {
    if (hasText) return styles.sendButton;
    
    switch (voicePhase) {
      case 'recording':
        return styles.recordingButton;
      case 'processing':
        return styles.processingButton;
      default:
        return styles.voiceButton;
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, SPACING.md) : SPACING.md,
        },
      ]}
    >
      {/* Status Overlay */}
      {(isRecordingActive || isProcessingOrUploading || voicePhase === 'error' || uploadState.isUploading) && (
        <Animated.View
          style={[
            styles.recordingOverlay,
            recordingOverlayStyle,
            { backgroundColor: getOverlayColor() }
          ]}
        >
          <View style={styles.recordingContent}>
            <View style={styles.recordingIndicator}>
              <View style={[styles.recordingDot, voicePhase === 'recording' && styles.recordingDotActive]} />
              <Text style={styles.recordingText}>
                {getStatusText()}
              </Text>
            </View>

            {voicePhase === 'error' && (
              <Pressable onPress={handleRetryRecording} style={styles.retryButton}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            )}
          </View>

          {(isRecordingActive || isProcessingOrUploading || uploadState.isUploading) && (
            <View style={styles.progressBarContainer}>
              <Animated.View style={[styles.progressBarFill, recordingProgressStyle]} />
            </View>
          )}
        </Animated.View>
      )}

      {/* Main Input Row */}
      <Animated.View style={styles.inputRow}>
        {/* Input Container */}
        <Animated.View
          style={[
            styles.inputContainer,
            isFocused && styles.inputContainerFocused,
            (isRecordingActive || isProcessingOrUploading) && styles.inputContainerRecording,
            inputAnimatedStyle,
          ]}
        >
          {/* Attachment Button */}
          <Pressable
            onPress={handlePhotoPress}
            style={({ pressed }) => [styles.attachmentButton, pressed && styles.buttonPressed]}
            disabled={disabled || isRecordingActive || isProcessingOrUploading}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="attach-outline"
              size={20}
              color={disabled || isRecordingActive || isProcessingOrUploading ? COLORS.gray400 : COLORS.gray600}
            />
          </Pressable>

          {/* Text Input */}
          <TextInput
            ref={textInputRef}
            value={inputText}
            onChangeText={handleTextChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            placeholderTextColor={COLORS.gray400}
            style={[
              styles.textInput,
              {
                textAlign: isRTL ? 'right' : 'left',
                writingDirection: isRTL ? 'rtl' : 'ltr',
              },
            ]}
            multiline
            maxLength={maxLength}
            editable={!disabled && !isRecordingActive && !isProcessingOrUploading}
            textAlignVertical="center"
            returnKeyType="send"
            onSubmitEditing={hasText ? handleSendMessage : undefined}
            blurOnSubmit={false}
          />

          {/* Camera Button */}
          <Pressable
            onPress={handleCameraPress}
            style={({ pressed }) => [styles.cameraButton, pressed && styles.buttonPressed]}
            disabled={disabled || isRecordingActive || isProcessingOrUploading}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name="camera-outline"
              size={20}
              color={disabled || isRecordingActive || isProcessingOrUploading ? COLORS.gray400 : COLORS.gray600}
            />
          </Pressable>
        </Animated.View>

        {/* Action Button - Larger Size */}
        <Animated.View style={actionButtonAnimatedStyle}>
          <Pressable
            onPressIn={hasText ? undefined : handleVoicePressIn}
            onLongPress={hasText ? undefined : handleVoiceLongPress}
            onPressOut={hasText ? undefined : handleVoicePressOut}
            onPress={hasText ? handleSendMessage : undefined}
            delayLongPress={200}
            style={[styles.actionButton, getActionButtonStyle()]}
            disabled={disabled && !isRecordingFlowActive}
          >
            <Ionicons
              name={getActionButtonIcon()}
              size={24}
              color={COLORS.white}
            />
          </Pressable>
        </Animated.View>
      </Animated.View>

      {/* Character Count */}
      {inputText.length > maxLength * 0.8 && (
        <Text
          style={[
            styles.characterCount,
            {
              textAlign: isRTL ? 'left' : 'right',
              color: inputText.length >= maxLength ? COLORS.error : COLORS.gray500,
            },
          ]}
        >
          {inputText.length}/{maxLength}
        </Text>
      )}

      {/* Error Display */}
      {uploadState.error && <Text style={styles.errorText}>{uploadState.error}</Text>}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.gray50,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  } as ViewStyle,

  recordingOverlay: {
    position: 'absolute',
    top: -60,
    left: SPACING.lg,
    right: SPACING.lg,
    borderRadius: 16,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    zIndex: 10,
    ...SHADOWS.md,
  } as ViewStyle,

  recordingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  } as ViewStyle,

  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,

  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.white,
    marginRight: SPACING.sm,
    opacity: 0.7,
  } as ViewStyle,

  recordingDotActive: {
    opacity: 1,
  } as ViewStyle,

  recordingText: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.white,
  } as TextStyle,

  retryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  } as ViewStyle,

  retryText: {
    ...TYPOGRAPHY.small,
    color: COLORS.white,
    fontWeight: '500',
  } as TextStyle,

  progressBarContainer: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  } as ViewStyle,

  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 2,
  } as ViewStyle,

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  } as ViewStyle,

  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: COLORS.gray200,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    minHeight: 40,
    ...SHADOWS.sm,
  } as ViewStyle,

  inputContainerFocused: {
    borderColor: COLORS.primary,
  } as ViewStyle,

  inputContainerRecording: {
    borderColor: COLORS.error,
    backgroundColor: '#fef2f2',
  } as ViewStyle,

  attachmentButton: {
    padding: SPACING.sm,
    marginRight: SPACING.xs,
    alignSelf: 'flex-end',
  } as ViewStyle,

  textInput: {
    flex: 1,
    ...TYPOGRAPHY.body,
    color: COLORS.gray900,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    maxHeight: 100,
    minHeight: 24,
  } as TextStyle,

  cameraButton: {
    padding: SPACING.sm,
    marginLeft: SPACING.xs,
    alignSelf: 'flex-end',
  } as ViewStyle,

  buttonPressed: {
    opacity: 0.7,
  } as ViewStyle,

  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  } as ViewStyle,

  sendButton: {
    backgroundColor: COLORS.primary,
  } as ViewStyle,

  voiceButton: {
    backgroundColor: COLORS.success,
  } as ViewStyle,

  recordingButton: {
    backgroundColor: COLORS.error,
  } as ViewStyle,

  processingButton: {
    backgroundColor: COLORS.warning,
  } as ViewStyle,

  characterCount: {
    ...TYPOGRAPHY.caption,
    marginTop: SPACING.xs,
    marginRight: SPACING.sm,
  } as TextStyle,

  errorText: {
    ...TYPOGRAPHY.small,
    color: COLORS.error,
    marginTop: SPACING.xs,
    textAlign: 'center',
  } as TextStyle,
});