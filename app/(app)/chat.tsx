// app/(app)/chat.tsx - Updated with worker support
import { MessageFeed } from '@/components/Messageeed';
import { ChatInputBar } from '@/components/chat/ChatInputBar';
import { useLocalization } from '@/constants/localization';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Id } from '../../convex/_generated/dataModel';
import { useAuth } from '../../hooks/useAuth';
import { useChat } from '../../hooks/useChat';

// Design System - Using existing color palette
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
  mxs: 6,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

const TYPOGRAPHY = {
  h2: {
    fontSize: 24,
    fontWeight: '600' as const,
    lineHeight: 32,
  },
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

export default function ChatScreen() {
  const { categoryId, chatId } = useLocalSearchParams<{ 
    categoryId?: string;
    chatId?: string;
  }>();
  const router = useRouter();
  const { user } = useAuth();
  const { isRTL, t } = useLocalization();
  const { 
    activeChat,
    messages, 
    loading, 
    error,
    startChatForCategory,
    loadSpecificChat,
    sendMessage,
    clearError,
    retryLastAction 
  } = useChat();



  // Add conversation mode detection after user authentication check
  const isConversationMode = useMemo(() => {
    return !!(activeChat?.customer_id && activeChat?.worker_id && activeChat?.job_id);
  }, [activeChat?.customer_id, activeChat?.worker_id, activeChat?.job_id]);

  const chatMode = useMemo(() => {
    if (!activeChat) return 'none';
    
    if (user?.user_type === 'customer') {
      return isConversationMode ? 'customer_conversation' : 'customer_service';
    } else if (user?.user_type === 'worker') {
      return isConversationMode ? 'worker_conversation' : 'worker_notification';
    }
    
    return 'none';
  }, [user?.user_type, isConversationMode, activeChat]);




  
  const { width } = useWindowDimensions();
  
  // Animation values
  const fadeAnim = useSharedValue(0);
  const slideAnim = useSharedValue(30);
  



  // Start entrance animation
  useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 600 });
    slideAnim.value = withSpring(0, { damping: 20, stiffness: 200 });
  }, []);

  // Start chat when category and user are available (customers only) or chatId (both)
  const hasStartedChatRef = React.useRef(false);
  
  useEffect(() => {
    
    if (chatId && user?._id && !hasStartedChatRef.current) {
      // Direct navigation to specific chat
      hasStartedChatRef.current = true;
      loadSpecificChat(chatId as Id<'chats'>);
    } else if (categoryId && user?._id && !hasStartedChatRef.current && user.user_type === 'customer') {
      // Only customers use categoryId in chat route
      hasStartedChatRef.current = true;
      startChatForCategory(categoryId as Id<'categories'>);
    } else {
    }
  }, [categoryId, chatId, user?._id, user?.user_type, startChatForCategory, loadSpecificChat]);

  // Clear error after showing it briefly
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  // Re-render detection for infinite loop monitoring
  const renderCountRef = React.useRef(0);
  const lastRenderTimeRef = React.useRef(Date.now());
  
  useEffect(() => {
    renderCountRef.current += 1;
    const currentTime = Date.now();
    const timeSinceLastRender = currentTime - lastRenderTimeRef.current;
    
    
    // Detect rapid re-renders (potential infinite loop)
    if (timeSinceLastRender < 100) { // Less than 100ms between renders
      console.warn('🚨 [RENDER_DETECTION] RAPID RE-RENDER DETECTED - Potential infinite loop!');
    }
    
    lastRenderTimeRef.current = currentTime;
  });

  const containerStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ translateY: slideAnim.value }],
  }));

  // Worker helper functions
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

  // Message handling functions (customers only)
  const handleSendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || loading.sendingMessage) return;
    
    try {
      await sendMessage('text', messageText);
    } catch (error) {
      Alert.alert(
        t('chat.error.sendFailed') || 'Send Failed',
        t('chat.error.sendFailedMessage') || 'Could not send message. Please try again.'
      );
    }
  }, [loading.sendingMessage, sendMessage, t]);

  const handleVoiceMessage = useCallback(async (audioData: { 
    uri: string; 
    duration: number; 
    size?: number; 
  }) => {
    if (loading.sendingMessage) return;
    
    try {
      const metadata = {
        uri: audioData.uri,
        duration: audioData.duration,
        size: audioData.size || 0,
        type: 'audio/m4a',
      };
      
      await sendMessage('voice', '', metadata);
    } catch (error) {
      Alert.alert(
        t('chat.error.voiceFailed') || 'Voice Message Failed',
        t('chat.error.voiceFailedMessage') || 'Could not send voice message. Please try again.'
      );
    }
  }, [loading.sendingMessage, sendMessage, t]);

  const handlePhotoUpload = useCallback(async (photoData: { 
    uri: string; 
    type: string; 
    size?: number; 
  }) => {
    if (loading.sendingMessage) return;
    
    try {
      const metadata = {
        uri: photoData.uri,
        type: photoData.type,
        size: photoData.size || 0,
        width: undefined,
        height: undefined,
      };
      
      await sendMessage('photo', '', metadata);
    } catch (error) {
      Alert.alert(
        t('chat.error.photoFailed') || 'Photo Failed',
        t('chat.error.photoFailedMessage') || 'Could not send photo. Please try again.'
      );
    }
  }, [loading.sendingMessage, sendMessage, t]);

  const handleCameraPress = useCallback(() => {
    try {
      router.push('/(app)/camera' as any);
    } catch (error) {
      Alert.alert(
        t('chat.error.cameraFailed') || 'Camera Failed',
        t('chat.error.cameraFailedMessage') || 'Could not open camera. Please try again.'
      );
    }
  }, [router, t]);

  const handleGoBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleProfilePress = useCallback(() => {
    router.push('/(auth)/profile' as any);
  }, [router]);

  const handleRetry = useCallback(async () => {
    try {
      await retryLastAction();
    } catch (error) {
      Alert.alert(
        t('chat.error.retryFailed') || 'Retry Failed',
        t('chat.error.retryFailedMessage') || 'Could not retry action. Please try again.'
      );
    }
  }, [retryLastAction, t]);

  // NEW: Add "Back to Jobs" handler function
  const handleBackToJobFeed = useCallback(() => {
    if (activeChat?.category_id) {
      router.push({
        pathname: '/(app)/jobs/[categoryId]',
        params: { categoryId: activeChat.category_id }
      });
    }
  }, [activeChat?.category_id, router]);

  // Add function to find conversation chat
  const findConversationChat = useCallback(async (jobId: string) => {
    // This would need to be implemented as a Convex query
    // For now, we'll handle this in Phase 3 with WorkerJobBubble navigation
    return null;
  }, []);

  // Show loading state while initializing chat (customers only)
  if (loading.startingChat && user?.user_type === 'customer') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>
            {t('chat.startingConversation') || 'Starting conversation...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header - Different for workers vs customers */}
        {chatMode === 'customer_conversation' ? (
          // Customer conversation header - show worker name
          <View style={[styles.headerContainer, isRTL && styles.headerContainerRTL]}>
            <Pressable onPress={handleGoBack} style={styles.backButton}>
              <Ionicons 
                name={isRTL ? "chevron-forward" : "chevron-back"} 
                size={24} 
                color={COLORS.gray700} 
              />
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                Chat with Worker
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                Job #{activeChat?.job_id?.slice(-8)}
              </Text>
            </View>
            <Pressable onPress={handleProfilePress} style={styles.profileButton}>
              <Ionicons name="person-circle" size={32} color={COLORS.primary} />
            </Pressable>
          </View>
        ) : chatMode === 'worker_conversation' ? (
          // Worker conversation header - show customer info
          <View style={[styles.headerContainer, isRTL && styles.headerContainerRTL]}>
            <Pressable onPress={handleGoBack} style={styles.backButton}>
              <Ionicons 
                name={isRTL ? "chevron-forward" : "chevron-back"} 
                size={24} 
                color={COLORS.gray700} 
              />
            </Pressable>
            
            {/* NEW: Add "Back to Jobs" button */}
            <Pressable onPress={handleBackToJobFeed} style={styles.jobFeedButton}>
              <Ionicons name="briefcase" size={16} color={COLORS.primary} />
              <Text style={styles.jobFeedButtonText}>Jobs</Text>
            </Pressable>
            
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                Chat with Customer
              </Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                Job #{activeChat?.job_id?.slice(-8)}
              </Text>
            </View>
            <Pressable onPress={handleProfilePress} style={styles.profileButton}>
              <Ionicons name="person-circle" size={32} color={COLORS.primary} />
            </Pressable>
          </View>
        ) : user?.user_type === 'worker' ? (
          // Existing worker notification header
          <View style={[styles.workerHeaderContainer, isRTL && styles.headerContainerRTL]}>
            <View style={styles.headerLeft}>
              <Text style={styles.workerGreeting} numberOfLines={1}>
                {getWorkerGreeting()}
              </Text>
              <View style={styles.workerStats}>
                <View style={styles.statItem}>
                  <Ionicons name="wallet" size={14} color={COLORS.success} />
                  <Text style={styles.balanceText}>
                    ${getWorkerBalance().toFixed(2)}
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
        ) : (
          // Existing customer service header
          <View style={[styles.headerContainer, isRTL && styles.headerContainerRTL]}>
            <Pressable onPress={handleGoBack} style={styles.backButton}>
              <Ionicons 
                name={isRTL ? "chevron-forward" : "chevron-back"} 
                size={24} 
                color={COLORS.gray700} 
              />
            </Pressable>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {t('chat.title') || 'Chat'}
            </Text>
            <View style={styles.headerSpacer} />
          </View>
        )}

        {/* Error Banner */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error.message}</Text>
            {error.retryable && (
              <Pressable onPress={handleRetry} style={styles.retryButton}>
                <Text style={styles.retryText}>
                  {t('chat.retry') || 'Retry'}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Messages Feed - MessageFeed handles worker vs customer filtering */}
        <Animated.View style={[styles.messagesContainer, containerStyle]}>
          <MessageFeed
            messages={messages}
            user={user}
            loading={loading.loadingMessages}
            onRefresh={async () => {
            }}
            onLoadMore={async () => {
            }}
            isRTL={isRTL}
          />
        </Animated.View>

        {/* Chat Input Bar - Only for customers */}
        {(chatMode === 'customer_service' || chatMode === 'customer_conversation' || chatMode === 'worker_conversation') && (
          <ChatInputBar
            disabled={loading.sendingMessage}
            isRTL={isRTL}
            placeholder={
              chatMode === 'worker_conversation' ? 
                'Message customer...' : 
                t('chat.messagePlaceholder') || 'Type a message...'
            }
            maxLength={500}
          />
        )}
      </KeyboardAvoidingView>
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
    paddingHorizontal: SPACING.md,
  } as ViewStyle,

  loadingText: {
    ...TYPOGRAPHY.body,
    color: COLORS.gray600,
  } as TextStyle,

  // Customer header styles
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
    minHeight: 44,
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
    ...SHADOWS.sm,
  } as ViewStyle,

  headerTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.gray900,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: SPACING.sm,
    fontSize: 20,
  } as TextStyle,

  headerSpacer: {
    width: 40,
  } as ViewStyle,

  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  headerSubtitle: {
    ...TYPOGRAPHY.small,
    color: COLORS.gray500,
    marginTop: 2,
  } as TextStyle,

  // Worker header styles
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

  headerLeft: {
    flex: 1,
  } as ViewStyle,

  workerGreeting: {
    ...TYPOGRAPHY.h2,
    color: COLORS.gray900,
    marginBottom: SPACING.xs,
    fontSize: 20,
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
    backgroundColor: COLORS.gray300,
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

  errorBanner: {
    backgroundColor: COLORS.error,
    borderRadius: 8,
    padding: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  } as ViewStyle,

  errorText: {
    ...TYPOGRAPHY.small,
    color: COLORS.white,
    flex: 1,
  } as TextStyle,

  retryButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    marginLeft: SPACING.sm,
  } as ViewStyle,

  retryText: {
    ...TYPOGRAPHY.small,
    color: COLORS.white,
    fontWeight: '500',
  } as TextStyle,

  messagesContainer: {
    flex: 1,
    paddingHorizontal: SPACING.mxs,
  } as ViewStyle,

  // NEW: Job feed button styles
  jobFeedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    backgroundColor: COLORS.primary + '15',
    borderRadius: 8,
    gap: SPACING.xs,
  } as ViewStyle,

  jobFeedButtonText: {
    ...TYPOGRAPHY.small,
    color: COLORS.primary,
    fontWeight: '600',
  } as TextStyle,
});
