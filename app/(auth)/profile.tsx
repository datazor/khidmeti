// app/(auth)/profile.tsx
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
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { useSignUp, UserType } from '../../hooks/useSignUp';
import { useAuth } from '../../hooks/useAuth';
import { useLocalization } from '@/constants/localization';

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


export default function ProfileCompletionScreen() {
  const router = useRouter();
  const signUp = useSignUp();
  const auth = useAuth();
  const { width } = useWindowDimensions();
  const { t } = useLocalization();

    // Move validation functions inside component to access t()
  const validateName = useCallback((name: string): string => {
    const trimmed = name.trim();
    if (!trimmed) return t('validation.nameRequired');
    if (trimmed.length < 2) return t('validation.nameMinLength');
    if (trimmed.length > 50) return t('validation.nameMaxLength');
    if (!/^[a-zA-Z\s\u0600-\u06FF]+$/.test(trimmed)) return t('validation.nameInvalid');
    return '';
  }, [t]);

    const validatePassword = useCallback((password: string): string => {
    if (!password) return t('validation.passwordRequired');
    if (password.length < 6) return t('validation.passwordMinLength');
    if (password.length > 128) return t('validation.passwordMaxLength');
    if (!/(?=.*[a-zA-Z])/.test(password)) return t('validation.passwordLetter');
    return '';
  }, [t]);

    const getPasswordStrength = useCallback((password: string) => {
    if (!password) return { strength: 0, text: '', color: COLORS.gray400 };
    
    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    
    if (score <= 2) return { strength: score / 5, text: t('auth.profile.passwordWeak'), color: COLORS.error };
    if (score <= 3) return { strength: score / 5, text: t('auth.profile.passwordFair'), color: COLORS.warning };
    if (score <= 4) return { strength: score / 5, text: t('auth.profile.passwordGood'), color: COLORS.primary };
    return { strength: 1, text: t('auth.profile.passwordStrong'), color: COLORS.success };
  }, [t]);
  
  // Local state
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserType | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  
  // Form validation
  const [nameError, setNameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  
  // Animation values
  const fadeAnim = useSharedValue(0);
  const slideAnim = useSharedValue(30);
  const buttonScale = useSharedValue(1);
  const fieldScales = {
    name: useSharedValue(1),
    password: useSharedValue(1),
    confirmPassword: useSharedValue(1),
  };
  
  // Refs
  const nameInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);
  
  // Responsive
  const isSmallScreen = width < 375;
  const containerPadding = isSmallScreen ? SPACING.lg : SPACING.xl;
  
  // Start entrance animation
  useEffect(() => {
    fadeAnim.value = withTiming(1, { duration: 600 });
    slideAnim.value = withSpring(0, { damping: 20, stiffness: 200 });
  }, []);

  // In profile.tsx, update the useEffect:
useEffect(() => {
  
  if (auth.isAuthenticated && auth.user && !signUp.isLoading && selectedRole) {
    
    const timer = setTimeout(() => {
      if (selectedRole === 'worker') {
        router.replace('/(auth)/worker-onboarding');
      } else if (selectedRole === 'customer') {
        router.replace('/(app)/customer');
      }
    }, 1000);

    return () => clearTimeout(timer);
  }
}, [auth.isAuthenticated, auth.user, signUp.isLoading, selectedRole, router]);
  
  // Animated styles
  const containerStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
    transform: [{ translateY: slideAnim.value }],
  }));
  
  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));
  
  const createFieldAnimatedStyle = (field: keyof typeof fieldScales) => {
    return useAnimatedStyle(() => ({
      transform: [{ scale: fieldScales[field].value }],
    }));
  };
  
  // Password strength calculation
  const passwordStrength = getPasswordStrength(password);
  const strengthAnim = useSharedValue(0);
  
  useEffect(() => {
    strengthAnim.value = withTiming(passwordStrength.strength, { duration: 300 });
  }, [passwordStrength.strength]);
  
  const strengthBarStyle = useAnimatedStyle(() => ({
    width: `${interpolate(strengthAnim.value, [0, 1], [0, 100])}%`,
    backgroundColor: passwordStrength.color,
  }));
  
  // Handlers
  const handleNameChange = useCallback((text: string) => {
    setName(text);
    setNameError('');
    
    fieldScales.name.value = withSpring(1.02, { duration: 100 });
    fieldScales.name.value = withSpring(1, { duration: 200 });
  }, []);
  
  const handlePasswordChange = useCallback((text: string) => {
    setPassword(text);
    setPasswordError('');
    
    // Clear confirm password error if passwords now match
    if (confirmPassword && text === confirmPassword) {
      setConfirmPasswordError('');
    }
    
    fieldScales.password.value = withSpring(1.02, { duration: 100 });
    fieldScales.password.value = withSpring(1, { duration: 200 });
  }, [confirmPassword]);
  
  const handleConfirmPasswordChange = useCallback((text: string) => {
    setConfirmPassword(text);
    setConfirmPasswordError('');
    
    fieldScales.confirmPassword.value = withSpring(1.02, { duration: 100 });
    fieldScales.confirmPassword.value = withSpring(1, { duration: 200 });
  }, []);
  
  const handleRoleSelect = useCallback((role: UserType) => {
    setSelectedRole(role);
    Vibration.vibrate(50);
  }, []);
  
  const handleFocus = useCallback((field: string) => {
    setFocusedField(field);
    if (field in fieldScales) {
      fieldScales[field as keyof typeof fieldScales].value = withSpring(1.02, { damping: 15 });
    }
  }, []);
  
  const handleBlur = useCallback((field: string) => {
    setFocusedField(null);
    if (field in fieldScales) {
      fieldScales[field as keyof typeof fieldScales].value = withSpring(1, { damping: 15 });
    }
    
    // Validate on blur
    if (field === 'name') {
      const error = validateName(name);
      setNameError(error);
    } else if (field === 'password') {
      const error = validatePassword(password);
      setPasswordError(error);
    } else if (field === 'confirmPassword') {
      if (password !== confirmPassword) {
        setConfirmPasswordError(t('validation.passwordsNotMatch'));
      }
    }
  }, [name, password, confirmPassword]);
  
  const handleSubmit = useCallback(async () => {
    // Validate all fields
    const nameErr = validateName(name);
    const passwordErr = validatePassword(password);
    let confirmErr = '';
    
    if (password !== confirmPassword) {
      confirmErr = t('validation.passwordsNotMatch');
    }
    
    setNameError(nameErr);
    setPasswordError(passwordErr);
    setConfirmPasswordError(confirmErr);
    
    if (nameErr || passwordErr || confirmErr || !selectedRole) {
      // Shake animation for invalid form
      Object.values(fieldScales).forEach(scale => {
        scale.value = withSpring(0.98, { duration: 100 });
        scale.value = withSpring(1, { duration: 200 });
      });
      Vibration.vibrate([0, 100, 50, 100]);
      return;
    }
    
    // Button animation
    buttonScale.value = withSpring(0.95, { duration: 100 });
    buttonScale.value = withSpring(1, { duration: 200 });
    
    // Haptic feedback
    Vibration.vibrate(50);
    
    // Submit form
    await signUp.completeSignupWithProfile(name.trim(), password, selectedRole);
  }, [name, password, confirmPassword, selectedRole, signUp]);
  
  const handleGoBack = useCallback(() => {
    signUp.goBack();
    router.back();
  }, [router, signUp]);
  
  // Computed values
  const isFormValid = name.trim().length >= 2 && 
                     password.length >= 6 && 
                     password === confirmPassword && 
                     selectedRole !== null &&
                     !nameError && 
                     !passwordError && 
                     !confirmPasswordError;
  
  const isLoading = signUp.isLoading;
  
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent, 
            { 
              padding: containerPadding,
              paddingBottom: containerPadding + 60 
            }
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={containerStyle}>
          
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
              
              <Text style={styles.title}>{t('auth.profile.title')}</Text>
              <Text style={styles.subtitle}>
                {t('auth.profile.subtitle')}
              </Text>
            </View>
            
            {/* Form Section */}
            <View style={styles.formSection}>
              
              {/* Name Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('auth.profile.fullNameLabel')}</Text>
                <Animated.View style={[
                  styles.inputContainer,
                  focusedField === 'name' && styles.inputContainerFocused,
                  nameError && styles.inputContainerError,
                  createFieldAnimatedStyle('name'),
                ]}>
                  <TextInput
                    ref={nameInputRef}
                    value={name}
                    onChangeText={handleNameChange}
                    onFocus={() => handleFocus('name')}
                    onBlur={() => handleBlur('name')}
                    placeholder={t('auth.profile.fullNamePlaceholder')}
                    placeholderTextColor={COLORS.gray400}
                    style={styles.textInput}
                    autoComplete="name"
                    textContentType="name"
                    autoCapitalize="words"
                    editable={!isLoading}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordInputRef.current?.focus()}
                  />
                </Animated.View>
                {nameError && (
                  <Text style={styles.errorText}>{nameError}</Text>
                )}
              </View>
              
              {/* Password Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('auth.profile.passwordLabel')}</Text>
                <Animated.View style={[
                  styles.inputContainer,
                  focusedField === 'password' && styles.inputContainerFocused,
                  passwordError && styles.inputContainerError,
                  createFieldAnimatedStyle('password'),
                ]}>
                  <TextInput
                    ref={passwordInputRef}
                    value={password}
                    onChangeText={handlePasswordChange}
                    onFocus={() => handleFocus('password')}
                    onBlur={() => handleBlur('password')}
                    placeholder={t('auth.profile.passwordPlaceholder')}
                    placeholderTextColor={COLORS.gray400}
                    style={[styles.textInput, styles.passwordInput]}
                    secureTextEntry={!showPassword}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    editable={!isLoading}
                    returnKeyType="next"
                    onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
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
                
                {/* Password Strength Indicator */}
                {password.length > 0 && (
                  <View style={styles.strengthContainer}>
                    <View style={styles.strengthBar}>
                      <Animated.View style={[styles.strengthBarFill, strengthBarStyle]} />
                    </View>
                    <Text style={[styles.strengthText, { color: passwordStrength.color }]}>
                      {passwordStrength.text}
                    </Text>
                  </View>
                )}
                
                {passwordError && (
                  <Text style={styles.errorText}>{passwordError}</Text>
                )}
              </View>
              
              {/* Confirm Password Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('auth.profile.confirmPasswordLabel')}</Text>
                <Animated.View style={[
                  styles.inputContainer,
                  focusedField === 'confirmPassword' && styles.inputContainerFocused,
                  confirmPasswordError && styles.inputContainerError,
                  createFieldAnimatedStyle('confirmPassword'),
                ]}>
                  <TextInput
                    ref={confirmPasswordInputRef}
                    value={confirmPassword}
                    onChangeText={handleConfirmPasswordChange}
                    onFocus={() => handleFocus('confirmPassword')}
                    onBlur={() => handleBlur('confirmPassword')}
                    placeholder={t('auth.profile.confirmPasswordPlaceholder')}
                    placeholderTextColor={COLORS.gray400}
                    style={[styles.textInput, styles.passwordInput]}
                    secureTextEntry={!showConfirmPassword}
                    autoComplete="new-password"
                    editable={!isLoading}
                    returnKeyType="done"
                  />
                  <Pressable
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color={COLORS.gray500}
                    />
                  </Pressable>
                </Animated.View>
                {confirmPasswordError && (
                  <Text style={styles.errorText}>{confirmPasswordError}</Text>
                )}
              </View>
              
              {/* Role Selection */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('auth.profile.roleLabel')}</Text>
                <View style={styles.roleContainer}>
                  <Pressable
                    onPress={() => handleRoleSelect('customer')}
                    style={[
                      styles.roleOption,
                      selectedRole === 'customer' && styles.roleOptionSelected,
                    ]}
                    disabled={isLoading}
                  >
                    <View style={[
                      styles.roleIcon,
                      selectedRole === 'customer' && styles.roleIconSelected,
                    ]}>
                      <Ionicons
                        name="person-outline"
                        size={24}
                        color={selectedRole === 'customer' ? COLORS.white : COLORS.gray600}
                      />
                    </View>
                    <View style={styles.roleContent}>
                      <Text style={[
                        styles.roleTitle,
                        selectedRole === 'customer' && styles.roleTitleSelected,
                      ]}>
                        {t('auth.profile.customerRole')}
                      </Text>
                      <Text style={[
                        styles.roleDescription,
                        selectedRole === 'customer' && styles.roleDescriptionSelected,
                      ]}>
                        {t('auth.profile.customerDescription')}
                      </Text>
                    </View>
                    <View style={[
                      styles.radioButton,
                      selectedRole === 'customer' && styles.radioButtonSelected,
                    ]}>
                      {selectedRole === 'customer' && (
                        <View style={styles.radioButtonInner} />
                      )}
                    </View>
                  </Pressable>
                  
                  <Pressable
                    onPress={() => handleRoleSelect('worker')}
                    style={[
                      styles.roleOption,
                      selectedRole === 'worker' && styles.roleOptionSelected,
                    ]}
                    disabled={isLoading}
                  >
                    <View style={[
                      styles.roleIcon,
                      selectedRole === 'worker' && styles.roleIconSelected,
                    ]}>
                      <Ionicons
                        name="construct-outline"
                        size={24}
                        color={selectedRole === 'worker' ? COLORS.white : COLORS.gray600}
                      />
                    </View>
                    <View style={styles.roleContent}>
                      <Text style={[
                        styles.roleTitle,
                        selectedRole === 'worker' && styles.roleTitleSelected,
                      ]}>
                        {t('auth.profile.workerRole')}
                      </Text>
                      <Text style={[
                        styles.roleDescription,
                        selectedRole === 'worker' && styles.roleDescriptionSelected,
                      ]}>
                        {t('auth.profile.workerDescription')}
                      </Text>
                    </View>
                    <View style={[
                      styles.radioButton,
                      selectedRole === 'worker' && styles.radioButtonSelected,
                    ]}>
                      {selectedRole === 'worker' && (
                        <View style={styles.radioButtonInner} />
                      )}
                    </View>
                  </Pressable>
                </View>
              </View>
              
              {/* Error Card */}
              {signUp.error && (
                <View style={styles.errorCard}>
                  <View style={styles.errorIconContainer}>
                    <Ionicons name="warning-outline" size={16} color={COLORS.error} />
                  </View>
                  <Text style={styles.errorCardText}>
                    {signUp.error}
                  </Text>
                </View>
              )}
            </View>
            
            {/* Submit Button */}
            <View style={styles.buttonSection}>
              <Animated.View style={buttonAnimatedStyle}>
                <Pressable
                  onPress={handleSubmit}
                  disabled={!isFormValid || isLoading}
                  style={[
                    styles.submitButton,
                    (isFormValid && !isLoading) && styles.submitButtonActive,
                  ]}
                >
                  {isLoading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator
                        size="small"
                        color={COLORS.white}
                        style={styles.loadingSpinner}
                      />
                      <Text style={styles.buttonTextLoading}>{t('auth.profile.creatingAccount')}</Text>
                    </View>
                  ) : (
                    <Text style={styles.buttonText}>{t('auth.profile.completeSetup')}</Text>
                  )}
                </Pressable>
              </Animated.View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  } as ViewStyle,
  
  keyboardAvoidingView: {
    flex: 1,
  } as ViewStyle,
  
  scrollView: {
    flex: 1,
  } as ViewStyle,
  
  scrollContent: {
    flexGrow: 1,
    minHeight: '100%',
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
    lineHeight: 22,
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
  
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    gap: SPACING.sm,
  } as ViewStyle,
  
  strengthBar: {
    flex: 1,
    height: 4,
    backgroundColor: COLORS.gray200,
    borderRadius: 2,
    overflow: 'hidden',
  } as ViewStyle,
  
  strengthBarFill: {
    height: '100%',
    borderRadius: 2,
  } as ViewStyle,
  
  strengthText: {
    ...TYPOGRAPHY.small,
    fontWeight: '500',
    minWidth: 50,
  } as TextStyle,
  
  roleContainer: {
    gap: SPACING.sm,
  } as ViewStyle,
  
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.gray50,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.gray200,
    padding: SPACING.md,
    ...SHADOWS.sm,
  } as ViewStyle,
  
  roleOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  } as ViewStyle,
  
  roleIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.gray200,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  } as ViewStyle,
  
  roleIconSelected: {
    backgroundColor: COLORS.primary,
  } as ViewStyle,
  
  roleContent: {
    flex: 1,
  } as ViewStyle,
  
  roleTitle: {
    ...TYPOGRAPHY.bodyMedium,
    color: COLORS.gray900,
    marginBottom: SPACING.xs,
  } as TextStyle,
  
  roleTitleSelected: {
    color: COLORS.primary,
  } as TextStyle,
  
  roleDescription: {
    ...TYPOGRAPHY.small,
    color: COLORS.gray600,
    lineHeight: 18,
  } as TextStyle,
  
  roleDescriptionSelected: {
    color: COLORS.gray700,
  } as TextStyle,
  
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.gray300,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  
  radioButtonSelected: {
    borderColor: COLORS.primary,
  } as ViewStyle,
  
  radioButtonInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  } as ViewStyle,
  
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
  
  buttonSection: {
    marginBottom: SPACING.lg,
  } as ViewStyle,
  
  submitButton: {
    backgroundColor: COLORS.gray300,
    borderRadius: 16,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    ...SHADOWS.sm,
  } as ViewStyle,
  
  submitButtonActive: {
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
  
  helperText: {
    fontSize: 12,
    color: COLORS.gray500,
    textAlign: 'center',
    marginTop: SPACING.md,
    lineHeight: 16,
  } as TextStyle,
});