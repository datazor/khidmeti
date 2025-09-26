// components/worker/BiddingInput.tsx - Clean professional bid input with real-time validation
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Id } from '../../convex/_generated/dataModel';

// Design System
const COLORS = {
  primary: '#2563eb',
  success: '#10b981',
  error: '#ef4444',
  white: '#ffffff',
  gray50: '#f8fafc',
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
};

interface BidValidationResult {
  isValid: boolean;
  minimumAmount: number;
  reason?: string;
}

interface BiddingInputProps {
  subcategoryId: Id<'categories'>;
  priceFloor: number;
  onBidSubmit: (amount: number, equipmentCost: number) => Promise<void>;
  validationResult?: BidValidationResult | null;
  isSubmitting?: boolean;
  isValidating?: boolean;
  isRTL?: boolean;
  disabled?: boolean;
}

export const BiddingInput: React.FC<BiddingInputProps> = ({
  subcategoryId,
  priceFloor,
  onBidSubmit,
  validationResult,
  isSubmitting = false,
  isValidating = false,
  isRTL = false,
  disabled = false,
}) => {
  const [bidAmount, setBidAmount] = useState('');
  const [equipmentCost, setEquipmentCost] = useState('');
  
  const borderColorAnim = useSharedValue(0);
  const submitButtonScale = useSharedValue(1);

  const bidValue = useMemo(() => parseFloat(bidAmount) || 0, [bidAmount]);
  const equipmentValue = useMemo(() => parseFloat(equipmentCost) || 0, [equipmentCost]);
  const totalBid = useMemo(() => bidValue + equipmentValue, [bidValue, equipmentValue]);

  const canSubmit = useMemo(() => {
    return !disabled && 
           !isSubmitting && 
           bidValue > 0 && 
           bidValue >= priceFloor &&
           (!validationResult || validationResult.isValid);
  }, [disabled, isSubmitting, bidValue, priceFloor, validationResult]);

  // Update border animation based on validation
  useEffect(() => {
    if (validationResult && bidValue > 0) {
      borderColorAnim.value = withSpring(validationResult.isValid ? 1 : -1, { damping: 15 });
    } else {
      borderColorAnim.value = withSpring(0, { damping: 15 });
    }
  }, [validationResult, bidValue, borderColorAnim]);

  const bidInputAnimatedStyle = useAnimatedStyle(() => {
    const borderColor = interpolateColor(
      borderColorAnim.value,
      [-1, 0, 1],
      [COLORS.error, COLORS.gray200, COLORS.success]
    );
    return { borderColor };
  });

  const submitButtonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: submitButtonScale.value }],
  }));

  const handleBidAmountChange = useCallback((text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length <= 2) {
      setBidAmount(cleaned);
    }
  }, []);

  const handleEquipmentCostChange = useCallback((text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length <= 2) {
      setEquipmentCost(cleaned);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    submitButtonScale.value = withSpring(0.95, { damping: 15 }, () => {
      submitButtonScale.value = withSpring(1, { damping: 15 });
    });

    try {
      await onBidSubmit(bidValue, equipmentValue);
    } catch (error) {
      console.error('Bid submission failed:', error);
    }
  }, [canSubmit, onBidSubmit, bidValue, equipmentValue, submitButtonScale]);

  return (
    <View style={[styles.container, disabled && styles.containerDisabled]}>
      {/* Bid Amount Input */}
      <View style={styles.inputGroup}>
        <Text style={[styles.label, isRTL && styles.labelRTL]}>
          Base Bid Amount
        </Text>
        <Animated.View style={[styles.inputContainer, bidInputAnimatedStyle]}>
          <View style={styles.currencyPrefix}>
            <Text style={styles.currencyText}>MRU</Text>
          </View>
          <TextInput
            style={[styles.input, isRTL && styles.inputRTL]}
            value={bidAmount}
            onChangeText={handleBidAmountChange}
            placeholder="0.00"
            placeholderTextColor={COLORS.gray400}
            keyboardType="decimal-pad"
            returnKeyType="next"
            editable={!disabled && !isSubmitting}
            selectTextOnFocus
          />
          {isValidating && (
            <View style={styles.validationSpinner}>
              <ActivityIndicator size="small" color={COLORS.gray400} />
            </View>
          )}
        </Animated.View>
        <Text style={[styles.helperText, isRTL && styles.helperTextRTL]}>
          Minimum: {priceFloor.toFixed(2)} MRU
        </Text>
      </View>

      {/* Equipment Cost Input */}
      <View style={styles.inputGroup}>
        <Text style={[styles.label, isRTL && styles.labelRTL]}>
          Equipment Cost <Text style={styles.optionalText}>(Optional)</Text>
        </Text>
        <View style={styles.inputContainer}>
          <View style={styles.currencyPrefix}>
            <Text style={styles.currencyText}>MRU</Text>
          </View>
          <TextInput
            style={[styles.input, isRTL && styles.inputRTL]}
            value={equipmentCost}
            onChangeText={handleEquipmentCostChange}
            placeholder="0.00"
            placeholderTextColor={COLORS.gray400}
            keyboardType="decimal-pad"
            returnKeyType="done"
            editable={!disabled && !isSubmitting}
            selectTextOnFocus
          />
        </View>
        <Text style={[styles.helperText, isRTL && styles.helperTextRTL]}>
          Materials, tools, etc.
        </Text>
      </View>

      {/* Validation Message */}
      {validationResult && bidValue > 0 && (
        <View style={styles.validationMessage}>
          <Ionicons 
            name={validationResult.isValid ? "checkmark-circle" : "alert-circle"} 
            size={14} 
            color={validationResult.isValid ? COLORS.success : COLORS.error} 
          />
          <Text style={[
            styles.validationText,
            { color: validationResult.isValid ? COLORS.success : COLORS.error }
          ]}>
            {validationResult.isValid 
              ? "✓ Valid bid amount" 
              : validationResult.reason || "Invalid bid amount"
            }
          </Text>
        </View>
      )}

      {/* Bid Summary */}
      {totalBid > 0 && (
        <View style={styles.summaryContainer}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Base Bid:</Text>
            <Text style={styles.summaryValue}>{bidValue.toFixed(2)} MRU</Text>
          </View>
          {equipmentValue > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Equipment:</Text>
              <Text style={styles.summaryValue}>{equipmentValue.toFixed(2)} MRU</Text>
            </View>
          )}
          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <Text style={styles.summaryTotalLabel}>Total Bid:</Text>
            <Text style={styles.summaryTotalValue}>{totalBid.toFixed(2)} MRU</Text>
          </View>
        </View>
      )}

      {/* Submit Button */}
      <Animated.View style={submitButtonAnimatedStyle}>
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.submitButton,
            !canSubmit && styles.submitButtonDisabled,
            pressed && styles.submitButtonPressed,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.submitButtonText}>Submit Bid</Text>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: SPACING.lg,
  } as ViewStyle,

  containerDisabled: {
    opacity: 0.6,
  } as ViewStyle,

  inputGroup: {
    gap: SPACING.xs,
  } as ViewStyle,

  label: {
    ...TYPOGRAPHY.body,
    color: COLORS.gray700,
    fontWeight: '600',
  } as TextStyle,

  labelRTL: {
    textAlign: 'right',
  } as TextStyle,

  optionalText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray500,
    fontWeight: '400',
  } as TextStyle,

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.gray200,
    minHeight: 48,
    ...SHADOWS.sm,
  } as ViewStyle,

  currencyPrefix: {
    paddingHorizontal: SPACING.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: COLORS.gray200,
  } as ViewStyle,

  currencyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.gray600,
    fontWeight: '600',
  } as TextStyle,

  input: {
    flex: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    ...TYPOGRAPHY.body,
    color: COLORS.gray900,
    fontWeight: '500',
  } as TextStyle,

  inputRTL: {
    textAlign: 'right',
  } as TextStyle,

  validationSpinner: {
    paddingHorizontal: SPACING.md,
  } as ViewStyle,

  helperText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.gray500,
    paddingHorizontal: SPACING.xs,
  } as TextStyle,

  helperTextRTL: {
    textAlign: 'right',
  } as TextStyle,

  validationMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.xs,
  } as ViewStyle,

  validationText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '500',
  } as TextStyle,

  summaryContainer: {
    backgroundColor: COLORS.gray50,
    borderRadius: 12,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  } as ViewStyle,

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  } as ViewStyle,

  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: COLORS.gray300,
    marginTop: SPACING.xs,
    paddingTop: SPACING.sm,
  } as ViewStyle,

  summaryLabel: {
    ...TYPOGRAPHY.body,
    color: COLORS.gray600,
  } as TextStyle,

  summaryValue: {
    ...TYPOGRAPHY.body,
    color: COLORS.gray800,
    fontWeight: '500',
  } as TextStyle,

  summaryTotalLabel: {
    ...TYPOGRAPHY.title,
    color: COLORS.gray800,
  } as TextStyle,

  summaryTotalValue: {
    ...TYPOGRAPHY.title,
    color: COLORS.primary,
    fontWeight: '700',
  } as TextStyle,

  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    ...SHADOWS.md,
  } as ViewStyle,

  submitButtonDisabled: {
    backgroundColor: COLORS.gray300,
    ...SHADOWS.sm,
  } as ViewStyle,

  submitButtonPressed: {
    opacity: 0.8,
  } as ViewStyle,

  submitButtonText: {
    ...TYPOGRAPHY.title,
    color: COLORS.white,
    fontWeight: '600',
  } as TextStyle,
});
