// components/chat/PhotoCarousel.tsx - Full-screen photo carousel for job images
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Design System
const COLORS = {
  white: '#ffffff',
  black: '#000000',
  gray100: '#f1f5f9',
  gray400: '#94a3b8',
  gray600: '#475569',
  gray800: '#1e293b',
  gray900: '#0f172a',
  primary: '#2563eb',
  error: '#ef4444',
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
  title: {
    fontSize: 18,
    fontWeight: '700' as const,
    lineHeight: 24,
  },
  body: {
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
};

interface PhotoItem {
  id: string;
  uri: string;
  width?: number;
  height?: number;
  caption?: string;
}

interface PhotoCarouselProps {
  photos: PhotoItem[];
  visible: boolean;
  initialIndex?: number;
  onClose: () => void;
  onDelete?: (photoId: string) => void;
  canDelete?: boolean;
  jobTitle?: string;
}

export const PhotoCarousel: React.FC<PhotoCarouselProps> = ({
  photos,
  visible,
  initialIndex = 0,
  onClose,
  onDelete,
  canDelete = false,
  jobTitle,
}) => {
  console.log('🎠 PhotoCarousel render:', { 
    visible, 
    photosLength: photos.length, 
    initialIndex,
    jobTitle 
  });

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [imageLoading, setImageLoading] = useState<{ [key: string]: boolean }>({});
  const [imageError, setImageError] = useState<{ [key: string]: boolean }>({});
  const scrollViewRef = useRef<ScrollView>(null);

  const handleScroll = useCallback((event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    setCurrentIndex(Math.max(0, Math.min(index, photos.length - 1)));
  }, [photos.length]);

  const goToImage = useCallback((index: number) => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        x: index * SCREEN_WIDTH,
        animated: true,
      });
    }
    setCurrentIndex(index);
  }, []);

  const handleImageLoadStart = useCallback((photoId: string) => {
    setImageLoading(prev => ({ ...prev, [photoId]: true }));
  }, []);

  const handleImageLoadEnd = useCallback((photoId: string) => {
    setImageLoading(prev => ({ ...prev, [photoId]: false }));
  }, []);

  const handleImageError = useCallback((photoId: string) => {
    setImageError(prev => ({ ...prev, [photoId]: true }));
    setImageLoading(prev => ({ ...prev, [photoId]: false }));
  }, []);

  const handleDelete = useCallback(() => {
    if (onDelete && photos[currentIndex]) {
      onDelete(photos[currentIndex].id);
    }
  }, [onDelete, photos, currentIndex]);

  const currentPhoto = photos[currentIndex];

  if (!visible || photos.length === 0) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
    >
      <StatusBar hidden={Platform.OS === 'ios'} backgroundColor={COLORS.black} barStyle="light-content" />
      
      {/* Background */}
      <View style={styles.container}>
        
        {/* Header */}
        <BlurView intensity={80} tint="dark" style={styles.header}>
          <Pressable 
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={8}
          >
            <Ionicons name="close" size={24} color={COLORS.white} />
          </Pressable>
          
          <View style={styles.headerInfo}>
            {jobTitle && (
              <Text style={styles.jobTitle} numberOfLines={1}>
                {jobTitle}
              </Text>
            )}
            <Text style={styles.photoCounter}>
              {currentIndex + 1} of {photos.length}
            </Text>
          </View>

          {canDelete && (
            <Pressable 
              onPress={handleDelete}
              style={styles.deleteButton}
              hitSlop={8}
            >
              <Ionicons name="trash" size={20} color={COLORS.error} />
            </Pressable>
          )}
        </BlurView>

        {/* Photo Carousel */}
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={styles.carousel}
          contentContainerStyle={styles.carouselContent}
        >
          {photos.map((photo, index) => (
            <View key={photo.id} style={styles.photoContainer}>
              {imageError[photo.id] ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="image-outline" size={64} color={COLORS.gray400} />
                  <Text style={styles.errorText}>Failed to load image</Text>
                </View>
              ) : (
                <>
                  {imageLoading[photo.id] && (
                    <View style={styles.loadingContainer}>
                      <View style={styles.loadingSpinner} />
                      <Text style={styles.loadingText}>Loading...</Text>
                    </View>
                  )}
                  
                  <Image
                    source={{ uri: photo.uri }}
                    style={styles.photo}
                    resizeMode="contain"
                    onLoadStart={() => handleImageLoadStart(photo.id)}
                    onLoadEnd={() => handleImageLoadEnd(photo.id)}
                    onError={() => handleImageError(photo.id)}
                  />
                </>
              )}
            </View>
          ))}
        </ScrollView>

        {/* Bottom Info */}
        {currentPhoto?.caption && (
          <BlurView intensity={80} tint="dark" style={styles.captionContainer}>
            <Text style={styles.caption}>{currentPhoto.caption}</Text>
          </BlurView>
        )}

        {/* Dots Indicator */}
        {photos.length > 1 && (
          <View style={styles.dotsContainer}>
            {photos.map((_, index) => (
              <Pressable
                key={index}
                onPress={() => goToImage(index)}
                style={[
                  styles.dot,
                  index === currentIndex && styles.activeDot,
                ]}
                hitSlop={8}
              />
            ))}
          </View>
        )}

        {/* Side Navigation (for larger screens) */}
        {photos.length > 1 && SCREEN_WIDTH > 400 && (
          <>
            {currentIndex > 0 && (
              <Pressable
                onPress={() => goToImage(currentIndex - 1)}
                style={[styles.navButton, styles.navButtonLeft]}
                hitSlop={12}
              >
                <Ionicons name="chevron-back" size={32} color={COLORS.white} />
              </Pressable>
            )}
            
            {currentIndex < photos.length - 1 && (
              <Pressable
                onPress={() => goToImage(currentIndex + 1)}
                style={[styles.navButton, styles.navButtonRight]}
                hitSlop={12}
              >
                <Ionicons name="chevron-forward" size={32} color={COLORS.white} />
              </Pressable>
            )}
          </>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.black,
  } as ViewStyle,

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: SPACING.md,
    paddingHorizontal: SPACING.lg,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  } as ViewStyle,

  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  headerInfo: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  } as ViewStyle,

  jobTitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.white,
    marginBottom: 2,
  } as TextStyle,

  photoCounter: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray400,
  } as TextStyle,

  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  carousel: {
    flex: 1,
  } as ViewStyle,

  carouselContent: {
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  photoContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Platform.OS === 'ios' ? 100 : 80,
    paddingBottom: 100,
  } as ViewStyle,

  photo: {
    width: SCREEN_WIDTH - (SPACING.xl * 2),
    height: '100%',
    maxHeight: SCREEN_HEIGHT - 200,
  },

  loadingContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  } as ViewStyle,

  loadingSpinner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: COLORS.gray600,
    borderTopColor: COLORS.white,
    marginBottom: SPACING.sm,
  } as ViewStyle,

  loadingText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray400,
  } as TextStyle,

  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  errorText: {
    ...TYPOGRAPHY.body,
    color: COLORS.gray400,
    marginTop: SPACING.md,
    textAlign: 'center',
  } as TextStyle,

  captionContainer: {
    position: 'absolute',
    bottom: 80,
    left: SPACING.lg,
    right: SPACING.lg,
    borderRadius: 12,
    padding: SPACING.md,
  } as ViewStyle,

  caption: {
    ...TYPOGRAPHY.body,
    color: COLORS.white,
    textAlign: 'center',
    lineHeight: 20,
  } as TextStyle,

  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
  } as ViewStyle,

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 4,
  } as ViewStyle,

  activeDot: {
    backgroundColor: COLORS.white,
    width: 10,
    height: 10,
    borderRadius: 5,
  } as ViewStyle,

  navButton: {
    position: 'absolute',
    top: '50%',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  } as ViewStyle,

  navButtonLeft: {
    left: SPACING.lg,
  } as ViewStyle,

  navButtonRight: {
    right: SPACING.lg,
  } as ViewStyle,
});