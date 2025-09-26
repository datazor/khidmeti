// Replace app/(app)/worker.tsx with this category selection interface
import { useLocalization } from '@/constants/localization';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { useAuth } from '../../hooks/useAuth';
import { useChat } from '../../hooks/useChat';
import { useWorkerJobs } from '../../hooks/useWorkerJobs';

// Design System - matching your existing styles
const COLORS = {
  primary: '#2563eb',
  primaryLight: '#3b82f6',
  success: '#059669',
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
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 36,
  },
  h2: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  small: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
};

interface WorkerCategory {
  categoryId: Id<'categories'>;
  categoryName: string;
  categoryPhoto: string;
  experienceRating?: number;
  hasNotificationChat: boolean;
  unreadJobCount: number;
}

export default function WorkerScreen() {
  const { user } = useAuth();
  const { t, isRTL } = useLocalization();
  const router = useRouter();
  const { 
    notificationChats, 
    conversationChats,
    getActiveJobInCategory
  } = useWorkerJobs();
  
  // Add these hooks
  const { viewJobFeedForCategory, continueActiveJobInCategory } = useChat();

  // Get worker's skilled categories - using existing API
  const workerSkills = useQuery(
    api.workerOnboarding.getOnboardingProgress,
    user?._id ? { userId: user._id } : 'skip'
  );

  // Transform data for display
  const workerCategories = useMemo((): WorkerCategory[] => {
    if (!workerSkills?.selected_skills) return [];

    return workerSkills.selected_skills.map(skill => {
      const notificationChat = notificationChats.find(chat => chat.category_id === skill.category_id);
      const conversationChat = conversationChats.find(chat => chat.category_id === skill.category_id);
      
      return {
        categoryId: skill.category_id,
        categoryName: skill.category_name,
        categoryPhoto: '',
        experienceRating: skill.experience_rating,
        hasNotificationChat: !!notificationChat,
        unreadJobCount: 0,
      };
    });
  }, [workerSkills, notificationChats, conversationChats]);

  // Get active jobs for display indicators
  const activeJobs = useMemo(() => {
    const activeByCategory = new Map<Id<'categories'>, any>();
    
    conversationChats.forEach(chat => {
      if (chat.job_id && chat.customer_id) {
        activeByCategory.set(chat.category_id, chat);
      }
    });
    
    return activeByCategory;
  }, [conversationChats]);

  // Update your existing handleCategoryPress method
  const handleCategoryPress = useCallback(async (categoryId: Id<'categories'>) => {
    
    // Navigate using params object
    router.push({
      pathname: '/(app)/jobs/[categoryId]',
      params: { categoryId }
    });
  }, [router]);

  // Add new method for active job navigation
  const handleActiveJobPress = useCallback(async (categoryId: Id<'categories'>) => {
    await continueActiveJobInCategory(categoryId);
  }, [continueActiveJobInCategory]);

  const handleProfilePress = useCallback(() => {
    router.push('/(auth)/profile');
  }, [router]);

  // Enhanced CategoryCard component
  const CategoryCard: React.FC<{
    category: WorkerCategory;
    onPress: () => void;
    hasActiveJob: boolean;
    activeJobChat?: any;
  }> = ({ category, onPress, hasActiveJob, activeJobChat }) => {
    // Handle direct navigation to active job
    const handleActiveJobButtonPress = useCallback((e: any) => {
      e.stopPropagation(); // Prevent category press
      if (activeJobChat) {
        handleActiveJobPress(category.categoryId);
      }
    }, [activeJobChat, category.categoryId, handleActiveJobPress]);

    return (
      <Pressable onPress={onPress} style={({ pressed }) => [
        styles.categoryCard,
        pressed && styles.categoryCardPressed,
        isRTL && styles.categoryCardRTL,
      ]}>
        <View style={styles.categoryContent}>
          {/* Category Icon/Image */}
          <View style={styles.categoryIconContainer}>
            <View style={styles.categoryIcon}>
              <Ionicons name="briefcase" size={24} color={COLORS.primary} />
            </View>
            {category.unreadJobCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCount}>
                  {category.unreadJobCount > 99 ? '99+' : category.unreadJobCount}
                </Text>
              </View>
            )}
          </View>

          {/* Category Info */}
          <View style={[styles.categoryInfo, isRTL && styles.categoryInfoRTL]}>
            <Text style={styles.categoryName} numberOfLines={2}>
              {category.categoryName}
            </Text>
            
            {category.experienceRating && (
              <View style={styles.experienceContainer}>
                <Text style={styles.experienceLabel}>Experience:</Text>
                <View style={styles.starsContainer}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <Ionicons
                      key={star}
                      name={star <= category.experienceRating! ? "star" : "star-outline"}
                      size={14}
                      color={star <= category.experienceRating! ? COLORS.primary : COLORS.gray300}
                    />
                  ))}
                </View>
              </View>
            )}

            <View style={styles.statusContainer}>
              <View style={[
                styles.statusDot,
                { backgroundColor: category.hasNotificationChat ? COLORS.success : COLORS.gray400 }
              ]} />
              <Text style={styles.statusText}>
                {category.hasNotificationChat ? 'Active' : 'Setup needed'}
              </Text>
            </View>

            {/* Active Job Indicator */}
            {hasActiveJob && (
              <Pressable 
                onPress={handleActiveJobButtonPress}
                style={styles.activeJobIndicator}
              >
                <View style={styles.activeJobBadge}>
                  <Text style={styles.activeJobText}>Active Job</Text>
                  <Ionicons name="chatbubble" size={16} color="#fff" />
                </View>
              </Pressable>
            )}
          </View>

          {/* Arrow */}
          <View style={styles.arrowContainer}>
            <Ionicons 
              name={isRTL ? "chevron-back" : "chevron-forward"} 
              size={20} 
              color={COLORS.gray400} 
            />
          </View>
        </View>
      </Pressable>
    );
  };

  // Render category item
  const renderCategoryItem = useCallback(({ item }: { item: WorkerCategory }) => (
    <CategoryCard
      category={item}
      onPress={() => handleCategoryPress(item.categoryId)}
      hasActiveJob={activeJobs.has(item.categoryId)}
      activeJobChat={activeJobs.get(item.categoryId)}
    />
  ), [handleCategoryPress, activeJobs, isRTL]);

  // Loading state
  if (!workerSkills) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading your categories...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, isRTL && styles.headerRTL]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>
            {t('worker.categories.title') || 'Your Categories'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {t('worker.categories.subtitle') || 'Select a category to view available jobs'}
          </Text>
        </View>
        
        <Pressable onPress={handleProfilePress} style={styles.profileButton}>
          <Ionicons name="person-circle" size={32} color={COLORS.primary} />
        </Pressable>
      </View>

      {/* Categories List */}
      <FlatList
        data={workerCategories}
        renderItem={renderCategoryItem}
        keyExtractor={(item) => item.categoryId}
        style={styles.categoriesList}
        contentContainerStyle={styles.categoriesContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="briefcase-outline" size={48} color={COLORS.gray400} />
            <Text style={styles.emptyTitle}>No Categories</Text>
            <Text style={styles.emptyText}>
              Contact support to add job categories to your profile
            </Text>
          </View>
        }
      />

      {/* Footer Stats */}
      <View style={styles.footer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{workerCategories.length}</Text>
          <Text style={styles.statLabel}>Categories</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {workerCategories.reduce((sum, cat) => sum + cat.unreadJobCount, 0)}
          </Text>
          <Text style={styles.statLabel}>Available Jobs</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>${user?.balance || 0}</Text>
          <Text style={styles.statLabel}>Balance</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray50,
  } as ViewStyle,

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,

  loadingText: {
    ...TYPOGRAPHY.body,
    color: COLORS.gray600,
    marginTop: SPACING.md,
  } as TextStyle,

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  } as ViewStyle,

  headerRTL: {
    flexDirection: 'row-reverse',
  } as ViewStyle,

  headerLeft: {
    flex: 1,
  } as ViewStyle,

  headerTitle: {
    ...TYPOGRAPHY.h1,
    color: COLORS.gray900,
    marginBottom: SPACING.xs,
  } as TextStyle,

  headerSubtitle: {
    ...TYPOGRAPHY.small,
    color: COLORS.gray600,
  } as TextStyle,

  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  categoriesList: {
    flex: 1,
  } as ViewStyle,

  categoriesContent: {
    padding: SPACING.lg,
    paddingTop: SPACING.md,
  } as ViewStyle,

  categoryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.gray200,
  } as ViewStyle,

  categoryCardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.8,
  } as ViewStyle,

  categoryCardRTL: {
    // RTL adjustments handled in content
  } as ViewStyle,

  categoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
  } as ViewStyle,

  categoryIconContainer: {
    position: 'relative',
    marginRight: SPACING.lg,
  } as ViewStyle,

  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  } as ViewStyle,

  unreadCount: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.white,
  } as TextStyle,

  categoryInfo: {
    flex: 1,
  } as ViewStyle,

  categoryInfoRTL: {
    alignItems: 'flex-end',
  } as ViewStyle,

  categoryName: {
    ...TYPOGRAPHY.h2,
    color: COLORS.gray900,
    marginBottom: SPACING.xs,
  } as TextStyle,

  experienceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  } as ViewStyle,

  experienceLabel: {
    ...TYPOGRAPHY.small,
    color: COLORS.gray600,
    marginRight: SPACING.sm,
  } as TextStyle,

  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  } as ViewStyle,

  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.sm,
  } as ViewStyle,

  statusText: {
    ...TYPOGRAPHY.small,
    color: COLORS.gray600,
  } as TextStyle,

  arrowContainer: {
    marginLeft: SPACING.md,
  } as ViewStyle,

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl * 2,
  } as ViewStyle,

  emptyTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.gray700,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  } as TextStyle,

  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.gray500,
    textAlign: 'center',
    maxWidth: 280,
  } as TextStyle,

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  } as ViewStyle,

  statItem: {
    alignItems: 'center',
    flex: 1,
  } as ViewStyle,

  statValue: {
    ...TYPOGRAPHY.h2,
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  } as TextStyle,

  statLabel: {
    ...TYPOGRAPHY.small,
    color: COLORS.gray600,
  } as TextStyle,

  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.gray300,
  } as ViewStyle,

  // NEW: Active job indicator styles
  activeJobIndicator: {
    marginTop: SPACING.sm,
  } as ViewStyle,

  activeJobBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 12,
    gap: SPACING.xs,
  } as ViewStyle,

  activeJobText: {
    ...TYPOGRAPHY.small,
    color: COLORS.white,
    fontWeight: '600',
  } as TextStyle,
});
