// app/(auth)/phone.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
  Vibration,
  StyleSheet,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { useSignUp } from '../../hooks/useSignUp';
import { validateMauritanianMobile } from '../../lib/phoneValidation';
import { useLocalization } from '@/constants/localization';

// Helper function to get text alignment based on language
const getTextAlign = (isRTL: boolean): 'left' | 'right' | 'center' => {
  return isRTL ? 'right' : 'left';
};

// Design System
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

export default function PhoneInputScreen() {
  const router = useRouter();
  const signUp = useSignUp();
  const { width } = useWindowDimensions();
  const { t, isRTL, textDirection } = useLocalization(); // Get RTL context

  
  // Local state
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  
  // Animation values
  const fadeAnim = useSharedValue(0);
  const slideAnim = useSharedValue(30);
  const inputScale = useSharedValue(1);
  const successAnim = useSharedValue(0);
  
  // Refs
  const phoneInputRef = useRef<TextInput>(null);
  
  // Responsive
  const isSmallScreen = width < 375;
  const containerPadding = isSmallScreen ? SPACING.lg : SPACING.xl;
  
  // Start entrance animation
  useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 600 });
    slideAnim.value = withSpring(0, { damping: 20, stiffness: 200 });
  }, []);
  
  // Handle signup state changes
  useEffect(() => {
    if (signUp.step === 'userCheck' && !signUp.isLoading) {
      if (signUp.userExists) {
        successAnim.value = withSpring(1, { damping: 15 });
        Vibration.vibrate(100);
        setTimeout(() => {
          signUp.navigateToSignIn();
        }, 1500);
      } else {
        signUp.sendOTP(phone.replace(/\D/g, ''));
        router.push('/(auth)/otp');
      }
    }
  }, [signUp.step, signUp.isLoading, signUp.userExists]);
  
  // Animated styles
  const containerStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ translateY: slideAnim.value }],
  }));
  
  const inputAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: inputScale.value }],
  }));
  
  const successBannerStyle = useAnimatedStyle(() => {
    const translateY = interpolate(successAnim.value, [0, 1], [-100, 0]);
    const opacity = interpolate(successAnim.value, [0, 1], [0, 1]);
    
    return {
      transform: [{ translateY }],
      opacity,
    };
  });
  
  // Handlers
  const handlePhoneChange = useCallback((text: string) => {
    const cleaned = text.replace(/\D/g, '');
    let formatted = cleaned;
    if (cleaned.length >= 4) {
      formatted = `${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6, 8)}`;
    } else if (cleaned.length >= 2) {
      formatted = `${cleaned.slice(0, 2)} ${cleaned.slice(2)}`;
    }
    
    setPhone(formatted);
    setPhoneError('');
    
    inputScale.value = withSpring(1.02, { duration: 100 });
    inputScale.value = withSpring(1, { duration: 200 });
  }, []);
  
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    inputScale.value = withSpring(1.02, { damping: 15 });
  }, []);
  
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    inputScale.value = withSpring(1, { damping: 15 });
  }, []);
  
  const handleContinue = useCallback(() => {
    
    const cleanPhone = phone.replace(/\D/g, '');
    
    const isValid = validateMauritanianMobile(cleanPhone);
    
    if (!isValid) {
      setPhoneError(t('phone.invalidPhoneError'));
      inputScale.value = withSpring(0.98, { duration: 100 });
      inputScale.value = withSpring(1, { duration: 200 });
      Vibration.vibrate([0, 100, 50, 100]);
      return;
    }

    Vibration.vibrate(50);
    signUp.checkUserExists(cleanPhone);
  }, [phone, signUp, t]);

  // Computed values
  const isPhoneValid = phone.replace(/\D/g, '').length >= 8;
  const isLoading = signUp.isLoading;
  
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
          
          {/* Success Banner */}
          {signUp.userExists && (
            <Animated.View style={[styles.successBanner, successBannerStyle]}>
              <View style={styles.successIcon}>
                <Text style={styles.successCheckmark}>✓</Text>
              </View>
              <View style={styles.successTextContainer}>
                <Text style={[
                  styles.successTitle,
                  { 
                    textAlign: getTextAlign(isRTL),
                    writingDirection: textDirection 
                  }
                ]}>
                  {t('phone.accountFound')}
                </Text>
                <Text style={[
                  styles.successSubtitle,
                  { 
                    textAlign: getTextAlign(isRTL),
                    writingDirection: textDirection 
                  }
                ]}>
                  {t('phone.redirectingText')}
                </Text>
              </View>
              <ActivityIndicator size="small" color={COLORS.white} />
            </Animated.View>
          )}
          
          {/* Header */}
          <View style={styles.header}>
            {/* Logo - always stays on the left */}
            <View style={styles.logo}>
              <View style={styles.logoInner}>
                <Text style={styles.logoText}>K</Text>
              </View>
            </View>
            
            {/* Title - text aligns based on language but container stays in place */}
            <Text style={[
              styles.title,
              { 
                textAlign: getTextAlign(isRTL),
                writingDirection: textDirection 
              }
            ]}>
              {t('phone.title')}
            </Text>
            
            <Text style={[
              styles.subtitle,
              { 
                textAlign: getTextAlign(isRTL),
                writingDirection: textDirection 
              }
            ]}>
              {t('phone.subtitle')}
            </Text>
          </View>
          
          {/* Phone Input Section */}
          <View style={styles.inputSection}>
            <Text style={[
              styles.inputLabel,
              { 
                textAlign: getTextAlign(isRTL),
                writingDirection: textDirection 
              }
            ]}>
              {t('phone.phoneNumberLabel')}
            </Text>
            
            <Animated.View style={[
              styles.inputContainer,
              isFocused && styles.inputContainerFocused,
              phoneError && styles.inputContainerError,
              inputAnimatedStyle,
            ]}>
              {/* Force LTR layout for phone input - this is critical */}
              <View style={[
                styles.inputRow,
                { flexDirection: 'row' } // Always left-to-right for phone numbers
              ]}>
                {/* Country Code - always on the left */}
                <View style={styles.countryCode}>
                  <Text style={styles.flagEmoji}>🇲🇷</Text>
                  <Text style={styles.countryCodeText}>+222</Text>
                </View>
                
                {/* Phone Input - always LTR */}
                <TextInput
                  ref={phoneInputRef}
                  value={phone}
                  onChangeText={handlePhoneChange}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  placeholder={t('phone.phonePlaceholder')}
                  placeholderTextColor={COLORS.gray400}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  style={[
                    styles.phoneInput,
                    { textAlign: 'left' } // Always left for phone numbers
                  ]}
                  editable={!isLoading}
                  maxLength={11}
                />
              </View>
            </Animated.View>
            
            {/* Error Messages - align based on language */}
            {phoneError && (
              <Text style={[
                styles.errorText,
                { 
                  textAlign: getTextAlign(isRTL),
                  writingDirection: textDirection 
                }
              ]}>
                {phoneError}
              </Text>
            )}
            
            {signUp.error && (
              <Text style={[
                styles.errorText,
                { 
                  textAlign: getTextAlign(isRTL),
                  writingDirection: textDirection 
                }
              ]}>
                {signUp.error}
              </Text>
            )}
          </View>
          
          {/* Spacer */}
          <View style={styles.spacer} />
          
          {/* Continue Button */}
          <View style={styles.buttonSection}>
            <Pressable
              onPress={handleContinue}
              disabled={!isPhoneValid || isLoading}
              style={{
                backgroundColor: (isPhoneValid && !isLoading) ? COLORS.primary : COLORS.gray300,
                padding: SPACING.md,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 56,
                opacity: (!isPhoneValid || isLoading) ? 0.6 : 1,
                ...SHADOWS.sm,
              }}
            >
              {isLoading ? (
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                }}>
                  <ActivityIndicator
                    size="small"
                    color={COLORS.white}
                    style={{ marginRight: SPACING.sm }}
                  />
                  <Text style={[
                    {
                      ...TYPOGRAPHY.bodyMedium,
                      color: COLORS.white,
                    },
                    { 
                      textAlign: getTextAlign(isRTL),
                      writingDirection: textDirection 
                    }
                  ]}>
                    {t('phone.checkingText')}
                  </Text>
                </View>
              ) : (
                <Text style={[
                  {
                    ...TYPOGRAPHY.bodyMedium,
                    color: COLORS.white,
                  },
                  { 
                    textAlign: getTextAlign(isRTL),
                    writingDirection: textDirection 
                  }
                ]}>
                  {t('phone.continueButton')}
                </Text>
              )}
            </Pressable>
            
            <Text style={[
              styles.helperText,
              { 
                textAlign: getTextAlign(isRTL),
                writingDirection: textDirection 
              }
            ]}>
              {t('phone.termsText')}
            </Text>
          </View>
        </Animated.View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

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
  
  successBanner: {
    position: 'absolute',
    top: 0,
    left: SPACING.xl,
    right: SPACING.xl,
    backgroundColor: COLORS.success,
    borderRadius: 12,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 100,
    ...SHADOWS.md,
  } as ViewStyle,
  
  successIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  } as ViewStyle,
  
  successCheckmark: {
    color: COLORS.success,
    fontSize: 16,
    fontWeight: '600',
  } as TextStyle,
  
  successTextContainer: {
    flex: 1,
  } as ViewStyle,
  
  successTitle: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  } as TextStyle,
  
  successSubtitle: {
    color: COLORS.white,
    fontSize: 12,
    opacity: 0.9,
  } as TextStyle,
  
  header: {
    marginTop: SPACING.xxxl,
    marginBottom: SPACING.xl,
  } as ViewStyle,
  
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    alignSelf: 'flex-start', // Logo always stays on the left
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
    ...TYPOGRAPHY.h1,
    color: COLORS.gray900,
    marginBottom: SPACING.sm,
  } as TextStyle,
  
  subtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.gray600,
  } as TextStyle,
  
  inputSection: {
    marginBottom: SPACING.xl,
  } as ViewStyle,
  
  inputLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.gray600,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  } as TextStyle,
  
  inputContainer: {
    backgroundColor: COLORS.gray50,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.gray200,
    ...SHADOWS.sm,
  } as ViewStyle,
  
  inputContainerFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  } as ViewStyle,
  
  inputContainerError: {
    borderColor: COLORS.error,
  } as ViewStyle,
  
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  } as ViewStyle,
  
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: SPACING.md,
    borderRightWidth: 1,
    borderRightColor: COLORS.gray200,
    marginRight: SPACING.md,
    textAlign: 'left',
  } as ViewStyle,
  
  flagEmoji: {
    fontSize: 20,
    marginRight: SPACING.xs,
  } as TextStyle,
  
  countryCodeText: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.gray900,
  } as TextStyle,
  
  phoneInput: {
    flex: 1,
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.gray900,
    padding: 0,
  } as TextStyle,
  
  errorText: {
    ...TYPOGRAPHY.small,
    color: COLORS.error,
    marginTop: SPACING.xs,
    marginLeft: SPACING.xs,
  } as TextStyle,
  
  spacer: {
    flex: 1,
  } as ViewStyle,
  
  buttonSection: {
    marginBottom: SPACING.lg,
  } as ViewStyle,
  
  helperText: {
    fontSize: 12,
    color: COLORS.gray500,
    textAlign: 'center',
    marginTop: SPACING.md,
    lineHeight: 16,
  } as TextStyle,
});