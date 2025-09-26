// components/chat/FullscreenPhotoModal.tsx - Full screen photo viewer
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ImageStyle,
  Modal,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { PinchGestureHandler, PanGestureHandler, State } from 'react-native-gesture-handler';

// Design System
const COLORS = {
  primary: '#2563eb',
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
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

const TYPOGRAPHY = {
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  micro: {
    fontSize: 10,
    fontWeight: '500' as const,
    lineHeight: 14,
  },
};

interface FullscreenPhotoModalProps {
  visible: boolean;
  photoUri: string;
  caption?: string;
  onClose: () => void;
  onError?: (error: string) => void;
  // Optional metadata
  fileName?: string;
  size?: number;
  timestamp?: number;
  senderName?: string;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const FullscreenPhotoModal: React.FC<FullscreenPhotoModalProps> = ({
  visible,
  photoUri,
  caption,
  onClose,
  onError,
  fileName,
  size,
  timestamp,
  senderName,
}) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [showControls, setShowControls] = useState(true);

  // Animation values
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const controlsOpacity = useSharedValue(1);

  // Show modal animation
  React.useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 300 });
      scale.value = withSpring(1, { damping: 20, stiffness: 200 });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(0.9, { duration: 200 });
      // Reset transforms when closing
      translateX.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(1, { duration: 200 });
    }
  }, [visible]);

  // Auto-hide controls
  React.useEffect(() => {
    if (visible && showControls) {
      const timer = setTimeout(() => {
        setShowControls(false);
        controlsOpacity.value = withTiming(0, { duration: 300 });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [visible, showControls]);

  // Handle image load
  const handleImageLoad = useCallback((event: any) => {
    setImageLoading(false);
    
    if (event.nativeEvent?.source) {
      const { width: imgWidth, height: imgHeight } = event.nativeEvent.source;
      setImageDimensions({ width: imgWidth, height: imgHeight });
    }
  }, []);

  // Handle image error
  const handleImageError = useCallback(() => {
    setImageLoading(false);
    setImageError(true);
    onError?.('Failed to load image');
  }, [onError]);

  // Handle close
  const handleClose = useCallback(() => {
    setImageLoading(true);
    setImageError(false);
    setShowControls(true);
    controlsOpacity.value = 1;
    onClose();
  }, [onClose]);

  // Toggle controls
  const toggleControls = useCallback(() => {
    const newShowControls = !showControls;
    setShowControls(newShowControls);
    controlsOpacity.value = withTiming(newShowControls ? 1 : 0, { duration: 300 });
  }, [showControls]);

  // Reset zoom and position
  const resetTransform = useCallback(() => {
    scale.value = withSpring(1, { damping: 20, stiffness: 200 });
    translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
    translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
  }, []);

  // Pinch gesture handler
  const onPinchGestureEvent = useCallback((event: any) => {
    scale.value = Math.max(0.5, Math.min(event.nativeEvent.scale, 3));
  }, []);

  const onPinchHandlerStateChange = useCallback((event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      if (scale.value < 1) {
        scale.value = withSpring(1, { damping: 20, stiffness: 200 });
      }
    }
  }, []);

  // Pan gesture handler
  const onPanGestureEvent = useCallback((event: any) => {
    translateX.value = event.nativeEvent.translationX;
    translateY.value = event.nativeEvent.translationY;
  }, []);

  const onPanHandlerStateChange = useCallback((event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      // Snap back if moved too far
      const { translationX, translationY } = event.nativeEvent;
      const maxTranslation = 100;
      
      if (Math.abs(translationX) > maxTranslation || Math.abs(translationY) > maxTranslation) {
        runOnJS(handleClose)();
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
        translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    }
  }, [handleClose]);

  // Calculate image display dimensions
  const imageDisplayStyle = useMemo(() => {
    if (!imageDimensions) {
      return {
        width: SCREEN_WIDTH,
        height: SCREEN_HEIGHT * 0.6,
      };
    }

    const { width: imgWidth, height: imgHeight } = imageDimensions;
    const aspectRatio = imgWidth / imgHeight;
    
    let displayWidth = SCREEN_WIDTH;
    let displayHeight = SCREEN_WIDTH / aspectRatio;
    
    if (displayHeight > SCREEN_HEIGHT * 0.8) {
      displayHeight = SCREEN_HEIGHT * 0.8;
      displayWidth = displayHeight * aspectRatio;
    }
    
    return {
      width: displayWidth,
      height: displayHeight,
    };
  }, [imageDimensions]);

  // Format file size
  const formatFileSize = useCallback((bytes?: number) => {
    if (!bytes) return '';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }, []);

  // Format timestamp
  const formatTime = useCallback((timestamp?: number) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleString();
  }, []);

  // Animated styles
  const modalStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const imageContainerStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const controlsStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
  }));

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.9)" />
      
      <Animated.View style={[styles.container, modalStyle]}>
        {/* Background overlay */}
        <Pressable style={styles.overlay} onPress={handleClose} />
        
        {/* Header controls */}
        <Animated.View style={[styles.header, controlsStyle]}>
          <SafeAreaView style={styles.headerSafeArea}>
            <View style={styles.headerContent}>
              <Pressable onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={COLORS.white} />
              </Pressable>
              
              <View style={styles.headerInfo}>
                {senderName && (
                  <Text style={styles.senderText} numberOfLines={1}>
                    {senderName}
                  </Text>
                )}
                {fileName && (
                  <Text style={styles.fileNameText} numberOfLines={1}>
                    {fileName}
                  </Text>
                )}
              </View>
              
              <Pressable onPress={resetTransform} style={styles.resetButton}>
                <Ionicons name="refresh" size={20} color={COLORS.white} />
              </Pressable>
            </View>
          </SafeAreaView>
        </Animated.View>

        {/* Image container */}
        <View style={styles.imageContainer}>
          <Pressable onPress={toggleControls} style={styles.imageTouchArea}>
            <PanGestureHandler
              onGestureEvent={onPanGestureEvent}
              onHandlerStateChange={onPanHandlerStateChange}
            >
              <PinchGestureHandler
                onGestureEvent={onPinchGestureEvent}
                onHandlerStateChange={onPinchHandlerStateChange}
              >
                <Animated.View style={[styles.imageWrapper, imageContainerStyle]}>
                  {!imageError && (
                    <Image
                      source={{ uri: photoUri }}
                      style={[styles.image, imageDisplayStyle]}
                      onLoad={handleImageLoad}
                      onError={handleImageError}
                      resizeMode="contain"
                    />
                  )}

                  {/* Loading indicator */}
                  {imageLoading && !imageError && (
                    <View style={[styles.loadingContainer, imageDisplayStyle]}>
                      <ActivityIndicator size="large" color={COLORS.white} />
                    </View>
                  )}

                  {/* Error state */}
                  {imageError && (
                    <View style={[styles.errorContainer, imageDisplayStyle]}>
                      <Ionicons name="image-outline" size={64} color={COLORS.gray400} />
                      <Text style={styles.errorText}>Failed to load image</Text>
                    </View>
                  )}
                </Animated.View>
              </PinchGestureHandler>
            </PanGestureHandler>
          </Pressable>
        </View>

        {/* Footer with caption and metadata */}
        {(caption || size || timestamp) && (
          <Animated.View style={[styles.footer, controlsStyle]}>
            <SafeAreaView style={styles.footerSafeArea}>
              <View style={styles.footerContent}>
                {caption && (
                  <Text style={styles.captionText}>{caption}</Text>
                )}
                
                <View style={styles.metadataContainer}>
                  {size && (
                    <Text style={styles.metadataText}>
                      {formatFileSize(size)}
                    </Text>
                  )}
                  {timestamp && (
                    <Text style={styles.metadataText}>
                      {formatTime(timestamp)}
                    </Text>
                  )}
                </View>
              </View>
            </SafeAreaView>
          </Animated.View>
        )}
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  } as ViewStyle,

  overlay: {
    ...StyleSheet.absoluteFillObject,
  } as ViewStyle,

  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  } as ViewStyle,

  headerSafeArea: {
    paddingHorizontal: SPACING.lg,
  } as ViewStyle,

  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
  } as ViewStyle,

  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  headerInfo: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  } as ViewStyle,

  senderText: {
    ...TYPOGRAPHY.body,
    color: COLORS.white,
    fontWeight: '600',
  } as TextStyle,

  fileNameText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray300,
    marginTop: 2,
  } as TextStyle,

  resetButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  imageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  imageTouchArea: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  imageWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  image: {
    borderRadius: 8,
  } as ImageStyle,

  loadingContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  } as ViewStyle,

  errorContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    padding: SPACING.xxl,
  } as ViewStyle,

  errorText: {
    ...TYPOGRAPHY.body,
    color: COLORS.white,
    marginTop: SPACING.lg,
    textAlign: 'center',
  } as TextStyle,

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  } as ViewStyle,

  footerSafeArea: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  } as ViewStyle,

  footerContent: {
    alignItems: 'center',
  } as ViewStyle,

  captionText: {
    ...TYPOGRAPHY.body,
    color: COLORS.white,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.sm,
  } as TextStyle,

  metadataContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.lg,
  } as ViewStyle,

  metadataText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray300,
  } as TextStyle,
});