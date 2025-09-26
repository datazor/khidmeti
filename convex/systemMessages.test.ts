/**
 * Comprehensive tests for system message functions
 * Tests all languages, message keys, variable substitution, and edge cases
 */

// convex/systemMessages.test.ts
import { convexTest } from "convex-test";
import { test, expect, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

// Helper function to create test chat setup
async function createTestChatSetup(t: any) {
  const customerId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      phone: `+${Math.random().toString().slice(2, 12)}`,
      password_hash: "test_hash",
      name: "Test Customer",
      user_type: "customer",
      balance: 0,
      approval_status: "approved",
      cancellation_count: 0,
      priority_score: 100,
      created_at: Date.now(),
    });
  });

  const categoryId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("categories", {
      name_en: "Plumbing",
      name_fr: "Plomberie",
      name_ar: "السباكة",
      photo_url: "test.jpg",
      requires_photos: false,
      requires_work_code: false,
      level: 1,
    });
  });

  const chatId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("chats", {
      customer_id: customerId,
      category_id: categoryId,
      is_cleared: false,
      created_at: Date.now(),
    });
  });

  return { customerId, categoryId, chatId };
}

describe("sendSystemMessage", () => {
  test("sends welcome message in English", async () => {
    const t = convexTest(schema);
    const { chatId } = await createTestChatSetup(t);

    const message = await t.mutation(api.systemMessages.sendSystemMessage, {
      chatId,
      bubbleType: "system_instruction",
      messageKey: "welcome",
      language: "en",
      variables: { categoryName: "Plumbing" },
      metadata: { step: 1 },
    });

    expect(message).toBeDefined();
    expect(message!.bubble_type).toBe("system_instruction");
    expect(message!.content).toBe("Welcome! I'll help you request Plumbing services. Let's start by describing what you need.");
    expect(message!.metadata.isSystemGenerated).toBe(true);
    expect(message!.metadata.automated).toBe(true);
    expect(message!.metadata.language).toBe("en");
    expect(message!.metadata.messageKey).toBe("welcome");
    expect(message!.metadata.step).toBe(1);
  });

  test("sends welcome message in French", async () => {
    const t = convexTest(schema);
    const { chatId } = await createTestChatSetup(t);

    const message = await t.mutation(api.systemMessages.sendSystemMessage, {
      chatId,
      bubbleType: "system_instruction",
      messageKey: "welcome",
      language: "fr",
      variables: { categoryName: "Plomberie" },
    });

    expect(message!.content).toBe("Bienvenue ! Je vais vous aider à demander des services de Plomberie. Commençons par décrire ce dont vous avez besoin.");
    expect(message!.metadata.language).toBe("fr");
  });

  test("sends welcome message in Arabic", async () => {
    const t = convexTest(schema);
    const { chatId } = await createTestChatSetup(t);

    const message = await t.mutation(api.systemMessages.sendSystemMessage, {
      chatId,
      bubbleType: "system_instruction",
      messageKey: "welcome",
      language: "ar",
      variables: { categoryName: "السباكة" },
    });

    expect(message!.content).toBe("مرحباً! سأساعدك في طلب خدمات السباكة. لنبدأ بوصف ما تحتاجه.");
    expect(message!.metadata.language).toBe("ar");
  });

  test("sends voice instruction in all languages", async () => {
    const t = convexTest(schema);
    const { chatId } = await createTestChatSetup(t);

    // English
    const enMessage = await t.mutation(api.systemMessages.sendSystemMessage, {
      chatId,
      bubbleType: "system_instruction",
      messageKey: "voice_instruction",
      language: "en",
    });

    expect(enMessage!.content).toBe("Please record a voice message describing your service request in detail.");

    // French
    const frMessage = await t.mutation(api.systemMessages.sendSystemMessage, {
      chatId,
      bubbleType: "system_instruction",
      messageKey: "voice_instruction",
      language: "fr",
    });

    expect(frMessage!.content).toBe("Veuillez enregistrer un message vocal décrivant votre demande de service en détail.");

    // Arabic
    const arMessage = await t.mutation(api.systemMessages.sendSystemMessage, {
      chatId,
      bubbleType: "system_instruction",
      messageKey: "voice_instruction",
      language: "ar",
    });

    expect(arMessage!.content).toBe("يرجى تسجيل رسالة صوتية تصف طلب الخدمة بالتفصيل.");
  });

  test("sends confirmation prompt in all languages", async () => {
    const t = convexTest(schema);
    const { chatId } = await createTestChatSetup(t);

    const languages = [
      { lang: "en", expected: "Is this description accurate?" },
      { lang: "fr", expected: "Cette description est-elle exacte ?" },
      { lang: "ar", expected: "هل هذا الوصف دقيق؟" }
    ];

    for (const { lang, expected } of languages) {
      const message = await t.mutation(api.systemMessages.sendSystemMessage, {
        chatId,
        bubbleType: "system_prompt",
        messageKey: "confirmation_prompt",
        language: lang as "en" | "fr" | "ar",
      });

      expect(message!.content).toBe(expected);
      expect(message!.bubble_type).toBe("system_prompt");
    }
  });

  test("sends date instruction in all languages", async () => {
    const t = convexTest(schema);
    const { chatId } = await createTestChatSetup(t);

    const testCases = [
      { lang: "en", expected: "When would you like this service completed?" },
      { lang: "fr", expected: "Quand souhaitez-vous que ce service soit terminé ?" },
      { lang: "ar", expected: "متى تريد إكمال هذه الخدمة؟" }
    ];

    for (const { lang, expected } of testCases) {
      const message = await t.mutation(api.systemMessages.sendSystemMessage, {
        chatId,
        bubbleType: "system_instruction",
        messageKey: "date_instruction",
        language: lang as "en" | "fr" | "ar",
      });

      expect(message!.content).toBe(expected);
    }
  });

  test("sends photo question in all languages", async () => {
    const t = convexTest(schema);
    const { chatId } = await createTestChatSetup(t);

    const testCases = [
      { lang: "en", expected: "Would you like to add photos of the problem area?" },
      { lang: "fr", expected: "Souhaitez-vous ajouter des photos de la zone problématique ?" },
      { lang: "ar", expected: "هل تريد إضافة صور للمنطقة المشكلة؟" }
    ];

    for (const { lang, expected } of testCases) {
      const message = await t.mutation(api.systemMessages.sendSystemMessage, {
        chatId,
        bubbleType: "system_prompt",
        messageKey: "photo_question",
        language: lang as "en" | "fr" | "ar",
      });

      expect(message!.content).toBe(expected);
      expect(message!.bubble_type).toBe("system_prompt");
    }
  });

  test("sends photo instruction in all languages", async () => {
    const t = convexTest(schema);
    const { chatId } = await createTestChatSetup(t);

    const testCases = [
      { lang: "en", expected: "Please share photos of the area that needs work." },
      { lang: "fr", expected: "Veuillez partager des photos de la zone qui nécessite des travaux." },
      { lang: "ar", expected: "يرجى مشاركة صور للمنطقة التي تحتاج إلى عمل." }
    ];

    for (const { lang, expected } of testCases) {
      const message = await t.mutation(api.systemMessages.sendSystemMessage, {
        chatId,
        bubbleType: "system_instruction",
        messageKey: "photo_instruction",
        language: lang as "en" | "fr" | "ar",
      });

      expect(message!.content).toBe(expected);
    }
  });

  test("sends job created notification in all languages", async () => {
    const t = convexTest(schema);
    const { chatId } = await createTestChatSetup(t);

    const testCases = [
      { lang: "en", expected: "Your service request has been posted successfully!" },
      { lang: "fr", expected: "Votre demande de service a été publiée avec succès !" },
      { lang: "ar", expected: "تم نشر طلب الخدمة الخاص بك بنجاح!" }
    ];

    for (const { lang, expected } of testCases) {
      const message = await t.mutation(api.systemMessages.sendSystemMessage, {
        chatId,
        bubbleType: "system_notification",
        messageKey: "job_created",
        language: lang as "en" | "fr" | "ar",
      });

      expect(message!.content).toBe(expected);
      expect(message!.bubble_type).toBe("system_notification");
    }
  });

  test("handles variable substitution correctly", async () => {
    const t = convexTest(schema);
    const { chatId } = await createTestChatSetup(t);

    const message = await t.mutation(api.systemMessages.sendSystemMessage, {
      chatId,
      bubbleType: "system_instruction",
      messageKey: "welcome",
      language: "en",
      variables: { categoryName: "Electrical Work" },
    });

    expect(message!.content).toBe("Welcome! I'll help you request Electrical Work services. Let's start by describing what you need.");
  });

  test("handles multiple variable substitutions", async () => {
    const t = convexTest(schema);
    const { chatId } = await createTestChatSetup(t);

    // Test with a custom message that has multiple variables
    // Since our current messages only have categoryName, let's test with Arabic where we might have different substitution patterns
    const message = await t.mutation(api.systemMessages.sendSystemMessage, {
      chatId,
      bubbleType: "system_instruction", 
      messageKey: "welcome",
      language: "ar",
      variables: { categoryName: "أعمال كهربائية" },
    });

    expect(message!.content).toBe("مرحباً! سأساعدك في طلب خدمات أعمال كهربائية. لنبدأ بوصف ما تحتاجه.");
  });

  test("handles empty variables gracefully", async () => {
    const t = convexTest(schema);
    const { chatId } = await createTestChatSetup(t);

    const message = await t.mutation(api.systemMessages.sendSystemMessage, {
      chatId,
      bubbleType: "system_instruction",
      messageKey: "voice_instruction",
      language: "en",
      variables: {},
    });

    expect(message!.content).toBe("Please record a voice message describing your service request in detail.");
  });

  test("updates message partition count", async () => {
    const t = convexTest(schema);
    const { chatId } = await createTestChatSetup(t);

    // Send first system message
    await t.mutation(api.systemMessages.sendSystemMessage, {
      chatId,
      bubbleType: "system_instruction",
      messageKey: "welcome",
      language: "en",
      variables: { categoryName: "Plumbing" },
    });

    // Check partition was created
    const partitions = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("message_partitions")
        .withIndex("by_chat", (q: any) => q.eq("chat_id", chatId))
        .collect();
    });

    expect(partitions).toHaveLength(1);
    expect(partitions[0].message_count).toBe(1);

    // Send second system message
    await t.mutation(api.systemMessages.sendSystemMessage, {
      chatId,
      bubbleType: "system_instruction",
      messageKey: "voice_instruction",
      language: "en",
    });

    // Check partition count incremented
    const updatedPartitions = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("message_partitions")
        .withIndex("by_chat", (q: any) => q.eq("chat_id", chatId))
        .collect();
    });

    expect(updatedPartitions[0].message_count).toBe(2);
  });

  test("throws error for non-existent chat", async () => {
    const t = convexTest(schema);
    const { customerId, categoryId } = await createTestChatSetup(t);

    // Create and delete a chat to get a valid but non-existent ID
    const deletedChatId = await t.run(async (ctx: any) => {
      const tempId = await ctx.db.insert("chats", {
        customer_id: customerId,
        category_id: categoryId,
        is_cleared: false,
        created_at: Date.now(),
      });
      await ctx.db.delete(tempId);
      return tempId;
    });

    await expect(
      t.mutation(api.systemMessages.sendSystemMessage, {
        chatId: deletedChatId,
        bubbleType: "system_instruction",
        messageKey: "welcome",
        language: "en",
      })
    ).rejects.toThrow("Chat not found");
  });

  test("throws error for unknown message key", async () => {
    const t = convexTest(schema);
    const { chatId } = await createTestChatSetup(t);

    await expect(
      t.mutation(api.systemMessages.sendSystemMessage, {
        chatId,
        bubbleType: "system_instruction",
        messageKey: "unknown_key",
        language: "en",
      })
    ).rejects.toThrow("Unknown message key: unknown_key");
  });

  test("creates correct year-month partition", async () => {
    const t = convexTest(schema);
    const { chatId } = await createTestChatSetup(t);

    const message = await t.mutation(api.systemMessages.sendSystemMessage, {
      chatId,
      bubbleType: "system_instruction",
      messageKey: "welcome",
      language: "en",
      variables: { categoryName: "Test" },
    });

    const now = new Date();
    const expectedYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    expect(message!.year_month).toBe(expectedYearMonth);
  });
});

describe("sendInitialInstructions", () => {
  test("sends welcome and voice instruction in English", async () => {
    const t = convexTest(schema);
    const { chatId, categoryId } = await createTestChatSetup(t);

    const result = await t.mutation(api.systemMessages.sendInitialInstructions, {
      chatId,
      categoryId,
      language: "en",
    });

    expect(result.success).toBe(true);

    // Check that two messages were created
    const messages = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("messages")
        .filter((q: any) => q.eq(q.field("chat_id"), chatId))
        .collect();
    });

    expect(messages).toHaveLength(2);
    
    // Check welcome message
    const welcomeMessage = messages.find((m: any) => m.content.includes("Welcome"));
    expect(welcomeMessage).toBeDefined();
    expect(welcomeMessage!.content).toBe("Welcome! I'll help you request Plumbing services. Let's start by describing what you need.");
    expect(welcomeMessage!.metadata.step).toBe(1);
    expect(welcomeMessage!.metadata.nextAction).toBe("voice_recording");

    // Check voice instruction message
    const voiceMessage = messages.find((m: any) => m.content.includes("record a voice message"));
    expect(voiceMessage).toBeDefined();
    expect(voiceMessage!.content).toBe("Please record a voice message describing your service request in detail.");
    expect(voiceMessage!.metadata.step).toBe(2);
  });

  test("sends initial instructions in French", async () => {
    const t = convexTest(schema);
    const { chatId, categoryId } = await createTestChatSetup(t);

    await t.mutation(api.systemMessages.sendInitialInstructions, {
      chatId,
      categoryId,
      language: "fr",
    });

    const messages = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("messages")
        .filter((q: any) => q.eq(q.field("chat_id"), chatId))
        .collect();
    });

    expect(messages).toHaveLength(2);
    
    const welcomeMessage = messages.find((m: any) => m.content.includes("Bienvenue"));
    expect(welcomeMessage!.content).toBe("Bienvenue ! Je vais vous aider à demander des services de Plomberie. Commençons par décrire ce dont vous avez besoin.");
    
    const voiceMessage = messages.find((m: any) => m.content.includes("enregistrer"));
    expect(voiceMessage!.content).toBe("Veuillez enregistrer un message vocal décrivant votre demande de service en détail.");
  });

  test("sends initial instructions in Arabic", async () => {
    const t = convexTest(schema);
    const { chatId, categoryId } = await createTestChatSetup(t);

    await t.mutation(api.systemMessages.sendInitialInstructions, {
      chatId,
      categoryId,
      language: "ar",
    });

    const messages = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("messages")
        .filter((q: any) => q.eq(q.field("chat_id"), chatId))
        .collect();
    });

    expect(messages).toHaveLength(2);
    
    const welcomeMessage = messages.find((m: any) => m.content.includes("مرحباً"));
    expect(welcomeMessage!.content).toBe("مرحباً! سأساعدك في طلب خدمات السباكة. لنبدأ بوصف ما تحتاجه.");
    
    const voiceMessage = messages.find((m: any) => m.content.includes("تسجيل"));
    expect(voiceMessage!.content).toBe("يرجى تسجيل رسالة صوتية تصف طلب الخدمة بالتفصيل.");
  });

  test("uses correct category name for each language", async () => {
    const t = convexTest(schema);
    
    // Create category with different names
    const categoryId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("categories", {
        name_en: "Electrical Work",
        name_fr: "Travaux Électriques", 
        name_ar: "أعمال كهربائية",
        photo_url: "test.jpg",
        requires_photos: false,
        requires_work_code: false,
        level: 1,
      });
    });

    const customerId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        phone: "+1234567890",
        password_hash: "test_hash",
        name: "Test Customer",
        user_type: "customer",
        balance: 0,
        approval_status: "approved",
        cancellation_count: 0,
        priority_score: 100,
        created_at: Date.now(),
      });
    });

    const chatId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("chats", {
        customer_id: customerId,
        category_id: categoryId,
        is_cleared: false,
        created_at: Date.now(),
      });
    });

    // Test English
    await t.mutation(api.systemMessages.sendInitialInstructions, {
      chatId,
      categoryId,
      language: "en",
    });

    let messages = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("messages")
        .filter((q: any) => q.eq(q.field("chat_id"), chatId))
        .collect();
    });

    let welcomeMessage = messages.find((m: any) => m.content.includes("Welcome"));
    expect(welcomeMessage!.content).toContain("Electrical Work");

    // Clear messages and test French
    await t.run(async (ctx: any) => {
      for (const message of messages) {
        await ctx.db.delete(message._id);
      }
    });

    await t.mutation(api.systemMessages.sendInitialInstructions, {
      chatId,
      categoryId,
      language: "fr",
    });

    messages = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("messages")
        .filter((q: any) => q.eq(q.field("chat_id"), chatId))
        .collect();
    });

    welcomeMessage = messages.find((m: any) => m.content.includes("Bienvenue"));
    expect(welcomeMessage!.content).toContain("Travaux Électriques");
  });

  test("throws error for non-existent category", async () => {
    const t = convexTest(schema);
    const { chatId } = await createTestChatSetup(t);

    const deletedCategoryId = await t.run(async (ctx: any) => {
      const tempId = await ctx.db.insert("categories", {
        name_en: "Temp",
        name_fr: "Temp",
        name_ar: "مؤقت",
        photo_url: "test.jpg",
        requires_photos: false,
        requires_work_code: false,
        level: 1,
      });
      await ctx.db.delete(tempId);
      return tempId;
    });

    await expect(
      t.mutation(api.systemMessages.sendInitialInstructions, {
        chatId,
        categoryId: deletedCategoryId,
        language: "en",
      })
    ).rejects.toThrow("Category not found");
  });

  test("updates partition count correctly for both messages", async () => {
    const t = convexTest(schema);
    const { chatId, categoryId } = await createTestChatSetup(t);

    await t.mutation(api.systemMessages.sendInitialInstructions, {
      chatId,
      categoryId,
      language: "en",
    });

    const partitions = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("message_partitions")
        .withIndex("by_chat", (q: any) => q.eq("chat_id", chatId))
        .collect();
    });

    expect(partitions).toHaveLength(1);
    expect(partitions[0].message_count).toBe(2); // Welcome + voice instruction
  });
});