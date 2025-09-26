// components/onboarding/CompletionStep.tsx
import React, { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWorkerOnboarding } from '../../hooks/useWorkerOnboarding';
import { COLORS, SPACING, SHADOWS } from '../../constants/design';

interface CompletionStepProps {
  onNext: () => void;
  onBack: () => void;
}

export const CompletionStep = ({ onNext, onBack }: CompletionStepProps) => {
  const { completeOnboarding, loading, error, progress } = useWorkerOnboarding();
  
  
  const handleComplete = useCallback(async () => {
    
    try {
      await completeOnboarding();
      onNext();
    } catch (err) {
    }
    
  }, [completeOnboarding, onNext]);
  
  const completionItems = [
    {
      icon: 'camera' as const,
      title: 'Verification Photo',
      description: 'Identity verification and profile photo uploaded',
      completed: !!progress?.selfie_url,
    },
    {
      icon: 'document' as const,
      title: 'ID Documents',
      description: 'Government-issued identification verified',
      completed: (progress?.documents?.length || 0) > 0,
    },
    {
      icon: 'list' as const,
      title: 'Service Categories',
      description: 'Selected areas of expertise and experience levels',
      completed: (progress?.selected_skills?.length || 0) > 0,
    },
    {
      icon: 'folder' as const,
      title: 'Profile Setup',
      description: 'Worker profile ready for review',
      completed: true,
    },
  ];
  

  
  const allCompleted = completionItems.every(item => item.completed);
  
  // Debug the specific issue with selected_skills
  
  // Additional debug for documents
  
  
  return (
    <View style={styles.stepContainer}>
      <View style={styles.stepContent}>
        <View style={styles.stepHeader}>
          <View style={styles.stepIcon}>
            <Ionicons 
              name={allCompleted ? "checkmark-circle-outline" : "hourglass-outline"} 
              size={32} 
              color={allCompleted ? COLORS.success : COLORS.primary} 
            />
          </View>
          <Text style={styles.stepTitle}>
            {allCompleted ? 'Ready for Review!' : 'Complete Your Profile'}
          </Text>
          <Text style={styles.stepSubtitle}>
            {allCompleted 
              ? 'Your worker profile is complete and ready for admin review'
              : 'Please complete all required steps before submitting'
            }
          </Text>
        </View>
        
        {/* Completion Checklist */}
        <View style={styles.completionContent}>
          <Text style={styles.checklistTitle}>Profile Completion Checklist:</Text>
          {completionItems.map((item, index) => (
            <View key={index} style={styles.completionItem}>
              <View style={[
                styles.completionIcon,
                item.completed && styles.completionIconCompleted
              ]}>
                {item.completed ? (
                  <Ionicons name="checkmark" size={16} color={COLORS.white} />
                ) : (
                  <Ionicons name={item.icon} size={16} color={COLORS.gray400} />
                )}
              </View>
              <View style={styles.completionText}>
                <Text style={[
                  styles.completionTitle,
                  item.completed && styles.completionTitleCompleted
                ]}>
                  {item.title}
                </Text>
                <Text style={[
                  styles.completionDescription,
                  item.completed && styles.completionDescriptionCompleted
                ]}>
                  {item.description}
                </Text>
              </View>
              {item.completed && (
                <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
              )}
            </View>
          ))}
        </View>
        
        {/* Review Process Information */}
        {allCompleted && (
          <View style={styles.reviewNotice}>
            <View style={styles.reviewHeader}>
              <Ionicons name="time-outline" size={20} color={COLORS.warning} />
              <Text style={styles.reviewTitle}>What happens next?</Text>
            </View>
            <View style={styles.reviewSteps}>
              <View style={styles.reviewStep}>
                <View style={styles.reviewStepNumber}>
                  <Text style={styles.reviewStepNumberText}>1</Text>
                </View>
                <Text style={styles.reviewStepText}>
                  Your application will be reviewed by our verification team
                </Text>
              </View>
              <View style={styles.reviewStep}>
                <View style={styles.reviewStepNumber}>
                  <Text style={styles.reviewStepNumberText}>2</Text>
                </View>
                <Text style={styles.reviewStepText}>
                  You'll receive a notification within 24-48 hours
                </Text>
              </View>
              <View style={styles.reviewStep}>
                <View style={styles.reviewStepNumber}>
                  <Text style={styles.reviewStepNumberText}>3</Text>
                </View>
                <Text style={styles.reviewStepText}>
                  Once approved, you can start receiving job opportunities
                </Text>
              </View>
            </View>
          </View>
        )}
        
        {/* Error Display */}
        {error && (
          <View style={styles.errorCard}>
            <Ionicons name="warning-outline" size={16} color={COLORS.error} />
            <Text style={styles.errorText}>{error.message}</Text>
          </View>
        )}
      </View>
      
      <View style={styles.stepActions}>
        {allCompleted ? (
          <Pressable
            onPress={handleComplete}
            style={styles.primaryButton}
            disabled={loading.completing}
          >
            {loading.completing ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={COLORS.white} />
                <Text style={styles.loadingText}>Submitting...</Text>
              </View>
            ) : (
              <View style={styles.buttonContent}>
                <Ionicons name="paper-plane" size={20} color={COLORS.white} />
                <Text style={styles.primaryButtonText}>Submit for Review</Text>
              </View>
            )}
          </Pressable>
        ) : (
          <View style={styles.incompleteNotice}>
            <Ionicons name="information-circle-outline" size={20} color={COLORS.gray500} />
            <Text style={styles.incompleteText}>
              Complete all steps above to submit your application
            </Text>
          </View>
        )}
        
        <Pressable onPress={onBack} style={styles.textButton}>
          <Text style={styles.textButtonText}>Back</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Step Container
  stepContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  
  stepContent: {
    flex: 1,
  },
  
  stepHeader: {
    alignItems: 'center',
    marginTop: SPACING.xxl,
    marginBottom: SPACING.xl,
  },
  
  stepIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: COLORS.gray50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  
  stepTitle: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 32,
    color: COLORS.gray900,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  
  stepSubtitle: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
    color: COLORS.gray600,
    textAlign: 'center',
  },
  
  // Completion Checklist
  completionContent: {
    backgroundColor: COLORS.gray50,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  
  checklistTitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    color: COLORS.gray900,
    marginBottom: SPACING.md,
  },
  
  completionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  
  completionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.gray200,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  
  completionIconCompleted: {
    backgroundColor: COLORS.success,
  },
  
  completionText: {
    flex: 1,
  },
  
  completionTitle: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    color: COLORS.gray700,
    marginBottom: SPACING.xs,
  },
  
  completionTitleCompleted: {
    color: COLORS.gray900,
  },
  
  completionDescription: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: COLORS.gray500,
  },
  
  completionDescriptionCompleted: {
    color: COLORS.gray600,
  },
  
  // Review Process
  reviewNotice: {
    backgroundColor: `${COLORS.warning}10`,
    borderRadius: 12,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: `${COLORS.warning}30`,
    marginBottom: SPACING.lg,
  },
  
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  
  reviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
    color: COLORS.gray900,
    marginLeft: SPACING.sm,
  },
  
  reviewSteps: {
    gap: SPACING.md,
  },
  
  reviewStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  
  reviewStepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.warning,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  
  reviewStepNumberText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    color: COLORS.white,
  },
  
  reviewStepText: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: COLORS.gray700,
    flex: 1,
  },
  
  // Actions
  stepActions: {
    marginTop: SPACING.xl,
    gap: SPACING.md,
  },
  
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    ...SHADOWS.sm,
  },
  
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    color: COLORS.white,
    marginLeft: SPACING.sm,
  },
  
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    color: COLORS.white,
    marginLeft: SPACING.sm,
  },
  
  incompleteNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gray50,
    borderRadius: 12,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  
  incompleteText: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: COLORS.gray500,
    marginLeft: SPACING.sm,
  },
  
  textButton: {
    alignItems: 'center',
    padding: SPACING.sm,
  },
  
  textButtonText: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: COLORS.gray500,
  },
  
  // Error
  errorCard: {
    backgroundColor: `${COLORS.error}15`,
    borderRadius: 12,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${COLORS.error}30`,
    marginTop: SPACING.md,
  },
  
  errorText: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: COLORS.error,
    marginLeft: SPACING.sm,
    flex: 1,
  },
});