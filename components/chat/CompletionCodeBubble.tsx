// components/chat/CompletionCodeBubble.tsx - Code input bubble for job completion
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import {
  CodeField,
  Cursor,
  useBlurOnFulfill,
  useClearByFocusCell,
} from 'react-native-confirmation-code-field';
import { useLocalization } from '@/constants/localization';
import { Id } from '../../convex/_generated/dataModel';

// Design System - consistent with other bubbles
const COLORS = {
  primary: '#2563eb',
  primaryLight: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
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
};

const TYPOGRAPHY = {
  title: {
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
  code: {
    fontSize: 24,
    fontWeight: '700' as const,
    letterSpacing: 4,
    fontFamily: 'monospace',
  },
};

const SHADOWS = {
  card: {
    shadowColor: COLORS.gray900,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  button: {
    shadowColor: COLORS.gray900,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
};

interface CompletionCodeBubbleProps {
  messageId: Id<'messages'>;
  jobId: Id<'jobs'>;
  instruction: string;
  timestamp: number;
  isRTL?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  maxLength?: number;
  onCodeSubmit: (code: string, jobId: Id<'jobs'>) => Promise<void>;
  onValidationError?: (error: string) => void;
  disabled?: boolean;
  delay?: number;
}

export const CompletionCodeBubble: React.FC<CompletionCodeBubbleProps> = ({
  messageId,
  jobId,
  instruction,
  timestamp,
  isRTL = false,
  isFirst = true,
  isLast = true,
  maxLength = 6,
  onCodeSubmit,
  onValidationError,
  disabled = false,
  delay = 0,
}) => {
  const { t } = useLocalization();
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasError, setHasError] = useState(false);
  
  // Reanimated shared values for animations
  const shakeOffset = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);

  // Use library hooks for better focus management
  const ref = useBlurOnFulfill({ value: code, cellCount: maxLength });
  const [props, getCellOnLayoutHandler] = useClearByFocusCell({
    value: code,
    setValue: setCode,
  });
  
  // Reanimated styles
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeOffset.value }]
  }));
  
  const entranceStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }]
  }));

  // Entrance animation with delay
  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
    scale.value = withDelay(delay, withTiming(1, { duration: 300 }));
  }, [delay, opacity, scale]);

  // Format timestamp
  const formatTime = useCallback((timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  // Shake animation for errors using reanimated
  const triggerShakeAnimation = useCallback(() => {
    shakeOffset.value = withSequence(
      withTiming(10, { duration: 100 }),
      withTiming(-10, { duration: 100 }),
      withTiming(10, { duration: 100 }),
      withTiming(0, { duration: 100 })
    );
  }, [shakeOffset]);

  // Handle code submission
  const handleSubmitCode = useCallback(async (finalCode: string) => {
    if (finalCode.length < maxLength) {
      setHasError(true);
      triggerShakeAnimation();
      onValidationError?.(`Code must be ${maxLength} digits`);
      return;
    }

    if (isSubmitting || disabled) return;

    setIsSubmitting(true);
    setHasError(false);

    try {
      await onCodeSubmit(finalCode, jobId);
      // Success - bubble will expire and disappear
      setCode('');
    } catch (error) {
      console.error('Code submission failed:', error);
      setHasError(true);
      triggerShakeAnimation();
      
      const errorMessage = error instanceof Error ? error.message : 'Invalid code. Please try again.';
      onValidationError?.(errorMessage);
      
      // Clear the code on error to allow re-entry
      setCode('');
    } finally {
      setIsSubmitting(false);
    }
  }, [maxLength, isSubmitting, disabled, onCodeSubmit, jobId, triggerShakeAnimation, onValidationError]);

  // Handle code change with auto-submit
  const handleCodeChange = useCallback((text: string) => {
    setCode(text);
    setHasError(false);

    // Auto-submit when complete
    if (text.length === maxLength) {
      handleSubmitCode(text);
    }
  }, [maxLength, handleSubmitCode]);

  // Manual submit button handler
  const handleManualSubmit = useCallback(() => {
    if (code.length === maxLength) {
      handleSubmitCode(code);
    }
  }, [code, maxLength, handleSubmitCode]);

  const containerStyle = [
    styles.container,
    isFirst && styles.containerFirst,
    isLast && styles.containerLast,
    isRTL && styles.containerRTL,
  ];

  return (
    <Animated.View style={[
      containerStyle,
      entranceStyle,
      shakeStyle
    ]}>
      <View style={styles.bubble}>
        {/* Header */}
        <View style={[styles.header, isRTL && styles.headerRTL]}>
          <View style={styles.iconContainer}>
            <Ionicons 
              name="keypad" 
              size={20} 
              color={hasError ? COLORS.error : COLORS.primary} 
            />
          </View>
          <Text style={[styles.title, hasError && { color: COLORS.error }]}>
            Enter Completion Code
          </Text>
        </View>

        {/* Instruction */}
        <Text style={[styles.instruction, isRTL && { textAlign: 'right' }]}>
          {instruction}
        </Text>

        {/* Code Input Area - Using react-native-confirmation-code-field */}
        <CodeField
          ref={ref}
          {...props}
          value={code}
          onChangeText={handleCodeChange}
          cellCount={maxLength}
          rootStyle={styles.codeFieldRoot}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          editable={!disabled && !isSubmitting}
          renderCell={({ index, symbol, isFocused }) => (
            <View
              key={index}
              onLayout={getCellOnLayoutHandler(index)}
              style={[
                styles.codeDot,
                isFocused && styles.codeDotActive,
                hasError && styles.codeDotError,
                symbol && styles.codeDotFilled,
              ]}
            >
              <Text style={[
                styles.codeDigit,
                hasError && styles.codeDigitError,
              ]}>
                {symbol || (isFocused ? <Cursor /> : null)}
              </Text>
            </View>
          )}
        />

        {/* Status message */}
        {hasError && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color={COLORS.error} />
            <Text style={styles.errorText}>
              Invalid code. Please try again.
            </Text>
          </View>
        )}

        {isSubmitting && (
          <View style={styles.statusContainer}>
            <Ionicons name="hourglass" size={16} color={COLORS.primary} />
            <Text style={styles.statusText}>
              Verifying code...
            </Text>
          </View>
        )}

        {/* Manual submit button */}
        {code.length === maxLength && !isSubmitting && !hasError && (
          <Pressable
            onPress={handleManualSubmit}
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.submitButtonPressed,
            ]}
          >
            <Text style={styles.submitButtonText}>Submit Code</Text>
            <Ionicons name="checkmark" size={16} color={COLORS.white} />
          </Pressable>
        )}

        {/* Footer */}
        <View style={[styles.footer, isRTL && styles.footerRTL]}>
          <Text style={styles.timestamp}>
            {formatTime(timestamp)}
          </Text>
          <Text style={styles.helpText}>
            Tap to enter {maxLength}-digit code
          </Text>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: SPACING.sm,
    alignSelf: 'flex-start',
    maxWidth: '90%',
  } as ViewStyle,

  containerFirst: {
    marginTop: SPACING.xs,
  } as ViewStyle,

  containerLast: {
    marginBottom: SPACING.md,
  } as ViewStyle,

  containerRTL: {
    alignSelf: 'flex-end',
  } as ViewStyle,

  bubble: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    padding: SPACING.lg,
    borderWidth: 2,
    borderColor: COLORS.primary + '20',
    minWidth: 280,
    ...SHADOWS.card,
  } as ViewStyle,

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  } as ViewStyle,

  headerRTL: {
    flexDirection: 'row-reverse',
  } as ViewStyle,

  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary + '10',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  } as ViewStyle,

  title: {
    ...TYPOGRAPHY.title,
    color: COLORS.gray800,
    flex: 1,
  } as TextStyle,

  instruction: {
    ...TYPOGRAPHY.body,
    color: COLORS.gray600,
    marginBottom: SPACING.lg,
    lineHeight: 20,
  } as TextStyle,

  codeFieldRoot: {
    marginVertical: SPACING.md,
    gap: SPACING.xs,
  } as ViewStyle,

  codeDot: {
    width: 32,
    height: 40,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.gray300,
    backgroundColor: COLORS.gray50,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,

  codeDotFilled: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  } as ViewStyle,

  codeDotActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '05',
  } as ViewStyle,

  codeDotError: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.error + '10',
  } as ViewStyle,

  codeDigit: {
    ...TYPOGRAPHY.code,
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: '700',
  } as TextStyle,

  codeDigitError: {
    color: COLORS.error,
  } as TextStyle,

  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.error + '10',
    padding: SPACING.sm,
    borderRadius: 8,
    marginBottom: SPACING.sm,
  } as ViewStyle,

  errorText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.error,
    marginLeft: SPACING.xs,
    fontWeight: '500',
  } as TextStyle,

  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary + '10',
    padding: SPACING.sm,
    borderRadius: 8,
    marginBottom: SPACING.sm,
  } as ViewStyle,

  statusText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.primary,
    marginLeft: SPACING.xs,
    fontWeight: '500',
  } as TextStyle,

  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: 12,
    marginBottom: SPACING.sm,
    gap: SPACING.xs,
    ...SHADOWS.button,
  } as ViewStyle,

  submitButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  } as ViewStyle,

  submitButtonText: {
    ...TYPOGRAPHY.body,
    color: COLORS.white,
    fontWeight: '600',
  } as TextStyle,

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as ViewStyle,

  footerRTL: {
    flexDirection: 'row-reverse',
  } as ViewStyle,

  timestamp: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray400,
  } as TextStyle,

  helpText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray500,
    fontStyle: 'italic',
  } as TextStyle,
});
