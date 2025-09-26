// locales/ar.ts
export const ar = {

      quickReply: {
      yes: "نعم",
      no: "لا"
    },  
  phone: {
    // Screen Text Content
    title: "مرحباً بك في خدمة",
    subtitle: "أدخل رقم هاتفك للبدء",
    phoneNumberLabel: "رقم الهاتف",
    checkingText: "جاري التحقق...",
    continueButton: "متابعة",
    termsText: "بالمتابعة، فإنك توافق على شروط الخدمة وسياسة الخصوصية الخاصة بنا",
    
    // Success Banner Text
    accountFound: "تم العثور على الحساب",
    redirectingText: "جاري إعادة التوجيه لتسجيل الدخول...",
    
    // Error Messages
    invalidPhoneError: "يرجى إدخال رقم هاتف موريتاني صحيح",
    
    // Placeholder
    phonePlaceholder: "12 34 56 78"
  },
  signIn: {
    // Header Text
    title: "مرحباً بعودتك",
    subtitle: "أدخل كلمة المرور لتسجيل الدخول",
    
    // Form Labels & Inputs
    passwordLabel: "كلمة المرور",
    passwordPlaceholder: "أدخل كلمة المرور",
    
    // Interactive Elements
    forgotPassword: "نسيت كلمة المرور؟",
    signingInText: "جاري تسجيل الدخول...",
    signInButton: "تسجيل الدخول",
    
    // Account Actions
    signUpPrompt: "ليس لديك حساب؟ ",
    signUpLink: "إنشاء حساب",
    
    // Error Messages
    incorrectPassword: "كلمة مرور خاطئة. يرجى المحاولة مرة أخرى",
    accountNotFound: "لم يتم العثور على حساب بهذا الرقم",
    connectionError: "مشكلة في الاتصال. تحقق من الإنترنت وحاول مرة أخرى",
    tooManyAttempts: "محاولات كثيرة جداً. يرجى الانتظار قبل المحاولة مرة أخرى",
    accountSuspended: "الحساب معلق مؤقتاً. اتصل بالدعم للمساعدة",
    signInFailed: "فشل تسجيل الدخول. تحقق من كلمة المرور وحاول مرة أخرى",
    passwordRequired: "كلمة المرور مطلوبة"
  },
    otp: {
    // Header Text
    title: "أدخل رمز التحقق",
    subtitle: "لقد أرسلنا رمز مكون من 6 أرقام إلى",
    
    // Form Labels
    verificationCodeLabel: "رمز التحقق",
    
    // Timer/Resend Section
    resendCodeIn: "إعادة إرسال الرمز خلال {{time}}",
    resendingText: "جاري الإرسال...",
    resendButton: "إعادة إرسال الرمز",
    
    // Button Text
    verifyingText: "جاري التحقق...",
    verifyButton: "تحقق من الرمز",
    
    // Helper Text
    helperText: "لم تستلم الرمز؟ تحقق من رسائلك أو حاول إعادة الإرسال",
    
    // Error Messages
    errors: {
      invalidState: "يرجى إعادة تشغيل عملية التحقق",
      invalidCode: "الرمز الذي أدخلته غير صحيح. يرجى المحاولة مرة أخرى",
      expired: "انتهت صلاحية هذا الرمز. يرجى طلب رمز جديد",
      connection: "مشكلة في الاتصال. يرجى التحقق من الإنترنت والمحاولة مرة أخرى",
      tooManyAttempts: "محاولات كثيرة جداً. يرجى الانتظار قبل المحاولة مرة أخرى",
      generic: "فشل التحقق. يرجى المحاولة مرة أخرى أو طلب رمز جديد"
    }
  },
  
  "auth": {
    "profile": {
      "title": "أكمل ملفك الشخصي",
      "subtitle": "أخبرنا عن نفسك لإنهاء إعداد حسابك",
      "fullNameLabel": "الاسم الكامل",
      "fullNamePlaceholder": "أدخل اسمك الكامل",
      "passwordLabel": "كلمة المرور",
      "passwordPlaceholder": "أنشئ كلمة مرور آمنة",
      "confirmPasswordLabel": "تأكيد كلمة المرور",
      "confirmPasswordPlaceholder": "أكد كلمة المرور",
      "roleLabel": "أنا",
      "customerRole": "عميل",
      "customerDescription": "أحتاج إلى خدمات وأريد توظيف عمال",
      "workerRole": "عامل",
      "workerDescription": "أقدم خدمات وأريد العثور على عمل",
      "creatingAccount": "جاري إنشاء الحساب...",
      "completeSetup": "إكمال الإعداد",
      "termsText": "بإكمال الإعداد، فإنك توافق على شروط الخدمة وسياسة الخصوصية الخاصة بنا",
      "passwordWeak": "ضعيفة",
      "passwordFair": "مقبولة",
      "passwordGood": "جيدة",
      "passwordStrong": "قوية"
    }
  },
  onboarding: {
    categories: {
      continue: "متابعة",
      selectAll: "تحديد الكل",
      done: "تم"
    }
  },
  "validation": {
    "nameRequired": "الاسم مطلوب",
    "nameMinLength": "يجب أن يكون الاسم على الأقل حرفين",
    "nameMaxLength": "الاسم طويل جداً",
    "nameInvalid": "يمكن أن يحتوي الاسم على أحرف ومسافات فقط",
    "passwordRequired": "كلمة المرور مطلوبة",
    "passwordMinLength": "يجب أن تكون كلمة المرور على الأقل 6 أحرف",
    "passwordMaxLength": "كلمة المرور طويلة جداً",
    "passwordLetter": "يجب أن تحتوي كلمة المرور على حرف واحد على الأقل",
    "passwordsNotMatch": "كلمات المرور غير متطابقة"
  },
  customer: {
    greeting: "مرحبا {{name}}",
    defaultGreeting: "مرحبا",
    subtitle: "اختر فئة للبدء"
  },
   "chat": {
      "title": "المحادثة",
      "startingConversation": "جاري بدء المحادثة...",
      "messagePlaceholder": "اكتب رسالة...",
      "retry": "إعادة المحاولة",
      "error": {
        "sendFailed": "فشل الإرسال",
        "sendFailedMessage": "تعذر إرسال الرسالة. يرجى المحاولة مرة أخرى.",
        "voiceFailed": "فشل الرسالة الصوتية",
        "voiceFailedMessage": "تعذر إرسال الرسالة الصوتية. يرجى المحاولة مرة أخرى.",
        "photoFailed": "فشل في الصورة",
        "photoFailedMessage": "تعذر إرسال الصورة. يرجى المحاولة مرة أخرى.",
        "cameraFailed": "فشل في الكاميرا",
        "cameraFailedMessage": "تعذر فتح الكاميرا. يرجى المحاولة مرة أخرى.",
        "retryFailed": "فشلت إعادة المحاولة",
        "retryFailedMessage": "تعذر إعادة المحاولة. يرجى المحاولة مرة أخرى."
      },
      "assistant": "سعيد",
            selected: "محدد",
      removing: "إزالة الرسالة...",
      processing: "معالجة..."
    }

};
