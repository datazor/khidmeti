// app/(app)/jobs/[categoryId].tsx
import { MessageFeed } from '@/components/Messageeed';
import { useLocalization } from '@/constants/localization';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Id } from '../../../convex/_generated/dataModel';
import { useAuth } from '../../../hooks/useAuth';
import { useChat } from '../../../hooks/useChat';

const COLORS = {
  primary: '#2563eb',
  success: '#059669',
  white: '#ffffff',
  gray50: '#f8fafc',
  gray200: '#e2e8f0',
  gray400: '#94a3b8',
  gray500: '#64748b',
  gray600: '#475569',
  gray700: '#334155',
  gray900: '#0f172a',
};

const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
};

const TYPOGRAPHY = {
  h2: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  small: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
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
};

export default function JobFeedScreen() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { isRTL } = useLocalization();
  const {
    activeChat,
    messages,
    loading,
    viewJobFeedForCategory,
  } = useChat();

  const hasStartedChatRef = React.useRef(false);

  // Initialize job feed when component mounts
  useEffect(() => {
    if (categoryId && user?._id && !hasStartedChatRef.current) {
      hasStartedChatRef.current = true;
      viewJobFeedForCategory(categoryId as Id<'categories'>);
    }
  }, [categoryId, user?._id, viewJobFeedForCategory]);

  // Filter messages to show only worker job bubbles
  const jobFeedMessages = useMemo(() => {
    return messages.filter(message => {
      const isWorkerJob = message.bubble_type === 'worker_job';
      const isNotExpired = !message.is_expired;
      

      
      return isWorkerJob && isNotExpired;
    });
  }, [messages]);



  const getWorkerGreeting = useCallback(() => {
    const hour = new Date().getHours();
    let greeting = 'Good morning';
    if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
    if (hour >= 17) greeting = 'Good evening';
    return `${greeting}, ${user?.name || 'Worker'}`;
  }, [user?.name]);

  const getWorkerBalance = useCallback(() => {
    return (user as any)?.balance || 0;
  }, [user]);

  const getWorkerJobCount = useCallback(() => {
    return messages.filter(m => m.bubble_type === 'worker_job').length;
  }, [messages]);

  const handleGoBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleProfilePress = useCallback(() => {
    router.push('/(auth)/profile');
  }, [router]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Job Feed Header */}
      <View style={[styles.workerHeaderContainer, isRTL && styles.headerContainerRTL]}>
        <Pressable onPress={handleGoBack} style={styles.backButton}>
          <Ionicons 
            name={isRTL ? "chevron-forward" : "chevron-back"} 
            size={24} 
            color={COLORS.gray700} 
          />
        </Pressable>
        
        <View style={styles.headerLeft}>
          <Text style={styles.workerGreeting} numberOfLines={1}>
            {getWorkerGreeting()}
          </Text>
          <View style={styles.workerStats}>
            <View style={styles.statItem}>
              <Ionicons name="wallet" size={14} color={COLORS.success} />
              <Text style={styles.balanceText}>
                {getWorkerBalance().toFixed(2)} MRU
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Ionicons name="briefcase" size={14} color={COLORS.primary} />
              <Text style={styles.jobCountText}>
                {getWorkerJobCount()} jobs
              </Text>
            </View>
          </View>
        </View>
        
        <Pressable onPress={handleProfilePress} style={styles.profileButton}>
          <Ionicons name="person-circle" size={32} color={COLORS.primary} />
        </Pressable>
      </View>

      {/* Filtered Messages */}
      <View style={styles.messagesContainer}>
        <MessageFeed
          messages={jobFeedMessages} // Use filtered messages
          user={user}
          loading={loading.loadingMessages}
          onRefresh={async () => {
          }}
          onLoadMore={async () => {
          }}
          isRTL={isRTL}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.gray50,
  } as ViewStyle,

  workerHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
    minHeight: 60,
    backgroundColor: COLORS.gray50,
  } as ViewStyle,

  headerContainerRTL: {
    flexDirection: 'row-reverse',
  } as ViewStyle,

  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.gray200,
    marginRight: SPACING.md,
    ...SHADOWS.sm,
  } as ViewStyle,

  headerLeft: {
    flex: 1,
  } as ViewStyle,

  workerGreeting: {
    ...TYPOGRAPHY.h2,
    color: COLORS.gray900,
    marginBottom: SPACING.xs,
  } as TextStyle,

  workerStats: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,

  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  } as ViewStyle,

  balanceText: {
    ...TYPOGRAPHY.small,
    color: COLORS.success,
    fontWeight: '600',
  } as TextStyle,

  jobCountText: {
    ...TYPOGRAPHY.small,
    color: COLORS.gray600,
    fontWeight: '500',
  } as TextStyle,

  statDivider: {
    width: 1,
    height: 16,
    backgroundColor: COLORS.gray400,
    marginHorizontal: SPACING.md,
  } as ViewStyle,

  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.gray200,
    ...SHADOWS.sm,
  } as ViewStyle,

  messagesContainer: {
    flex: 1,
    paddingHorizontal: SPACING.xs,
  } as ViewStyle,
});
