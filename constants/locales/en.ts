// locales/en.ts
export const en = {
      quickReply: {
      yes: "Yes",
      no: "No"
    },
  phone: {
    // Screen Text Content
    title: "Welcome to Khidma",
    subtitle: "Enter your phone number to get started",
    phoneNumberLabel: "PHONE NUMBER",
    checkingText: "Checking...",
    continueButton: "Continue",
    termsText: "By continuing, you agree to our Terms of Service and Privacy Policy",
    
    // Success Banner Text
    accountFound: "Account Found",
    redirectingText: "Redirecting you to sign in...",
    
    // Error Messages
    invalidPhoneError: "Please enter a valid Mauritanian phone number",
    
    // Placeholder
    phonePlaceholder: "12 34 56 78"
  },
  // locales/en.ts - ADD TO EXISTING FILE

  signIn: {
    // Header Text
    title: "Welcome back",
    subtitle: "Enter your password to sign in",
    
    // Form Labels & Inputs
    passwordLabel: "PASSWORD",
    passwordPlaceholder: "Enter your password",
    
    // Interactive Elements
    forgotPassword: "Forgot password?",
    signingInText: "Signing in...",
    signInButton: "Sign In",
    
    // Account Actions
    signUpPrompt: "Don't have an account? ",
    signUpLink: "Sign up",
    
    // Error Messages
    incorrectPassword: "Incorrect password. Please try again",
    accountNotFound: "No account found with this phone number",
    connectionError: "Connection issue. Please check your internet and try again",
    tooManyAttempts: "Too many attempts. Please wait before trying again",
    accountSuspended: "Account is temporarily suspended. Contact support for assistance",
    signInFailed: "Sign in failed. Please check your password and try again",
    passwordRequired: "Password is required"
  },
  otp: {
    // Header Text
    title: "Enter verification code",
    subtitle: "We sent a 6-digit code to",
    
    // Form Labels
    verificationCodeLabel: "VERIFICATION CODE",
    
    // Timer/Resend Section
    resendCodeIn: "Resend code in {{time}}",
    resendingText: "Resending...",
    resendButton: "Resend Code",
    
    // Button Text
    verifyingText: "Verifying...",
    verifyButton: "Verify Code",
    
    // Helper Text
    helperText: "Didn't receive the code? Check your messages or try resending",
    
    // Error Messages
    errors: {
      invalidState: "Please restart the verification process",
      invalidCode: "The code you entered is incorrect. Please try again",
      expired: "This code has expired. Please request a new one",
      connection: "Connection issue. Please check your internet and try again",
      tooManyAttempts: "Too many attempts. Please wait before trying again",
      generic: "Verification failed. Please try again or request a new code"
    }
  },
  
  "auth": {
    "profile": {
      "title": "Complete your profile",
      "subtitle": "Tell us about yourself to finish setting up your account",
      "fullNameLabel": "FULL NAME",
      "fullNamePlaceholder": "Enter your full name",
      "passwordLabel": "PASSWORD", 
      "passwordPlaceholder": "Create a secure password",
      "confirmPasswordLabel": "CONFIRM PASSWORD",
      "confirmPasswordPlaceholder": "Confirm your password",
      "roleLabel": "I AM A",
      "customerRole": "Customer",
      "customerDescription": "I need services and want to hire workers",
      "workerRole": "Worker", 
      "workerDescription": "I provide services and want to find work",
      "creatingAccount": "Creating Account...",
      "completeSetup": "Complete Setup",
      "termsText": "By completing setup, you agree to our Terms of Service and Privacy Policy",
      "passwordWeak": "Weak",
      "passwordFair": "Fair", 
      "passwordGood": "Good",
      "passwordStrong": "Strong"
    }
  },
  onboarding: {
    categories: {
      continue: "Continue",
      selectAll: "Select All",
      done: "Done"
    }
  },
  "validation": {
    "nameRequired": "Name is required",
    "nameMinLength": "Name must be at least 2 characters",
    "nameMaxLength": "Name is too long", 
    "nameInvalid": "Name can only contain letters and spaces",
    "passwordRequired": "Password is required",
    "passwordMinLength": "Password must be at least 6 characters",
    "passwordMaxLength": "Password is too long",
    "passwordLetter": "Password must contain at least one letter",
    "passwordsNotMatch": "Passwords do not match"
  },
  customer: {
    greeting: "Hello {{name}}, what can we help you with?",
    defaultGreeting: "Hello, what can we help you with?",
    subtitle: "Choose a category to get started"
  },

  "chat": {
      "title": "Chat",
      "startingConversation": "Starting conversation...",
      "messagePlaceholder": "Type a message...",
      "retry": "Retry",
      "error": {
        "sendFailed": "Send Failed",
        "sendFailedMessage": "Could not send message. Please try again.",
        "voiceFailed": "Voice Message Failed", 
        "voiceFailedMessage": "Could not send voice message. Please try again.",
        "photoFailed": "Photo Failed",
        "photoFailedMessage": "Could not send photo. Please try again.",
        "cameraFailed": "Camera Failed",
        "cameraFailedMessage": "Could not open camera. Please try again.",
        "retryFailed": "Retry Failed",
        "retryFailedMessage": "Could not retry action. Please try again.",
        
        
      },
      "assistant": "Saeed",
            selected: "Selected",
      removing: "Removing message...",
      processing: "Processing..."
    }

};
