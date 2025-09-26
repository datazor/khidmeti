// app/(app)/customer.tsx
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  useWindowDimensions,
  TextStyle,
  ViewStyle,
  ImageStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Carousel from 'react-native-reanimated-carousel';
import { useCustomer } from '../../hooks/useCustomer';
import { useAuth } from '../../hooks/useAuth';
import { useLocalization } from '@/constants/localization';

// Helper function to get text alignment based on language
const getTextAlign = (isRTL: boolean): 'left' | 'right' | 'center' => {
  return isRTL ? 'right' : 'left';
};

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
  xxl: 48,
  xxxl: 64,
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

interface Category {
  _id: string;
  name: string;
  name_en: string;
  name_fr: string;
  name_ar: string;
  photo_url: string;
  requires_photos: boolean;
  requires_work_code: boolean;
  level: number;
  parent_id?: string;
}

type ViewMode = 'grid' | 'coverflow';

interface ViewToggleProps {
  viewMode: ViewMode;
  onToggle: (mode: ViewMode) => void;
}

const ViewToggle: React.FC<ViewToggleProps> = ({ viewMode, onToggle }) => {
  return (
    <View style={styles.toggleContainer}>
      <Pressable
        onPress={() => onToggle('grid')}
        style={[
          styles.toggleButton,
          viewMode === 'grid' && styles.toggleButtonActive
        ]}
      >
        <Ionicons 
          name="grid-outline" 
          size={20} 
          color={viewMode === 'grid' ? COLORS.white : COLORS.gray600} 
        />
      </Pressable>
      <Pressable
        onPress={() => onToggle('coverflow')}
        style={[
          styles.toggleButton,
          viewMode === 'coverflow' && styles.toggleButtonActive
        ]}
      >
        <Ionicons 
          name="albums-outline" 
          size={20} 
          color={viewMode === 'coverflow' ? COLORS.white : COLORS.gray600} 
        />
      </Pressable>
    </View>
  );
};

interface CategoryCardSkeletonProps {
  cardWidth: number;
  cardHeight: number;
}

const CategoryCardSkeleton: React.FC<CategoryCardSkeletonProps> = ({ cardWidth, cardHeight }) => {
  const pulseAnim = useSharedValue(0.3);

  useEffect(() => {
    const pulse = () => {
      pulseAnim.value = withTiming(0.8, { duration: 1000 }, () => {
        pulseAnim.value = withTiming(0.3, { duration: 1000 }, () => {
          pulse();
        });
      });
    };
    pulse();
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: pulseAnim.value,
  }));

  return (
    <Animated.View style={[styles.categoryCard, { width: cardWidth, height: cardHeight }, animatedStyle]}>
      <View style={styles.skeletonBackground}>
        <View style={styles.skeletonTextContainer}>
          <View style={styles.skeletonText} />
        </View>
      </View>
    </Animated.View>
  );
};

interface CategoryCardProps {
  category: Category;
  onPress: () => void;
  cardWidth: number;
  cardHeight: number;
  style?: any;
}

const CategoryCard: React.FC<CategoryCardProps> = ({ category, onPress, cardWidth, cardHeight, style }) => {
  const scaleAnim = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
  }));

  const handlePressIn = useCallback(() => {
    scaleAnim.value = withSpring(0.98, { damping: 15, stiffness: 200 });
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    scaleAnim.value = withSpring(1, { damping: 15, stiffness: 200 });
  }, [scaleAnim]);

  return (
    <Animated.View style={[animatedStyle, style, { width: cardWidth }]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.categoryCard, { width: cardWidth, height: cardHeight }]}
        accessibilityLabel={`Select ${category.name} category`}
        accessibilityRole="button"
      >
        <Image
          source={{ uri: category.photo_url }}
          style={styles.categoryImage}
          resizeMode="cover"
        />
        <View style={styles.categoryOverlay} />
        <View style={styles.categoryTextContainer}>
          <Text style={styles.categoryText} numberOfLines={2}>
            {category.name}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
};

interface CoverFlowCarouselProps {
  categories: Category[];
  onCategoryPress: (categoryId: string) => void;
  screenWidth: number;
}

const CoverFlowCarousel: React.FC<CoverFlowCarouselProps> = ({ 
  categories, 
  onCategoryPress, 
  screenWidth 
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const cardWidth = screenWidth * 0.7;
  const cardHeight = cardWidth * 0.85;
  const navigationDotsHeight = 50;
  const carouselHeight = cardHeight + 40;

  const renderCoverFlowItem = ({ item }: { item: Category }) => (
    <View style={{ width: cardWidth, height: cardHeight, justifyContent: 'center', alignItems: 'center' }}>
      <CategoryCard
        category={item}
        onPress={() => onCategoryPress(item._id)}
        cardWidth={cardWidth}
        cardHeight={cardHeight}
      />
    </View>
  );

  return (
    <View style={styles.coverFlowContainer}>
      <View style={{ 
        height: carouselHeight, 
        justifyContent: 'center',
        alignItems: 'center',
        width: screenWidth 
      }}>
        <Carousel
          width={screenWidth}
          height={carouselHeight}
          data={categories}
          renderItem={renderCoverFlowItem}
          mode="parallax"
          modeConfig={{
            parallaxScrollingScale: 0.9,
            parallaxScrollingOffset: 80,
            parallaxAdjacentItemScale: 0.75,
          }}
          snapEnabled={true}
          pagingEnabled={true}
          loop={false}
          autoPlay={false}
          onSnapToItem={setCurrentIndex}
        />
      </View>
      
      <View style={[styles.pageIndicators, { height: navigationDotsHeight }]}>
        {categories.map((_, index) => (
          <View
            key={index}
            style={[
              styles.pageIndicator,
              index === currentIndex && styles.pageIndicatorActive
            ]}
          />
        ))}
      </View>
    </View>
  );
};

export default function CustomerCategoriesScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { categories, isLoadingCategories } = useCustomer();
  const { user } = useAuth();
  const { t, isRTL, textDirection } = useLocalization();
  
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  
  const fadeAnim = useSharedValue(0);
  const slideAnim = useSharedValue(30);
  
  const containerPadding = SPACING.lg;
  const columnGap = SPACING.sm;
  const availableWidth = width - (containerPadding * 2);
  const gridCardWidth = (availableWidth - columnGap) / 2;
  const gridCardHeight = gridCardWidth * 0.85;

  useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 600 });
    slideAnim.value = withSpring(0, { damping: 20, stiffness: 200 });
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ translateY: slideAnim.value }],
  }));

const handleCategoryPress = useCallback((categoryId: string) => {
  router.push({
    pathname: '/(app)/chat' as any,
    params: { categoryId }
  });
}, [router]);

  const handleViewToggle = useCallback((mode: ViewMode) => {
    setViewMode(mode);
  }, []);

  const renderGridCategory = useCallback(({ item, index }: { item: Category; index: number }) => {
    const isRightColumn = index % 2 === 1;
    const marginLeft = isRightColumn ? columnGap : 0;
    
    return (
      <View style={{ marginLeft }}>
        <CategoryCard
          category={item}
          onPress={() => handleCategoryPress(item._id)}
          cardWidth={gridCardWidth}
          cardHeight={gridCardHeight}
        />
      </View>
    );
  }, [gridCardWidth, gridCardHeight, columnGap, handleCategoryPress]);

  const renderGridSkeleton = useCallback(({ index }: { index: number }) => {
    const isRightColumn = index % 2 === 1;
    const marginLeft = isRightColumn ? columnGap : 0;
    
    return (
      <View style={{ marginLeft }}>
        <CategoryCardSkeleton cardWidth={gridCardWidth} cardHeight={gridCardHeight} />
      </View>
    );
  }, [gridCardWidth, gridCardHeight, columnGap]);

  const keyExtractor = useCallback((item: Category) => item._id, []);

  const getGreeting = () => {
    if (user?.name) {
      return t('customer.greeting', { name: user.name });
    }
    return t('customer.defaultGreeting');
  };

  if (isLoadingCategories) {
    return (
      <SafeAreaView style={styles.container}>
        <Animated.View style={[{ padding: containerPadding }, containerStyle]}>
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View style={styles.brandContainer}>
                <Text style={styles.brandText}>Khidme</Text>
                <View style={styles.brandUnderline} />
              </View>
              <ViewToggle viewMode={viewMode} onToggle={handleViewToggle} />
            </View>
            
            <Text style={[
              styles.title,
              { 
                textAlign: getTextAlign(isRTL),
                writingDirection: textDirection 
              }
            ]}>
              {getGreeting()}
            </Text>
            <Text style={[
              styles.subtitle,
              { 
                textAlign: getTextAlign(isRTL),
                writingDirection: textDirection 
              }
            ]}>
              {t('customer.subtitle')}
            </Text>
          </View>

          {viewMode === 'grid' ? (
            <FlatList
              data={Array(8).fill({}).map((_, index) => ({ _id: index.toString() }))}
              renderItem={renderGridSkeleton}
              numColumns={2}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.listContainer, { paddingBottom: 120 }]}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              columnWrapperStyle={styles.row}
            />
          ) : (
            <View style={styles.coverFlowContainer}>
              <Carousel
                width={width}
                height={width * 0.7 * 0.85 + 50}
                data={Array(6).fill({ _id: 'skeleton', name: 'Loading...' })}
                renderItem={() => (
                  <CategoryCardSkeleton cardWidth={width * 0.7} cardHeight={width * 0.7 * 0.85} />
                )}
                mode="parallax"
                modeConfig={{
                  parallaxScrollingScale: 0.8,
                  parallaxScrollingOffset: 50,
                  parallaxAdjacentItemScale: 0.7,
                }}
                enabled={false}
              />
            </View>
          )}
        </Animated.View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[{ padding: containerPadding }, containerStyle]}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.brandContainer}>
              <Text style={styles.brandText}>Khidme</Text>
              <View style={styles.brandUnderline} />
            </View>
            <ViewToggle viewMode={viewMode} onToggle={handleViewToggle} />
          </View>
          
          <Text style={[
            styles.title,
            { 
              textAlign: getTextAlign(isRTL),
              writingDirection: textDirection 
            }
          ]}>
            {getGreeting()}
          </Text>
          <Text style={[
            styles.subtitle,
            { 
              textAlign: getTextAlign(isRTL),
              writingDirection: textDirection 
            }
          ]}>
            {t('customer.subtitle')}
          </Text>
        </View>

        {viewMode === 'grid' ? (
          <FlatList
            data={categories}
            renderItem={renderGridCategory}
            keyExtractor={keyExtractor}
            numColumns={2}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.listContainer, { paddingBottom: 120 }]}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            columnWrapperStyle={styles.row}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={10}
            removeClippedSubviews={true}
          />
        ) : (
          <CoverFlowCarousel
            categories={categories}
            onCategoryPress={handleCategoryPress}
            screenWidth={width}
          />
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  } as ViewStyle,

  header: {
    alignItems: 'center',
    marginBottom: SPACING.xs,
    paddingTop: SPACING.xs,
  } as ViewStyle,

  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: SPACING.xs,
  } as ViewStyle,

  brandContainer: {
    alignItems: 'center',
  } as ViewStyle,

  brandText: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.5,
  } as TextStyle,

  brandUnderline: {
    width: 45,
    height: 2,
    backgroundColor: COLORS.primary,
    marginTop: 2,
    borderRadius: 1,
  } as ViewStyle,

  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.gray100,
    borderRadius: 8,
    padding: 2,
  } as ViewStyle,

  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  } as ViewStyle,

  toggleButtonActive: {
    backgroundColor: COLORS.primary,
  } as ViewStyle,

  title: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 26,
    color: COLORS.gray900,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  } as TextStyle,

  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
    color: COLORS.gray600,
    textAlign: 'center',
  } as TextStyle,

  listContainer: {
    flexGrow: 1,
  } as ViewStyle,

  row: {
    justifyContent: 'flex-start',
  } as ViewStyle,

  separator: {
    height: SPACING.xs,
  } as ViewStyle,

  categoryCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: COLORS.gray200,
    ...SHADOWS.md,
  } as ViewStyle,

  categoryImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  } as ImageStyle,

  categoryOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
    backgroundColor: 'rgba(0,0,0,0.4)',
  } as ViewStyle,

  categoryTextContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.md,
    justifyContent: 'flex-end',
  } as ViewStyle,

  categoryText: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 20,
    color: COLORS.white,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  } as TextStyle,

  coverFlowContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: SPACING.md,
  } as ViewStyle,

  pageIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.xs,
    width: '100%',
  } as ViewStyle,

  pageIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.gray300,
  } as ViewStyle,

  pageIndicatorActive: {
    backgroundColor: COLORS.primary,
    width: 20,
  } as ViewStyle,

  skeletonBackground: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.gray200,
    justifyContent: 'flex-end',
  } as ViewStyle,

  skeletonTextContainer: {
    padding: SPACING.md,
  } as ViewStyle,

  skeletonText: {
    height: 16,
    backgroundColor: COLORS.gray300,
    borderRadius: 4,
    width: '70%',
  } as ViewStyle,
});
