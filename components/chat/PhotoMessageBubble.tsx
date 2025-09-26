// components/chat/PhotoMessageBubble.tsx - Photo message display component
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageStyle,
  Pressable,
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
} from 'react-native-reanimated';
import { Id } from '../../convex/_generated/dataModel';

// Design System
const COLORS = {
  primary: '#2563eb',
  primaryLight: '#3b82f6',
  success: '#10b981',
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
  gray900: '#0f172a',
};

const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
};

const TYPOGRAPHY = {
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

const SHADOWS = {
  photo: {
    shadowColor: COLORS.gray900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
};

interface PhotoMessageBubbleProps {
  messageId: Id<'messages'>;
  photoUri: string;
  caption?: string;
  timestamp: number;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  isCurrentUser: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  isRTL?: boolean;
  senderName?: string;
  senderAvatar?: string;
  onPhotoPress?: (photoUri: string) => void;
  onError?: (error: string) => void;
  isOptimistic?: boolean;
  optimisticStatus?: 'sending' | 'failed';
  // Photo metadata
  width?: number;
  height?: number;
  size?: number;
  fileName?: string;
}

export const PhotoMessageBubble: React.FC<PhotoMessageBubbleProps> = ({
  messageId,
  photoUri,
  caption,
  timestamp,
  status,
  isCurrentUser,
  isFirst = true,
  isLast = true,
  isRTL = false,
  senderName,
  senderAvatar,
  onPhotoPress,
  onError,
  isOptimistic = false,
  optimisticStatus,
  width,
  height,
  size,
  fileName,
}) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  // Animation values
  const scaleAnim = useSharedValue(1);
  const opacityAnim = useSharedValue(isOptimistic ? 0.7 : 1);

  // Calculate optimal image dimensions
  const photoStyle = useMemo(() => {
    const maxWidth = 240;
    const maxHeight = 320;
    const minWidth = 160;
    const minHeight = 120;

    let photoWidth = width || maxWidth;
    let photoHeight = height || maxHeight;

    // If we have dimensions, calculate aspect ratio
    if (width && height) {
      const aspectRatio = width / height;
      
      if (aspectRatio > 1) {
        // Landscape
        photoWidth = Math.min(maxWidth, Math.max(minWidth, width));
        photoHeight = photoWidth / aspectRatio;
        
        if (photoHeight > maxHeight) {
          photoHeight = maxHeight;
          photoWidth = photoHeight * aspectRatio;
        }
      } else {
        // Portrait or square
        photoHeight = Math.min(maxHeight, Math.max(minHeight, height));
        photoWidth = photoHeight * aspectRatio;
        
        if (photoWidth > maxWidth) {
          photoWidth = maxWidth;
          photoHeight = photoWidth / aspectRatio;
        }
      }
    }

    return {
      width: Math.round(photoWidth),
      height: Math.round(photoHeight),
    };
  }, [width, height]);

  // Handle image load
  const handleImageLoad = useCallback((event: any) => {
    setImageLoading(false);
    
    // Get actual image dimensions if not provided
    if (!imageDimensions && event.nativeEvent?.source) {
      const { width: imgWidth, height: imgHeight } = event.nativeEvent.source;
      setImageDimensions({ width: imgWidth, height: imgHeight });
    }
  }, [imageDimensions]);

  // Handle image error
  const handleImageError = useCallback(() => {
    setImageLoading(false);
    setImageError(true);
    onError?.('Failed to load image');
  }, [onError]);

  // Handle photo press
  const handlePhotoPress = useCallback(() => {
    if (imageError || imageLoading) return;
    
    // Animate press
    scaleAnim.value = withSpring(0.95, { damping: 15 }, () => {
      scaleAnim.value = withSpring(1, { damping: 15 });
    });
    
    onPhotoPress?.(photoUri);
  }, [imageError, imageLoading, photoUri, onPhotoPress, scaleAnim]);

  // Update opacity for optimistic messages
  React.useEffect(() => {
    if (isOptimistic) {
      opacityAnim.value = optimisticStatus === 'failed' ? 0.5 : 0.7;
    } else {
      opacityAnim.value = withTiming(1, { duration: 300 });
    }
  }, [isOptimistic, optimisticStatus, opacityAnim]);

  // Container styles
  const containerStyle = useMemo(() => [
    styles.container,
    isCurrentUser ? styles.currentUserContainer : styles.otherUserContainer,
    isFirst && (isCurrentUser ? styles.currentUserFirst : styles.otherUserFirst),
    isLast && (isCurrentUser ? styles.currentUserLast : styles.otherUserLast),
    isRTL && styles.containerRTL,
  ], [isCurrentUser, isFirst, isLast, isRTL]);

  // Animated styles
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
    opacity: opacityAnim.value,
  }));

  // Format file size
  const formatFileSize = useCallback((bytes?: number) => {
    if (!bytes) return '';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  }, []);

  // Format timestamp
  const formatTime = useCallback((timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }, []);

  return (
    <Animated.View style={[containerStyle, animatedStyle]}>
      {/* Sender info for other users */}
      {!isCurrentUser && senderName && isFirst && (
        <View style={[styles.senderInfo, isRTL && styles.senderInfoRTL]}>
          {senderAvatar && (
            <Image source={{ uri: senderAvatar }} style={styles.senderAvatar} />
          )}
          <Text style={styles.senderName}>{senderName}</Text>
        </View>
      )}

      {/* Photo container */}
      <Pressable
        onPress={handlePhotoPress}
        disabled={imageError || imageLoading}
        style={({ pressed }) => [
          styles.photoContainer,
          { ...photoStyle },
          pressed && styles.photoPressed,
        ]}
      >
        {/* Photo */}
        {!imageError && (
          <Image
            source={{ uri: photoUri }}
            style={[styles.photo, { width: photoStyle.width, height: photoStyle.height }]}
            onLoad={handleImageLoad}
            onError={handleImageError}
            resizeMode="cover"
          />
        )}

        {/* Loading indicator */}
        {imageLoading && !imageError && (
          <View style={[styles.loadingContainer, photoStyle]}>
            <ActivityIndicator size="large" color={COLORS.white} />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        )}

        {/* Error state */}
        {imageError && (
          <View style={[styles.errorContainer, photoStyle]}>
            <Ionicons name="image-outline" size={48} color={COLORS.gray400} />
            <Text style={styles.errorText}>Failed to load image</Text>
            {fileName && (
              <Text style={styles.errorFileName}>{fileName}</Text>
            )}
          </View>
        )}

        {/* Photo overlay info */}
        {!imageLoading && !imageError && (
          <View style={styles.photoOverlay}>
            {/* File size badge */}
            {size && (
              <View style={styles.sizeBadge}>
                <Text style={styles.sizeText}>{formatFileSize(size)}</Text>
              </View>
            )}
            
            {/* Expand icon */}
            <View style={styles.expandIcon}>
              <Ionicons name="expand" size={16} color={COLORS.white} />
            </View>
          </View>
        )}

        {/* Optimistic status overlay */}
        {isOptimistic && (
          <View style={styles.optimisticOverlay}>
            {optimisticStatus === 'sending' && (
              <View style={styles.sendingIndicator}>
                <ActivityIndicator size="small" color={COLORS.white} />
              </View>
            )}
            {optimisticStatus === 'failed' && (
              <View style={styles.failedIndicator}>
                <Ionicons name="alert-circle" size={20} color={COLORS.error} />
              </View>
            )}
          </View>
        )}
      </Pressable>

      {/* Caption */}
      {caption && (
        <View style={styles.captionContainer}>
          <Text style={styles.captionText}>{caption}</Text>
        </View>
      )}

      {/* Message footer */}
      <View style={[styles.footer, isRTL && styles.footerRTL]}>
        <Text style={styles.timestamp}>{formatTime(timestamp)}</Text>
        
        {/* Message status for current user */}
        {isCurrentUser && !isOptimistic && (
          <View style={styles.statusContainer}>
            {status === 'sending' && (
              <ActivityIndicator size="small" color={COLORS.gray400} />
            )}
            {status === 'sent' && (
              <Ionicons name="checkmark" size={16} color={COLORS.gray400} />
            )}
            {status === 'delivered' && (
              <Ionicons name="checkmark-done" size={16} color={COLORS.gray400} />
            )}
            {status === 'read' && (
              <Ionicons name="checkmark-done" size={16} color={COLORS.primary} />
            )}
            {status === 'failed' && (
              <Ionicons name="alert-circle" size={16} color={COLORS.error} />
            )}
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.xs,
    maxWidth: '80%',
  } as ViewStyle,

  currentUserContainer: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  } as ViewStyle,

  otherUserContainer: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  } as ViewStyle,

  currentUserFirst: {
    borderTopRightRadius: 8,
  } as ViewStyle,

  currentUserLast: {
    borderBottomRightRadius: 8,
  } as ViewStyle,

  otherUserFirst: {
    borderTopLeftRadius: 8,
  } as ViewStyle,

  otherUserLast: {
    borderBottomLeftRadius: 8,
  } as ViewStyle,

  containerRTL: {
    // RTL layout handled by flex directions
  } as ViewStyle,

  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  } as ViewStyle,

  senderInfoRTL: {
    flexDirection: 'row-reverse',
  } as ViewStyle,

  senderAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: SPACING.xs,
  } as ImageStyle,

  senderName: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
    fontWeight: '500',
  } as TextStyle,

  photoContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.gray200,
    position: 'relative',
    ...SHADOWS.photo,
  } as ViewStyle,

  photoPressed: {
    opacity: 0.8,
  } as ViewStyle,

  photo: {
    borderRadius: 12,
  } as ImageStyle,

  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.gray300,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  } as ViewStyle,

  loadingText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.white,
    marginTop: SPACING.sm,
  } as TextStyle,

  errorContainer: {
    backgroundColor: COLORS.gray200,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: SPACING.lg,
  } as ViewStyle,

  errorText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
    marginTop: SPACING.sm,
    textAlign: 'center',
  } as TextStyle,

  errorFileName: {
    ...TYPOGRAPHY.micro,
    color: COLORS.gray500,
    marginTop: SPACING.xs,
    textAlign: 'center',
  } as TextStyle,

  photoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    padding: SPACING.sm,
  } as ViewStyle,

  sizeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 8,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  } as ViewStyle,

  sizeText: {
    ...TYPOGRAPHY.micro,
    color: COLORS.white,
  } as TextStyle,

  expandIcon: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  optimisticOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  } as ViewStyle,

  sendingIndicator: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 16,
    padding: SPACING.sm,
  } as ViewStyle,

  failedIndicator: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.sm,
  } as ViewStyle,

  captionContainer: {
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  } as ViewStyle,

  captionText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray700,
    lineHeight: 18,
  } as TextStyle,

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  } as ViewStyle,

  footerRTL: {
    flexDirection: 'row-reverse',
  } as ViewStyle,

  timestamp: {
    ...TYPOGRAPHY.micro,
    color: COLORS.gray500,
  } as TextStyle,

  statusContainer: {
    marginLeft: SPACING.sm,
  } as ViewStyle,
});