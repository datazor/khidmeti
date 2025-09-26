// components/chat/TextMessageBubble.tsx - Dedicated text message bubble component
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Id } from '../../convex/_generated/dataModel';

// Design System - Aligned with other bubble components
const COLORS = {
  primary: '#2563eb',
  primaryLight: '#3b82f6',
  success: '#059669',
  error: '#dc2626',
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
};

const TYPOGRAPHY = {
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
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600' as const,
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

type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

interface TextMessageBubbleProps {
  messageId: Id<'messages'>;
  content: string;
  timestamp: number;
  status: MessageStatus;
  isCurrentUser: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  isRTL?: boolean;
  senderName?: string;
  isOptimistic?: boolean;
  optimisticStatus?: 'sending' | 'failed';
}

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  
  // Same day - show time only
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // This week - show day and time
  const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff < 7) {
    return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  }
  
  // Older - show date
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export const TextMessageBubble: React.FC<TextMessageBubbleProps> = ({
  messageId,
  content,
  timestamp,
  status,
  isCurrentUser,
  isFirst = true,
  isLast = true,
  isRTL = false,
  senderName,
  isOptimistic = false,
  optimisticStatus,
}) => {
  
  // Memoized styles for performance
  const containerStyle = useMemo(() => [
    styles.container,
    isCurrentUser ? styles.userContainer : styles.otherContainer,
    isRTL && styles.containerRTL,
  ], [isCurrentUser, isRTL]);

  const bubbleStyle = useMemo(() => [
    styles.bubble,
    isCurrentUser ? styles.userBubble : styles.otherBubble,
    isFirst && (isCurrentUser ? styles.userBubbleFirst : styles.otherBubbleFirst),
    isLast && (isCurrentUser ? styles.userBubbleLast : styles.otherBubbleLast),
    isOptimistic && styles.optimisticBubble,
    optimisticStatus === 'failed' && styles.failedBubble,
    isRTL && styles.bubbleRTL,
  ], [isCurrentUser, isFirst, isLast, isOptimistic, optimisticStatus, isRTL]);

  const textStyle = useMemo(() => [
    styles.messageText,
    isCurrentUser ? styles.userText : styles.otherText,
    isRTL && styles.textRTL,
  ], [isCurrentUser, isRTL]);

  // Status icon component
  const StatusIcon = useMemo(() => {
    if (!isCurrentUser || isOptimistic) return null;
    
    const iconProps = { size: 12, style: styles.statusIcon };
    
    switch (status) {
      case 'failed': 
        return <Ionicons name="alert-circle" color={COLORS.error} {...iconProps} />;
      case 'sending': 
        return <Ionicons name="time" color={COLORS.gray400} {...iconProps} />;
      case 'read': 
        return <Ionicons name="checkmark-done" color={COLORS.primary} {...iconProps} />;
      case 'delivered': 
        return <Ionicons name="checkmark-done" color={COLORS.gray400} {...iconProps} />;
      case 'sent':
      default: 
        return <Ionicons name="checkmark" color={COLORS.gray400} {...iconProps} />;
    }
  }, [isCurrentUser, isOptimistic, status]);

  return (
    <View style={containerStyle}>
      {/* Sender name for received messages */}
      {!isCurrentUser && senderName && (
        <Text style={[styles.senderName, isRTL && styles.senderNameRTL]}>
          {senderName}
        </Text>
      )}
      
      <View style={bubbleStyle}>
        {/* Message content */}
        <Text style={textStyle}>{content}</Text>
        
        {/* Message footer with timestamp and status */}
        <View style={[styles.messageFooter, isRTL && styles.messageFooterRTL]}>
          <Text style={[
            styles.timestamp,
            isCurrentUser ? styles.userTimestamp : styles.otherTimestamp,
            isRTL && styles.timestampRTL
          ]}>
            {formatTime(timestamp)}
          </Text>
          
          {/* Status indicator for user messages */}
          {isCurrentUser && (
            <View style={styles.statusContainer}>
              {isOptimistic ? (
                <Text style={styles.optimisticStatus}>
                  {optimisticStatus === 'sending' ? 'Sending...' : 'Failed'}
                </Text>
              ) : (
                StatusIcon
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.xs,
    maxWidth: '85%',
  } as ViewStyle,

  userContainer: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  } as ViewStyle,

  otherContainer: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  } as ViewStyle,

  containerRTL: {
    // RTL handled by individual components
  } as ViewStyle,

  senderName: {
    ...TYPOGRAPHY.senderName,
    color: COLORS.primaryLight,
    marginBottom: 2,
    marginLeft: SPACING.xs,
  } as TextStyle,

  senderNameRTL: {
    marginLeft: 0,
    marginRight: SPACING.xs,
    textAlign: 'right',
  } as TextStyle,

  bubble: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 18,
    ...SHADOWS.sm,
  } as ViewStyle,

  bubbleRTL: {
    // Text alignment handles RTL
  } as ViewStyle,

  userBubble: {
    backgroundColor: COLORS.primary,
    alignSelf: 'flex-end',
  } as ViewStyle,

  userBubbleFirst: {
    borderTopRightRadius: 8,
  } as ViewStyle,

  userBubbleLast: {
    borderBottomRightRadius: 8,
  } as ViewStyle,

  otherBubble: {
    backgroundColor: COLORS.gray200,
    alignSelf: 'flex-start',
  } as ViewStyle,

  otherBubbleFirst: {
    borderTopLeftRadius: 8,
  } as ViewStyle,

  otherBubbleLast: {
    borderBottomLeftRadius: 8,
  } as ViewStyle,

  optimisticBubble: {
    opacity: 0.7,
  } as ViewStyle,

  failedBubble: {
    backgroundColor: COLORS.error + '20',
    borderWidth: 1,
    borderColor: COLORS.error + '40',
  } as ViewStyle,

  messageText: {
    ...TYPOGRAPHY.body,
    marginBottom: SPACING.xs,
  } as TextStyle,

  textRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  } as TextStyle,

  userText: {
    color: COLORS.white,
  } as TextStyle,

  otherText: {
    color: COLORS.gray800,
  } as TextStyle,

  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 16,
  } as ViewStyle,

  messageFooterRTL: {
    flexDirection: 'row-reverse',
  } as ViewStyle,

  timestamp: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
  } as TextStyle,

  timestampRTL: {
    textAlign: 'right',
  } as TextStyle,

  userTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  } as TextStyle,

  otherTimestamp: {
    color: COLORS.gray500,
  } as TextStyle,

  statusContainer: {
    marginLeft: SPACING.xs,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  statusIcon: {
    marginTop: 1, // Slight alignment adjustment
  },

  optimisticStatus: {
    ...TYPOGRAPHY.caption,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    fontStyle: 'italic',
  } as TextStyle,
});