// components/onboarding/StepIndicator.tsx
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { COLORS, SPACING } from '../../constants/design';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export const StepIndicator = ({ currentStep, totalSteps }: StepIndicatorProps) => {
  const progressAnim = useSharedValue(0);
  
  useEffect(() => {
    progressAnim.value = withTiming((currentStep - 1) / (totalSteps - 1), { duration: 500 });
  }, [currentStep, totalSteps]);
  
  const progressStyle = useAnimatedStyle(() => ({
    width: `${interpolate(progressAnim.value, [0, 1], [0, 100])}%`,
  }));
  
  return (
    <View style={styles.stepIndicator}>
      <View style={styles.stepIndicatorTrack}>
        <Animated.View style={[styles.stepIndicatorProgress, progressStyle]} />
      </View>
      <Text style={styles.stepIndicatorText}>
        Step {currentStep} of {totalSteps}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  stepIndicator: {
    alignItems: 'center',
  },
  
  stepIndicatorTrack: {
    width: '100%',
    height: 4,
    backgroundColor: COLORS.gray200,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  
  stepIndicatorProgress: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  
  stepIndicatorText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    color: COLORS.gray600,
  },
});