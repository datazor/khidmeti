// app/(app)/_layout.tsx - Replace with this version:
import { Stack, Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useWorkerOnboarding } from '@/hooks/useWorkerOnboarding';
import { ActivityIndicator, View } from 'react-native';

export default function AppLayout() {
  const auth = useAuth();
  const { progress } = useWorkerOnboarding();

  // Show loading while checking authentication
  if (!auth.isInitialized || auth.isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // Redirect to auth if not authenticated
  if (!auth.isAuthenticated || !auth.user) {
    return <Redirect href="/(auth)/phone" />;
  }

  // Wait for user type to be loaded
  if (!auth.user.user_type) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // Handle worker routing based on onboarding and approval status
  if (auth.user.user_type === 'worker') {
    console.log('🔍 App Layout: Worker detected, checking onboarding status:', progress?.onboarding_status);
    
    // Check if worker hasn't completed onboarding
    if (!progress || 
        progress.onboarding_status === 'not_started' || 
        progress.onboarding_status === 'selfie_completed' || 
        progress.onboarding_status === 'documents_completed' || 
        progress.onboarding_status === 'categories_completed' || 
        progress.onboarding_status === 'additional_files_completed') {
      console.log('🔍 App Layout: Redirecting to worker-onboarding');
      return <Redirect href="/(auth)/worker-onboarding" />;
    }
    
    // Check if worker completed onboarding but not approved
    if (progress.onboarding_status === 'completed' && 
        (auth.user as any).approval_status === 'pending') {
      console.log('🔍 App Layout: Redirecting to pending-approval');
      return <Redirect href="/(auth)/pending-approval" />;
    }
    
    // Check if worker was rejected
    if ((auth.user as any).approval_status === 'rejected') {
      console.log('🔍 App Layout: Redirecting to pending-approval (rejected)');
      return <Redirect href="/(auth)/pending-approval" />;
    }
    
    console.log('🔍 App Layout: Worker approved, showing worker screen');
  }

  // Show appropriate route based on user type
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {auth.user.user_type === 'customer' && (
        <Stack.Screen name="customer" />
      )}
      {auth.user.user_type === 'worker' && (
        <>
          <Stack.Screen name="worker" />
          <Stack.Screen name="jobs/[categoryId]" options={{ title: 'Available Jobs' }} />
        </>
      )}
      <Stack.Screen name="chat" />
    </Stack>
  );
}
