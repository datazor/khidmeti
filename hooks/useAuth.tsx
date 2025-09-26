// hooks/useAuth.tsx
import React, { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import * as SecureStore from 'expo-secure-store';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { router } from 'expo-router';

// Types
export type UserType = 'customer' | 'worker';

export interface User {
  _id: Id<"users">;
  phone: string;
  name: string;
  user_type: UserType;
  rating?: number;
  approval_status: "pending" | "approved" | "rejected";
  balance: number;
}

export interface AuthTokens {
  sessionToken: string;
  refreshToken: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean; // Track if we've checked stored tokens
}

export interface AuthActions {
  // Login with tokens (called after signup or sign-in)
  login: (tokens: AuthTokens, userData: User) => Promise<void>;

  // Sign in with credentials
  signIn: (phone: string, password: string) => Promise<void>;

  // Logout user
  logout: () => Promise<void>;

  // Refresh session token
  refreshSession: () => Promise<boolean>;

  // Clear any errors
  clearError: () => void;

  // Initialize auth state from stored tokens
  initializeAuth: () => Promise<void>;
}

// Secure storage keys
const STORAGE_KEYS = {
  SESSION_TOKEN: 'session_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_ID: 'user_id',
} as const;

// Context setup
type AuthContextType = (AuthState & AuthActions) | null;
const AuthContext = createContext<AuthContextType>(null);

// Device ID helper
const getDeviceId = () => `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Internal hook implementation
function useAuthHook(): AuthState & AuthActions {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    isInitialized: false,
  });

  // State for refresh token validation
  const [refreshTokenFromStorage, setRefreshTokenFromStorage] = useState<string | null>(null);

  // Convex functions
  const validateCredentials = useAction(api.actions.validateCredentials);
  const validateRefreshToken = useAction(api.actions.validateRefreshToken);
  const validateSessionToken = useMutation(api.auth.validateSessionToken);
  const generateNewSession = useMutation(api.auth.generateNewSession);
  const invalidateSession = useMutation(api.auth.invalidateSession);
  const revokeRefreshToken = useMutation(api.auth.revokeRefreshToken);
  const generateRefreshToken = useAction(api.actions.generateRefreshToken);

  // Conditional user query - only fetch when we have a user ID
  const shouldFetchUser = Boolean(state.user?._id) && state.isAuthenticated;
  const currentUser = useQuery(
    api.auth.getUserById,
    shouldFetchUser && state.user ? { userId: state.user._id } : 'skip'
  );

  // Update user data when query returns
  useEffect(() => {
    if (currentUser && state.isAuthenticated) {
      setState(prev => ({
        ...prev,
        user: currentUser as User,
      }));

    }
  }, [currentUser, state.isAuthenticated]);

  // Initialize auth state on app start
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = useCallback(async () => {
  
  if (state.isInitialized) {
    return;
  }
  
  setState(prev => ({ ...prev, isLoading: true }));
  
  try {
    const [sessionToken, refreshToken, userId] = await Promise.all([
      SecureStore.getItemAsync(STORAGE_KEYS.SESSION_TOKEN),
      SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
      SecureStore.getItemAsync(STORAGE_KEYS.USER_ID),
    ]);



    if (!sessionToken || !refreshToken || !userId) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        isInitialized: true,
      }));
      return;
    }

    try {
      const sessionValidation = await validateSessionToken({ sessionToken });
      
      if (sessionValidation.userId === userId) {
        // Session is still valid, use it
        setState(prev => ({
          ...prev,
          user: { _id: userId as Id<"users"> } as User,
          isAuthenticated: true,
          isLoading: false,
          isInitialized: true,
        }));
        return;
      }
    } catch (sessionError) {
    }

    // Only if session invalid, validate refresh token
    setRefreshTokenFromStorage(refreshToken);
    
  } catch (error) {
    await clearStoredTokens();
    setState(prev => ({
      ...prev,
      isLoading: false,
      isInitialized: true,
      error: 'Failed to restore session',
    }));
  }
}, [state.isInitialized, validateSessionToken]);

  const handleRefreshTokenValidation = useCallback(async () => {
    try {
      const userId = await SecureStore.getItemAsync(STORAGE_KEYS.USER_ID);

      const refreshResult = await validateRefreshToken({ refreshToken: refreshTokenFromStorage! });


      if (refreshResult?.userId === userId) {
        // Valid refresh token, generate new session
        const newSession = await generateNewSession({
          userId: userId as Id<"users">,
          deviceId: getDeviceId(),
        });

        // Store new session token
        await SecureStore.setItemAsync(STORAGE_KEYS.SESSION_TOKEN, newSession.sessionToken);

        setState(prev => ({
          ...prev,
          user: { _id: userId as Id<"users"> } as User, // Will be populated by query
          isAuthenticated: true,
          isLoading: false,
          isInitialized: true,
        }));
      } else {
        // Invalid refresh token, clear storage
        await clearStoredTokens();
        setState(prev => ({
          ...prev,
          isLoading: false,
          isInitialized: true,
        }));
      }
    } catch (error) {
      await clearStoredTokens();
      setState(prev => ({
        ...prev,
        isLoading: false,
        isInitialized: true,
        error: 'Failed to restore session',
      }));
    }
  }, [refreshTokenFromStorage, validateRefreshToken, generateNewSession]);

  // Handle refresh token validation result
  useEffect(() => {
    if (refreshTokenFromStorage) {
      handleRefreshTokenValidation();
    }
  }, [refreshTokenFromStorage, handleRefreshTokenValidation]);

  /**
   * Login with pre-generated tokens (after signup)
   */
  const login = useCallback(async (tokens: AuthTokens, userData: User) => {


    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Store tokens securely
      await Promise.all([
        SecureStore.setItemAsync(STORAGE_KEYS.SESSION_TOKEN, tokens.sessionToken),
        SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, tokens.refreshToken),
        SecureStore.setItemAsync(STORAGE_KEYS.USER_ID, userData._id),
      ]);

      setState(prev => ({
        ...prev,
        user: userData,
        isAuthenticated: true,
        isLoading: false,
        isInitialized: true,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to store authentication tokens',
      }));
    }
  }, []);

  /**
   * Sign in with phone and password
   */
  const signIn = useCallback(async (phone: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Validate credentials
      const credentialsResult = await validateCredentials({ phone, password });

      if (!credentialsResult.userId) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Invalid phone number or password',
        }));
        return;
      }

      // Generate new session and refresh token
      const [sessionResult, refreshResult] = await Promise.all([
        generateNewSession({
          userId: credentialsResult.userId,
          deviceId: getDeviceId(),
        }),
        generateRefreshToken({ userId: credentialsResult.userId })
      ]);

      // Store all tokens
      await Promise.all([
        SecureStore.setItemAsync(STORAGE_KEYS.SESSION_TOKEN, sessionResult.sessionToken),
        SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refreshResult.refreshToken),
        SecureStore.setItemAsync(STORAGE_KEYS.USER_ID, credentialsResult.userId),
      ]);

      setState(prev => ({
        ...prev,
        user: { _id: credentialsResult.userId } as User, // Will be populated by query
        isAuthenticated: true,
        isLoading: false,
      }));


    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Sign in failed',
      }));
    }
  }, [validateCredentials, generateNewSession, generateRefreshToken]);

  /**
   * Logout user and clear all tokens
   */
  const logout = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const [sessionToken, refreshToken] = await Promise.all([
        SecureStore.getItemAsync(STORAGE_KEYS.SESSION_TOKEN),
        SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
      ]);

      // Invalidate tokens on server
      const promises = [];
      if (sessionToken) {
        promises.push(invalidateSession({ sessionToken }));
      }
      if (refreshToken) {
        promises.push(revokeRefreshToken({ refreshToken }));
      }

      await Promise.all(promises);
    } catch (error) {
      // Continue with logout even if server calls fail
    }

    // Clear local storage
    await clearStoredTokens();
    setRefreshTokenFromStorage(null);

    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      isInitialized: true,
    });
  }, [invalidateSession, revokeRefreshToken]);

  /**
   * Refresh session token using refresh token
   */
  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const refreshToken = await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
      if (!refreshToken) {
        return false;
      }

      // Set refresh token to trigger validation
      setRefreshTokenFromStorage(refreshToken);
      // Wait for validation result (this is simplified - in practice you'd want better coordination)

      return true; // This would need proper async coordination with the validation result
    } catch (error) {
      return false;
    }
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  /**
   * Helper to clear all stored tokens
   */
  const clearStoredTokens = async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(STORAGE_KEYS.SESSION_TOKEN),
      SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN),
      SecureStore.deleteItemAsync(STORAGE_KEYS.USER_ID),
    ]);
  };


  return {
    // State
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,
    isInitialized: state.isInitialized,

    // Actions
    login,
    signIn,
    logout,
    refreshSession,
    clearError,
    initializeAuth,
  };
}

// Provider component
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const authValue = useAuthHook();

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Public hook
export function useAuth(): AuthState & AuthActions {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}