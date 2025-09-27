// app/(auth)/otp.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
  Vibration,
  StyleSheet,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { OtpInput } from 'react-native-otp-entry';
import { useSignUp } from '../../hooks/useSignUp';
import { useLocalization } from '@/constants/localization';

// Helper function to get text alignment based on language
const getTextAlign = (isRTL: boolean): 'left' | 'right' | 'center' => {
  return isRTL ? 'right' : 'left';
};

// Design System - Same as phone.tsx
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
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

const TYPOGRAPHY = {
  h1: {
    fontSize: 32,
    fontWeight: '700' as const,
    lineHeight: 40,
  },
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
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 16,
    letterSpacing: 0.5,
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

// Phone number formatting helper
const formatPhoneNumber = (phone: string) => {
  if (!phone) return 'XX XX XX XX';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length >= 8) {
    return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6, 8)}`;
  }
  return phone;
};

export default function OTPVerificationScreen() {
  const router = useRouter();
  const signUp = useSignUp();
  const { width } = useWindowDimensions();
  const { t, isRTL, textDirection } = useLocalization(); // Get localization context


  
  // Local state
  const [otp, setOTP] = useState('');
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [isResending, setIsResending] = useState(false);
  
  // Animation values
  const fadeAnim = useSharedValue(0);
  const slideAnim = useSharedValue(30);
  const buttonScale = useSharedValue(1);
  const otpScale = useSharedValue(1);
  const timerProgress = useSharedValue(1);
  
  // Responsive
  const isSmallScreen = width < 375;
  const containerPadding = isSmallScreen ? SPACING.lg : SPACING.xl;

  // Error mapping helper - NOW INSIDE COMPONENT TO ACCESS 't'
  const mapErrorToUserMessage = useCallback((error: string) => {
    if (!error) return '';
    
    const errorLower = error.toLowerCase();
    
    if (errorLower.includes('invalid signup state')) {
      return t('otp.errors.invalidState');
    }
    
    if (errorLower.includes('invalid otp') || errorLower.includes('incorrect code')) {
      return t('otp.errors.invalidCode');
    }
    
    if (errorLower.includes('expired')) {
      return t('otp.errors.expired');
    }
    
    if (errorLower.includes('network') || errorLower.includes('connection')) {
      return t('otp.errors.connection');
    }
    
    if (errorLower.includes('rate limit') || errorLower.includes('too many')) {
      return t('otp.errors.tooManyAttempts');
    }
    
    // Generic fallback for unknown errors
    return t('otp.errors.generic');
  }, [t]);
  
  // Start entrance animation
  useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 600 });
    slideAnim.value = withSpring(0, { damping: 20, stiffness: 200 });
  }, []);
  
  // Timer countdown logic using setInterval
  useEffect(() => {
    let interval: number;
    
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => {
          const newTime = prev - 1;
          // Update progress animation
          timerProgress.value = withTiming(newTime / 60, { duration: 1000 });
          return newTime;
        });
      }, 1000);
    } else {
      setCanResend(true);
      timerProgress.value = withTiming(0, { duration: 300 });
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [timer]);
  
  
  // Animated styles
  const containerStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ translateY: slideAnim.value }],
  }));
  
  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));
  
  const otpAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: otpScale.value }],
  }));
  
  const timerProgressStyle = useAnimatedStyle(() => {
    const width = interpolate(timerProgress.value, [0, 1], [0, 100]);
    return {
      width: `${width}%`,
    };
  });
  
  // Handlers
  const handleOTPChange = useCallback((value: string) => {
    setOTP(value);
    
    // Input feedback animation
    otpScale.value = withSpring(1.02, { duration: 100 });
    otpScale.value = withSpring(1, { duration: 200 });
  }, []);
  
  const handleOTPComplete = useCallback((value: string) => {
    // Trigger verification when all digits are filled
    setTimeout(() => {
      handleVerifyOTP(value);
    }, 200);
  }, []);
  
  const handleVerifyOTP = useCallback((otpCode?: string) => {
    const codeToVerify = otpCode || otp;
    if (codeToVerify.length === 6) {
      // Button animation
      buttonScale.value = withSpring(0.95, { duration: 100 });
      buttonScale.value = withSpring(1, { duration: 200 });
      
      // Haptic feedback
      Vibration.vibrate(50);
      
      signUp.verifyOTP(codeToVerify);
    }
  }, [otp, signUp]);
  
  const handleResendOTP = useCallback(async () => {
    if (!canResend || isResending) return;
    
    setIsResending(true);
    
    try {
      // Reset timer and OTP
      setTimer(60);
      setCanResend(false);
      setOTP('');
      timerProgress.value = withTiming(1, { duration: 300 });
      
      // Haptic feedback
      Vibration.vibrate(50);
      
      // Simulate resend API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
    } finally {
      setIsResending(false);
    }
  }, [canResend, isResending]);
  
  const handleGoBack = useCallback(() => {
    signUp.goBack();
    router.back(); 
  }, [router]);
  
  // Computed values
  const isOTPComplete = otp.length === 6;
  const isLoading = signUp.isLoading;
  const allInputsDisabled = isLoading || isResending;
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        extraHeight={100}
      >
        <Animated.View style={[{ padding: containerPadding }, containerStyle]}>
          
          {/* Back Button */}
          <View style={styles.backButtonContainer}>
            <Pressable onPress={handleGoBack} style={styles.backButton}>
              <Ionicons name="chevron-back" size={24} color={COLORS.gray700} />
            </Pressable>
          </View>
          
          {/* Header */}
          <View style={styles.header}>
            {/* Logo */}
            <View style={styles.logo}>
              <View style={styles.logoInner}>
                <Text style={styles.logoText}>K</Text>
              </View>
            </View>
            
            {/* Title */}
            <Text style={[
              styles.title,
              { 
                textAlign: getTextAlign(isRTL),
                writingDirection: textDirection 
              }
            ]}>
              {t('otp.title')}
            </Text>
            
            <Text style={[
              styles.subtitle,
              { 
                textAlign: getTextAlign(isRTL),
                writingDirection: textDirection 
              }
            ]}>
              {t('otp.subtitle')}
            </Text>
            
            {/* Phone Number - Always LTR format */}
            <Text style={[
              styles.phoneNumber,
              { 
                textAlign: 'center', // Always center for phone numbers
                writingDirection: 'ltr' // Always LTR for phone numbers
              }
            ]}>
              +222 {formatPhoneNumber(signUp.phone)}
            </Text>
          </View>
          
          {/* OTP Input Section */}
          <View style={styles.otpSection}>
            <Text style={[
              styles.otpLabel,
              { 
                textAlign: getTextAlign(isRTL),
                writingDirection: textDirection 
              }
            ]}>
              {t('otp.verificationCodeLabel')}
            </Text>
            
            {/* OTP Input Fields - Always LTR */}
            <Animated.View style={[styles.otpContainer, otpAnimatedStyle]}>
              <OtpInput
                numberOfDigits={6}
                onTextChange={handleOTPChange}
                onFilled={handleOTPComplete}
                autoFocus={true}
                focusColor={COLORS.primary}
                theme={{
                  containerStyle: styles.otpLibraryContainer,
                  pinCodeContainerStyle: signUp.error ? styles.otpInputError : styles.otpInput,
                  focusedPinCodeContainerStyle: styles.otpInputFocused,
                  filledPinCodeContainerStyle: styles.otpInputFilled,
                  pinCodeTextStyle: styles.otpInputText,
                }}
                disabled={allInputsDisabled}
              />
            </Animated.View>
            
            {/* Timer and Resend Section */}
            <View style={styles.timerSection}>
              {!canResend ? (
                <View style={styles.timerContainer}>
                  <View style={styles.timerProgressBar}>
                    <Animated.View style={[styles.timerProgressFill, timerProgressStyle]} />
                  </View>
                  <Text style={[
                    styles.timerText,
                    { 
                      textAlign: getTextAlign(isRTL),
                      writingDirection: textDirection 
                    }
                  ]}>
                    {t('otp.resendCodeIn', { time: formatTime(timer) })}
                  </Text>
                </View>
              ) : (
                <Pressable 
                  onPress={handleResendOTP}
                  style={styles.resendButton}
                  disabled={isResending}
                >
                  {isResending ? (
                    <View style={styles.resendLoadingContainer}>
                      <ActivityIndicator size="small" color={COLORS.primary} />
                      <Text style={[
                        styles.resendLoadingText,
                        { 
                          textAlign: getTextAlign(isRTL),
                          writingDirection: textDirection 
                        }
                      ]}>
                        {t('otp.resendingText')}
                      </Text>
                    </View>
                  ) : (
                    <Text style={[
                      styles.resendButtonText,
                      { 
                        textAlign: getTextAlign(isRTL),
                        writingDirection: textDirection 
                      }
                    ]}>
                      {t('otp.resendButton')}
                    </Text>
                  )}
                </Pressable>
              )}
            </View>
            
            {/* Error Card */}
            {signUp.error && (
              <View style={styles.errorCard}>
                <View style={styles.errorIconContainer}>
                  <Ionicons name="warning-outline" size={16} color={COLORS.error} />
                </View>
                <Text style={[
                  styles.errorCardText,
                  { 
                    textAlign: getTextAlign(isRTL),
                    writingDirection: textDirection 
                  }
                ]}>
                  {mapErrorToUserMessage(signUp.error)}
                </Text>
              </View>
            )}
          </View>
          
          {/* Spacer */}
          <View style={styles.spacer} />
          
          {/* Verify Button */}
          <View style={styles.buttonSection}>
            <Animated.View style={buttonAnimatedStyle}>
              <Pressable
                onPress={() => handleVerifyOTP()}
                disabled={!isOTPComplete || isLoading}
                style={({ pressed }) => [
                  styles.verifyButton,
                  (isOTPComplete && !isLoading) && styles.verifyButtonActive,
                  pressed && styles.verifyButtonPressed,
                ]}
              >
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator
                      size="small"
                      color={COLORS.white}
                      style={styles.loadingSpinner}
                    />
                    <Text style={[
                      styles.buttonTextLoading,
                      { 
                        textAlign: getTextAlign(isRTL),
                        writingDirection: textDirection 
                      }
                    ]}>
                      {t('otp.verifyingText')}
                    </Text>
                  </View>
                ) : (
                  <Text style={[
                    styles.buttonText,
                    { 
                      textAlign: getTextAlign(isRTL),
                      writingDirection: textDirection 
                    }
                  ]}>
                    {t('otp.verifyButton')}
                  </Text>
                )}
              </Pressable>
            </Animated.View>
            
            <Text style={[
              styles.helperText,
              { 
                textAlign: getTextAlign(isRTL),
                writingDirection: textDirection 
              }
            ]}>
              {t('otp.helperText')}
            </Text>
          </View>
        </Animated.View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

// Styles remain the same as before...
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  } as ViewStyle,
  
  scrollView: {
    flex: 1,
  } as ViewStyle,
  
  scrollContent: {
    flexGrow: 1,
  } as ViewStyle,
  
  backButtonContainer: {
    marginBottom: SPACING.lg,
  } as ViewStyle,
  
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.gray50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.gray200,
  } as ViewStyle,
  
  header: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
    alignItems: 'center',
  } as ViewStyle,
  
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    ...SHADOWS.md,
  } as ViewStyle,
  
  logoInner: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  
  logoText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.primary,
  } as TextStyle,
  
  title: {
    ...TYPOGRAPHY.h2,
    color: COLORS.gray900,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  } as TextStyle,
  
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.gray600,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  } as TextStyle,
  
  phoneNumber: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.primary,
    textAlign: 'center',
  } as TextStyle,
  
  otpSection: {
    marginBottom: SPACING.xl,
  } as ViewStyle,
  
  otpLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.gray600,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: SPACING.lg,
  } as TextStyle,
  
  otpContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  } as ViewStyle,
  
  otpLibraryContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
  } as ViewStyle,
  
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.gray200,
    backgroundColor: COLORS.gray50,
    ...SHADOWS.sm,
  } as ViewStyle,
  
  otpInputText: {
    fontSize: 24,
    fontWeight: '600',
    color: COLORS.gray900,
  } as TextStyle,
  
  otpInputFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  } as ViewStyle,
  
  otpInputFilled: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  } as ViewStyle,
  
  otpInputError: {
    borderColor: COLORS.error,
  } as ViewStyle,
  
  timerSection: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  } as ViewStyle,
  
  timerContainer: {
    alignItems: 'center',
  } as ViewStyle,
  
  timerProgressBar: {
    width: 200,
    height: 3,
    backgroundColor: COLORS.gray200,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  } as ViewStyle,
  
  timerProgressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  } as ViewStyle,
  
  timerText: {
    ...TYPOGRAPHY.small,
    color: COLORS.gray500,
  } as TextStyle,
  
  resendButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  } as ViewStyle,
  
  resendLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  } as ViewStyle,
  
  resendLoadingText: {
    ...TYPOGRAPHY.small,
    color: COLORS.gray500,
  } as TextStyle,
  
  resendButtonText: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.primary,
  } as TextStyle,
  
  errorCard: {
    backgroundColor: `${COLORS.error}15`,
    borderRadius: 12,
    padding: SPACING.md,
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${COLORS.error}30`,
  } as ViewStyle,
  
  errorIconContainer: {
    marginRight: SPACING.sm,
  } as ViewStyle,
  
  errorCardText: {
    ...TYPOGRAPHY.small,
    color: COLORS.error,
    flex: 1,
    lineHeight: 18,
  } as TextStyle,
  
  spacer: {
    flex: 1,
  } as ViewStyle,
  
  buttonSection: {
    marginBottom: SPACING.lg,
  } as ViewStyle,
  
  verifyButton: {
    backgroundColor: COLORS.gray300,
    borderRadius: 16,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    ...SHADOWS.sm,
  } as ViewStyle,
  
  verifyButtonActive: {
    backgroundColor: COLORS.primary,
  } as ViewStyle,
  
  verifyButtonPressed: {
    opacity: 0.9,
  } as ViewStyle,
  
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  
  loadingSpinner: {
    marginRight: SPACING.sm,
  } as ViewStyle,
  
  buttonText: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.white,
  } as TextStyle,
  
  buttonTextLoading: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.white,
  } as TextStyle,
  
  helperText: {
    fontSize: 12,
    color: COLORS.gray500,
    textAlign: 'center',
    marginTop: SPACING.md,
    lineHeight: 16,
  } as TextStyle,
});