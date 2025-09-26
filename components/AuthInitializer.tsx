// components/AuthInitializer.tsx
import React, { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import * as SplashScreen from 'expo-splash-screen';

interface AuthInitializerProps {
  children: React.ReactNode;
}

export const AuthInitializer: React.FC<AuthInitializerProps> = ({ children }) => {
  const auth = useAuth();

  useEffect(() => {
    // Initialize authentication state when app starts
    const initializeAuth = async () => {
      try {
        // This will trigger the auth initialization
        await auth.initializeAuth();
      } catch (error) {
        console.error('Auth initialization failed:', error);
      }
    };

    // Only initialize if not already initialized
    if (!auth.isInitialized) {
      initializeAuth();
    }
  }, [auth.isInitialized]);

  // Hide splash screen once auth state is determined and not loading
  useEffect(() => {
    if (auth.isInitialized && !auth.isLoading) {
      const hideSplash = async () => {
        try {
          await SplashScreen.hideAsync();
        } catch (error) {
          console.error('Failed to hide splash screen:', error);
        }
      };
      
      hideSplash();
    }
  }, [auth.isInitialized, auth.isLoading]);

  return <>{children}</>;
};