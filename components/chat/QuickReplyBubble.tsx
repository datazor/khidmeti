// components/chat/QuickReplyBubble.tsx - Updated with voice completeness handling
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useLocalization } from '@/constants/localization';
import { useChat } from '@/hooks/useChat';
import { Id } from '@/convex/_generated/dataModel';

// Design System
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
  confirmationBg: '#f0f9ff',
  confirmationText: '#1e40af',
};

const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
};

const TYPOGRAPHY = {
  body: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
};

interface QuickReplyOption {
  label: string;
  value: string;
}

// Add this interface to the existing QuickReplyBubble.tsx file

interface CompletionConfirmationProps {
  isCompletionConfirmation?: boolean;
  jobId?: Id<'jobs'>;
  onCompletionConfirm?: (confirmed: boolean, jobId: Id<'jobs'>) => Promise<void>;
}

// Update the main interface to include these props
interface QuickReplyBubbleProps {
  messageId: string;
  question: string;
  options: QuickReplyOption[];
  onSelect?: (value: string) => void;
  selectedValue?: string;
  isRTL?: boolean;
  timestamp: number;
  senderName?: string;
  disabled?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  // Voice completeness specific props
  voiceMessageId?: Id<'messages'>;
  quickReplyMessageId?: Id<'messages'>;
  isVoiceCompletenessCheck?: boolean;
  // NEW: Completion confirmation props
  isCompletionConfirmation?: boolean;
  jobId?: Id<'jobs'>;
  onCompletionConfirm?: (confirmed: boolean, jobId: Id<'jobs'>) => Promise<void>;
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

export const QuickReplyBubble: React.FC<QuickReplyBubbleProps> = ({
  messageId,
  question,
  options,
  onSelect,
  selectedValue,
  isRTL = false,
  timestamp,
  senderName,
  disabled = false,
  isFirst = true,
  isLast = true,
  voiceMessageId,
  quickReplyMessageId,
  isVoiceCompletenessCheck = false,
  // NEW: Add these lines
  isCompletionConfirmation = false,
  jobId,
  onCompletionConfirm,
}) => {
  const { t } = useLocalization();
  const { handleQuickReplySelection } = useChat();
  const [tempSelected, setTempSelected] = useState<string | null>(selectedValue || null);
  const [isProcessing, setIsProcessing] = useState(false);



  const handleSelect = useCallback(async (value: string) => {

    
    if (disabled || tempSelected || isProcessing) {
      return;
    }
    
    // Haptic feedback on selection
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (hapticError) {
    }
    
    setTempSelected(value);
    setIsProcessing(true);
    
    try {
      // NEW: Handle completion confirmation specifically
      if (isCompletionConfirmation && jobId && onCompletionConfirm) {

        
        await onCompletionConfirm(value === 'yes', jobId);
      }
      // Handle voice completeness check specifically
      else if (isVoiceCompletenessCheck && voiceMessageId && quickReplyMessageId) {
        
        if (typeof handleQuickReplySelection === 'function') {
          await handleQuickReplySelection(
            value as 'yes' | 'no',
            voiceMessageId,
            quickReplyMessageId
          );
        } else {
          console.error('🔘 handleQuickReplySelection is not a function:', typeof handleQuickReplySelection);
        }
      } else {

      }
      
      // Call the general onSelect callback if provided
      if (onSelect) {
        onSelect(value);
      }
      
    } catch (error) {
    
      // Reset state on error
      setTempSelected(null);
    } finally {
      setIsProcessing(false);
    }
  }, [
    disabled, 
    tempSelected, 
    isProcessing, 
    isCompletionConfirmation, 
    jobId, 
    onCompletionConfirm,
    isVoiceCompletenessCheck, 
    voiceMessageId, 
    quickReplyMessageId, 
    handleQuickReplySelection, 
    onSelect
  ]);

  const bubbleStyle = [
    styles.bubble,
    isFirst && styles.bubbleFirst,
    isLast && styles.bubbleLast,
    isRTL && styles.bubbleRTL,
  ];

  const containerStyle = [
    styles.container,
    isRTL && styles.containerRTL,
  ];

  return (
    <View style={containerStyle}>
      <View style={styles.messageWrapper}>
        {/* Sender name */}
        {senderName && (
          <Text style={[
            styles.senderName,
            isRTL && styles.senderNameRTL
          ]}>
            {senderName}
          </Text>
        )}
        
        <View style={bubbleStyle}>
          {/* Question text */}
          <Text style={[
            styles.questionText,
            isRTL && styles.questionTextRTL
          ]}>
            {question}
          </Text>
          
          {/* Reply buttons */}
          <View style={[
            styles.buttonsContainer,
            isRTL && styles.buttonsContainerRTL
          ]}>
            {options.map((option, index) => {
              const isSelected = tempSelected === option.value;
              const isDisabled = disabled || isProcessing || (tempSelected !== null && !isSelected);
              
              return (
                <TouchableOpacity
                  key={`${messageId}-option-${index}`}
                  style={[
                    styles.replyButton,
                    isSelected && styles.selectedReplyButton,
                    isDisabled && styles.disabledReplyButton,
                    options.length === 2 && styles.replyButtonTwoColumns,
                  ]}
                  onPress={() => handleSelect(option.value)}
                  disabled={isDisabled}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  accessibilityState={{ 
                    selected: isSelected,
                    disabled: isDisabled
                  }}
                >
                  <Text style={[
                    styles.replyButtonText,
                    isSelected && styles.selectedReplyButtonText,
                    isDisabled && styles.disabledReplyButtonText,
                    isRTL && styles.replyButtonTextRTL,
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Selected confirmation */}
          {tempSelected && (
            <View style={styles.selectedConfirmation}>
              <Text style={[
                styles.confirmationText,
                isRTL && styles.confirmationTextRTL
              ]}>
                {t('chat.selected') || 'Selected'}: {options.find(opt => opt.value === tempSelected)?.label}
              </Text>
            </View>
          )}

          {/* Processing state */}
          {isProcessing && (
            <View style={styles.processingContainer}>
              <Text style={[
                styles.processingText,
                isRTL && styles.processingTextRTL
              ]}>
                {tempSelected === 'no' ? 
                  (t('chat.removing') || 'Removing message...') : 
                  (t('chat.processing') || 'Processing...')
                }
              </Text>
            </View>
          )}

          {/* Timestamp */}
          <Text style={[
            styles.timestampText,
            isRTL && styles.timestampTextRTL
          ]}>
            {formatTime(timestamp)}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.sm,
    alignSelf: 'flex-start',
    maxWidth: '85%',
  } as ViewStyle,

  containerRTL: {
    alignSelf: 'flex-start', // Quick replies always align to start (system messages)
  } as ViewStyle,

  messageWrapper: {
    width: '100%',
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
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    shadowColor: COLORS.gray900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    minWidth: 260,
    maxWidth: 320,
  } as ViewStyle,

  bubbleFirst: {
    borderTopLeftRadius: 8,
  } as ViewStyle,

  bubbleLast: {
    borderBottomLeftRadius: 8,
  } as ViewStyle,

  bubbleRTL: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
  } as ViewStyle,

  questionText: {
    ...TYPOGRAPHY.body,
    color: COLORS.gray700,
    marginBottom: SPACING.md,
    lineHeight: 20,
  } as TextStyle,

  questionTextRTL: {
    textAlign: 'right',
    writingDirection: 'rtl',
  } as TextStyle,

  buttonsContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  } as ViewStyle,

  buttonsContainerRTL: {
    flexDirection: 'row-reverse',
  } as ViewStyle,

  replyButton: {
    flex: 1,
    backgroundColor: COLORS.gray50,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.gray200,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  } as ViewStyle,

  replyButtonTwoColumns: {
    minWidth: 100,
  } as ViewStyle,

  selectedReplyButton: {
    backgroundColor: '#eff6ff',
    borderColor: COLORS.primary,
  } as ViewStyle,

  disabledReplyButton: {
    backgroundColor: COLORS.gray100,
    borderColor: COLORS.gray200,
    opacity: 0.6,
  } as ViewStyle,

  replyButtonText: {
    ...TYPOGRAPHY.buttonText,
    color: COLORS.gray700,
    textAlign: 'center',
  } as TextStyle,

  replyButtonTextRTL: {
    textAlign: 'center',
  } as TextStyle,

  selectedReplyButtonText: {
    color: COLORS.primary,
  } as TextStyle,

  disabledReplyButtonText: {
    color: COLORS.gray400,
  } as TextStyle,

  selectedConfirmation: {
    backgroundColor: COLORS.confirmationBg,
    borderRadius: 8,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    alignItems: 'center',
  } as ViewStyle,

  confirmationText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
    color: COLORS.confirmationText,
  } as TextStyle,

  confirmationTextRTL: {
    textAlign: 'right',
  } as TextStyle,

  processingContainer: {
    backgroundColor: COLORS.gray100,
    borderRadius: 8,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    alignItems: 'center',
  } as ViewStyle,

  processingText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '500',
    color: COLORS.gray600,
  } as TextStyle,

  processingTextRTL: {
    textAlign: 'right',
  } as TextStyle,

  timestampText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray400,
    textAlign: 'right',
  } as TextStyle,

  timestampTextRTL: {
    textAlign: 'left',
  } as TextStyle,
});
