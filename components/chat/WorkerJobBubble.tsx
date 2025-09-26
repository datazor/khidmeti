// components/chat/WorkerJobBubble.tsx - Clean worker job interface
import { useLocalization } from '@/constants/localization';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from 'convex/react';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { useChat } from '../../hooks/useChat';
import { useAuth } from '../../hooks/useAuth';
import { PhotoCarousel } from './PhotoCarousel';
import { VoiceMessageBubble } from './VoiceMessageBubble';
import { SubcategoryCarousel } from './SubcategoryCarousel';

// Modern Design System - Consistent with JobStatusBubble
const COLORS = {
  primary: '#2563eb',
  primaryLight: '#3b82f6',
  primaryDark: '#1d4ed8',
  success: '#10b981',
  successLight: '#34d399',
  warning: '#f59e0b',
  warningLight: '#fbbf24',
  error: '#ef4444',
  errorLight: '#f87171',
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
  title: {
    fontSize: 18,
    fontWeight: '700' as const,
    lineHeight: 24,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 22,
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
  micro: {
    fontSize: 10,
    fontWeight: '500' as const,
    lineHeight: 14,
  },
};

const SHADOWS = {
  card: {
    shadowColor: COLORS.gray900,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  button: {
    shadowColor: COLORS.gray900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
};

// Worker job interface data
interface WorkerJob {
  jobId: Id<'jobs'>;
  categoryId: Id<'categories'>;
  categoryName: string;
  categoryNameFr: string;
  categoryNameAr: string;
  voiceUrl?: string;
  voiceDuration: number;
  photos: string[];
  locationLat: number;
  locationLng: number;
  priceFloor: number;
  portfolioConsent: boolean;
  broadcastingPhase: number;
  customerName: string;
  createdAt: number;
  hasSubcategory: boolean;
  subcategoryId?: Id<'categories'>;
  
  // ADD BID STATUS FIELDS:
  bidStatus?: 'pending' | 'accepted' | 'rejected';
  bidId?: Id<'bids'>;
  bidAmount?: number;
  bidEquipmentCost?: number;
  bidServiceFee?: number;
  bidTotalAmount?: number;
  bidSubmittedAt?: number;
  bidAcceptedAt?: number;
  bidRejectedAt?: number;
}

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

type WorkerJobMode = 'categorization' | 'bidding' | 'bid_submitted' | 'bid_accepted' | 'bid_rejected' | 'completed';

interface WorkerJobBubbleProps {
  messageId: Id<'messages'>;
  jobData: WorkerJob;
  timestamp: number;
  isRTL?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}

export const WorkerJobBubble: React.FC<WorkerJobBubbleProps> = ({
  messageId,
  jobData,
  timestamp,
  isRTL = false,
  isFirst = true,
  isLast = true,
}) => {




  const { t, locale } = useLocalization();
  const router = useRouter();
  const { user } = useAuth();
  const { 
    handleCategorizationSubmit, 
    handleBidSubmit, 
    loading,
    error,
    expireWorkerJobBubble // NEW: Add this
  } = useChat();

  // State management
  const [selectedSubcategory, setSelectedSubcategory] = useState<Id<'categories'> | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [equipmentCost, setEquipmentCost] = useState('');
  const [showPhotoCarousel, setShowPhotoCarousel] = useState(false);

  // Animations
  const slideAnim = useSharedValue(0);
  const fadeAnim = useSharedValue(1);

  // Determine current mode based on job state and bid status
  const mode: WorkerJobMode = useMemo(() => {
    // Check bid status first
    if (jobData.bidStatus === 'accepted') return 'bid_accepted';
    if (jobData.bidStatus === 'rejected') return 'bid_rejected';
    if (jobData.bidStatus === 'pending') return 'bid_submitted';
    
    // Then check job progression
    if (jobData.hasSubcategory) return 'bidding';
    if (jobData.broadcastingPhase === 1) return 'categorization';
    return 'completed';
  }, [jobData.bidStatus, jobData.hasSubcategory, jobData.broadcastingPhase]);

  // NEW: Query for conversation chat when bid is accepted
  const conversationChat = useQuery(
    api.chats.getConversationChatByJob,
    mode === 'bid_accepted' && user?._id ? {
      jobId: jobData.jobId,
      userId: user._id
    } : 'skip'
  );

  // Fetch subcategories for categorization
  const subcategoriesQuery = useQuery(
    api.categories.getSubcategories,
    mode === 'categorization' ? { 
      categoryId: jobData.categoryId,
      language: locale as 'en' | 'fr' | 'ar'
    } : 'skip'
  );

  // Fetch bid validation for current amount
  const bidValidationQuery = useQuery(
    api.workerJobs.validateBidAmount,
    mode === 'bidding' && jobData.subcategoryId && bidAmount && !isNaN(Number(bidAmount)) ? {
      subcategoryId: jobData.subcategoryId,
      bidAmount: Number(bidAmount)
    } : 'skip'
  );

  // Animation setup
  useEffect(() => {
    slideAnim.value = withSpring(0, { damping: 15, stiffness: 200 });
    fadeAnim.value = withTiming(1, { duration: 300 });
  }, []);

  // NEW: Auto-expiration for terminal states
  useEffect(() => {
    const terminalStates: WorkerJobMode[] = ['completed', 'bid_rejected'];
    
    if (terminalStates.includes(mode)) {
      
      const timer = setTimeout(async () => {
        
        try {
          await expireWorkerJobBubble(messageId);
        } catch (error) {
          console.error(`[WORKER_JOB_BUBBLE] Failed to expire bubble:`, error);
        }
      }, 5000); // 5 seconds

      return () => clearTimeout(timer);
    }
  }, [mode, messageId, jobData.jobId, expireWorkerJobBubble]);

  // NEW: Handle navigation to conversation chat
  const handleNavigateToConversation = useCallback(() => {
    if (mode === 'bid_accepted' && conversationChat) {
      router.push({
        pathname: '/(app)/chat',
        params: { chatId: conversationChat._id }
      });
    }
  }, [mode, conversationChat, router]);

  // Container styles
  const containerStyle = useMemo(() => [
    styles.container,
    isFirst && styles.containerFirst,
    isLast && styles.containerLast,
    isRTL && styles.containerRTL,
  ], [isFirst, isLast, isRTL]);

  // Animated styles
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideAnim.value }],
    opacity: fadeAnim.value,
  }));

  // Photo carousel data
  const carouselPhotos = useMemo(() => {
    if (!jobData.photos || jobData.photos.length === 0) return [];
    
    return jobData.photos.map((photoUrl, index) => ({
      id: `${jobData.jobId}-photo-${index}`,
      uri: photoUrl,
      width: 800,
      height: 600,
      caption: `Job photo ${index + 1}`,
    }));
  }, [jobData.photos, jobData.jobId]);

  // Handlers
  const handleSubcategorySelect = useCallback((subcategoryId: Id<'categories'>) => {
    setSelectedSubcategory(subcategoryId);
  }, []);

  const handleSubmitCategorization = useCallback(async () => {
    if (!selectedSubcategory) {
      Alert.alert('Selection Required', 'Please select a subcategory before submitting.');
      return;
    }

    try {
      await handleCategorizationSubmit(jobData.jobId, selectedSubcategory);
      // Success feedback
      slideAnim.value = withSpring(-20, { damping: 15 }, () => {
        slideAnim.value = withSpring(0, { damping: 15 });
      });
    } catch (error) {
      console.error('Categorization submission failed:', error);
      Alert.alert('Submission Failed', 'Please try again.');
    }
  }, [selectedSubcategory, handleCategorizationSubmit, jobData.jobId, slideAnim]);

  const handleSubmitBid = useCallback(async () => {
    const bidValue = Number(bidAmount);
    const equipmentValue = Number(equipmentCost) || 0;

    if (!bidValue || bidValue <= 0) {
      Alert.alert('Invalid Bid', 'Please enter a valid bid amount.');
      return;
    }

    if (bidValidationQuery && !bidValidationQuery.isValid) {
      Alert.alert('Bid Too Low', bidValidationQuery.reason || 'Bid amount is below minimum threshold.');
      return;
    }

    try {
      await handleBidSubmit(jobData.jobId, bidValue, equipmentValue);
      // Success feedback
      slideAnim.value = withSpring(-20, { damping: 15 }, () => {
        slideAnim.value = withSpring(0, { damping: 15 });
      });
    } catch (error) {
      console.error('Bid submission failed:', error);
      Alert.alert('Submission Failed', 'Please try again.');
    }
  }, [bidAmount, equipmentCost, bidValidationQuery, handleBidSubmit, jobData.jobId, slideAnim]);

  const handlePhotoPress = useCallback(() => {
    setShowPhotoCarousel(true);
  }, []);

  const handleClosePhotoCarousel = useCallback(() => {
    setShowPhotoCarousel(false);
  }, []);

  // Get mode-specific styling
  const getModeConfig = () => {
    switch (mode) {
      case 'categorization':
        return {
          bgGradient: ['#eff6ff', '#dbeafe'] as const,
          primaryColor: COLORS.primary,
        };
      case 'bidding':
        return {
          bgGradient: ['#fffbeb', '#fef3c7'] as const,
          primaryColor: COLORS.warning,
        };
      case 'bid_submitted':
        return {
          bgGradient: ['#f3f4f6', '#e5e7eb'] as const,
          primaryColor: COLORS.gray600,
        };
      case 'bid_accepted':
        return {
          bgGradient: ['#ecfdf5', '#d1fae5'] as const,
          primaryColor: COLORS.success,
        };
      case 'bid_rejected':
        return {
          bgGradient: ['#fef2f2', '#fecaca'] as const,
          primaryColor: COLORS.error,
        };
      default:
        return {
          bgGradient: ['#ecfdf5', '#d1fae5'] as const,
          primaryColor: COLORS.success,
        };
    }
  };

  const modeConfig = getModeConfig();

  // Helper function to render bubble content
  const renderBubbleContent = () => (
    <>
      {/* Header */}
      <View style={[styles.header, isRTL && styles.headerRTL]}>
        <Text style={styles.categoryName}>{jobData.categoryName}</Text>

        {/* Photo count badge */}
        {jobData.photos && jobData.photos.length > 0 && (
          <Pressable 
            onPress={handlePhotoPress}
            style={({ pressed }) => [
              styles.photoButton,
              { backgroundColor: modeConfig.primaryColor + '20' },
              pressed && styles.buttonPressed,
            ]}
          >
            <Ionicons name="images" size={14} color={modeConfig.primaryColor} />
            <Text style={[styles.photoCount, { color: modeConfig.primaryColor }]}>
              {jobData.photos.length}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Voice Message */}
      {jobData.voiceUrl && (
        <View style={styles.voiceSection}>
          <VoiceMessageBubble
            messageId={messageId}
            audioUri={jobData.voiceUrl}
            duration={jobData.voiceDuration}
            isCurrentUser={false}
            timestamp={timestamp}
            status="sent"
            isRTL={isRTL}
            isFirst={true}
            isLast={true}
            compact={true}
            senderName="Customer"
            onError={(error) => console.error('Voice playback error:', error)}
          />
        </View>
      )}

      {/* Mode-specific content */}
      {mode === 'categorization' && (
        <View style={styles.categorizationSection}>
          <Text style={styles.sectionTitle}>Select Subcategory:</Text>
          
          {subcategoriesQuery ? (
            <SubcategoryCarousel
              subcategories={subcategoriesQuery}
              selectedSubcategoryId={selectedSubcategory}
              onSubcategorySelect={handleSubcategorySelect}
              isRTL={isRTL}
              disabled={loading.submittingCategorization}
            />
          ) : (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={modeConfig.primaryColor} />
              <Text style={styles.loadingText}>Loading subcategories...</Text>
            </View>
          )}

          {selectedSubcategory && (
            <Pressable
              onPress={handleSubmitCategorization}
              disabled={loading.submittingCategorization}
              style={({ pressed }) => [
                styles.submitButton,
                { backgroundColor: modeConfig.primaryColor },
                pressed && styles.buttonPressed,
                loading.submittingCategorization && styles.buttonDisabled,
              ]}
            >
              {loading.submittingCategorization ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.submitButtonText}>Submit</Text>
              )}
            </Pressable>
          )}
        </View>
      )}

      {mode === 'bidding' && (
        <View style={styles.biddingSection}>
          <Text style={styles.sectionTitle}>Your Bid:</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Base Amount (MRU)</Text>
            <TextInput
              style={[
                styles.input,
                bidValidationQuery && !bidValidationQuery.isValid && styles.inputError
              ]}
              value={bidAmount}
              onChangeText={setBidAmount}
              placeholder="Enter your bid"
              placeholderTextColor={COLORS.gray400}
              keyboardType="numeric"
              returnKeyType="next"
            />
            {bidValidationQuery && !bidValidationQuery.isValid && (
              <Text style={styles.errorText}>{bidValidationQuery.reason}</Text>
            )}
            {bidValidationQuery && bidValidationQuery.isValid && (
              <Text style={styles.successText}>✓ Valid bid amount</Text>
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Equipment Cost (MRU) - Optional</Text>
            <TextInput
              style={styles.input}
              value={equipmentCost}
              onChangeText={setEquipmentCost}
              placeholder="Additional equipment costs"
              placeholderTextColor={COLORS.gray400}
              keyboardType="numeric"
              returnKeyType="done"
            />
          </View>

          {bidAmount && (
            <View style={styles.bidSummary}>
              <Text style={styles.summaryLabel}>Total Bid:</Text>
              <Text style={styles.summaryAmount}>
                {(Number(bidAmount) + (Number(equipmentCost) || 0)).toFixed(2)} MRU
              </Text>
            </View>
          )}

          <Pressable
            onPress={handleSubmitBid}
            disabled={loading.submittingBid || !bidAmount || (bidValidationQuery && !bidValidationQuery.isValid)}
            style={({ pressed }) => [
              styles.submitButton,
              { backgroundColor: modeConfig.primaryColor },
              pressed && styles.buttonPressed,
              (loading.submittingBid || !bidAmount || (bidValidationQuery && !bidValidationQuery.isValid)) && styles.buttonDisabled,
            ]}
          >
            {loading.submittingBid ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.submitButtonText}>Submit Bid</Text>
            )}
          </Pressable>
        </View>
      )}

      {mode === 'bid_submitted' && (
        <View style={styles.bidSubmittedSection}>
          <View style={styles.statusIconContainer}>
            <Ionicons name="time-outline" size={32} color={modeConfig.primaryColor} />
          </View>
          <Text style={styles.statusTitle}>Bid Submitted</Text>
          <Text style={styles.statusDescription}>
            Your bid is under review by the customer
          </Text>
          
          {jobData.bidAmount !== undefined && (
            <View style={styles.bidDetailsCard}>
              <View style={styles.bidDetailRow}>
                <Text style={styles.bidDetailLabel}>Base Amount:</Text>
                <Text style={styles.bidDetailValue}>{jobData.bidAmount.toFixed(2)} MRU</Text>
              </View>
              {jobData.bidEquipmentCost && jobData.bidEquipmentCost > 0 && (
                <View style={styles.bidDetailRow}>
                  <Text style={styles.bidDetailLabel}>Equipment:</Text>
                  <Text style={styles.bidDetailValue}>{jobData.bidEquipmentCost.toFixed(2)} MRU</Text>
                </View>
              )}
              {jobData.bidServiceFee && (
                <View style={styles.bidDetailRow}>
                  <Text style={styles.bidDetailLabel}>Service Fee:</Text>
                  <Text style={styles.bidDetailValue}>{jobData.bidServiceFee.toFixed(2)} MRU</Text>
                </View>
              )}
              <View style={[styles.bidDetailRow, styles.totalRow]}>
                <Text style={styles.bidTotalLabel}>Total:</Text>
                <Text style={styles.bidTotalValue}>{jobData.bidTotalAmount?.toFixed(2) || '0.00'} MRU</Text>
              </View>
            </View>
          )}
          
          {jobData.bidSubmittedAt && (
            <Text style={styles.timestampText}>
              Submitted {new Date(jobData.bidSubmittedAt).toLocaleString()}
            </Text>
          )}
        </View>
      )}

      {mode === 'bid_accepted' && (
        <View style={styles.bidAcceptedSection}>
          <View style={styles.statusIconContainer}>
            <Ionicons name="checkmark-circle" size={32} color={modeConfig.primaryColor} />
          </View>
          <Text style={styles.statusTitle}>Bid Accepted!</Text>
          <Text style={styles.statusDescription}>
            Congratulations! Your bid has been accepted.
          </Text>
          
          {jobData.bidTotalAmount && (
            <View style={styles.acceptedAmountCard}>
              <Text style={styles.acceptedAmountLabel}>Winning Bid:</Text>
              <Text style={styles.acceptedAmountValue}>{jobData.bidTotalAmount.toFixed(2)} MRU</Text>
            </View>
          )}
          
          {/* NEW: Add navigation hint */}
          <View style={styles.navigationHint}>
            <Ionicons name="chatbubble" size={16} color={modeConfig.primaryColor} />
            <Text style={[styles.navigationHintText, { color: modeConfig.primaryColor }]}>
              Tap to chat with customer
            </Text>
            <Ionicons 
              name={isRTL ? "chevron-back" : "chevron-forward"} 
              size={16} 
              color={modeConfig.primaryColor} 
            />
          </View>
          
          {jobData.bidAcceptedAt && (
            <Text style={styles.timestampText}>
              Accepted {new Date(jobData.bidAcceptedAt).toLocaleString()}
            </Text>
          )}
        </View>
      )}

      {mode === 'bid_rejected' && (
        <View style={styles.bidRejectedSection}>
          <View style={styles.statusIconContainer}>
            <Ionicons name="close-circle" size={32} color={modeConfig.primaryColor} />
          </View>
          <Text style={styles.statusTitle}>Bid Not Selected</Text>
          <Text style={styles.statusDescription}>
            The customer selected a different bid for this job.
          </Text>
          
          {jobData.bidRejectedAt && (
            <Text style={styles.timestampText}>
              Updated {new Date(jobData.bidRejectedAt).toLocaleString()}
            </Text>
          )}
        </View>
      )}

      {mode === 'completed' && (
        <View style={styles.completedSection}>
          <View style={styles.completedIcon}>
            <Ionicons name="checkmark-circle" size={32} color={modeConfig.primaryColor} />
          </View>
          <Text style={styles.completedText}>
            Task completed successfully!
          </Text>
        </View>
      )}

      {/* Footer */}
      <View style={[styles.footer, isRTL && styles.footerRTL]}>
        <Text style={styles.timestamp}>
          {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </>
  );

  return (
    <>
      <Animated.View style={[animatedStyle]}>
        {mode === 'bid_accepted' ? (
          <Pressable
            onPress={handleNavigateToConversation}
            style={({ pressed }) => [
              pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
            ]}
            disabled={!conversationChat}
          >
            <LinearGradient
              colors={modeConfig.bgGradient}
              style={containerStyle}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {renderBubbleContent()}
            </LinearGradient>
          </Pressable>
        ) : (
          <LinearGradient
            colors={modeConfig.bgGradient}
            style={containerStyle}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {renderBubbleContent()}
          </LinearGradient>
        )}
      </Animated.View>

      {/* Photo Carousel Modal */}
      <PhotoCarousel
        photos={carouselPhotos}
        visible={showPhotoCarousel}
        onClose={handleClosePhotoCarousel}
        jobTitle={`Job: ${jobData.categoryName}`}
        canDelete={false}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    marginVertical: SPACING.xs,
    alignSelf: 'flex-start',
    maxWidth: '95%',
    minWidth: '85%',
    overflow: 'hidden',
    ...SHADOWS.card,
  } as ViewStyle,

  containerFirst: {
    borderTopLeftRadius: 8,
  } as ViewStyle,

  containerLast: {
    borderBottomLeftRadius: 8,
  } as ViewStyle,

  containerRTL: {
    alignSelf: 'flex-end',
  } as ViewStyle,

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    paddingBottom: SPACING.sm,
  } as ViewStyle,

  headerRTL: {
    flexDirection: 'row-reverse',
  } as ViewStyle,

  categoryName: {
    ...TYPOGRAPHY.title,
    color: COLORS.gray900,
    flex: 1,
  } as TextStyle,

  photoButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...SHADOWS.button,
  } as ViewStyle,

  photoCount: {
    ...TYPOGRAPHY.micro,
    fontWeight: '700',
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    textAlign: 'center',
    lineHeight: 16,
    fontSize: 8,
  } as TextStyle,

  voiceSection: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  } as ViewStyle,

  categorizationSection: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  } as ViewStyle,

  biddingSection: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
  } as ViewStyle,

  completedSection: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    alignItems: 'center',
  } as ViewStyle,

  sectionTitle: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.gray800,
    marginBottom: SPACING.md,
  } as TextStyle,

  inputContainer: {
    marginBottom: SPACING.md,
  } as ViewStyle,

  inputLabel: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray700,
    marginBottom: SPACING.xs,
    fontWeight: '500',
  } as TextStyle,

  input: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    ...TYPOGRAPHY.body,
    color: COLORS.gray900,
    height: 44, // Fixed height
  } as TextStyle,

  inputError: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.error + '10',
  } as TextStyle,

  errorText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.error,
    marginTop: SPACING.xs,
  } as TextStyle,

  successText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.success,
    marginTop: SPACING.xs,
    fontWeight: '500',
  } as TextStyle,

  bidSummary: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44, // Fixed height
    ...SHADOWS.button,
  } as ViewStyle,

  summaryLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.gray700,
    fontWeight: '500',
  } as TextStyle,

  summaryAmount: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.primary,
    fontWeight: '700',
  } as TextStyle,

  submitButton: {
    borderRadius: 12,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48, // Fixed height
    ...SHADOWS.button,
  } as ViewStyle,

  submitButtonText: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.white,
    fontWeight: '600',
  } as TextStyle,

  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  } as ViewStyle,

  buttonDisabled: {
    opacity: 0.6,
  } as ViewStyle,

  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    height: 60, // Fixed height to match subcategory scroll
  } as ViewStyle,

  loadingText: {
    ...TYPOGRAPHY.body,
    color: COLORS.gray600,
    marginLeft: SPACING.sm,
  } as TextStyle,

  completedIcon: {
    marginBottom: SPACING.sm,
  } as ViewStyle,

  completedText: {
    ...TYPOGRAPHY.body,
    color: COLORS.gray700,
    textAlign: 'center',
  } as TextStyle,

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    paddingTop: SPACING.xs, // Small top padding
  } as ViewStyle,

  footerRTL: {
    flexDirection: 'row-reverse',
  } as ViewStyle,

  timestamp: {
    ...TYPOGRAPHY.micro,
    color: COLORS.gray500,
  } as TextStyle,

  jobId: {
    ...TYPOGRAPHY.micro,
    color: COLORS.gray400,
    fontFamily: 'monospace',
  } as TextStyle,

  bidSubmittedSection: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    alignItems: 'center',
  } as ViewStyle,

  bidAcceptedSection: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    alignItems: 'center',
  } as ViewStyle,

  bidRejectedSection: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.lg,
    alignItems: 'center',
  } as ViewStyle,

  statusIconContainer: {
    marginBottom: SPACING.sm,
  } as ViewStyle,

  statusTitle: {
    ...TYPOGRAPHY.title,
    color: COLORS.gray900,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  } as TextStyle,

  statusDescription: {
    ...TYPOGRAPHY.body,
    color: COLORS.gray600,
    textAlign: 'center',
    marginBottom: SPACING.md,
  } as TextStyle,

  bidDetailsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    width: '100%',
    ...SHADOWS.button,
  } as ViewStyle,

  bidDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  } as ViewStyle,

  totalRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
    paddingTop: SPACING.sm,
    marginTop: SPACING.xs,
  } as ViewStyle,

  bidDetailLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.gray700,
  } as TextStyle,

  bidDetailValue: {
    ...TYPOGRAPHY.body,
    color: COLORS.gray900,
    fontWeight: '600',
  } as TextStyle,

  bidTotalLabel: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.gray900,
    fontWeight: '700',
  } as TextStyle,

  bidTotalValue: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.primary,
    fontWeight: '700',
  } as TextStyle,

  acceptedAmountCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    alignItems: 'center',
    width: '100%',
    ...SHADOWS.button,
  } as ViewStyle,

  acceptedAmountLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.gray600,
    marginBottom: SPACING.xs,
  } as TextStyle,

  acceptedAmountValue: {
    ...TYPOGRAPHY.title,
    color: COLORS.success,
    fontWeight: '700',
    fontSize: 24,
  } as TextStyle,

  navigationHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    marginTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    gap: SPACING.xs,
  } as ViewStyle,

  navigationHintText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '500',
  } as TextStyle,

  timestampText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray500,
    textAlign: 'center',
  } as TextStyle,

});
