// app/(auth)/subcategory-selection.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useWorkerOnboarding } from '../../hooks/useWorkerOnboarding';
import { COLORS, SPACING, SHADOWS } from '../../constants/design';
import { Id } from '../../convex/_generated/dataModel';

export default function SubcategorySelectionScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  
  const { 
    categories, 
    selectedCategories,
    setSelectedCategories 
  } = useWorkerOnboarding();
  
  // Find category data
  const category = categories.find(c => c._id === categoryId);
  const currentSelection = selectedCategories.find(c => c.categoryId === categoryId);
  
  // Local state
  const [selectedSubcategoryIds, setSelectedSubcategoryIds] = useState<Id<'categories'>[]>(
    currentSelection?.subcategoryIds || []
  );
  const [experienceRating, setExperienceRating] = useState<number | undefined>(
    currentSelection?.experienceRating
  );
  
  // Calculate card dimensions
  const containerPadding = SPACING.lg;
  const columnGap = SPACING.md;
  const availableWidth = width - (containerPadding * 2);
  const cardWidth = (availableWidth - columnGap) / 2;
  const cardHeight = cardWidth * 1.0; // Square cards
  
  // Handlers
  const handleSubcategoryToggle = useCallback((subcategoryId: Id<'categories'>) => {
    setSelectedSubcategoryIds(prev => {
      if (prev.includes(subcategoryId)) {
        return prev.filter(id => id !== subcategoryId);
      }
      return [...prev, subcategoryId];
    });
  }, []);
  
  const handleSelectAll = useCallback(() => {
    if (!category?.subcategories) return;
    setSelectedSubcategoryIds(category.subcategories.map(s => s._id));
  }, [category]);
  
  const handleStarPress = useCallback((rating: number) => {
    setExperienceRating(rating);
  }, []);
  
  const handleDone = useCallback(() => {
    if (selectedSubcategoryIds.length === 0) return;
    
    // Update parent state
    setSelectedCategories(prev => {
      const filtered = prev.filter(c => c.categoryId !== categoryId);
      return [...filtered, {
        categoryId: categoryId as Id<'categories'>,
        subcategoryIds: selectedSubcategoryIds,
        experienceRating
      }];
    });
    
    router.back();
  }, [categoryId, selectedSubcategoryIds, experienceRating, setSelectedCategories, router]);
  
  const handleBack = useCallback(() => {
    // Save progress even when going back
    if (selectedSubcategoryIds.length > 0) {
      setSelectedCategories(prev => {
        const filtered = prev.filter(c => c.categoryId !== categoryId);
        return [...filtered, {
          categoryId: categoryId as Id<'categories'>,
          subcategoryIds: selectedSubcategoryIds,
          experienceRating
        }];
      });
    }
    router.back();
  }, [categoryId, selectedSubcategoryIds, experienceRating, setSelectedCategories, router]);
  
  // Render subcategory card
  const renderSubcategory = useCallback(({ item, index }: { item: any; index: number }) => {
    const isSelected = selectedSubcategoryIds.includes(item._id);
    const isRightColumn = index % 2 === 1;
    const marginLeft = isRightColumn ? columnGap : 0;
    
    return (
      <SubcategoryCard
        subcategory={item}
        isSelected={isSelected}
        onPress={() => handleSubcategoryToggle(item._id)}
        cardWidth={cardWidth}
        cardHeight={cardHeight}
        style={{ marginLeft }}
      />
    );
  }, [selectedSubcategoryIds, cardWidth, cardHeight, columnGap, handleSubcategoryToggle]);
  
  if (!category) {
    return null;
  }
  
  const canProceed = selectedSubcategoryIds.length > 0;
  
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.gray900} />
        </Pressable>
        <Text style={styles.headerTitle}>{category.name}</Text>
        <View style={styles.headerSpacer} />
      </View>
      
      {/* Subcategories Grid */}
      <FlatList
        data={category.subcategories || []}
        renderItem={renderSubcategory}
        keyExtractor={(item) => item._id}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContainer, { padding: containerPadding }]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        columnWrapperStyle={styles.row}
      />
      
      {/* Experience Rating */}
      {selectedSubcategoryIds.length > 0 && (
        <View style={styles.ratingContainer}>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                onPress={() => handleStarPress(star)}
                style={styles.starButton}
              >
                <Ionicons
                  name={star <= (experienceRating || 0) ? "star" : "star-outline"}
                  size={32}
                  color={star <= (experienceRating || 0) ? COLORS.warning : COLORS.gray300}
                />
              </Pressable>
            ))}
          </View>
        </View>
      )}
      
      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <Pressable
          onPress={handleSelectAll}
          style={styles.textButton}
        >
          <Text style={styles.textButtonText}>Select All</Text>
        </Pressable>
        
        <Pressable
          onPress={handleDone}
          style={[
            styles.doneButton,
            !canProceed && styles.doneButtonDisabled
          ]}
          disabled={!canProceed}
        >
          <Text style={[
            styles.doneButtonText,
            !canProceed && styles.doneButtonTextDisabled
          ]}>
            Done
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// Subcategory Card Component
interface SubcategoryCardProps {
  subcategory: any;
  isSelected: boolean;
  onPress: () => void;
  cardWidth: number;
  cardHeight: number;
  style?: any;
}

const SubcategoryCard: React.FC<SubcategoryCardProps> = ({
  subcategory,
  isSelected,
  onPress,
  cardWidth,
  cardHeight,
  style
}) => {
  const scaleAnim = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
  }));
  
  const handlePressIn = useCallback(() => {
    scaleAnim.value = withSpring(0.95);
  }, [scaleAnim]);
  
  const handlePressOut = useCallback(() => {
    scaleAnim.value = withSpring(1);
  }, [scaleAnim]);
  
  return (
    <Animated.View style={[animatedStyle, style, { width: cardWidth }]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.subcategoryCard,
          { width: cardWidth, height: cardHeight },
          isSelected && styles.subcategoryCardSelected
        ]}
      >
        <Image
          source={{ uri: subcategory.photo_url }}
          style={styles.subcategoryImage}
          resizeMode="cover"
        />
        <View style={styles.subcategoryOverlay} />
        <View style={styles.subcategoryTextContainer}>
          <Text style={styles.subcategoryText} numberOfLines={2}>
            {subcategory.name}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  
  backButton: {
    padding: SPACING.sm,
  },
  
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.gray900,
  },
  
  headerSpacer: {
    width: 40, // Same as back button for centering
  },
  
  listContainer: {
    flexGrow: 1,
    paddingBottom: 180, // Space for rating + buttons
  },
  
  row: {
    justifyContent: 'flex-start',
  },
  
  separator: {
    height: SPACING.md,
  },
  
  subcategoryCard: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.gray200,
    borderWidth: 2,
    borderColor: 'transparent',
    ...SHADOWS.md,
  },
  
  subcategoryCardSelected: {
    borderColor: COLORS.primary,
  },
  
  subcategoryImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  
  subcategoryOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  
  subcategoryTextContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.md,
  },
  
  subcategoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  
  ratingContainer: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
  },
  
  starsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  
  starButton: {
    padding: SPACING.xs,
  },
  
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingBottom: SPACING.lg,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  },
  
  textButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  
  textButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.primary,
  },
  
  doneButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
    borderRadius: 12,
  },
  
  doneButtonDisabled: {
    backgroundColor: COLORS.gray300,
  },
  
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  
  doneButtonTextDisabled: {
    color: COLORS.gray500,
  },
});