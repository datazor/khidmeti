// styles/otpStyles.ts
import { StyleSheet, Dimensions, Platform } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Design System Constants (consistent with phone screen)
export const COLORS = {
  background: '#1A1A1A',
  cardBackground: '#2A2A2A',
  inputBackground: '#222222',
  border: '#333333',
  borderFocused: '#ADFF2F',
  borderError: '#FF4444',
  white: '#FFFFFF',
  textPrimary: '#FFFFFF',
  textSecondary: '#888888',
  textPlaceholder: '#666666',
  accent: '#ADFF2F',
  accentSecondary: '#75FCCC',
  error: '#FF4444',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};

export const TYPOGRAPHY = {
  titleSize: Math.min(36, screenWidth * 0.09),
  titleLineHeight: Math.min(42, screenWidth * 0.105),
  logoTextSize: 40,
  bodySize: 16,
  labelSize: 14,
  smallSize: 12,
  buttonSize: 16,
  otpSize: 24,
};

export const LOGO = {
  containerPadding: SPACING.xxxl,
  iconSize: 72,
  iconRadius: 36,
  textMargin: SPACING.xxxl,
  borderRadius: 56,
};

export const OTP = {
  inputSize: 56,
  inputSpacing: SPACING.md,
  containerWidth: (56 * 6) + (SPACING.md * 5), // 6 inputs + 5 gaps
};

export const otpStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  
  // Floating decorative elements
  floatingDot: {
    position: 'absolute',
    backgroundColor: COLORS.accent,
  },
  floatingDot1: {
    top: screenHeight * 0.08,
    right: screenWidth * 0.85,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  floatingDot2: {
    top: screenHeight * 0.15,
    left: screenWidth * 0.1,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.accentSecondary,
  },
  floatingDot3: {
    bottom: screenHeight * 0.3,
    right: screenWidth * 0.15,
    width: 10,
    height: 10,
    borderRadius: 5,
    opacity: 0.6,
  },

  // Back button
  backButtonContainer: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backButtonText: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '600',
  },

  // Main content
  mainContent: {
    flex: 1,
    paddingHorizontal: SPACING.xxl,
    paddingTop: screenHeight * 0.06,
  },
  
  // Title section
  titleSection: {
    marginBottom: screenHeight * 0.08,
    alignItems: 'center',
  },
  logoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    paddingVertical: LOGO.containerPadding,
    paddingHorizontal: SPACING.huge,
    borderRadius: LOGO.borderRadius,
    marginBottom: SPACING.xxxl,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  logoContainer: {
    width: LOGO.iconSize,
    height: LOGO.iconSize,
    borderRadius: LOGO.iconRadius,
    marginRight: LOGO.textMargin,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  logoGradient: {
    width: LOGO.iconSize,
    height: LOGO.iconSize,
    borderRadius: LOGO.iconRadius,
    position: 'absolute',
  },
  logoShadow: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(26, 26, 26, 0.3)',
    top: 10,
    left: 10,
  },
  logoCenterDot: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    opacity: 0.9,
  },
  logoFlowCurve: {
    position: 'absolute',
    width: 32,
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 16,
  },
  logoFlowCurve1: {
    top: 16,
    left: 6,
    transform: [{ rotate: '45deg' }],
  },
  logoFlowCurve2: {
    bottom: 16,
    right: 6,
    transform: [{ rotate: '45deg' }],
  },
  logoText: {
    fontSize: TYPOGRAPHY.logoTextSize,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  title: {
    fontSize: TYPOGRAPHY.titleSize,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
    lineHeight: TYPOGRAPHY.titleLineHeight,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: TYPOGRAPHY.bodySize,
    color: COLORS.textSecondary,
    lineHeight: 24,
    maxWidth: screenWidth * 0.85,
    fontWeight: '400',
    textAlign: 'center',
  },
  phoneNumber: {
    fontSize: TYPOGRAPHY.bodySize,
    color: COLORS.accent,
    fontWeight: '600',
    marginTop: SPACING.sm,
  },

  // OTP input section
  otpSection: {
    marginBottom: SPACING.xxxl,
    alignItems: 'center',
  },
  otpLabel: {
    fontSize: TYPOGRAPHY.labelSize,
    fontWeight: '600',
    color: '#CCCCCC',
    marginBottom: SPACING.xl,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  
  // OTP input container
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
    gap: SPACING.md,
  },
  otpInput: {
    width: OTP.inputSize,
    height: OTP.inputSize,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 2,
    borderRadius: SPACING.lg,
    borderColor: COLORS.border,
    textAlign: 'center',
    fontSize: TYPOGRAPHY.otpSize,
    fontWeight: '700',
    color: COLORS.textPrimary,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  otpInputFocused: {
    borderColor: COLORS.borderFocused,
    backgroundColor: COLORS.inputBackground,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.borderFocused,
        shadowOpacity: 0.3,
      },
    }),
  },
  otpInputFilled: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.inputBackground,
  },
  otpInputError: {
    borderColor: COLORS.borderError,
    backgroundColor: COLORS.cardBackground,
  },

  // Timer and resend section
  timerSection: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  timerText: {
    fontSize: TYPOGRAPHY.labelSize,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  resendButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  resendButtonText: {
    fontSize: TYPOGRAPHY.labelSize,
    color: COLORS.accent,
    fontWeight: '600',
  },
  resendButtonDisabled: {
    opacity: 0.5,
  },

  // Error text
  errorText: {
    color: COLORS.error,
    fontSize: TYPOGRAPHY.labelSize,
    marginTop: SPACING.sm,
    textAlign: 'center',
    fontWeight: '500',
  },

  // Spacer
  spacer: {
    flex: 1,
  },

  // Button section
  buttonSection: {
    paddingBottom: SPACING.xxxl,
  },
  verifyButton: {
    borderRadius: SPACING.lg,
    paddingVertical: 18,
    paddingHorizontal: SPACING.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.border,
  },
  verifyButtonActive: {
    backgroundColor: COLORS.accent,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  verifyButtonLoading: {
    opacity: 0.8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingSpinner: {
    marginRight: SPACING.sm,
  },
  buttonText: {
    fontWeight: '700',
    fontSize: SPACING.lg,
    letterSpacing: 0.3,
  },
  buttonTextActive: {
    color: COLORS.background,
  },
  buttonTextInactive: {
    color: COLORS.textPlaceholder,
  },
  buttonTextLoading: {
    fontWeight: '700',
    fontSize: SPACING.lg,
    color: COLORS.background,
    letterSpacing: 0.3,
  },
  helperText: {
    fontSize: TYPOGRAPHY.smallSize,
    color: COLORS.textPlaceholder,
    textAlign: 'center',
    marginTop: SPACING.xl,
    lineHeight: 18,
    maxWidth: screenWidth * 0.8,
    alignSelf: 'center',
    fontWeight: '400',
  },
});