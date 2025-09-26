

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useWorkerOnboarding } from '../../hooks/useWorkerOnboarding';

interface RejectionIssue {
  step: 'selfie' | 'documents' | 'categories' | 'additional_files';
  title: string;
  reason: string;
  canEdit: boolean;
}

export default function PendingApprovalScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { 
    progress, 
    resetOnboarding, 
    updateCurrentStep, 
    resetOnboardingCompletely,
    loading 
  } = useWorkerOnboarding();

  const approvalStatus = user?.approval_status || 'pending';
  const rejectionReason = (user as any)?.rejection_reason;

  // Auto-route approved workers to worker screen
  React.useEffect(() => {
    if (approvalStatus === 'approved') {
      router.replace('/(app)/worker');
    }
  }, [approvalStatus, router]);
  
  // Parse rejection issues if available
  const rejectionIssues: RejectionIssue[] = React.useMemo(() => {
    if (approvalStatus !== 'rejected' || !rejectionReason) return [];
    
    try {
      // Try to parse structured rejection data
      const parsed = JSON.parse(rejectionReason);
      if (Array.isArray(parsed.issues)) {
        return parsed.issues;
      }
    } catch {
      // If parsing fails, treat as general rejection
      return [{
        step: 'selfie' as const,
        title: 'Application Issues',
        reason: rejectionReason,
        canEdit: true
      }];
    }
    return [];
  }, [approvalStatus, rejectionReason]);

  const handleEditSpecificStep = (step: string) => {
    Alert.alert(
      'Edit Application Step',
      `You'll be taken to the ${step} step to make corrections.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Edit',
          onPress: async () => {
            // Determine step number based on step name
            const stepNumber = getStepNumber(step);
            
            // Set the current step and navigate
            await updateCurrentStep(stepNumber);
            router.push('/(auth)/worker-onboarding');
          },
        },
      ]
    );
  };

  const handleEditFullApplication = () => {
    Alert.alert(
      'Edit Full Application',
      'This will clear all your uploaded files and restart the application process from the beginning. Are you sure?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Start Over',
          style: 'destructive',
          onPress: async () => {
            
            try {
              // 1. Reset local onboarding state (clears files, categories, etc.)
              resetOnboarding();
              
              // 2. Reset backend step and status
              await updateCurrentStep(1);
              
              // 3. Reset onboarding completely (backend + local)
              await resetOnboardingCompletely();
              
              router.push('/(auth)/worker-onboarding');
              
            } catch (error) {
              Alert.alert(
                'Reset Failed', 
                'There was an error resetting your application. Please try again.',
                [{ text: 'OK' }]
              );
            }
          },
        },
      ]
    );
  };

  const getStepNumber = (stepName: string): number => {
    switch (stepName) {
      case 'selfie': return 1;
      case 'documents': return 2;
      case 'categories': return 3;
      case 'additional_files': return 4;
      default: return 1;
    }
  };

  const handleContactSupport = () => {
    Alert.alert(
      'Contact Support',
      'Need help? You can reach out to our support team.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Email Support',
          onPress: () => {
            // Implement email support
          },
        },
        {
          text: 'Live Chat',
          onPress: () => {
            // Implement live chat
          },
        },
      ]
    );
  };

  const getStatusConfig = () => {
    switch (approvalStatus) {
      case 'pending':
        return {
          icon: 'time-outline',
          iconColor: '#FF9500',
          title: 'Application Under Review',
          subtitle: 'We\'re reviewing your application',
          description: 'Our team is currently reviewing your submitted documents and information. This process typically takes 1-3 business days.',
        };
      case 'rejected':
        return {
          icon: 'close-circle-outline',
          iconColor: '#FF3B30',
          title: 'Application Needs Updates',
          subtitle: 'Some information needs to be corrected',
          description: 'Please review the issues below and update your application accordingly.',
        };
      case 'approved':
        return {
          icon: 'checkmark-circle-outline',
          iconColor: '#34C759',
          title: 'Application Approved!',
          subtitle: 'Welcome to the platform',
          description: 'Your application has been approved. You can now start offering your services.',
        };
      default:
        return {
          icon: 'help-circle-outline',
          iconColor: '#8E8E93',
          title: 'Status Unknown',
          subtitle: 'Checking your application status',
          description: 'Please contact support if this persists.',
        };
    }
  };

  const statusConfig = getStatusConfig();

  const getStepIcon = (step: string) => {
    switch (step) {
      case 'selfie': return 'camera-outline';
      case 'documents': return 'document-text-outline';
      case 'categories': return 'list-outline';
      case 'additional_files': return 'folder-open-outline';
      default: return 'alert-circle-outline';
    }
  };

  const getStepTitle = (step: string) => {
    switch (step) {
      case 'selfie': return 'Profile Photo';
      case 'documents': return 'ID Documents';
      case 'categories': return 'Service Categories';
      case 'additional_files': return 'Additional Files';
      default: return 'Unknown Step';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color="#333" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Application Status</Text>
        </View>

        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={[styles.statusIcon, { backgroundColor: `${statusConfig.iconColor}20` }]}>
            <Ionicons
              name={statusConfig.icon as any}
              size={48}
              color={statusConfig.iconColor}
            />
          </View>

          <Text style={styles.statusTitle}>{statusConfig.title}</Text>
          <Text style={styles.statusSubtitle}>{statusConfig.subtitle}</Text>
          <Text style={styles.statusDescription}>{statusConfig.description}</Text>
        </View>

        {/* Rejection Issues */}
        {approvalStatus === 'rejected' && rejectionIssues.length > 0 && (
          <View style={styles.issuesCard}>
            <Text style={styles.issuesTitle}>Issues to Address</Text>
            
            {rejectionIssues.map((issue, index) => (
              <View key={index} style={styles.issueItem}>
                <View style={styles.issueHeader}>
                  <View style={styles.issueIconContainer}>
                    <Ionicons 
                      name={getStepIcon(issue.step) as any} 
                      size={20} 
                      color="#FF3B30" 
                    />
                  </View>
                  <View style={styles.issueContent}>
                    <Text style={styles.issueStepTitle}>{getStepTitle(issue.step)}</Text>
                    <Text style={styles.issueReason}>{issue.reason}</Text>
                  </View>
                </View>
                
                {issue.canEdit && (
                  <TouchableOpacity
                    style={styles.editStepButton}
                    onPress={() => handleEditSpecificStep(issue.step)}
                  >
                    <Text style={styles.editStepButtonText}>Fix This</Text>
                    <Ionicons name="chevron-forward" size={16} color="#007AFF" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Timeline */}
        <View style={styles.timelineCard}>
          <Text style={styles.timelineTitle}>Review Process</Text>
          
          <View style={styles.timelineItem}>
            <View style={[styles.timelineIcon, styles.timelineIconComplete]}>
              <Ionicons name="checkmark" size={16} color="#fff" />
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineStepTitle}>Application Submitted</Text>
              <Text style={styles.timelineStepDescription}>
                Your application has been received
              </Text>
            </View>
          </View>

          <View style={styles.timelineItem}>
            <View style={[
              styles.timelineIcon,
              approvalStatus === 'pending' ? styles.timelineIconActive : 
              approvalStatus === 'rejected' ? styles.timelineIconError : styles.timelineIconComplete
            ]}>
              {approvalStatus === 'pending' ? (
                <View style={styles.pulsingDot} />
              ) : approvalStatus === 'rejected' ? (
                <Ionicons name="close" size={16} color="#fff" />
              ) : (
                <Ionicons name="checkmark" size={16} color="#fff" />
              )}
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineStepTitle}>Document Review</Text>
              <Text style={styles.timelineStepDescription}>
                {approvalStatus === 'pending' 
                  ? 'Verifying your documents and information'
                  : approvalStatus === 'rejected'
                  ? 'Issues found - corrections needed'
                  : 'Document verification completed'
                }
              </Text>
            </View>
          </View>

          <View style={styles.timelineItem}>
            <View style={[
              styles.timelineIcon,
              approvalStatus === 'approved' ? styles.timelineIconComplete : styles.timelineIconPending
            ]}>
              {approvalStatus === 'approved' ? (
                <Ionicons name="checkmark" size={16} color="#fff" />
              ) : (
                <View style={styles.timelineIconDot} />
              )}
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineStepTitle}>Final Approval</Text>
              <Text style={styles.timelineStepDescription}>
                {approvalStatus === 'approved' 
                  ? 'Welcome to the platform!'
                  : 'Pending final review'
                }
              </Text>
            </View>
          </View>
        </View>

        {/* Information Cards */}
        {approvalStatus === 'pending' && (
          <View style={styles.infoCards}>
            <View style={styles.infoCard}>
              <Ionicons name="time-outline" size={24} color="#007AFF" />
              <View style={styles.infoCardContent}>
                <Text style={styles.infoCardTitle}>Expected Timeline</Text>
                <Text style={styles.infoCardDescription}>
                  Reviews typically take 1-3 business days
                </Text>
              </View>
            </View>

            <View style={styles.infoCard}>
              <Ionicons name="shield-checkmark-outline" size={24} color="#34C759" />
              <View style={styles.infoCardContent}>
                <Text style={styles.infoCardTitle}>Quality Assurance</Text>
                <Text style={styles.infoCardDescription}>
                  We verify all workers to ensure platform quality
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Tips for Approved Users */}
        {approvalStatus === 'approved' && (
          <View style={styles.tipsCard}>
            <Text style={styles.tipsTitle}>Next Steps</Text>
            <View style={styles.tipItem}>
              <Ionicons name="checkmark-circle" size={20} color="#34C759" />
              <Text style={styles.tipText}>Complete your profile with additional details</Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="checkmark-circle" size={20} color="#34C759" />
              <Text style={styles.tipText}>Set your availability and pricing</Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="checkmark-circle" size={20} color="#34C759" />
              <Text style={styles.tipText}>Start receiving job requests</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        {approvalStatus === 'rejected' && (
          <TouchableOpacity
            style={[
              styles.primaryButton, 
              loading.resetting && styles.buttonDisabled
            ]}
            onPress={handleEditFullApplication}
            activeOpacity={0.8}
            disabled={loading.resetting}
          >
            {loading.resetting ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.primaryButtonText}>Resetting...</Text>
              </View>
            ) : (
              <Text style={styles.primaryButtonText}>Review Full Application</Text>
            )}
          </TouchableOpacity>
        )}

        {approvalStatus === 'approved' && (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace('/(app)/worker')}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleContactSupport}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>Contact Support</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    marginRight: 16,
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statusIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  statusSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  statusDescription: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
  issuesCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#FF3B30',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  issuesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF3B30',
    marginBottom: 16,
  },
  issueItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  issueHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  issueIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF3B3020',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  issueContent: {
    flex: 1,
  },
  issueStepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  issueReason: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  editStepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF20',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  editStepButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginRight: 4,
  },
  timelineCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  timelineTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 20,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  timelineIconComplete: {
    backgroundColor: '#34C759',
  },
  timelineIconActive: {
    backgroundColor: '#007AFF',
  },
  timelineIconError: {
    backgroundColor: '#FF3B30',
  },
  timelineIconPending: {
    backgroundColor: '#E0E0E0',
  },
  timelineIconDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#999',
  },
  pulsingDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  timelineContent: {
    flex: 1,
  },
  timelineStepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  timelineStepDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  infoCards: {
    marginBottom: 24,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoCardContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  infoCardDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  tipsCard: {
    backgroundColor: '#34C75920',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#34C75930',
  },
  tipsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  actionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 20,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButton: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  buttonDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.6,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});