// styles/phoneStyles.ts
import { StyleSheet, Dimensions, Platform } from 'react-native';
import { scale, verticalScale, moderateScale } from 'react-native-size-matters';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Design System Constants with Responsive Scaling
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

export const RESPONSIVE_SPACING = {
  xs: scale(4),
  sm: scale(8),
  md: scale(12),
  lg: scale(16),
  xl: scale(20),
  xxl: scale(24),
  xxxl: scale(32),
  huge: scale(48),
};

export const RESPONSIVE_TYPOGRAPHY = {
  titleSize: moderateScale(36),
  titleLineHeight: moderateScale(42),
  logoTextSize: moderateScale(40),
  bodySize: moderateScale(16),
  labelSize: moderateScale(14),
  smallSize: moderateScale(12),
  buttonSize: moderateScale(16),
};

export const RESPONSIVE_LOGO = {
  containerPadding: RESPONSIVE_SPACING.xxxl,
  iconSize: scale(72),
  iconRadius: scale(36),
  textMargin: RESPONSIVE_SPACING.xxxl,
  borderRadius: scale(56),
};

export const phoneStyles = StyleSheet.create({
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
  
  // Scroll content styles
  scrollContent: {
    flexGrow: 1,
  },
  
  // Keyboard spacer
  keyboardSpacer: {
    height: verticalScale(100), // Extra space for keyboard
  },
  
  // Floating decorative elements with responsive positioning
  floatingDot: {
    position: 'absolute',
    backgroundColor: COLORS.accent,
  },
  floatingDot1: {
    top: screenHeight * 0.08,
    right: screenWidth * 0.85,
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
  },
  floatingDot2: {
    top: screenHeight * 0.15,
    left: screenWidth * 0.1,
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    backgroundColor: COLORS.accentSecondary,
  },
  floatingDot3: {
    bottom: screenHeight * 0.3,
    right: screenWidth * 0.15,
    width: scale(10),
    height: scale(10),
    borderRadius: scale(5),
    opacity: 0.6,
  },

  // Main content with responsive spacing
  mainContent: {
    flex: 1,
    paddingHorizontal: RESPONSIVE_SPACING.xxl,
    paddingTop: verticalScale(screenHeight * 0.12),
  },
  
  // Title section with responsive margins
  titleSection: {
    marginBottom: verticalScale(screenHeight * 0.08),
    alignItems: 'center',
  },
  logoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    paddingVertical: RESPONSIVE_LOGO.containerPadding,
    paddingHorizontal: RESPONSIVE_SPACING.huge,
    borderRadius: RESPONSIVE_LOGO.borderRadius,
    marginBottom: RESPONSIVE_SPACING.xxxl,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  logoContainer: {
    width: RESPONSIVE_LOGO.iconSize,
    height: RESPONSIVE_LOGO.iconSize,
    borderRadius: RESPONSIVE_LOGO.iconRadius,
    marginRight: RESPONSIVE_LOGO.textMargin,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  logoGradient: {
    width: RESPONSIVE_LOGO.iconSize,
    height: RESPONSIVE_LOGO.iconSize,
    borderRadius: RESPONSIVE_LOGO.iconRadius,
    position: 'absolute',
  },
  logoShadow: {
    position: 'absolute',
    width: scale(52),
    height: scale(52),
    borderRadius: scale(26),
    backgroundColor: 'rgba(26, 26, 26, 0.3)',
    top: scale(10),
    left: scale(10),
  },
  logoCenterDot: {
    position: 'absolute',
    width: scale(20),
    height: scale(20),
    borderRadius: scale(10),
    backgroundColor: COLORS.white,
    opacity: 0.9,
  },
  logoFlowCurve: {
    position: 'absolute',
    width: scale(32),
    height: scale(16),
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: scale(16),
  },
  logoFlowCurve1: {
    top: scale(16),
    left: scale(6),
    transform: [{ rotate: '45deg' }],
  },
  logoFlowCurve2: {
    bottom: scale(16),
    right: scale(6),
    transform: [{ rotate: '45deg' }],
  },
  logoText: {
    fontSize: RESPONSIVE_TYPOGRAPHY.logoTextSize,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 1,
  },
  title: {
    fontSize: RESPONSIVE_TYPOGRAPHY.titleSize,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: RESPONSIVE_SPACING.md,
    lineHeight: RESPONSIVE_TYPOGRAPHY.titleLineHeight,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: RESPONSIVE_TYPOGRAPHY.bodySize,
    color: COLORS.textSecondary,
    lineHeight: verticalScale(24),
    maxWidth: screenWidth * 0.85,
    fontWeight: '400',
    textAlign: 'center',
  },

  // Input section with responsive spacing
  inputSection: {
    marginBottom: RESPONSIVE_SPACING.xxxl,
  },
  inputLabel: {
    fontSize: RESPONSIVE_TYPOGRAPHY.labelSize,
    fontWeight: '600',
    color: '#CCCCCC',
    marginBottom: RESPONSIVE_SPACING.md,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  
  // User exists banner with responsive dimensions
  userExistsBanner: {
    backgroundColor: COLORS.cardBackground,
    borderColor: COLORS.accent,
    borderWidth: 1,
    borderRadius: RESPONSIVE_SPACING.lg,
    padding: RESPONSIVE_SPACING.xl,
    marginBottom: RESPONSIVE_SPACING.xl,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userExistsIcon: {
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: RESPONSIVE_SPACING.lg,
  },
  userExistsCheckmark: {
    color: COLORS.background,
    fontSize: RESPONSIVE_SPACING.lg,
    fontWeight: '700',
  },
  userExistsTextContainer: {
    flex: 1,
  },
  userExistsTitle: {
    fontSize: RESPONSIVE_SPACING.lg,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: scale(4),
  },
  userExistsSubtitle: {
    fontSize: RESPONSIVE_TYPOGRAPHY.labelSize,
    color: COLORS.textSecondary,
    lineHeight: verticalScale(20),
  },

  // Input card with responsive styling
  inputCard: {
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderRadius: RESPONSIVE_SPACING.lg,
    borderColor: COLORS.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: verticalScale(4) },
        shadowOpacity: 0.1,
        shadowRadius: scale(12),
      },
      android: {
        elevation: 8,
      },
    }),
  },
  inputCardFocused: {
    borderColor: COLORS.borderFocused,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.borderFocused,
        shadowOpacity: 0.3,
      },
    }),
  },
  inputCardError: {
    borderColor: COLORS.borderError,
  },
  inputRow: {
    flexDirection: 'row',
  },
  countryCodeContainer: {
    paddingHorizontal: scale(18),
    paddingVertical: verticalScale(18),
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBackground,
    borderTopLeftRadius: RESPONSIVE_SPACING.lg,
    borderBottomLeftRadius: RESPONSIVE_SPACING.lg,
  },
  flagEmoji: {
    fontSize: moderateScale(18),
    marginRight: RESPONSIVE_SPACING.sm,
  },
  countryCode: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: RESPONSIVE_SPACING.lg,
  },
  phoneInputContainer: {
    flex: 1,
  },
  phoneInput: {
    paddingHorizontal: scale(18),
    paddingVertical: verticalScale(18),
    fontSize: RESPONSIVE_SPACING.lg,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },

  // Error text with responsive styling
  errorText: {
    color: COLORS.error,
    fontSize: RESPONSIVE_TYPOGRAPHY.labelSize,
    marginTop: RESPONSIVE_SPACING.sm,
    marginLeft: scale(4),
    fontWeight: '500',
  },

  // Button section with responsive spacing
  buttonSection: {
    paddingBottom: RESPONSIVE_SPACING.xxxl,
  },
  continueButton: {
    borderRadius: RESPONSIVE_SPACING.lg,
    paddingVertical: verticalScale(18),
    paddingHorizontal: RESPONSIVE_SPACING.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.border,
  },
  continueButtonActive: {
    backgroundColor: COLORS.accent,
    ...Platform.select({
      ios: {
        shadowColor: COLORS.accent,
        shadowOffset: { width: 0, height: verticalScale(4) },
        shadowOpacity: 0.3,
        shadowRadius: scale(12),
      },
      android: {
        elevation: 8,
      },
    }),
  },
  continueButtonLoading: {
    opacity: 0.8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingSpinner: {
    marginRight: RESPONSIVE_SPACING.sm,
  },
  buttonText: {
    fontWeight: '700',
    fontSize: RESPONSIVE_SPACING.lg,
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
    fontSize: RESPONSIVE_SPACING.lg,
    color: COLORS.background,
    letterSpacing: 0.3,
  },
  helperText: {
    fontSize: RESPONSIVE_TYPOGRAPHY.smallSize,
    color: COLORS.textPlaceholder,
    textAlign: 'center',
    marginTop: RESPONSIVE_SPACING.xl,
    lineHeight: verticalScale(18),
    maxWidth: screenWidth * 0.8,
    alignSelf: 'center',
    fontWeight: '400',
  },
});