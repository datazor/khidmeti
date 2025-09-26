// components/onboarding/CategoryStep.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { COLORS, SHADOWS, SPACING } from '../../constants/design';
import { onboardingLogic, useWorkerOnboarding } from '../../hooks/useWorkerOnboarding';
import { Id } from '../../convex/_generated/dataModel';

interface CategoryStepProps {
  onNext: () => void;
  onBack: () => void;
}

export const CategoryStep = ({ onNext, onBack }: CategoryStepProps) => {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { 
    categories, 
    workerConfig, 
    selectCategories, 
    selectedCategories,
    loading, 
    error 
  } = useWorkerOnboarding();
  
  const [localSelectedCategories, setLocalSelectedCategories] = useState(selectedCategories);
  
  // Sync with parent state
  useEffect(() => {
    if (selectedCategories && selectedCategories.length > 0) {
      setLocalSelectedCategories(selectedCategories);
    }
  }, [selectedCategories]);
  
  const maxCategories = workerConfig?.max_categories || 3;
  
  // Calculate card dimensions
  const containerPadding = SPACING.lg;
  const columnGap = SPACING.md;
  const availableWidth = width - (containerPadding * 2);
  const cardWidth = (availableWidth - columnGap) / 2;
  const cardHeight = cardWidth * 1.0; // Square cards
  
  // Handle category press
  const handleCategoryPress = useCallback((category: any) => {
    const isSelected = localSelectedCategories.some(c => c.categoryId === category._id);
    
    if (isSelected) {
      // Deselect - removes category and all subcategories
      setLocalSelectedCategories(prev => 
        prev.filter(c => c.categoryId !== category._id)
      );
    } else {
      // Check max limit
      if (localSelectedCategories.length >= maxCategories) {
        return; // Don't allow selection
      }
      
      // Navigate to subcategory screen if has subcategories
      if (category.subcategories && category.subcategories.length > 0) {
        router.push({
          pathname: '/(auth)/subcategory-selection',
          params: { categoryId: category._id }
        });
      } else {
        // Select directly (no subcategories)
        setLocalSelectedCategories(prev => [...prev, {
          categoryId: category._id,
          subcategoryIds: [],
          experienceRating: undefined
        }]);
      }
    }
  }, [localSelectedCategories, maxCategories, router]);
  
  // Validation
  const isValidSelection = useMemo(() => {
    console.log('🔍 Validating selection:', {
      localSelectedCategories,
      length: localSelectedCategories.length,
      maxCategories
    });
    
    if (localSelectedCategories.length === 0) {
      console.log('❌ No categories selected');
      return false;
    }
    
    if (localSelectedCategories.length > maxCategories) {
      console.log('❌ Too many categories');
      return false;
    }
    
    const hasValidSubcategories = localSelectedCategories.every(cat => {
      const category = categories.find(c => c._id === cat.categoryId);
      const hasSubcategories = category?.subcategories && category.subcategories.length > 0;
      
      console.log(`📋 Validating ${category?.name}:`, {
        hasSubcategories,
        selectedSubcategoryCount: cat.subcategoryIds.length
      });
      
      if (hasSubcategories) {
        return cat.subcategoryIds.length > 0;
      } else {
        return true;
      }
    });
    
    console.log('✅ Validation result:', hasValidSubcategories);
    return hasValidSubcategories;
  }, [localSelectedCategories, maxCategories, categories]);
  
  // Handle continue
  const handleContinue = useCallback(async () => {
    console.log('🔵 handleContinue CALLED');
    console.log('📊 Current state:', {
      localSelectedCategories,
      isValidSelection,
      loading: loading.selectingCategories,
    });
    
    console.log('📤 Sending to backend:', {
      localSelectedCategories,
      types: localSelectedCategories.map(c => ({
        categoryId: typeof c.categoryId,
        subcategoryIdTypes: c.subcategoryIds.map(id => typeof id)
      }))
    });
    
    try {
      console.log('⏳ Calling selectCategories...');
      await selectCategories(localSelectedCategories as any);
      console.log('✅ selectCategories SUCCESS');
      console.log('⏭️ Calling onNext...');
      onNext();
      console.log('✅ onNext SUCCESS');
    } catch (err) {
      console.error('❌ selectCategories FAILED:', err);
      console.error('Error details:', err instanceof Error ? err.message : 'Unknown error');
      console.error('Full error:', err);
    }
  }, [localSelectedCategories, selectCategories, onNext, isValidSelection, loading.selectingCategories]);
  
  // Check if category is completed
  const isCategoryCompleted = useCallback((categoryId: string) => {
    const selection = localSelectedCategories.find(c => c.categoryId === categoryId);
    if (!selection) return false;
    return onboardingLogic.isCategoryComplete(selection, categories);
  }, [localSelectedCategories, categories]);
  
  // Render category card
  const renderCategory = useCallback(({ item, index }: { item: any; index: number }) => {
    const isSelected = localSelectedCategories.some(c => c.categoryId === item._id);
    const isCompleted = isCategoryCompleted(item._id);
    const isDisabled = !isSelected && localSelectedCategories.length >= maxCategories;
    const isRightColumn = index % 2 === 1;
    const marginLeft = isRightColumn ? columnGap : 0;
    
    return (
      <CategoryCard
        category={item}
        isSelected={isSelected}
        isCompleted={isCompleted}
        isDisabled={isDisabled}
        onPress={() => handleCategoryPress(item)}
        cardWidth={cardWidth}
        cardHeight={cardHeight}
        style={{ marginLeft }}
      />
    );
  }, [localSelectedCategories, maxCategories, isCategoryCompleted, cardWidth, cardHeight, columnGap, handleCategoryPress]);
  
  return (
    <View style={styles.stepContainer}>
      <View style={styles.stepContent}>
        {/* Category Grid */}
        <FlatList
          data={categories}
          renderItem={renderCategory}
          keyExtractor={(item) => item._id}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContainer, { paddingBottom: 100 }]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          columnWrapperStyle={styles.row}
        />
        
        {error && (
          <View style={styles.errorCard}>
            <Ionicons name="warning-outline" size={16} color={COLORS.error} />
            <Text style={styles.errorText}>{error.message}</Text>
          </View>
        )}
      </View>
      
      {/* Continue Button */}
      <View style={styles.stepActions}>
        <Pressable
          onPress={handleContinue}
          style={[styles.primaryButton, !isValidSelection && styles.buttonDisabled]}
          disabled={!isValidSelection || loading.selectingCategories}
        >
          {loading.selectingCategories ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Continue</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
};

// Category Card Component
interface CategoryCardProps {
  category: any;
  isSelected: boolean;
  isCompleted: boolean;
  isDisabled: boolean;
  onPress: () => void;
  cardWidth: number;
  cardHeight: number;
  style?: any;
}

const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  isSelected,
  isCompleted,
  isDisabled,
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
    if (!isDisabled) {
      scaleAnim.value = withSpring(0.95);
    }
  }, [isDisabled, scaleAnim]);
  
  const handlePressOut = useCallback(() => {
    scaleAnim.value = withSpring(1);
  }, [scaleAnim]);
  
  return (
    <Animated.View style={[animatedStyle, style, { width: cardWidth }]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        style={[
          styles.categoryCard,
          { width: cardWidth, height: cardHeight },
          isSelected && styles.categoryCardSelected,
          isDisabled && styles.categoryCardDisabled
        ]}
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
        
        {/* Completion indicator */}
        {isCompleted && (
          <View style={styles.completionDot} />
        )}
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  stepContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  
  stepContent: {
    flex: 1,
  },
  
  listContainer: {
    flexGrow: 1,
  },
  
  row: {
    justifyContent: 'flex-start',
  },
  
  separator: {
    height: SPACING.md,
  },
  
  categoryCard: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.gray200,
    borderWidth: 2,
    borderColor: 'transparent',
    ...SHADOWS.md,
  },
  
  categoryCardSelected: {
    borderColor: COLORS.primary,
  },
  
  categoryCardDisabled: {
    opacity: 0.4,
  },
  
  categoryImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  
  categoryOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  
  categoryTextContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACING.md,
  },
  
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  
  completionDot: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
  
  stepActions: {
    paddingTop: SPACING.lg,
  },
  
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    ...SHADOWS.sm,
  },
  
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  
  buttonDisabled: {
    backgroundColor: COLORS.gray300,
  },
  
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
