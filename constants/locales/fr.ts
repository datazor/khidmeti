// locales/fr.ts
export const fr = {
  phone: {
    quickReply: {
      yes: "Oui",
      no: "Non"
    },
    // Screen Text Content
    title: "Bienvenue sur Khidma",
    subtitle: "Entrez votre numéro de téléphone pour commencer",
    phoneNumberLabel: "NUMÉRO DE TÉLÉPHONE",
    checkingText: "Vérification...",
    continueButton: "Continuer",
    termsText: "En continuant, vous acceptez nos Conditions d'utilisation et notre Politique de confidentialité",
    
    // Success Banner Text
    accountFound: "Compte trouvé",
    redirectingText: "Redirection vers la connexion...",
    
    // Error Messages
    invalidPhoneError: "Veuillez entrer un numéro de téléphone mauritanien valide",
    
    // Placeholder
    phonePlaceholder: "12 34 56 78"
  },
  signIn: {
    // Header Text
    title: "Bon retour",
    subtitle: "Entrez votre mot de passe pour vous connecter",
    
    // Form Labels & Inputs
    passwordLabel: "MOT DE PASSE",
    passwordPlaceholder: "Entrez votre mot de passe",
    
    // Interactive Elements
    forgotPassword: "Mot de passe oublié ?",
    signingInText: "Connexion en cours...",
    signInButton: "Se connecter",
    
    // Account Actions
    signUpPrompt: "Vous n'avez pas de compte ? ",
    signUpLink: "S'inscrire",
    
    // Error Messages
    incorrectPassword: "Mot de passe incorrect. Veuillez réessayer",
    accountNotFound: "Aucun compte trouvé avec ce numéro de téléphone",
    connectionError: "Problème de connexion. Vérifiez votre internet et réessayez",
    tooManyAttempts: "Trop de tentatives. Veuillez attendre avant de réessayer",
    accountSuspended: "Compte temporairement suspendu. Contactez le support pour assistance",
    signInFailed: "Échec de la connexion. Vérifiez votre mot de passe et réessayez",
    passwordRequired: "Le mot de passe est requis"
  },
  otp: {
    // Header Text
    title: "Entrez le code de vérification",
    subtitle: "Nous avons envoyé un code à 6 chiffres à",
    
    // Form Labels
    verificationCodeLabel: "CODE DE VÉRIFICATION",
    
    // Timer/Resend Section
    resendCodeIn: "Renvoyer le code dans {{time}}",
    resendingText: "Envoi en cours...",
    resendButton: "Renvoyer le code",
    
    // Button Text
    verifyingText: "Vérification...",
    verifyButton: "Vérifier le code",
    
    // Helper Text
    helperText: "Vous n'avez pas reçu le code ? Vérifiez vos messages ou réessayez d'envoyer",
    
    // Error Messages
    errors: {
      invalidState: "Veuillez redémarrer le processus de vérification",
      invalidCode: "Le code que vous avez saisi est incorrect. Veuillez réessayer",
      expired: "Ce code a expiré. Veuillez en demander un nouveau",
      connection: "Problème de connexion. Vérifiez votre internet et réessayez",
      tooManyAttempts: "Trop de tentatives. Veuillez attendre avant de réessayer",
      generic: "Échec de la vérification. Veuillez réessayer ou demander un nouveau code"
    }
  },
  "auth": {
    "profile": {
      "title": "Complétez votre profil",
      "subtitle": "Parlez-nous de vous pour terminer la configuration de votre compte",
      "fullNameLabel": "NOM COMPLET",
      "fullNamePlaceholder": "Entrez votre nom complet",
      "passwordLabel": "MOT DE PASSE",
      "passwordPlaceholder": "Créez un mot de passe sécurisé",
      "confirmPasswordLabel": "CONFIRMER LE MOT DE PASSE",
      "confirmPasswordPlaceholder": "Confirmez votre mot de passe",
      "roleLabel": "JE SUIS UN",
      "customerRole": "Client",
      "customerDescription": "J'ai besoin de services et veux embaucher des travailleurs",
      "workerRole": "Travailleur",
      "workerDescription": "Je fournis des services et veux trouver du travail",
      "creatingAccount": "Création du compte...",
      "completeSetup": "Terminer la configuration",
      "termsText": "En terminant la configuration, vous acceptez nos Conditions d'utilisation et notre Politique de confidentialité",
      "passwordWeak": "Faible",
      "passwordFair": "Correct",
      "passwordGood": "Bon",
      "passwordStrong": "Fort"
    }
  },
  onboarding: {
    categories: {
      continue: "Continuer",
      selectAll: "Tout sélectionner",
      done: "Terminé"
    }
  },
  "validation": {
    "nameRequired": "Le nom est requis",
    "nameMinLength": "Le nom doit contenir au moins 2 caractères",
    "nameMaxLength": "Le nom est trop long",
    "nameInvalid": "Le nom ne peut contenir que des lettres et des espaces",
    "passwordRequired": "Le mot de passe est requis",
    "passwordMinLength": "Le mot de passe doit contenir au moins 6 caractères",
    "passwordMaxLength": "Le mot de passe est trop long",
    "passwordLetter": "Le mot de passe doit contenir au moins une lettre",
    "passwordsNotMatch": "Les mots de passe ne correspondent pas"
  },
  customer: {
    greeting: "Bonjour {{name}}, comment pouvons-nous vous aider ?",
    defaultGreeting: "Bonjour, comment pouvons-nous vous aider ?",
    subtitle: "Choisissez une catégorie pour commencer"
  },
  "chat": {
      "title": "Discussion",
      "startingConversation": "Démarrage de la conversation...",
      "messagePlaceholder": "Tapez un message...",
      "retry": "Réessayer",
      "error": {
        "sendFailed": "Envoi échoué",
        "sendFailedMessage": "Impossible d'envoyer le message. Veuillez réessayer.",
        "voiceFailed": "Message vocal échoué",
        "voiceFailedMessage": "Impossible d'envoyer le message vocal. Veuillez réessayer.",
        "photoFailed": "Photo échouée",
        "photoFailedMessage": "Impossible d'envoyer la photo. Veuillez réessayer.",
        "cameraFailed": "Caméra échouée",
        "cameraFailedMessage": "Impossible d'ouvrir la caméra. Veuillez réessayer.",
        "retryFailed": "Nouvelle tentative échouée",
        "retryFailedMessage": "Impossible de réessayer l'action. Veuillez réessayer."
      },
      "assistant": "Saeed",
            selected: "Sélectionné",
      removing: "Suppression du message...",
      processing: "Traitement..."
    }
};
