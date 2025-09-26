// app/index.tsx
import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useWorkerOnboarding } from '@/hooks/useWorkerOnboarding';

export default function IndexScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { progress } = useWorkerOnboarding();

  useEffect(() => {


    // Only route when auth is fully initialized
    if (auth.isInitialized && !auth.isLoading) {
      if (!auth.isAuthenticated) {
        router.replace('/(auth)/phone');
      } else if (auth.user?.user_type === 'customer') {
        router.replace('/(app)/customer');
      } else if (auth.user?.user_type === 'worker') {
        
        // Wait for progress to load before making routing decisions
        if (progress === undefined) {
          return; // Don't route yet, wait for progress to load
        }
        

        
        // Check onboarding status
        if (progress?.onboarding_status === 'not_started' || 
            progress?.onboarding_status === 'selfie_completed' || 
            progress?.onboarding_status === 'documents_completed' || 
            progress?.onboarding_status === 'categories_completed' || 
            progress?.onboarding_status === 'additional_files_completed') {
          router.replace('/(auth)/worker-onboarding');
        } else if (progress?.onboarding_status === 'completed') {
          // Check approval status
          const approvalStatus = (auth.user as any)?.approval_status;
          
          if (approvalStatus === 'pending' || approvalStatus === 'rejected') {
            router.replace('/(auth)/pending-approval');
          } else if (approvalStatus === 'approved') {
            router.replace('/(app)/worker');
          } else {
            router.replace('/(auth)/pending-approval');
          }
        } else {
          router.replace('/(auth)/worker-onboarding');
        }
      } 
    } 
  }, [
    auth.isInitialized, 
    auth.isLoading, 
    auth.isAuthenticated, 
    auth.user?.user_type,
    progress?.onboarding_status,
    (auth.user as any)?.approval_status,
    router
  ]);

  // Show loading while determining where to route
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>K</Text>
        </View>
        <Text style={styles.appName}>Khidma</Text>
        <Text style={styles.tagline}>Your Service Connection</Text>
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 28,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  logoText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#ffffff',
  },
  appName: {
    fontSize: 40,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 48,
  },
  loadingContainer: {
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
  },
});