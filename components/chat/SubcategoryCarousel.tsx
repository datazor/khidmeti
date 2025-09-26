// components/worker/SubcategoryCarousel.tsx - Carousel-style subcategory selector like DatePickerBubble
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Id } from '../../convex/_generated/dataModel';

// Design System - Match DatePickerBubble styling
const COLORS = {
  primary: '#3b82f6',
  primaryLight: '#eff6ff',
  primaryDark: '#1e40af',
  white: '#ffffff',
  gray50: '#f8fafc',
  gray200: '#e5e7eb',
  gray400: '#9ca3af',
  gray700: '#374151',
};

const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
};

interface Subcategory {
  id: Id<'categories'>;
  nameEn: string;
  nameFr: string;
  nameAr: string;
  name: string; // Localized name
  photoUrl: string;
  requiresPhotos: boolean;
  requiresWorkCode: boolean;
  level: number;
}

interface SubcategoryCarouselProps {
  subcategories: Subcategory[];
  selectedSubcategoryId: Id<'categories'> | null;
  onSubcategorySelect: (subcategoryId: Id<'categories'>) => void;
  isRTL?: boolean;
  disabled?: boolean;
}

export const SubcategoryCarousel: React.FC<SubcategoryCarouselProps> = ({
  subcategories,
  selectedSubcategoryId,
  onSubcategorySelect,
  isRTL = false,
  disabled = false,
}) => {
  if (subcategories.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No subcategories available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {subcategories.map((subcategory) => {
          const isSelected = selectedSubcategoryId === subcategory.id;
          
          return (
            <Pressable
              key={subcategory.id}
              style={[
                styles.subcategoryOption,
                isSelected && styles.selectedOption,
              ]}
              onPress={() => !disabled && onSubcategorySelect(subcategory.id)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`Select ${subcategory.name}`}
            >
              <Text 
                style={[
                  styles.subcategoryText,
                  isSelected && styles.selectedText,
                ]}
              >
                {subcategory.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
  } as ViewStyle,

  scrollView: {
    flexGrow: 0,
    height: 50,
  } as ViewStyle,

  scrollContent: {
    paddingHorizontal: 4,
  } as ViewStyle,

  subcategoryOption: {
    backgroundColor: COLORS.gray50,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.gray200,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    minWidth: 75,
    maxWidth: 120,
  } as ViewStyle,

  selectedOption: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  } as ViewStyle,

  subcategoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray700,
    textAlign: 'center',
    fontFamily: 'System',
  } as TextStyle,

  selectedText: {
    color: COLORS.primary,
  } as TextStyle,

  emptyContainer: {
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.gray50,
    borderRadius: 12,
    marginBottom: SPACING.md,
  } as ViewStyle,

  emptyText: {
    fontSize: 12,
    color: COLORS.gray400,
    textAlign: 'center',
  } as TextStyle,
});