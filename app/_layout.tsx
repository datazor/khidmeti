// app/_layout.tsx
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SplashScreen, Stack } from 'expo-router';
import { useEffect } from 'react';
import { I18nManager, View, AppState } from 'react-native';
import { setAudioModeAsync } from 'expo-audio';

// Convex imports (using regular provider for custom auth)
import { ConvexReactClient, ConvexProvider } from "convex/react";

// Import global styles (NativeWind)
import '../global.css';
import { SignUpProvider } from '@/hooks/useSignUp';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { LocalizationProvider } from '@/constants/localization';
import { CustomerProvider } from '@/hooks/useCustomer';
import { ChatProvider } from '@/hooks/useChat';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { UploadProvider } from '@/contexts/UploadContext';
import { WorkerOnboardingProvider } from '@/hooks/useWorkerOnboarding';
import { WorkerJobsProvider } from '@/hooks/useWorkerJobs';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// Initialize Convex client
const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

// Global audio setup function
const setupGlobalAudio = async () => {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldRouteThroughEarpiece: false,
      shouldPlayInBackground: false,
      allowsRecording: false,
    });
    console.log('Global audio session configured');
  } catch (error) {
    console.error('Failed to setup global audio:', error);
  }
};

// Internal component that handles splash screen
function AppContent() {
  const auth = useAuth();

  // Setup global audio configuration
  useEffect(() => {
    setupGlobalAudio();
  }, []);

  // Monitor app state for audio session restoration
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        // Restore audio session when app returns to foreground
        setupGlobalAudio();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, []);

  // Hide splash screen when auth is ready
  useEffect(() => {
    if (auth.isInitialized && !auth.isLoading) {
      SplashScreen.hideAsync();
    }
  }, [auth.isInitialized, auth.isLoading]);

  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <StatusBar style="dark" backgroundColor="#ffffff" />

      {/* Simple Stack - no routing logic here */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  return (
    <ConvexProvider client={convex}>
      <SafeAreaProvider>
        <AuthProvider>
          <SignUpProvider>
            <LocalizationProvider>
              <CustomerProvider>
                <WorkerJobsProvider>
                <ChatProvider>
                  <UploadProvider>
                    <GestureHandlerRootView style={{ flex: 1 }}>
                      <WorkerOnboardingProvider>
                      <AppContent />
                      </WorkerOnboardingProvider>
                    </GestureHandlerRootView>
                  </UploadProvider>
                </ChatProvider>
                </WorkerJobsProvider>
              </CustomerProvider>
            </LocalizationProvider>
          </SignUpProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </ConvexProvider>
  );
}