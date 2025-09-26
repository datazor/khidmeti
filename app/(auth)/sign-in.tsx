// app/(auth)/sign-in.tsx
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
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useAuth } from '../../hooks/useAuth';
import { useSignUp } from '../../hooks/useSignUp';
import { useLocalSearchParams } from 'expo-router';
import { useLocalization } from '@/constants/localization';
import { t } from '@/constants/i18n';

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

// Phone number formatting helper
const formatPhoneNumber = (phone: string) => {
  if (!phone) return 'XX XX XX XX';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length >= 8) {
    return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6, 8)}`;
  }
  return phone;
};

// Error mapping helper
const mapErrorToUserMessage = (error: string) => {
  if (!error) return '';
  
  const errorLower = error.toLowerCase();
  
  if (errorLower.includes('invalid') || errorLower.includes('incorrect')) {
    return t('signIn.incorrectPassword');
  }
  
  if (errorLower.includes('account not found')) {
    return t('signIn.accountNotFound');
  }
  
  if (errorLower.includes('network') || errorLower.includes('connection')) {
    return t('signIn.connectionError');
  }
  
  if (errorLower.includes('rate limit') || errorLower.includes('too many')) {
    return t('signIn.tooManyAttempts');
  }
  
  if (errorLower.includes('suspended') || errorLower.includes('blocked')) {
    return t('signIn.accountSuspended');
  }
  
  // Generic fallback for unknown errors
  return t('signIn.signInFailed');
};

export default function SignInScreen() {
  const router = useRouter();
  const auth = useAuth();
  const signUp = useSignUp();
  const { width } = useWindowDimensions();
  const { t } = useLocalization();
  
  // Get phone from params
  const { phone: phoneParam } = useLocalSearchParams();
  const phone = phoneParam as string || signUp.phone || '';
  
  // Local state
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  
  // Form validation
  const [passwordError, setPasswordError] = useState('');
  
  // Animation values
  const fadeAnim = useSharedValue(0);
  const slideAnim = useSharedValue(30);
  const buttonScale = useSharedValue(1);
  const passwordScale = useSharedValue(1);
  
  // Refs
  const passwordInputRef = useRef<TextInput>(null);
  
  // Responsive
  const isSmallScreen = width < 375;
  const containerPadding = isSmallScreen ? SPACING.lg : SPACING.xl;
  
  // Start entrance animation
  useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 600 });
    slideAnim.value = withSpring(0, { damping: 20, stiffness: 200 });
  }, []);

  // Auto focus password input
  useEffect(() => {
    const timer = setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 800);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Clear auth errors when user starts typing
  useEffect(() => {
    if (auth.error) {
      auth.clearError();
    }
  }, [password]);
  
  // Animated styles
  const containerStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ translateY: slideAnim.value }],
  }));
  
  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));
  
  const passwordAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: passwordScale.value }],
  }));
  
  // Handlers
  const handlePasswordChange = useCallback((text: string) => {
    setPassword(text);
    setPasswordError('');
    
    passwordScale.value = withSpring(1.02, { duration: 100 });
    passwordScale.value = withSpring(1, { duration: 200 });
  }, []);
  
  const handleFocus = useCallback(() => {
    setFocusedField('password');
    passwordScale.value = withSpring(1.02, { damping: 15 });
  }, []);
  
  const handleBlur = useCallback(() => {
    setFocusedField(null);
    passwordScale.value = withSpring(1, { damping: 15 });
    
    if (!password) {
      setPasswordError(t('signIn.passwordRequired'));
    }
  }, [password]);
  
  const handleSignIn = useCallback(async () => {
    // Clear previous errors
    setPasswordError('');
    
    // Validate password
    if (!password) {
      setPasswordError('Password is required');
      passwordScale.value = withSpring(0.98, { duration: 100 });
      passwordScale.value = withSpring(1, { duration: 200 });
      Vibration.vibrate([0, 100, 50, 100]);
      return;
    }
    
    // Button animation
    buttonScale.value = withSpring(0.95, { duration: 100 });
    buttonScale.value = withSpring(1, { duration: 200 });
    
    // Haptic feedback
    Vibration.vibrate(50);
    
    // Clean phone for API call
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Just call signIn - the layout will handle routing when auth state changes
    await auth.signIn(cleanPhone, password);
  }, [phone, password, auth]);
  
  const handleGoToSignUp = useCallback(() => {
    signUp.reset();
    router.push('/(auth)/phone' as any);
  }, [router, signUp]);
  
  const handleForgotPassword = useCallback(() => {
    // Navigate to forgot password flow (to be implemented)
  }, []);
  
  const handleGoBack = useCallback(() => {
    signUp.reset();
    router.back();
  }, [router, signUp]);
  
  // Computed values
  const isFormValid = password.length > 0;
  const isLoading = auth.isLoading;
  
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
            <View style={styles.logo}>
              <View style={styles.logoInner}>
                <Text style={styles.logoText}>K</Text>
              </View>
            </View>
            
            <Text style={styles.title}>{t('signIn.title')}</Text>
            <Text style={styles.subtitle}>
              {t('signIn.subtitle')}
            </Text>
            
            {/* Phone Number Display */}
            <View style={styles.phoneDisplay}>
              <Text style={styles.phoneDisplayText}>
                +222 {formatPhoneNumber(phone)}
              </Text>
            </View>
          </View>
          
          {/* Form Section */}
          <View style={styles.formSection}>
            
            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t('signIn.passwordLabel')}</Text>
              <Animated.View style={[
                styles.inputContainer,
                focusedField === 'password' && styles.inputContainerFocused,
                passwordError && styles.inputContainerError,
                passwordAnimatedStyle,
              ]}>
                <TextInput
                  ref={passwordInputRef}
                  value={password}
                  onChangeText={handlePasswordChange}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  placeholder={t('signIn.passwordPlaceholder')}
                  placeholderTextColor={COLORS.gray400}
                  style={[styles.textInput, styles.passwordInput]}
                  secureTextEntry={!showPassword}
                  autoComplete="current-password"
                  textContentType="password"
                  editable={!isLoading}
                  returnKeyType="done"
                  onSubmitEditing={handleSignIn}
                />
                <Pressable
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={COLORS.gray500}
                  />
                </Pressable>
              </Animated.View>
              {passwordError && (
                <Text style={styles.errorText}>{passwordError}</Text>
              )}
            </View>
            
            {/* Forgot Password Link */}
            <View style={styles.forgotPasswordContainer}>
              <Pressable onPress={handleForgotPassword} style={styles.forgotPasswordButton}>
                <Text style={styles.forgotPasswordText}>{t('signIn.forgotPassword')}</Text>
              </Pressable>
            </View>
            
            {/* Error Card */}
            {auth.error && (
              <View style={styles.errorCard}>
                <View style={styles.errorIconContainer}>
                  <Ionicons name="warning-outline" size={16} color={COLORS.error} />
                </View>
                <Text style={styles.errorCardText}>
                  {mapErrorToUserMessage(auth.error)}
                </Text>
              </View>
            )}
          </View>
          
          {/* Spacer */}
          <View style={styles.spacer} />
          
          {/* Sign In Button */}
          <View style={styles.buttonSection}>
            <Animated.View style={buttonAnimatedStyle}>
              <Pressable
                onPress={handleSignIn}
                disabled={!isFormValid || isLoading}
                style={[
                  styles.signInButton,
                  (isFormValid && !isLoading) && styles.signInButtonActive,
                ]}
              >
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator
                      size="small"
                      color={COLORS.white}
                      style={styles.loadingSpinner}
                    />
                    <Text style={styles.buttonTextLoading}>{t('signIn.signingInText')}</Text>
                  </View>
                ) : (
                  <Text style={styles.buttonText}>{t('signIn.signInButton')}</Text>
                )}
              </Pressable>
            </Animated.View>
            
            {/* Sign Up Link */}
            <View style={styles.signUpContainer}>
              <Text style={styles.signUpPrompt}>{t('signIn.signUpPrompt')}</Text>
              <Pressable onPress={handleGoToSignUp}>
                <Text style={styles.signUpLink}>{t('signIn.signUpLink')}</Text>
              </Pressable>
            </View>
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
    marginBottom: SPACING.md,
  } as TextStyle,
  
  phoneDisplay: {
    backgroundColor: COLORS.gray50,
    borderRadius: 12,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  } as ViewStyle,
  
  phoneDisplayText: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.primary,
    textAlign: 'center',
  } as TextStyle,
  
  formSection: {
    marginBottom: SPACING.xl,
  } as ViewStyle,
  
  inputGroup: {
    marginBottom: SPACING.lg,
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
    flexDirection: 'row',
    alignItems: 'center',
    ...SHADOWS.sm,
  } as ViewStyle,
  
  inputContainerFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  } as ViewStyle,
  
  inputContainerError: {
    borderColor: COLORS.error,
  } as ViewStyle,
  
  textInput: {
    flex: 1,
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.gray900,
    padding: SPACING.md,
  } as TextStyle,
  
  passwordInput: {
    paddingRight: SPACING.xs,
  } as TextStyle,
  
  eyeButton: {
    padding: SPACING.sm,
    marginRight: SPACING.xs,
  } as ViewStyle,
  
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginTop: -SPACING.sm,
  } as ViewStyle,
  
  forgotPasswordButton: {
    padding: SPACING.xs,
  } as ViewStyle,
  
  forgotPasswordText: {
    ...TYPOGRAPHY.small,
    color: COLORS.primary,
    fontWeight: '500',
  } as TextStyle,
  
  errorText: {
    ...TYPOGRAPHY.small,
    color: COLORS.error,
    marginTop: SPACING.xs,
    marginLeft: SPACING.xs,
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
  
  signInButton: {
    backgroundColor: COLORS.gray300,
    borderRadius: 16,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    ...SHADOWS.sm,
  } as ViewStyle,
  
  signInButtonActive: {
    backgroundColor: COLORS.primary,
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
  
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.lg,
  } as ViewStyle,
  
  signUpPrompt: {
    ...TYPOGRAPHY.body,
    color: COLORS.gray600,
  } as TextStyle,
  
  signUpLink: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.primary,
  } as TextStyle,
});