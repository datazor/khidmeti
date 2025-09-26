//convex/systemMessages.ts - Complete file with photo selection support
import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Localized system messages
const SYSTEM_MESSAGES = {
  welcome: {
    en: "Welcome! I'll help you request {categoryName} services. Let's start by describing what you need.",
    fr: "Bienvenue ! Je vais vous aider à demander des services de {categoryName}. Commençons par décrire ce dont vous avez besoin.",
    ar: "مرحباً! سأساعدك في طلب خدمات {categoryName}. لنبدأ بوصف ما تحتاجه."
  },
  voice_instruction: {
    en: "Please record a voice message describing your service request in detail.",
    fr: "Veuillez enregistrer un message vocal décrivant votre demande de service en détail.",
    ar: "يرجى تسجيل رسالة صوتية تصف طلب الخدمة بالتفصيل."
  },
  voice_completeness_check: {
    en: "Does your voice message contain enough details about your service request?",
    fr: "Votre message vocal contient-il suffisamment de détails sur votre demande de service ?",
    ar: "هل تحتوي رسالتك الصوتية على تفاصيل كافية حول طلب الخدمة؟"
  },
  date_selection: {
    en: "When would you like this service completed?",
    fr: "Quand souhaitez-vous que ce service soit terminé ?",
    ar: "متى تريد إكمال هذه الخدمة؟"
  },
  photo_selection: {
    en: "Would you like to add photos of the area that needs work?",
    fr: "Souhaitez-vous ajouter des photos de la zone qui nécessite des travaux ?",
    ar: "هل تريد إضافة صور للمنطقة التي تحتاج إلى عمل؟"
  },
  photos_received: {
    en: "Thank you for the photos! Your service request is now complete.",
    fr: "Merci pour les photos ! Votre demande de service est maintenant complète.",
    ar: "شكراً لك على الصور! طلب الخدمة الخاص بك مكتمل الآن."
  },
  photos_skipped: {
    en: "Your service request is ready to be posted.",
    fr: "Votre demande de service est prête à être publiée.",
    ar: "طلب الخدمة الخاص بك جاهز للنشر."
  },
  confirmation_prompt: {
    en: "Is this description accurate?",
    fr: "Cette description est-elle exacte ?",
    ar: "هل هذا الوصف دقيق؟"
  },
  date_instruction: {
    en: "When would you like this service completed?",
    fr: "Quand souhaitez-vous que ce service soit terminé ?",
    ar: "متى تريد إكمال هذه الخدمة؟"
  },
  photo_question: {
    en: "Would you like to add photos of the problem area?",
    fr: "Souhaitez-vous ajouter des photos de la zone problématique ?",
    ar: "هل تريد إضافة صور للمنطقة المشكلة؟"
  },
  photo_instruction: {
    en: "Please share photos of the area that needs work.",
    fr: "Veuillez partager des photos de la zone qui nécessite des travaux.",
    ar: "يرجى مشاركة صور للمنطقة التي تحتاج إلى عمل."
  },
  job_created: {
    en: "Your service request has been posted successfully!",
    fr: "Votre demande de service a été publiée avec succès !",
    ar: "تم نشر طلب الخدمة الخاص بك بنجاح!"
  },
  completion_code_delivery: {
    en: "Share this code with the worker only when work is completed: {code}",
    fr: "Partagez ce code avec le travailleur seulement quand le travail est terminé: {code}",
    ar: "شارك هذا الرمز مع العامل فقط عند اكتمال العمل: {code}"
  },
  completion_code_input_instruction: {
    en: "Ask the customer for the completion code to finish this job",
    fr: "Demandez au client le code d'achèvement pour terminer ce travail",
    ar: "اطلب من العميل رمز الإكمال لإنهاء هذا العمل"
  }
} as const;

// Helper function to create system messages
async function createSystemMessage(
  ctx: any,
  chatId: string,
  bubbleType: string,
  messageKey: string,
  language: string,
  variables: Record<string, string> = {},
  metadata: any = {}
) {
  const chat = await ctx.db.get(chatId);
  if (!chat) {
    throw new Error("Chat not found");
  }

  const messageTemplate = SYSTEM_MESSAGES[messageKey as keyof typeof SYSTEM_MESSAGES];
  if (!messageTemplate) {
    throw new Error(`Unknown message key: ${messageKey}`);
  }

  let content: string = messageTemplate[language as keyof typeof messageTemplate];
  
  Object.entries(variables).forEach(([key, value]) => {
    content = content.replace(`{${key}}`, value);
  });

  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const timestamp = Date.now();

  const messageId = await ctx.db.insert("messages", {
    chat_id: chatId,
    year_month: yearMonth,
    sender_id: chat.customer_id,
    bubble_type: bubbleType,
    content,
    metadata: {
      ...metadata,
      isSystemGenerated: true,
      automated: true,
      language,
      messageKey,
    },
    is_dismissed: false,
    is_expired: false,
    created_at: timestamp,
  });

  // Update message partition count
  const existingPartition = await ctx.db
    .query("message_partitions")
    .withIndex("by_chat", (q: { eq: (arg0: string, arg1: string) => any; }) => q.eq("chat_id", chatId))
    .filter((q: { eq: (arg0: any, arg1: string) => any; field: (arg0: string) => any; }) => q.eq(q.field("year_month"), yearMonth))
    .first();

  if (existingPartition) {
    await ctx.db.patch(existingPartition._id, {
      message_count: existingPartition.message_count + 1,
    });
  } else {
    await ctx.db.insert("message_partitions", {
      chat_id: chatId,
      year_month: yearMonth,
      message_count: 1,
      created_at: timestamp,
    });
  }

  return await ctx.db.get(messageId);
}

export const sendSystemMessage = mutation({
  args: {
    chatId: v.id("chats"),
    bubbleType: v.union(
      v.literal("system_instruction"),
      v.literal("system_prompt"),
      v.literal("system_notification")
    ),
    messageKey: v.string(),
    language: v.union(v.literal("en"), v.literal("fr"), v.literal("ar")),
    variables: v.optional(v.record(v.string(), v.string())),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, { chatId, bubbleType, messageKey, language, variables = {}, metadata }) => {
    return await createSystemMessage(ctx, chatId, bubbleType, messageKey, language, variables, metadata);
  },
});

export const sendInitialInstructions = mutation({
  args: {
    chatId: v.id("chats"),
    categoryId: v.id("categories"),
    language: v.union(v.literal("en"), v.literal("fr"), v.literal("ar")),
  },
  handler: async (ctx, { chatId, categoryId, language }) => {
    
    const category = await ctx.db.get(categoryId);
    if (!category) {
      throw new Error("Category not found");
    }

    const categoryName = language === "ar" ? category.name_ar 
      : language === "fr" ? category.name_fr 
      : category.name_en;

    // Send welcome message
    await createSystemMessage(ctx, chatId, "system_instruction", "welcome", language, 
      { categoryName }, { step: 1, nextAction: "voice_recording", categoryName, isInitialInstruction: true });

    // Send voice recording prompt
    await createSystemMessage(ctx, chatId, "system_instruction", "voice_instruction", language,
      {}, { step: 2, nextAction: "voice_recording", promptType: "voice_instruction", isInitialInstruction: true });

    return { success: true };
  },
});
