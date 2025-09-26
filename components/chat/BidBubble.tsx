// components/chat/BidBubble.tsx - Worker bid display bubble for customers
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ViewStyle,
  TextStyle,
  ImageStyle,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Id } from '../../convex/_generated/dataModel';
import { useChat } from '../../hooks/useChat';

// Design System - Consistent with other bubbles
const COLORS = {
  primary: '#2563eb',
  warning: '#f59e0b',
  warningLight: '#fbbf24',
  success: '#10b981',
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
};

const TYPOGRAPHY = {
  title: {
    fontSize: 16,
    fontWeight: '700' as const,
    lineHeight: 22,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
  },
  body: {
    fontSize: 13,
    fontWeight: '500' as const,
    lineHeight: 18,
  },
  caption: {
    fontSize: 11,
    fontWeight: '400' as const,
    lineHeight: 15,
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

// Worker bid data interface
interface BidData {
  bidId: Id<'bids'>;
  workerId: Id<'users'>;
  workerName: string;
  workerPhotoUrl?: string;
  workerRating: number;
  workerReviewCount: number;
  bidAmount: number;
  equipmentCost: number;
  serviceFee: number;
  totalAmount: number;
  experienceLevel: 'beginner' | 'intermediate' | 'expert';
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
  expiresAt: number;
}

interface BidBubbleProps {
  messageId: Id<'messages'>;
  bidData: BidData;
  timestamp: number;
  isRTL?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}

// Render star rating
const StarRating: React.FC<{ 
  rating: number; 
  size?: number; 
  color?: string 
}> = ({ rating, size = 12, color = COLORS.warning }) => {
  const stars = [];
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;

  for (let i = 0; i < 5; i++) {
    if (i < fullStars) {
      stars.push(
        <Ionicons key={i} name="star" size={size} color={color} />
      );
    } else if (i === fullStars && hasHalfStar) {
      stars.push(
        <Ionicons key={i} name="star-half" size={size} color={color} />
      );
    } else {
      stars.push(
        <Ionicons key={i} name="star-outline" size={size} color={COLORS.gray300} />
      );
    }
  }

  return <View style={styles.starContainer}>{stars}</View>;
};

// Get experience level badge config
const getExperienceBadge = (level: BidData['experienceLevel']) => {
  switch (level) {
    case 'expert':
      return { color: COLORS.success, label: 'Expert', icon: 'diamond' as const };
    case 'intermediate':
      return { color: COLORS.warning, label: 'Pro', icon: 'star' as const };
    default:
      return { color: COLORS.primary, label: 'New', icon: 'leaf' as const };
  }
};

// Get status-based styling
const getStatusConfig = (status: BidData['status']) => {
  switch (status) {
    case 'accepted':
      return {
        bgGradient: ['#ecfdf5', '#d1fae5'] as const,
        primaryColor: COLORS.success,
        borderColor: COLORS.success,
      };
    case 'rejected':
      return {
        bgGradient: ['#fef2f2', '#fecaca'] as const,
        primaryColor: '#ef4444',
        borderColor: '#ef4444',
      };
    default: // pending
      return {
        bgGradient: ['#fffbeb', '#fef3c7'] as const,
        primaryColor: COLORS.warning,
        borderColor: COLORS.warning,
      };
  }
};

export const BidBubble: React.FC<BidBubbleProps> = ({
  messageId,
  bidData,
  timestamp,
  isRTL = false,
  isFirst = true,
  isLast = true,
}) => {
  const { handleBidAcceptance, handleBidRejection } = useChat();

  // Container styles
  const containerStyle = useMemo(() => [
    styles.container,
    isFirst && styles.containerFirst,
    isLast && styles.containerLast,
    isRTL && styles.containerRTL,
  ], [isFirst, isLast, isRTL]);

  // Experience badge config
  const experienceBadge = useMemo(() => 
    getExperienceBadge(bidData.experienceLevel)
  , [bidData.experienceLevel]);

  // Handle profile photo click
  const handleProfileClick = () => {
  };

  // Format currency
  const formatCurrency = (amount: number) => `${amount.toFixed(2)} MRU`;

  // Status-based styling
  const statusConfig = useMemo(() => 
    getStatusConfig(bidData.status)
  , [bidData.status]);

  // Handle bid acceptance
  const handleAcceptBid = () => {
    handleBidAcceptance(bidData.bidId);
  };

  const handleRejectBid = () => {
    handleBidRejection(bidData.bidId);
  };

  return (
    <LinearGradient
      colors={statusConfig.bgGradient}
      style={containerStyle}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Header with worker info */}
      <View style={[styles.header, isRTL && styles.headerRTL]}>
        {/* Profile photo */}
        <Pressable 
          onPress={handleProfileClick}
          style={({ pressed }) => [
            styles.profileButton,
            pressed && styles.profileButtonPressed,
          ]}
        >
          {bidData.workerPhotoUrl ? (
            <Image 
              source={{ uri: bidData.workerPhotoUrl }}
              style={styles.profilePhoto}
            />
          ) : (
            <View style={[styles.profilePhoto, styles.profilePhotoPlaceholder]}>
              <Ionicons name="person" size={20} color={COLORS.gray500} />
            </View>
          )}
          
          {/* Experience badge on profile */}
          <View style={[styles.experienceBadge, { backgroundColor: experienceBadge.color }]}>
            <Ionicons 
              name={experienceBadge.icon} 
              size={8} 
              color={COLORS.white} 
            />
          </View>
        </Pressable>

        {/* Worker details */}
        <View style={styles.workerInfo}>
          <Text style={styles.workerName} numberOfLines={1}>
            {bidData.workerName}
          </Text>
          
          {/* Rating row */}
          <View style={[styles.ratingRow, isRTL && styles.ratingRowRTL]}>
            <StarRating rating={bidData.workerRating} size={11} />
            <Text style={styles.ratingText}>
              {bidData.workerRating.toFixed(1)} ({bidData.workerReviewCount})
            </Text>
          </View>
        </View>

        {/* Total bid amount - prominent */}
        <View style={styles.totalBidContainer}>
          <Text style={styles.totalBidAmount}>
            {formatCurrency(bidData.totalAmount)}
          </Text>
          <Text style={styles.totalBidLabel}>Total</Text>
        </View>
      </View>

      {/* Bid breakdown */}
      <View style={styles.breakdownContainer}>
        {/* Base bid */}
        <View style={[styles.breakdownRow, isRTL && styles.breakdownRowRTL]}>
          <Text style={styles.breakdownLabel}>Base bid</Text>
          <Text style={styles.breakdownValue}>
            {formatCurrency(bidData.bidAmount)}
          </Text>
        </View>

        {/* Equipment costs (if any) */}
        {bidData.equipmentCost > 0 && (
          <View style={[styles.breakdownRow, isRTL && styles.breakdownRowRTL]}>
            <Text style={styles.breakdownLabel}>Equipment</Text>
            <Text style={styles.breakdownValue}>
              {formatCurrency(bidData.equipmentCost)}
            </Text>
          </View>
        )}

        {/* Service fee */}
        <View style={[styles.breakdownRow, styles.serviceFeeRow, isRTL && styles.breakdownRowRTL]}>
          <Text style={[styles.breakdownLabel, styles.serviceFeeLabel]}>Service fee</Text>
          <Text style={[styles.breakdownValue, styles.serviceFeeValue]}>
            {formatCurrency(bidData.serviceFee)}
          </Text>
        </View>
      </View>

      {/* Action buttons for pending bids */}
      {bidData.status === 'pending' && (
        <View style={styles.actionContainer}>
          <Pressable
            onPress={handleRejectBid}
            style={({ pressed }) => [
              styles.actionButton,
              styles.rejectButton,
              pressed && styles.actionButtonPressed,
            ]}
          >
            <Text style={styles.rejectButtonText}>Decline</Text>
          </Pressable>
          
          <Pressable
            onPress={handleAcceptBid}
            style={({ pressed }) => [
              styles.actionButton,
              styles.acceptButton,
              pressed && styles.actionButtonPressed,
            ]}
          >
            <Text style={styles.acceptButtonText}>Accept Bid</Text>
          </Pressable>
        </View>
      )}

      {/* Status indicator for accepted/rejected bids */}
      {bidData.status === 'accepted' && (
        <View style={styles.statusContainer}>
          <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
          <Text style={styles.acceptedText}>Bid Accepted</Text>
        </View>
      )}

      {bidData.status === 'rejected' && (
        <View style={styles.statusContainer}>
          <Ionicons name="close-circle" size={20} color="#ef4444" />
          <Text style={styles.rejectedText}>Bid Declined</Text>
        </View>
      )}

      {/* Footer */}
      <View style={[styles.footer, isRTL && styles.footerRTL]}>
        <Text style={styles.timestamp}>
          {new Date(timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </Text>
        
        {/* Bid expiry indicator */}
        <View style={styles.expiryContainer}>
          <Ionicons name="time-outline" size={10} color={COLORS.gray500} />
          <Text style={styles.expiryText}>
            Expires {new Date(bidData.expiresAt).toLocaleDateString([], { 
              month: 'short', 
              day: 'numeric' 
            })}
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    marginVertical: SPACING.xs,
    alignSelf: 'flex-start', // From worker to customer
    maxWidth: '90%',
    minWidth: '75%',
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
    padding: SPACING.lg,
    paddingBottom: SPACING.sm,
  } as ViewStyle,

  headerRTL: {
    flexDirection: 'row-reverse',
  } as ViewStyle,

  profileButton: {
    position: 'relative',
    marginRight: SPACING.md,
  } as ViewStyle,

  profileButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  } as ViewStyle,

  profilePhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.gray200,
    ...SHADOWS.button,
  } as ImageStyle,

  profilePhotoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  experienceBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  } as ViewStyle,

  workerInfo: {
    flex: 1,
  } as ViewStyle,

  workerName: {
    ...TYPOGRAPHY.title,
    color: COLORS.gray900,
    marginBottom: 2,
  } as TextStyle,

  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,

  ratingRowRTL: {
    flexDirection: 'row-reverse',
  } as ViewStyle,

  starContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.xs,
  } as ViewStyle,

  ratingText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray600,
  } as TextStyle,

  totalBidContainer: {
    alignItems: 'flex-end',
    backgroundColor: COLORS.white + '80',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    ...SHADOWS.button,
  } as ViewStyle,

  totalBidAmount: {
    ...TYPOGRAPHY.title,
    fontSize: 18,
    color: COLORS.warning,
    fontWeight: '700',
  } as TextStyle,

  totalBidLabel: {
    ...TYPOGRAPHY.micro,
    color: COLORS.gray600,
    marginTop: 1,
  } as TextStyle,

  breakdownContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  } as ViewStyle,

  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  } as ViewStyle,

  breakdownRowRTL: {
    flexDirection: 'row-reverse',
  } as ViewStyle,

  breakdownLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.gray700,
  } as TextStyle,

  breakdownValue: {
    ...TYPOGRAPHY.body,
    color: COLORS.gray900,
    fontWeight: '600',
  } as TextStyle,

  serviceFeeRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200 + '50',
    paddingTop: SPACING.xs,
    marginTop: SPACING.xs,
  } as ViewStyle,

  serviceFeeLabel: {
    color: COLORS.gray600,
  } as TextStyle,

  serviceFeeValue: {
    color: COLORS.gray700,
  } as TextStyle,

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    paddingTop: SPACING.xs,
  } as ViewStyle,

  footerRTL: {
    flexDirection: 'row-reverse',
  } as ViewStyle,

  timestamp: {
    ...TYPOGRAPHY.micro,
    color: COLORS.gray500,
  } as TextStyle,

  expiryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,

  expiryText: {
    ...TYPOGRAPHY.micro,
    color: COLORS.gray500,
    marginLeft: 2,
  } as TextStyle,

  actionContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.md,
  } as ViewStyle,

  actionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    ...SHADOWS.button,
  } as ViewStyle,

  acceptButton: {
    backgroundColor: COLORS.success,
  } as ViewStyle,

  rejectButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray300,
  } as ViewStyle,

  acceptButtonText: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.white,
    fontWeight: '600',
  } as TextStyle,

  rejectButtonText: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.gray700,
    fontWeight: '600',
  } as TextStyle,

  actionButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  } as ViewStyle,

  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  } as ViewStyle,

  acceptedText: {
    ...TYPOGRAPHY.subtitle,
    color: COLORS.success,
    fontWeight: '600',
  } as TextStyle,

  rejectedText: {
    ...TYPOGRAPHY.subtitle,
    color: '#ef4444',
    fontWeight: '600',
  } as TextStyle,
});
