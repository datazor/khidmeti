// app/(auth)/worker-onboarding.tsx
import React, { useCallback, useEffect } from 'react';
import {
  View,
  useWindowDimensions,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useWorkerOnboarding } from '../../hooks/useWorkerOnboarding';
import { useAuth } from '../../hooks/useAuth';
import { useLocalization } from '@/constants/localization';
import { SelfieStep } from '@/components/onboarding/SelfieStep';
import { DocumentStep } from '@/components/onboarding/DocumentStep';
import { AdditionalFilesStep } from '@/components/onboarding/AdditionalFilesStep';
import { CategoryStep } from '@/components/onboarding/CategoryStep';
import { CompletionStep } from '@/components/onboarding/CompletionStep';
import { StepIndicator } from '@/components/onboarding/StepIndicator';
import { SPACING, COLORS } from '@/styles/otpStyles';

export default function WorkerOnboardingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLocalization();
  const { width } = useWindowDimensions();
  const {
    currentStep,
    isOnboardingComplete,
    progress,
    initializeOnboarding,
    updateCurrentStep,
    loading,
    error
  } = useWorkerOnboarding();
  

  
  const isSmallScreen = width < 375;
  const containerPadding = isSmallScreen ? SPACING.lg : SPACING.xl;
  
  // Initialize onboarding when component mounts
  useEffect(() => {

    
    if (user?.user_type === 'worker' && progress?.onboarding_status === 'not_started') {
      initializeOnboarding();
    } else {
    }
  }, [user, progress, initializeOnboarding]);
  
  // Handle completion
  useEffect(() => {

    
    if (isOnboardingComplete) {
      router.replace('/(app)/worker');
    }
  }, [isOnboardingComplete, router]);
  
  const handleNext = useCallback(async () => {
    console.log('🔄 handleNext called - currentStep:', currentStep);
    
    // Advance to next step
    const nextStep = currentStep + 1;
    await updateCurrentStep(nextStep);
    
    console.log('✅ Advanced to step:', nextStep);
  }, [currentStep, updateCurrentStep]);
  
  const handleBack = useCallback(async () => {

    
    if (currentStep === 1) {
      router.back();
    } else {
      const prevStep = Math.max(currentStep - 1, 1);
      await updateCurrentStep(prevStep);
    }
  }, [currentStep, updateCurrentStep, router]);
  
  const renderStep = () => {

    
    switch (currentStep) {
      case 1:
        return <SelfieStep onNext={handleNext} onBack={handleBack} />;
      case 2:
        return <DocumentStep onNext={handleNext} onBack={handleBack} />;
      case 3:
        return <CategoryStep onNext={handleNext} onBack={handleBack} />;
      case 4:
        return <AdditionalFilesStep onNext={handleNext} onBack={handleBack} />;
      case 5:
        return <CompletionStep onNext={handleNext} onBack={handleBack} />;
      default:
        return <SelfieStep onNext={handleNext} onBack={handleBack} />;
    }
  };
  
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { paddingHorizontal: containerPadding }]}>
        <StepIndicator currentStep={currentStep} totalSteps={5} />
      </View>
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { padding: containerPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {renderStep()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  
  header: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.textSecondary,
  },
  
  scrollView: {
    flex: 1,
  },
  
  scrollContent: {
    flexGrow: 1,
  },
});
