// components/MessageFeed.tsx - Updated with WorkerJobBubble support and DEBUG LOGS
import { useLocalization } from '@/constants/localization';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  FlatList,
  ListRenderItem,
  RefreshControl,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle
} from 'react-native';
import { Id } from '../convex/_generated/dataModel';
import { useChat } from '../hooks/useChat';
import { useMessageStatus } from '../hooks/useMessageStatus';
import { BidBubble } from './chat/BidBubble';
import { CompletionCodeBubble } from './chat/CompletionCodeBubble';
import { DatePickerBubble } from './chat/DatePickerBubble';
import { JobStatusBubble } from './chat/JobStatusBubble';
import { OnboardingCodeBubble } from './chat/OnboardingCodeBubble';
import { PhotoMessageBubble } from './chat/PhotoMessageBubble';
import { PhotoSelectorBubble } from './chat/PhotoselectorBubble';
import { QuickReplyBubble } from './chat/QuickReplyBubble';
import { RatingBubble } from './chat/RatingBubble';
import { TextMessageBubble } from './chat/TextMessageBubble';
import { VoiceMessageBubble } from './chat/VoiceMessageBubble';
import { WorkerJobBubble } from './chat/WorkerJobBubble';
import { MessageErrorBoundary } from './ErrorBoundary';

// Design System
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
  md: 16,
  lg: 24,
  xl: 32,
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
};

// Import Message type from useChat hook to avoid duplication
import { Message } from '../hooks/useChat/type';

interface User {
  _id: Id<'users'>;
  name: string;
  user_type: 'customer' | 'worker';
  photo_url?: string;
}

interface MessageFeedProps {
  messages: Message[];
  user: User | null;
  loading?: boolean;
  onRefresh?: () => Promise<void>;
  onLoadMore?: () => Promise<void>;
  isRTL?: boolean;
}

// Message grouping
interface MessageGroup {
  id: string;
  messages: Message[];
  senderId: Id<'users'>;
  isUser: boolean;
  isSystem: boolean;
  timestamp: number;
  senderInfo?: {
    name: string;
    photo_url?: string;
  };
}

// Simplified message filtering - show messages based on chat context
const getDisplayMessages = (messages: Message[], userType: 'customer' | 'worker', activeChat: any): Message[] => {
  if (userType === 'customer') {
    // Customers see all messages in their chats
    return messages;
  } 
  
  if (userType === 'worker') {
    // Workers in conversation chats (with customer_id AND worker_id) see all messages
    const isConversationMode = !!(activeChat?.customer_id && activeChat?.worker_id);
    if (isConversationMode) {
      return messages;
    }
    // Workers in notification chats (no customer_id) only see worker_job messages
    return messages.filter(msg => msg.bubble_type === 'worker_job');
  }
  
  return messages;
};


// Group messages by sender
const groupMessages = (messages: Message[], userId: Id<'users'> | null): MessageGroup[] => {
  if (!messages.length) return [];

  const groups: MessageGroup[] = [];
  let currentGroup: Message[] = [];
  let currentSenderId: Id<'users'> | null = null;

  messages.forEach((message, index) => {
    const isSystem = message.bubble_type.startsWith('system_');
    const senderId = message.sender_id;

    if (currentSenderId !== senderId || 
        (currentGroup.length > 0 && 
         currentGroup[0].bubble_type.startsWith('system_') !== isSystem)) {
      
      if (currentGroup.length > 0) {
        const firstMessage = currentGroup[0];
        groups.push({
          id: `group_${groups.length}`,
          messages: [...currentGroup],
          senderId: currentSenderId!,
          isUser: currentSenderId === userId,
          isSystem: firstMessage.bubble_type.startsWith('system_'),
          timestamp: firstMessage.created_at,
          senderInfo: firstMessage.sender ? {
            name: firstMessage.sender.name,
            photo_url: firstMessage.sender.photo_url
          } : undefined,
        });
      }
      currentGroup = [message];
      currentSenderId = senderId;
    } else {
      currentGroup.push(message);
    }

    if (index === messages.length - 1) {
      groups.push({
        id: `group_${groups.length}`,
        messages: currentGroup,
        senderId: senderId,
        isUser: senderId === userId,
        isSystem: isSystem,
        timestamp: currentGroup[0].created_at,
        senderInfo: currentGroup[0].sender ? {
          name: currentGroup[0].sender.name,
          photo_url: currentGroup[0].sender.photo_url
        } : undefined,
      });
    }
  });

  return groups;
};

// Format timestamp
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff < 7) {
    return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  }
  
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

// Message Bubble Component
const MessageBubble: React.FC<{
  message: Message;
  isUser: boolean;
  isSystem: boolean;
  isFirst: boolean;
  isLast: boolean;
  isRTL: boolean;
  currentUser: User | null;
  onMessageRead: (messageId: Id<'messages'>) => Promise<void>;
}> = ({ message, isUser, isSystem, isFirst, isLast, isRTL, currentUser, onMessageRead }) => {
  const { handleQuickReplySelection, handleDateSelection, handlePhotoSelection, validateOnboardingCode } = useChat();

  // NEW: Track when message comes into view for read status
  React.useEffect(() => {
    if (!isUser && message.status !== 'read') {
      // Simple viewport tracking - message is considered read when component mounts
      const timer = setTimeout(() => {
        if (onMessageRead) {
          onMessageRead(message._id);
        }
      }, 1500); // 1.5 second delay to ensure user actually saw it

      return () => clearTimeout(timer);
    }
  }, [isUser, message._id, message.status, onMessageRead]);

  // Before the message type checking logic

  // Handle RatingBubble for rating requests
  if (message.bubble_type === 'rating_request') {
    const { handleRatingSubmission } = useChat();
    
    // Safely extract metadata with fallbacks
    const metadata = message.metadata || {};
    const ratingType = metadata.ratingType as 'customer_rates_worker' | 'worker_rates_customer';
    const jobId = metadata.jobId as Id<'jobs'>;
    
    // Safely determine target user ID and name
    let targetUserId: Id<'users'> | undefined;
    let targetUserName = 'User';
    
    if (ratingType === 'customer_rates_worker') {
      targetUserId = metadata.workerId as Id<'users'>;
      targetUserName = metadata.workerName || 'Worker';
    } else if (ratingType === 'worker_rates_customer') {
      targetUserId = metadata.customerId as Id<'users'>;
      targetUserName = metadata.customerName || 'Customer';
    }
    
    // Only render if we have the required data
    if (!ratingType || !jobId || !targetUserId) {

      return null; // Don't crash, just don't render
    }
    
    return (
      <MessageErrorBoundary>
        <RatingBubble
          messageId={message._id}
          jobId={jobId}
          ratingType={ratingType}
          targetUserId={targetUserId}
          targetUserName={targetUserName}
          question={message.content}
          timestamp={message.created_at}
          isRTL={isRTL}
          isFirst={isFirst}
          isLast={isLast}
          delay={isFirst ? 100 : 300} // Stagger animation - RatingBubble appears after CompletionCodeBubble
          onRatingSubmit={async (rating: number, review: string, jobId: Id<'jobs'>, targetUserId: Id<'users'>) => {
            await handleRatingSubmission(rating, review, jobId, targetUserId, ratingType);
          }}
        />
      </MessageErrorBoundary>
    );
  }

  // Handle WorkerJobBubble for worker job messages
  if (message.bubble_type === 'worker_job') {
    if (message.metadata?.jobData) {
      return (
        <WorkerJobBubble
          messageId={message._id}
          jobData={message.metadata.jobData}
          timestamp={message.created_at}
          isRTL={isRTL}
          isFirst={isFirst}
          isLast={isLast}
        />
      );
    } else {
      return (
        <View style={{ padding: 15, backgroundColor: '#fff3e0', margin: 10, borderRadius: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#e65100' }}>
            DEBUG: Worker Job (Missing Data)
          </Text>
          <Text>Job ID: {message.content}</Text>
          <Text>Metadata: {JSON.stringify(message.metadata, null, 2)}</Text>
        </View>
      );
    }
  }

  // Handle BidBubble for bid messages
  if (message.bubble_type === 'bid') {
    return (
      <BidBubble
        messageId={message._id}
        bidData={message.metadata?.bidData}
        timestamp={message.created_at}
        isRTL={isRTL}
        isFirst={isFirst}
        isLast={isLast}
      />
    );
  }

  // Handle CompletionCodeBubble for completion code input
  if (message.bubble_type === 'completion_code_input') {
    const { validateCompletionCode } = useChat();
    
    return (
      <MessageErrorBoundary>
        <CompletionCodeBubble
          key={`completion-${message._id}`}  // Stable prefix + message ID
          messageId={message._id}
          jobId={message.metadata?.jobId}
          instruction={message.content}
          timestamp={message.created_at}
          isRTL={isRTL}
          isFirst={isFirst}
          isLast={isLast}
          maxLength={message.metadata?.maxLength || 6}
          delay={isFirst ? 0 : 200} // Stagger animation for multiple bubbles
          onCodeSubmit={async (code: string, jobId: Id<'jobs'>) => {
            try {
              await validateCompletionCode(code, jobId);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Invalid completion code';
              throw new Error(errorMessage);
            }
          }}
          onValidationError={(error: string) => {
            console.error('Completion code validation error:', error);
          }}
        />
      </MessageErrorBoundary>
    );
  }

  // Handle OnboardingCodeBubble for onboarding code input
  if (message.bubble_type === 'onboarding_code_input') {
    console.log('OnboardingCodeBubble message object:', message._id, message.status, message.metadata);
    
    return (
      <OnboardingCodeBubble
        key={`onboarding-${message._id}`}  // Stable prefix + message ID
        messageId={message._id}
        jobId={message.metadata?.jobId}
        chatId={message.chat_id}
        instruction={message.content}
        timestamp={message.created_at}
        isRTL={isRTL}
        isFirst={isFirst}
        isLast={isLast}
        maxLength={message.metadata?.maxLength || 4}
      />
    );
  }

  // Handle CompletionCodeBubble for completion code input
  if (message.bubble_type === 'system_prompt' && 
      message.metadata?.promptType === 'completion_code_input') {
    const { validateCompletionCode } = useChat();
    
    return (
      <CompletionCodeBubble
        key={`completion-system-${message._id}`}  // Stable prefix + message ID
        messageId={message._id}
        jobId={message.metadata?.jobId}
        instruction={message.content}
        timestamp={message.created_at}
        isRTL={isRTL}
        isFirst={isFirst}
        isLast={isLast}
        maxLength={message.metadata?.maxLength || 6}
        onCodeSubmit={async (code: string, jobId: Id<'jobs'>) => {
          try {
            await validateCompletionCode(code, jobId);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Invalid completion code';
            throw new Error(errorMessage);
          }
        }}
        onValidationError={(error: string) => {
          console.error('Completion code validation error:', error);
        }}
      />
    );
  }

  // Handle JobStatusBubble for customer job messages
  if (message.bubble_type === 'job') {
    return (
      <JobStatusBubble
        messageId={message._id}
        jobId={message.content}
        timestamp={message.created_at}
        isRTL={isRTL}
        isFirst={isFirst}
        isLast={isLast}
        onPhotoCarouselOpen={() => {}}
      />
    );
  }

  // Handle system messages
  if (message.bubble_type === 'system_instruction') {
    return (
      <TextMessageBubble
        messageId={message._id}
        content={message.content}
        timestamp={message.created_at}
        status={message.status}
        isCurrentUser={false}
        isFirst={isFirst}
        isLast={isLast}
        isRTL={isRTL}
        senderName="System"
        isOptimistic={message.isOptimistic}
        optimisticStatus={message.optimisticStatus}
      />
    );
  }

  // Handle PhotoSelectorBubble
  if (message.bubble_type === 'system_prompt' && 
      message.metadata?.messageKey === 'photo_selection' &&
      message.metadata?.promptType === 'photo_selector') {
    return (
      <PhotoSelectorBubble
        messageId={message._id}
        question={message.content}
        timestamp={message.created_at}
        senderName={!isUser ? message.sender?.name : undefined}
        isRTL={isRTL}
        isFirst={isFirst}
        isLast={isLast}
        maxPhotos={message.metadata?.maxPhotos || 5}
        onPhotosSelect={(photos: any[]) => handlePhotoSelection(photos, message._id)}
        onSkip={() => handlePhotoSelection([], message._id)}
      />
    );
  }

  // Handle DatePickerBubble
  if (message.bubble_type === 'system_prompt' && 
      message.metadata?.messageKey === 'date_selection' &&
      message.metadata?.promptType === 'date_picker') {
    return (
      <DatePickerBubble
        messageId={message._id}
        question={message.content}
        timestamp={message.created_at}
        senderName={!isUser ? message.sender?.name : undefined}
        isRTL={isRTL}
        isFirst={isFirst}
        isLast={isLast}
        minDate={message.metadata?.minDate ? new Date(message.metadata.minDate) : new Date()}
        maxDate={message.metadata?.maxDate ? new Date(message.metadata.maxDate) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)}
        onDateSelect={(selectedDate: Date) => handleDateSelection(selectedDate, message._id)}
      />
    );
  }

  // Handle QuickReplyBubble
  if (message.bubble_type === 'system_prompt' && 
      message.metadata?.options && 
      (message.metadata?.messageKey === 'voice_completeness_check' || 
       message.metadata?.messageKey === 'completion_confirmation')) {
    
    const isCompletionConfirmation = message.metadata?.messageKey === 'completion_confirmation';
    
    return (
      <QuickReplyBubble
        messageId={message._id}
        question={message.content}
        options={message.metadata.options}
        timestamp={message.created_at}
        senderName={!isUser ? message.sender?.name : undefined}
        isRTL={isRTL}
        isFirst={isFirst}
        isLast={isLast}
        // Voice completeness props
        voiceMessageId={!isCompletionConfirmation ? message.metadata?.pendingVoiceMessageId : undefined}
        quickReplyMessageId={!isCompletionConfirmation ? message._id : undefined}
        isVoiceCompletenessCheck={!isCompletionConfirmation}
        // NEW: Completion confirmation props
        isCompletionConfirmation={isCompletionConfirmation}
        jobId={isCompletionConfirmation ? message.metadata?.jobId : undefined}
        onCompletionConfirm={isCompletionConfirmation ? async (confirmed: boolean, jobId: Id<'jobs'>) => {
          // TODO: Connect to completion workflow in Phase 3
        } : undefined}
      />
    );
  }

  // Handle voice messages
  if (message.bubble_type === 'voice') {
    return (
      <VoiceMessageBubble
        messageId={message._id}
        audioUri={message.content}
        duration={message.metadata?.duration || 0}
        isCurrentUser={isUser}
        timestamp={message.created_at}
        status={message.status}
        senderName={!isUser ? message.sender?.name : undefined}
        senderAvatar={!isUser ? message.sender?.photo_url : undefined}
        isRTL={isRTL}
        isFirst={isFirst}
        isLast={isLast}
        onError={() => {}}
      />
    );
  }

  // Handle date messages
  if (message.bubble_type === 'date') {
    const selectedDate = message.metadata?.selectedDate ? new Date(message.metadata.selectedDate) : new Date(message.content);
    const formattedDate = message.metadata?.formattedDate || selectedDate.toLocaleDateString();
    
    return (
      <TextMessageBubble
        messageId={message._id}
        content={`📅 ${formattedDate}`}
        timestamp={message.created_at}
        status={message.status}
        isCurrentUser={isUser}
        isFirst={isFirst}
        isLast={isLast}
        isRTL={isRTL}
        senderName={!isUser ? message.sender?.name : undefined}
        isOptimistic={message.isOptimistic}
        optimisticStatus={message.optimisticStatus}
      />
    );
  }

  // Handle photo messages
  if (message.bubble_type === 'photo') {
    return (
      <PhotoMessageBubble
        messageId={message._id}
        photoUri={message.content}
        timestamp={message.created_at}
        status={message.status}
        isCurrentUser={isUser}
        isFirst={isFirst}
        isLast={isLast}
        isRTL={isRTL}
        senderName={!isUser ? message.sender?.name : undefined}
        senderAvatar={!isUser ? message.sender?.photo_url : undefined}
        width={message.metadata?.width}
        height={message.metadata?.height}
        size={message.metadata?.size}
        fileName={message.metadata?.fileName}
        isOptimistic={message.isOptimistic}
        optimisticStatus={message.optimisticStatus}
      />
    );
  }

  // Handle text messages and fallback
  return (
    <TextMessageBubble
      messageId={message._id}
      content={message.content}
      timestamp={message.created_at}
      status={message.status}
      isCurrentUser={isUser}
      isFirst={isFirst}
      isLast={isLast}
      isRTL={isRTL}
      senderName={!isUser ? message.sender?.name : undefined}
      isOptimistic={message.isOptimistic}
      optimisticStatus={message.optimisticStatus}
    />
  );
};

// Message Group Component
const MessageGroupComponent: React.FC<{
  group: MessageGroup;
  isRTL: boolean;
  currentUser: User | null;
  onMessageRead: (messageId: Id<'messages'>) => Promise<void>;
}> = ({ group, isRTL, currentUser, onMessageRead }) => {
  const containerStyle = useMemo(() => [
    styles.messageGroup,
    group.isSystem ? styles.systemGroup : group.isUser ? styles.userGroup : styles.otherGroup,
    isRTL && styles.messageGroupRTL,
  ], [group.isSystem, group.isUser, isRTL]);

  return (
    <View style={containerStyle}>
      {!group.isUser && !group.isSystem && group.senderInfo && (
        <Text style={[styles.senderName, isRTL && styles.senderNameRTL]}>
          {group.senderInfo.name}
        </Text>
      )}
      
      {group.messages.map((message, index) => (
        <MessageBubble
          key={message._id}
          message={message}
          isUser={group.isUser}
          isSystem={group.isSystem}
          isFirst={index === 0}
          isLast={index === group.messages.length - 1}
          isRTL={isRTL}
          currentUser={currentUser}
          onMessageRead={onMessageRead}
        />
      ))}
      
      <Text style={[styles.timestamp, isRTL && styles.timestampRTL]}>
        {formatTime(group.timestamp)}
      </Text>
    </View>
  );
};

// Empty state
const EmptyState: React.FC<{ isRTL: boolean; userType: 'customer' | 'worker' }> = ({ isRTL, userType }) => (
  <View style={[styles.emptyState, isRTL && styles.emptyStateRTL]}>
    <Text style={styles.emptyText}>
      {userType === 'worker' ? 'Waiting for job assignments' : 'Start a conversation'}
    </Text>
    <Text style={styles.emptySubtext}>
      {userType === 'worker' ? 'Jobs will appear here when available' : 'Messages will appear here'}
    </Text>
  </View>
);

// Main MessageFeed component
export const MessageFeed: React.FC<MessageFeedProps> = ({
  messages,
  user,
  loading = false,
  onRefresh,
  onLoadMore,
  isRTL = false,
}) => {
  


  const flatListRef = useRef<FlatList>(null);
  const { locale } = useLocalization();
  
  // NEW: Add message status tracking
  const { handleMessagesDelivered, handleMessageRead } = useMessageStatus(
    // Pass active chat from context or props - you may need to add this
    null // TODO: Pass activeChat from useChat context
  );
  
  // Get activeChat from useChat hook (moved outside useMemo)
  const { activeChat } = useChat();
  
  // Apply message filtering based on user type
  const displayMessages = useMemo(() => {
    if (!user) {
      return messages;
    }
    
    const filtered = getDisplayMessages(messages, user.user_type, activeChat);
    console.log('All messages:', messages.length, 'Displayed:', filtered.length);
    console.log('Message IDs:', filtered.map(m => m._id));
    console.log('Message types:', filtered.map(m => m.bubble_type));
    
    return filtered;
  }, [messages, user, activeChat]);
  
  // Group filtered messages by sender
  const messageGroups = useMemo(() => {
    return groupMessages(displayMessages, user?._id || null);
  }, [displayMessages, user?._id]);

  // NEW: Mark messages as delivered when they load
  useEffect(() => {
    if (displayMessages.length > 0) {
      handleMessagesDelivered(displayMessages);
    }
  }, [displayMessages, handleMessagesDelivered]);

  // Auto-scroll to bottom for new messages
  useEffect(() => {
    if (displayMessages.length > 0 && flatListRef.current) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [displayMessages.length]);

  const renderItem: ListRenderItem<MessageGroup> = useCallback(({ item }) => (
    <MessageGroupComponent 
      group={item} 
      isRTL={isRTL} 
      currentUser={user}
      onMessageRead={handleMessageRead} // NEW: Pass read handler
    />
  ), [isRTL, user, handleMessageRead]);

  const keyExtractor = useCallback((item: MessageGroup) => item.id, []);

  const handleRefresh = useCallback(async () => {
    if (onRefresh) {
      await onRefresh();
    }
  }, [onRefresh]);

  if (messageGroups.length === 0 && !loading) {
    return <EmptyState isRTL={isRTL} userType={user?.user_type || 'customer'} />;
  }


  return (
    <FlatList
      ref={flatListRef}
      data={messageGroups}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      style={[styles.container, isRTL && styles.containerRTL]}
      contentContainerStyle={styles.contentContainer}
      
      removeClippedSubviews={true}
      initialNumToRender={10}
      maxToRenderPerBatch={5}
      windowSize={5}
      updateCellsBatchingPeriod={50}
      
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        ) : undefined
      }
      
      accessibilityLabel="Message feed"
      accessibilityRole="list"
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  } as ViewStyle,

  containerRTL: {
    // RTL handled by individual components
  } as ViewStyle,

  contentContainer: {
    paddingVertical: SPACING.md,
    flexGrow: 1,
  } as ViewStyle,

  messageGroup: {
    marginBottom: SPACING.md,
    width: '100%',
    paddingHorizontal: SPACING.xs,
  } as ViewStyle,

  messageGroupRTL: {
    // RTL layout handled by flexDirection
  } as ViewStyle,

  userGroup: {
    alignItems: 'flex-end',
  } as ViewStyle,

  otherGroup: {
    alignItems: 'flex-start',
  } as ViewStyle,

  systemGroup: {
    alignItems: 'flex-start',
  } as ViewStyle,

  senderName: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray500,
    marginBottom: SPACING.xs,
    marginLeft: SPACING.sm,
    alignSelf: 'flex-start',
  } as TextStyle,

  senderNameRTL: {
    marginLeft: 0,
    marginRight: SPACING.sm,
    textAlign: 'right',
    alignSelf: 'flex-end',
  } as TextStyle,

  timestamp: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray400,
    marginTop: SPACING.xs,
    fontSize: 11,
  } as TextStyle,

  timestampRTL: {
    textAlign: 'right',
  } as TextStyle,

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  } as ViewStyle,

  emptyStateRTL: {
    // Text alignment handles RTL
  } as ViewStyle,

  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.gray600,
    marginBottom: SPACING.sm,
    fontWeight: '500',
  } as TextStyle,

  emptySubtext: {
    ...TYPOGRAPHY.small,
    color: COLORS.gray400,
    textAlign: 'center',
  } as TextStyle,
});
