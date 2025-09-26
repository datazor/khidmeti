// components/chat/JobStatusBubble.tsx - Modern job status bubble with photo carousel
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ViewStyle,
  TextStyle,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Id } from '../../convex/_generated/dataModel';
import { VoiceMessageBubble } from './VoiceMessageBubble';
import { PhotoCarousel } from './PhotoCarousel';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useChat } from '../../hooks/useChat';

// Modern Design System
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

// Job status types with enhanced styling
type JobStatus = 'posted' | 'matched' | 'in_progress' | 'completed' | 'cancelled';

// Enhanced status configuration with gradients and animations
const getStatusConfig = (status: JobStatus) => {
  switch (status) {
    case 'posted':
      return {
        primaryColor: COLORS.primary,
        secondaryColor: COLORS.primaryLight,
        gradientColors: [COLORS.primary, COLORS.primaryLight] as const,
        icon: 'paper-plane-outline' as const,
        text: 'Job Posted',
        subtitle: 'Looking for workers',
        bgGradient: ['#eff6ff', '#dbeafe'] as const,
        pulseColor: COLORS.primary + '30',
      };
    case 'matched':
      return {
        primaryColor: COLORS.warning,
        secondaryColor: COLORS.warningLight,
        gradientColors: [COLORS.warning, COLORS.warningLight] as const,
        icon: 'people' as const,
        text: 'Worker Matched',
        subtitle: 'Ready to start',
        bgGradient: ['#fffbeb', '#fef3c7'] as const,
        pulseColor: COLORS.warning + '30',
      };
    case 'in_progress':
      return {
        primaryColor: COLORS.warning,
        secondaryColor: COLORS.warningLight,
        gradientColors: [COLORS.warning, COLORS.warningLight] as const,
        icon: 'construct' as const,
        text: 'In Progress',
        subtitle: 'Work underway',
        bgGradient: ['#fffbeb', '#fef3c7'] as const,
        pulseColor: COLORS.warning + '30',
      };
    case 'completed':
      return {
        primaryColor: COLORS.success,
        secondaryColor: COLORS.successLight,
        gradientColors: [COLORS.success, COLORS.successLight] as const,
        icon: 'checkmark-circle' as const,
        text: 'Completed',
        subtitle: 'Job finished',
        bgGradient: ['#ecfdf5', '#d1fae5'] as const,
        pulseColor: COLORS.success + '30',
      };
    case 'cancelled':
      return {
        primaryColor: COLORS.error,
        secondaryColor: COLORS.errorLight,
        gradientColors: [COLORS.error, COLORS.errorLight] as const,
        icon: 'close-circle' as const,
        text: 'Cancelled',
        subtitle: 'Job terminated',
        bgGradient: ['#fef2f2', '#fecaca'] as const,
        pulseColor: COLORS.error + '30',
      };
    default:
      return {
        primaryColor: COLORS.gray500,
        secondaryColor: COLORS.gray400,
        gradientColors: [COLORS.gray500, COLORS.gray400] as const,
        icon: 'help-circle' as const,
        text: 'Unknown',
        subtitle: 'Status unclear',
        bgGradient: [COLORS.gray100, COLORS.gray200] as const,
        pulseColor: COLORS.gray500 + '30',
      };
  }
};

interface JobStatusBubbleProps {
  messageId: Id<'messages'>;
  jobId: string;
  timestamp: number;
  isRTL?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  onPhotoCarouselOpen?: () => void;
}

export const JobStatusBubble: React.FC<JobStatusBubbleProps> = ({
  messageId,
  jobId,
  timestamp,
  isRTL = false,
  isFirst = true,
  isLast = true,
  onPhotoCarouselOpen,
}) => {
  // All hooks must be called in the same order every render
  const { handleJobCancellation } = useChat();
  const [showPhotoCarousel, setShowPhotoCarousel] = useState(false);
  
  // Fetch job data - this hook must always be called
  const jobData = useQuery(api.jobs.getJobBubbleData, { 
    jobId: jobId as Id<'jobs'> 
  });

  // NEW: Check if onboarding code has been entered
  const onboardingStatus = useQuery(
    api.jobs.getOnboardingStatus,
    jobData ? { jobId: jobData.jobId } : 'skip'
  );

  // All useMemo hooks must be called in the same order
  const containerStyle = useMemo(() => [
    styles.container,
    isFirst && styles.containerFirst,
    isLast && styles.containerLast,
    isRTL && styles.containerRTL,
  ], [isFirst, isLast, isRTL]);

  // Transform job photos for the carousel - UPDATED to use real photos
  const carouselPhotos = useMemo(() => {
    if (!jobData?.photos || jobData.photos.length === 0) return [];
    
    // Use actual job photos from backend
    return jobData.photos.map((photoUrl, index) => ({
      id: `${jobId}-photo-${index}`,
      uri: photoUrl,
      width: 800,
      height: 600,
      caption: `Job photo ${index + 1}`,
    }));
  }, [jobData?.photos, jobId]);

  // Early return after all hooks are called
  if (!jobData) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <View style={styles.loadingContent}>
          <View style={styles.loadingDot} />
          <Text style={styles.loadingText}>Loading job details...</Text>
        </View>
      </View>
    );
  }

  // In JobStatusBubble.tsx - Replace the handleCancelJob function

const handleCancelJob = () => {
  Alert.alert(
    'Cancel Job & Clear Discussion',
    'Are you sure you want to cancel this job? This will also clear the entire conversation and cannot be undone.',
    [
      { text: 'Keep Job', style: 'cancel' },
      { 
        text: 'Cancel & Clear', 
        style: 'destructive',
        onPress: () => {
          let phase: 'bidding' | 'matched' | 'in_progress' = 'bidding';
          if (jobData.status === 'matched') phase = 'matched';
          if (jobData.status === 'in_progress') phase = 'in_progress';
          
          handleJobCancellation(jobData.jobId, phase);
        }
      },
    ]
  );
};

  const handlePhotoPress = () => {
    
    if (onPhotoCarouselOpen) {
      onPhotoCarouselOpen();
    } else {
      setShowPhotoCarousel(true);
    }
  };

  const handleClosePhotoCarousel = () => {
    setShowPhotoCarousel(false);
  };

  const statusConfig = getStatusConfig(jobData.status as JobStatus);
  
  // NEW: Update cancel button visibility logic
  const canCancel = (jobData.status === 'posted' || 
                    jobData.status === 'matched' || 
                    jobData.status === 'in_progress') &&
                   !onboardingStatus?.codeEntered; // Hide after onboarding code entered

  return (
    <>
      <LinearGradient
        colors={statusConfig.bgGradient}
        style={containerStyle}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Compact Header with Voice and Actions in one row */}
        <View style={[styles.compactHeader, isRTL && styles.compactHeaderRTL]}>
          {/* View Count on Left */}
          <View style={[styles.compactStats, isRTL && styles.compactStatsRTL]}>
            <Ionicons name="eye" size={12} color={statusConfig.primaryColor} />
            <Text style={[styles.compactStatText, { color: statusConfig.primaryColor }]}>
              {jobData.viewCount}
            </Text>
          </View>

          {/* Cancel Button */}
          {canCancel && (
            <Pressable 
              onPress={handleCancelJob}
              style={({ pressed }) => [
                styles.cancelButtonLarge,
                pressed && styles.actionButtonPressed,
              ]}
            >
              <Text style={styles.cancelButtonTextLarge}>Cancel</Text>
            </Pressable>
          )}

          {/* Status Text */}
          <Text style={[styles.compactStatusTitleSmall, { color: statusConfig.primaryColor }]}>
            {statusConfig.text}
          </Text>

          {/* Photo Button on Right - UPDATED to use real photos */}
          {jobData.photos && jobData.photos.length > 0 && (
            <Pressable 
              onPress={handlePhotoPress}
              style={({ pressed }) => [
                styles.photoButtonNew,
                { backgroundColor: statusConfig.primaryColor + '20' },
                pressed && styles.actionButtonPressed,
              ]}
              hitSlop={8}
              testID="photo-carousel-button"
            >
              <Ionicons name="images" size={14} color={statusConfig.primaryColor} />
              <Text style={[styles.photoCountBadge, { color: statusConfig.primaryColor }]}>
                {jobData.photos.length}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Voice Message Section */}
        <View style={styles.inlineVoiceSection}>
          <VoiceMessageBubble
            messageId={messageId}
            audioUri={jobData.voiceUrl || ''}
            duration={jobData.voiceDuration}
            isCurrentUser={true}
            timestamp={timestamp}
            status="sent"
            isRTL={isRTL}
            isFirst={true}
            isLast={true}
            compact={true}
            onError={(error) => console.error('Voice playback error:', error)}
          />
        </View>

        {/* Minimal footer with time */}
        <View style={[styles.compactFooter, isRTL && styles.compactFooterRTL]}>
          <Text style={styles.compactTime}>
            {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          {(jobData.status === 'posted' || jobData.status === 'in_progress') && (
            <View style={styles.compactProgressDots}>
              <View style={[styles.miniProgressDot, { backgroundColor: statusConfig.primaryColor }]} />
              <View style={[styles.miniProgressDot, { backgroundColor: statusConfig.primaryColor }]} />
              <View style={[styles.miniProgressDot, { backgroundColor: statusConfig.primaryColor }]} />
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Photo Carousel Modal */}
      <PhotoCarousel
        photos={carouselPhotos}
        visible={showPhotoCarousel}
        onClose={handleClosePhotoCarousel}
        jobTitle={`Job: ${statusConfig.text}`}
        canDelete={false} // Set to true if you want to allow photo deletion
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    marginVertical: SPACING.xs,
    alignSelf: 'flex-end',
    maxWidth: '95%',
    minWidth: '80%',
    overflow: 'hidden',
    ...SHADOWS.card,
  } as ViewStyle,

  containerFirst: {
    borderTopRightRadius: 8,
  } as ViewStyle,

  containerLast: {
    borderBottomRightRadius: 8,
  } as ViewStyle,

  containerRTL: {
    alignSelf: 'flex-start',
  } as ViewStyle,

  loadingContainer: {
    backgroundColor: COLORS.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
  } as ViewStyle,

  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,

  loadingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    marginRight: SPACING.sm,
  } as ViewStyle,

  loadingText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
  } as TextStyle,

  // New compact layout styles
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    paddingBottom: SPACING.xs,
  } as ViewStyle,

  compactHeaderRTL: {
    flexDirection: 'row-reverse',
  } as ViewStyle,

  compactStatusTitle: {
    ...TYPOGRAPHY.body,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  } as TextStyle,

  compactStatusTitleSmall: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
  } as TextStyle,

  compactStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
    minHeight: 24,
    marginRight: SPACING.md,
    ...SHADOWS.button,
  } as ViewStyle,

  compactStatsRTL: {
    flexDirection: 'row-reverse',
  } as ViewStyle,

  compactStatText: {
    ...TYPOGRAPHY.micro,
    marginLeft: 4,
    fontWeight: '600',
  } as TextStyle,

  cancelButtonNew: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.error + '40',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.button,
  } as ViewStyle,

  cancelButtonLarge: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.error + '40',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.button,
  } as ViewStyle,

  cancelButtonTextLarge: {
    ...TYPOGRAPHY.micro,
    color: COLORS.error,
    fontWeight: '600',
    fontSize: 10,
  } as TextStyle,

  photoButtonNew: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...SHADOWS.button,
  } as ViewStyle,

  photoCountBadge: {
    ...TYPOGRAPHY.micro,
    fontWeight: '700',
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    textAlign: 'center',
    lineHeight: 16,
    fontSize: 8,
    ...SHADOWS.button,
  } as TextStyle,

  inlineVoiceSection: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  } as ViewStyle,

  compactFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  } as ViewStyle,

  compactFooterRTL: {
    flexDirection: 'row-reverse',
  } as ViewStyle,

  compactTime: {
    ...TYPOGRAPHY.micro,
    color: COLORS.gray500,
  } as TextStyle,

  compactProgressDots: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,

  miniProgressDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 1,
    opacity: 0.6,
  } as ViewStyle,

  actionButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  } as ViewStyle,

  // Remove old unused styles
  header: {} as ViewStyle,
  headerRTL: {} as ViewStyle,
  statusSection: {} as ViewStyle,
  statusSectionRTL: {} as ViewStyle,
  statusIcon: {} as ViewStyle,
  statusInfo: {} as ViewStyle,
  statusTitle: {} as TextStyle,
  statusSubtitle: {} as TextStyle,
  statsContainer: {} as ViewStyle,
  statsContainerRTL: {} as ViewStyle,
  statItem: {} as ViewStyle,
  statText: {} as TextStyle,
  statTime: {} as TextStyle,
  statDivider: {} as ViewStyle,
  voiceSection: {} as ViewStyle,
  actionBar: {} as ViewStyle,
  actionBarRTL: {} as ViewStyle,
  actionButton: {} as ViewStyle,
  actionButtonGradient: {} as ViewStyle,
  actionButtonText: {} as TextStyle,
  photoButton: {} as ViewStyle,
  cancelButton: {} as ViewStyle,
  cancelButtonContent: {} as ViewStyle,
  cancelButtonText: {} as TextStyle,
  spacer: {} as ViewStyle,
  progressIndicator: {} as ViewStyle,
  progressDot: {} as ViewStyle,
});
