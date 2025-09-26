// hooks/useSignUp.tsx
import React, { useState, useEffect, useRef, createContext, useContext, ReactNode } from 'react';
import { useAction, useMutation, useQuery } from 'convex/react';
import { useRouter } from 'expo-router';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';
import { validateMauritanianMobile } from '@/lib/phoneValidation';
import { useAuth } from './useAuth';

// Types for the signup flow
export type SignUpStep = 'phone' | 'userCheck' | 'otp' | 'profile' | 'complete';
export type UserType = 'customer' | 'worker';

export interface SignUpState {
  step: SignUpStep;
  phone: string;
  userType: UserType | null;
  userId: Id<"users"> | null;
  isLoading: boolean;
  error: string | null;
  userExists: boolean;
}

export interface SignUpActions {
  // Step 1: Check if user exists
  checkUserExists: (phone: string) => void;
  
  // Step 2: Send OTP to phone (for new users)
  sendOTP: (phone: string) => Promise<void>;
  
  // Step 3: Verify OTP code
  verifyOTP: (code: string) => Promise<void>;
  
  // Step 4: Complete signup with profile data
  completeSignupWithProfile: (name: string, password: string, userType: UserType) => Promise<void>;
  
  // Navigation controls
  goBack: () => void;
  reset: () => void;
  
  // Navigate to sign in with phone number
  navigateToSignIn: () => void;
}

// Context setup
type SignUpContextType = (SignUpState & SignUpActions) | null;
const SignUpContext = createContext<SignUpContextType>(null);

// Internal hook implementation
function useSignUpHook(): SignUpState & SignUpActions {
  
  const router = useRouter();
  const auth = useAuth();
  
  // Local state for signup flow
  const [state, setState] = useState<SignUpState>({
    step: 'phone',
    phone: '',
    userType: null,
    userId: null,
    isLoading: false,
    error: null,
    userExists: false,
  });

  // Convex mutations and queries
  const generateAndStoreOTP = useAction(api.actions.generateAndStoreOTP);
  const validateOTP = useAction(api.actions.validateOTP);
  const createUser = useAction(api.actions.createUser); // Changed to action
  const generateRefreshToken = useAction(api.actions.generateRefreshToken);
  const generateSession = useMutation(api.sessions.generateSession);
  
  // Conditional query for checking phone existence
  const shouldCheckPhone = state.step === 'userCheck' && state.phone !== '';
  const phoneCheckResult = useQuery(
    api.users.checkPhoneExists, 
    shouldCheckPhone ? { phone: state.phone } : 'skip'
  );

  // Handle phone check result
  useEffect(() => {
    if (state.step === 'userCheck' && phoneCheckResult !== undefined) {
      setState(prev => ({
        ...prev,
        userExists: phoneCheckResult,
        isLoading: false,
      }));
    }
  }, [phoneCheckResult, state.step]);

  /**
   * Step 1: Check if user exists by phone number
   */
  const checkUserExists = (phone: string) => {
    setState(prev => ({ 
      ...prev, 
      phone,
      step: 'userCheck', 
      isLoading: true,
      error: null 
    }));
  };

  /**
   * Navigate to sign in screen with phone number
   */
  const navigateToSignIn = () => {
  setState(prev => ({ 
    ...prev, 
    step: 'userCheck',
    error: null 
  }));
  router.push('/(auth)/sign-in');
};

  /**
   * Step 2: Send OTP to phone number (for new users)
   */
  const sendOTP = async (phone: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Validate phone format before anything
      const isValidPhone = validateMauritanianMobile(phone);
      if (!isValidPhone) {
        throw new Error('Invalid phone number');
      }

      // Generate and store OTP (this also sends SMS via server)
      await generateAndStoreOTP({ phone });

      // Move to OTP verification step
      setState(prev => ({
        ...prev,
        step: 'otp',
        phone,
        isLoading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to send OTP',
      }));
    }
  };

  /**
   * Step 3: Verify OTP and move to profile completion
   */
  const verifyOTP = async (code: string) => {
    if (!state.phone) {
      setState(prev => ({ ...prev, error: 'Invalid signup state' }));
      return;
    }
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Validate OTP
      const isValidOTP = await validateOTP({ 
        phone: state.phone, 
        code 
      });
      
      if (!isValidOTP) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Invalid OTP code. Please try again.',
        }));
        return;
      }
     
      // Move to combined profile completion screen
      setState(prev => ({
        ...prev,
        step: 'profile',
        isLoading: false,
      }));
       router.push('/(auth)/profile');
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to verify OTP',
      }));
    }
  };

  /**
   * Step 4: Complete signup with all profile data and login
   */
  const completeSignupWithProfile = async (name: string, password: string, userType: UserType) => {
    if (!state.phone) {
      setState(prev => ({ ...prev, error: 'Missing phone number' }));
      return;
    }
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Create user with all data (using action that handles password hashing)
      const { userId } = await createUser({ 
        phone: state.phone, 
        userType, 
        password,
        name: name.trim()
      });
      
      // Generate auth tokens
      const deviceId = `device-${Date.now()}`;
      const [sessionResult, refreshResult] = await Promise.all([
        generateSession({ userId, deviceId }),
        generateRefreshToken({ userId }),
      ]);
      
      // Login user through auth system
      await auth.login(
        {
          sessionToken: sessionResult.sessionToken,
          refreshToken: refreshResult.refreshToken,
        },
        {
          _id: userId,
          phone: state.phone,
          name: name.trim(),
          user_type: userType,
          approval_status: userType === 'customer' ? 'approved' : 'pending',
          balance: 0,
        }
      );
      
      setState(prev => ({
        ...prev,
        step: 'complete',
        userId,
        userType,
        isLoading: false,
      }));
      
      // Navigate based on user type
      if (userType === 'customer') {
        router.replace('/(app)/customer');
      } else {
        router.replace('/(app)/worker');
      }
      
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to complete signup',
      }));
    }
  };

  /**
   * Navigation: Go back to previous step
   */
  const goBack = () => {
    setState(prev => {
      switch (prev.step) {
        case 'userCheck':
          return { ...prev, step: 'phone', error: null };
        case 'otp':
          return { ...prev, step: 'phone', error: null };
        case 'profile':
          return { ...prev, step: 'otp', error: null };
        default:
          return prev;
      }
    });
  };

  /**
   * Reset the entire signup flow
   */
  const reset = () => {
    setState({
      step: 'phone',
      phone: '',
      userType: null,
      userId: null,
      isLoading: false,
      error: null,
      userExists: false,
    });
  };

  return {
    // State
    step: state.step,
    phone: state.phone,
    userType: state.userType,
    userId: state.userId,
    isLoading: state.isLoading,
    error: state.error,
    userExists: state.userExists,
    
    // Actions
    checkUserExists,
    sendOTP,
    verifyOTP,
    completeSignupWithProfile,
    goBack,
    reset,
    navigateToSignIn,
  };
}

// Provider component
interface SignUpProviderProps {
  children: ReactNode;
}

export const SignUpProvider: React.FC<SignUpProviderProps> = ({ children }) => {
  const signUpValue = useSignUpHook();
  
  return (
    <SignUpContext.Provider value={signUpValue}>
      {children}
    </SignUpContext.Provider>
  );
};

// Public hook that uses context
export function useSignUp(): SignUpState & SignUpActions {
  const context = useContext(SignUpContext);
  if (!context) {
    throw new Error('useSignUp must be used within a SignUpProvider');
  }
  return context;
}