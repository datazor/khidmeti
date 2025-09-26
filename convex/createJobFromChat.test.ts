/**
 * Comprehensive tests for createJobFromChat function
 * Tests conversation validation, job creation, and all edge cases
 */

// convex/createJobFromChat.test.ts
import { convexTest } from "convex-test";
import { test, expect, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

// Helper function to create complete chat setup with conversation
async function createCompleteConversationSetup(t: any, categoryOptions = {}) {
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
      ...categoryOptions,
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

// Helper to add conversation messages
async function addConversationMessages(t: any, chatId: string, customerId: string, options = {}) {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const baseTime = Date.now();

  const defaultOptions = {
    includeVoice: true,
    includeConfirmation: true,
    includeDate: true,
    includePhotos: false,
    confirmationValue: "yes",
  };

  const opts = { ...defaultOptions, ...options };

  await t.run(async (ctx: any) => {
    let messageTime = baseTime;

    // Add system welcome message
    await ctx.db.insert("messages", {
      chat_id: chatId,
      year_month: yearMonth,
      sender_id: customerId,
      bubble_type: "system_instruction",
      content: "Welcome! Please describe your service request.",
      metadata: { isSystemGenerated: true },
      is_dismissed: false,
      created_at: messageTime++,
    });

    // Add voice message if requested
    if (opts.includeVoice) {
      await ctx.db.insert("messages", {
        chat_id: chatId,
        year_month: yearMonth,
        sender_id: customerId,
        bubble_type: "voice",
        content: "https://storage.convex.dev/audio/plumbing_issue.mp3",
        metadata: { duration: 45 },
        is_dismissed: false,
        created_at: messageTime++,
      });
    }

    // Add confirmation if requested
    if (opts.includeConfirmation) {
      await ctx.db.insert("messages", {
        chat_id: chatId,
        year_month: yearMonth,
        sender_id: customerId,
        bubble_type: "confirmation",
        content: opts.confirmationValue,
        metadata: { question: "Is this description accurate?" },
        is_dismissed: false,
        created_at: messageTime++,
      });
    }

    // Add date selection if requested
    if (opts.includeDate) {
      await ctx.db.insert("messages", {
        chat_id: chatId,
        year_month: yearMonth,
        sender_id: customerId,
        bubble_type: "date",
        content: "2025-09-20T14:30:00Z",
        metadata: { timezone: "Africa/Nouakchott" },
        is_dismissed: false,
        created_at: messageTime++,
      });
    }

    // Add photos if requested
    if (opts.includePhotos) {
      await ctx.db.insert("messages", {
        chat_id: chatId,
        year_month: yearMonth,
        sender_id: customerId,
        bubble_type: "photo",
        content: "https://storage.convex.dev/images/problem1.jpg",
        metadata: { caption: "Broken pipe" },
        is_dismissed: false,
        created_at: messageTime++,
      });

      await ctx.db.insert("messages", {
        chat_id: chatId,
        year_month: yearMonth,
        sender_id: customerId,
        bubble_type: "photo",
        content: "https://storage.convex.dev/images/problem2.jpg",
        metadata: { caption: "Water damage" },
        is_dismissed: false,
        created_at: messageTime++,
      });
    }
  });
}

describe("createJobFromChat", () => {
  test("creates job successfully with complete conversation", async () => {
    const t = convexTest(schema);
    const { customerId, categoryId, chatId } = await createCompleteConversationSetup(t);
    
    await addConversationMessages(t, chatId, customerId);

    const job = await t.mutation(api.jobs.createJobFromChat, {
      chatId,
      locationLat: 18.0735,
      locationLng: -15.9582,
      priceFloor: 5000,
      portfolioConsent: true,
    });

    expect(job).toBeDefined();
    expect(job!.customer_id).toBe(customerId);
    expect(job!.category_id).toBe(categoryId);
    expect(job!.voice_url).toBe("https://storage.convex.dev/audio/plumbing_issue.mp3");
    expect(job!.location_lat).toBe(18.0735);
    expect(job!.location_lng).toBe(-15.9582);
    expect(job!.price_floor).toBe(5000);
    expect(job!.portfolio_consent).toBe(true);
    expect(job!.status).toBe("posted");
    expect(job!.photos).toEqual([]);
    expect(job!.subcategory_id).toBeUndefined();
    expect(job!.categorizer_worker_ids).toEqual([]);
    expect(job!.broadcasting_phase).toBe(0);
    
    // Check that 6-digit work code was generated
    expect(job!.work_code).toBeDefined();
    expect(job!.work_code).toMatch(/^\d{6}$/);
  });

  test("creates job with photos when provided", async () => {
    const t = convexTest(schema);
    const { customerId, categoryId, chatId } = await createCompleteConversationSetup(t);
    
    await addConversationMessages(t, chatId, customerId, { includePhotos: true });

    const job = await t.mutation(api.jobs.createJobFromChat, {
      chatId,
      locationLat: 18.0735,
      locationLng: -15.9582,
      priceFloor: 3000,
      portfolioConsent: false,
    });

    expect(job!.photos).toEqual([
      "https://storage.convex.dev/images/problem1.jpg",
      "https://storage.convex.dev/images/problem2.jpg"
    ]);
    expect(job!.portfolio_consent).toBe(false);
    expect(job!.work_code).toMatch(/^\d{6}$/);
  });

  test("generates unique 6-digit work codes", async () => {
    const t = convexTest(schema);
    
    // Create two separate chats and jobs
    const setup1 = await createCompleteConversationSetup(t);
    const setup2 = await createCompleteConversationSetup(t);
    
    await addConversationMessages(t, setup1.chatId, setup1.customerId);
    await addConversationMessages(t, setup2.chatId, setup2.customerId);

    const job1 = await t.mutation(api.jobs.createJobFromChat, {
      chatId: setup1.chatId,
      locationLat: 18.0735,
      locationLng: -15.9582,
      priceFloor: 5000,
      portfolioConsent: true,
    });

    const job2 = await t.mutation(api.jobs.createJobFromChat, {
      chatId: setup2.chatId,
      locationLat: 18.0735,
      locationLng: -15.9582,
      priceFloor: 5000,
      portfolioConsent: true,
    });

    expect(job1!.work_code).toMatch(/^\d{6}$/);
    expect(job2!.work_code).toMatch(/^\d{6}$/);
    expect(job1!.work_code).not.toBe(job2!.work_code); // Should be different
  });

  test("links chat to created job", async () => {
    const t = convexTest(schema);
    const { customerId, categoryId, chatId } = await createCompleteConversationSetup(t);
    
    await addConversationMessages(t, chatId, customerId);

    const job = await t.mutation(api.jobs.createJobFromChat, {
      chatId,
      locationLat: 18.0735,
      locationLng: -15.9582,
      priceFloor: 4000,
      portfolioConsent: true,
    });

    // Check that chat is linked to job
    const updatedChat = await t.run(async (ctx: any) => {
      return await ctx.db.get(chatId);
    });

    expect(updatedChat!.job_id).toBe(job!._id);
  });

  test("sends job creation notification with work code", async () => {
    const t = convexTest(schema);
    const { customerId, categoryId, chatId } = await createCompleteConversationSetup(t);
    
    await addConversationMessages(t, chatId, customerId);

    const job = await t.mutation(api.jobs.createJobFromChat, {
      chatId,
      locationLat: 18.0735,
      locationLng: -15.9582,
      priceFloor: 4000,
      portfolioConsent: true,
    });

    // Check that notification message was sent
    const messages = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("messages")
        .filter((q: any) => q.eq(q.field("chat_id"), chatId))
        .collect();
    });

    const notificationMessage = messages.find((m: any) => 
      m.bubble_type === "system_notification" && 
      m.content === "Your service request has been posted successfully!"
    );

    expect(notificationMessage).toBeDefined();
    expect(notificationMessage!.metadata.isSystemGenerated).toBe(true);
    expect(notificationMessage!.metadata.messageKey).toBe("job_created");
    expect(notificationMessage!.metadata.workCode).toBe(job!.work_code);
  });

  test("throws error for non-existent chat", async () => {
    const t = convexTest(schema);
    const { chatId } = await createCompleteConversationSetup(t);

    const deletedChatId = await t.run(async (ctx: any) => {
      await ctx.db.delete(chatId);
      return chatId;
    });

    await expect(
      t.mutation(api.jobs.createJobFromChat, {
        chatId: deletedChatId,
        locationLat: 18.0735,
        locationLng: -15.9582,
        priceFloor: 4000,
        portfolioConsent: true,
      })
    ).rejects.toThrow("Chat not found");
  });

  test("throws error when job already exists for chat", async () => {
    const t = convexTest(schema);
    const { customerId, categoryId, chatId } = await createCompleteConversationSetup(t);
    
    await addConversationMessages(t, chatId, customerId);

    // Create job first time
    await t.mutation(api.jobs.createJobFromChat, {
      chatId,
      locationLat: 18.0735,
      locationLng: -15.9582,
      priceFloor: 4000,
      portfolioConsent: true,
    });

    // Try to create job again
    await expect(
      t.mutation(api.jobs.createJobFromChat, {
        chatId,
        locationLat: 18.0735,
        locationLng: -15.9582,
        priceFloor: 5000,
        portfolioConsent: false,
      })
    ).rejects.toThrow("Job already created for this chat");
  });

  test("throws error when voice recording is missing", async () => {
    const t = convexTest(schema);
    const { customerId, categoryId, chatId } = await createCompleteConversationSetup(t);
    
    await addConversationMessages(t, chatId, customerId, { includeVoice: false });

    await expect(
      t.mutation(api.jobs.createJobFromChat, {
        chatId,
        locationLat: 18.0735,
        locationLng: -15.9582,
        priceFloor: 4000,
        portfolioConsent: true,
      })
    ).rejects.toThrow("Voice recording is required to create job");
  });

  test("throws error when confirmation is missing", async () => {
    const t = convexTest(schema);
    const { customerId, categoryId, chatId } = await createCompleteConversationSetup(t);
    
    await addConversationMessages(t, chatId, customerId, { includeConfirmation: false });

    await expect(
      t.mutation(api.jobs.createJobFromChat, {
        chatId,
        locationLat: 18.0735,
        locationLng: -15.9582,
        priceFloor: 4000,
        portfolioConsent: true,
      })
    ).rejects.toThrow("Customer must confirm the description before creating job");
  });

  test("throws error when customer confirms 'no'", async () => {
    const t = convexTest(schema);
    const { customerId, categoryId, chatId } = await createCompleteConversationSetup(t);
    
    await addConversationMessages(t, chatId, customerId, { confirmationValue: "no" });

    await expect(
      t.mutation(api.jobs.createJobFromChat, {
        chatId,
        locationLat: 18.0735,
        locationLng: -15.9582,
        priceFloor: 4000,
        portfolioConsent: true,
      })
    ).rejects.toThrow("Customer must confirm the description before creating job");
  });

  test("throws error when date selection is missing", async () => {
    const t = convexTest(schema);
    const { customerId, categoryId, chatId } = await createCompleteConversationSetup(t);
    
    await addConversationMessages(t, chatId, customerId, { includeDate: false });

    await expect(
      t.mutation(api.jobs.createJobFromChat, {
        chatId,
        locationLat: 18.0735,
        locationLng: -15.9582,
        priceFloor: 4000,
        portfolioConsent: true,
      })
    ).rejects.toThrow("Date selection is required to create job");
  });

  test("creates job successfully without photos (photos always optional)", async () => {
    const t = convexTest(schema);
    const { customerId, categoryId, chatId } = await createCompleteConversationSetup(t, {
      requires_photos: true // This is for completion, not creation
    });
    
    await addConversationMessages(t, chatId, customerId, { includePhotos: false });

    const job = await t.mutation(api.jobs.createJobFromChat, {
      chatId,
      locationLat: 18.0735,
      locationLng: -15.9582,
      priceFloor: 4000,
      portfolioConsent: true,
    });

    expect(job).toBeDefined();
    expect(job!.photos).toEqual([]);
    expect(job!.work_code).toMatch(/^\d{6}$/);
  });

  test("creates job successfully with photos when requires_photos is true", async () => {
    const t = convexTest(schema);
    const { customerId, categoryId, chatId } = await createCompleteConversationSetup(t, {
      requires_photos: true // This is for completion, photos still optional for creation
    });
    
    await addConversationMessages(t, chatId, customerId, { includePhotos: true });

    const job = await t.mutation(api.jobs.createJobFromChat, {
      chatId,
      locationLat: 18.0735,
      locationLng: -15.9582,
      priceFloor: 4000,
      portfolioConsent: true,
    });

    expect(job).toBeDefined();
    expect(job!.photos).toHaveLength(2);
  });

  test("ignores system messages when extracting conversation data", async () => {
    const t = convexTest(schema);
    const { customerId, categoryId, chatId } = await createCompleteConversationSetup(t);
    
    // Add lots of system messages that should be ignored
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    await t.run(async (ctx: any) => {
      // Add system voice message (should be ignored)
      await ctx.db.insert("messages", {
        chat_id: chatId,
        year_month: yearMonth,
        sender_id: customerId,
        bubble_type: "voice",
        content: "https://storage.convex.dev/audio/system_voice.mp3",
        metadata: { isSystemGenerated: true },
        is_dismissed: false,
        created_at: Date.now(),
      });

      // Add system confirmation (should be ignored)
      await ctx.db.insert("messages", {
        chat_id: chatId,
        year_month: yearMonth,
        sender_id: customerId,
        bubble_type: "confirmation",
        content: "yes",
        metadata: { isSystemGenerated: true },
        is_dismissed: false,
        created_at: Date.now(),
      });
    });

    await addConversationMessages(t, chatId, customerId);

    const job = await t.mutation(api.jobs.createJobFromChat, {
      chatId,
      locationLat: 18.0735,
      locationLng: -15.9582,
      priceFloor: 4000,
      portfolioConsent: true,
    });

    // Should use the user voice message, not system one
    expect(job!.voice_url).toBe("https://storage.convex.dev/audio/plumbing_issue.mp3");
  });

  test("uses first voice message when multiple exist", async () => {
    const t = convexTest(schema);
    const { customerId, categoryId, chatId } = await createCompleteConversationSetup(t);
    
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    await t.run(async (ctx: any) => {
      // Add first voice message
      await ctx.db.insert("messages", {
        chat_id: chatId,
        year_month: yearMonth,
        sender_id: customerId,
        bubble_type: "voice",
        content: "https://storage.convex.dev/audio/first_voice.mp3",
        is_dismissed: false,
        created_at: Date.now(),
      });

      // Add second voice message (should be ignored)
      await ctx.db.insert("messages", {
        chat_id: chatId,
        year_month: yearMonth,
        sender_id: customerId,
        bubble_type: "voice",
        content: "https://storage.convex.dev/audio/second_voice.mp3",
        is_dismissed: false,
        created_at: Date.now() + 1000,
      });
    });

    await addConversationMessages(t, chatId, customerId, { includeVoice: false });

    const job = await t.mutation(api.jobs.createJobFromChat, {
      chatId,
      locationLat: 18.0735,
      locationLng: -15.9582,
      priceFloor: 4000,
      portfolioConsent: true,
    });

    expect(job!.voice_url).toBe("https://storage.convex.dev/audio/first_voice.mp3");
  });

  test("handles edge case with zero price floor", async () => {
    const t = convexTest(schema);
    const { customerId, categoryId, chatId } = await createCompleteConversationSetup(t);
    
    await addConversationMessages(t, chatId, customerId);

    const job = await t.mutation(api.jobs.createJobFromChat, {
      chatId,
      locationLat: 18.0735,
      locationLng: -15.9582,
      priceFloor: 0,
      portfolioConsent: true,
    });

    expect(job!.price_floor).toBe(0);
    expect(job!.work_code).toMatch(/^\d{6}$/);
  });

  test("handles conversation with all message types", async () => {
    const t = convexTest(schema);
    const { customerId, categoryId, chatId } = await createCompleteConversationSetup(t);
    
    await addConversationMessages(t, chatId, customerId, { 
      includePhotos: true,
      includeVoice: true,
      includeConfirmation: true,
      includeDate: true 
    });

    const job = await t.mutation(api.jobs.createJobFromChat, {
      chatId,
      locationLat: 18.0735,
      locationLng: -15.9582,
      priceFloor: 10000,
      portfolioConsent: true,
    });

    expect(job!.voice_url).toBe("https://storage.convex.dev/audio/plumbing_issue.mp3");
    expect(job!.photos).toHaveLength(2);
    expect(job!.price_floor).toBe(10000);
    expect(job!.work_code).toMatch(/^\d{6}$/);
  });

  test("work code is included in notification metadata", async () => {
    const t = convexTest(schema);
    const { customerId, categoryId, chatId } = await createCompleteConversationSetup(t);
    
    await addConversationMessages(t, chatId, customerId);

    const job = await t.mutation(api.jobs.createJobFromChat, {
      chatId,
      locationLat: 18.0735,
      locationLng: -15.9582,
      priceFloor: 4000,
      portfolioConsent: true,
    });

    // Verify work code is 6 digits
    expect(job!.work_code).toMatch(/^\d{6}$/);
    const workCode = job!.work_code!;

    // Check notification includes work code
    const messages = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("messages")
        .filter((q: any) => q.eq(q.field("chat_id"), chatId))
        .collect();
    });

    const notificationMessage = messages.find((m: any) => 
      m.bubble_type === "system_notification"
    );

    expect(notificationMessage!.metadata.workCode).toBe(workCode);
  });
});

  test("ignores system messages when extracting conversation data", async () => {
    const t = convexTest(schema);
    const { customerId, categoryId, chatId } = await createCompleteConversationSetup(t);
    
    // Add lots of system messages that should be ignored
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    await t.run(async (ctx: any) => {
      // Add system voice message (should be ignored)
      await ctx.db.insert("messages", {
        chat_id: chatId,
        year_month: yearMonth,
        sender_id: customerId,
        bubble_type: "voice",
        content: "https://storage.convex.dev/audio/system_voice.mp3",
        metadata: { isSystemGenerated: true },
        is_dismissed: false,
        created_at: Date.now(),
      });

      // Add system confirmation (should be ignored)
      await ctx.db.insert("messages", {
        chat_id: chatId,
        year_month: yearMonth,
        sender_id: customerId,
        bubble_type: "confirmation",
        content: "yes",
        metadata: { isSystemGenerated: true },
        is_dismissed: false,
        created_at: Date.now(),
      });
    });

    await addConversationMessages(t, chatId, customerId);

    const job = await t.mutation(api.jobs.createJobFromChat, {
      chatId,
      locationLat: 18.0735,
      locationLng: -15.9582,
      priceFloor: 4000,
      portfolioConsent: true,
    });

    // Should use the user voice message, not system one
    expect(job!.voice_url).toBe("https://storage.convex.dev/audio/plumbing_issue.mp3");
  });

  test("uses first voice message when multiple exist", async () => {
    const t = convexTest(schema);
    const { customerId, categoryId, chatId } = await createCompleteConversationSetup(t);
    
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    await t.run(async (ctx: any) => {
      // Add first voice message
      await ctx.db.insert("messages", {
        chat_id: chatId,
        year_month: yearMonth,
        sender_id: customerId,
        bubble_type: "voice",
        content: "https://storage.convex.dev/audio/first_voice.mp3",
        is_dismissed: false,
        created_at: Date.now(),
      });

      // Add second voice message (should be ignored)
      await ctx.db.insert("messages", {
        chat_id: chatId,
        year_month: yearMonth,
        sender_id: customerId,
        bubble_type: "voice",
        content: "https://storage.convex.dev/audio/second_voice.mp3",
        is_dismissed: false,
        created_at: Date.now() + 1000,
      });
    });

    await addConversationMessages(t, chatId, customerId, { includeVoice: false });

    const job = await t.mutation(api.jobs.createJobFromChat, {
      chatId,
      locationLat: 18.0735,
      locationLng: -15.9582,
      priceFloor: 4000,
      portfolioConsent: true,
    });

    expect(job!.voice_url).toBe("https://storage.convex.dev/audio/first_voice.mp3");
  });

  test("handles edge case with zero price floor", async () => {
    const t = convexTest(schema);
    const { customerId, categoryId, chatId } = await createCompleteConversationSetup(t);
    
    await addConversationMessages(t, chatId, customerId);

    const job = await t.mutation(api.jobs.createJobFromChat, {
      chatId,
      locationLat: 18.0735,
      locationLng: -15.9582,
      priceFloor: 0,
      portfolioConsent: true,
    });

    expect(job!.price_floor).toBe(0);
    expect(job!.work_code).toMatch(/^\d{6}$/);
  });

  test("handles conversation with all message types", async () => {
    const t = convexTest(schema);
    const { customerId, categoryId, chatId } = await createCompleteConversationSetup(t);
    
    await addConversationMessages(t, chatId, customerId, { 
      includePhotos: true,
      includeVoice: true,
      includeConfirmation: true,
      includeDate: true 
    });

    const job = await t.mutation(api.jobs.createJobFromChat, {
      chatId,
      locationLat: 18.0735,
      locationLng: -15.9582,
      priceFloor: 10000,
      portfolioConsent: true,
    });

    expect(job!.voice_url).toBe("https://storage.convex.dev/audio/plumbing_issue.mp3");
    expect(job!.photos).toHaveLength(2);
    expect(job!.price_floor).toBe(10000);
    expect(job!.work_code).toMatch(/^\d{6}$/);
  });

  test("work code is included in notification metadata", async () => {
    const t = convexTest(schema);
    const { customerId, categoryId, chatId } = await createCompleteConversationSetup(t);
    
    await addConversationMessages(t, chatId, customerId);

    const job = await t.mutation(api.jobs.createJobFromChat, {
      chatId,
      locationLat: 18.0735,
      locationLng: -15.9582,
      priceFloor: 4000,
      portfolioConsent: true,
    });

    // Verify work code is 6 digits
    expect(job!.work_code).toMatch(/^\d{6}$/);
    const workCode = job!.work_code!;

    // Check notification includes work code
    const messages = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("messages")
        .filter((q: any) => q.eq(q.field("chat_id"), chatId))
        .collect();
    });

    const notificationMessage = messages.find((m: any) => 
      m.bubble_type === "system_notification"
    );

    expect(notificationMessage!.metadata.workCode).toBe(workCode);
  });



describe("createJobFromChat", () => {
  let t: any;

  beforeEach(async () => {
    t = convexTest(schema);
  });

  test("should create job successfully with valid chat data", async () => {
    // Setup test data
    const customerId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        phone: "+1234567890",
        name: "Test Customer",
        user_type: "customer",
        approval_status: "approved",
        balance: 100,
        created_at: Date.now(),
      });
    });

    const categoryId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("categories", {
        name_en: "Plumbing",
        name_fr: "Plomberie",
        name_ar: "سباكة",
        parent_id: undefined,
        created_at: Date.now(),
      });
    });

    const chatId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("chats", {
        customer_id: customerId,
        category_id: categoryId,
        worker_id: undefined,
        job_id: undefined,
        is_cleared: false,
        created_at: Date.now(),
      });
    });

    // Create message partition
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    await t.run(async (ctx: any) => {
      await ctx.db.insert("message_partitions", {
        chat_id: chatId,
        year_month: yearMonth,
        message_count: 3,
        created_at: Date.now(),
      });
    });

    // Add required messages (voice, date selection)
    await t.run(async (ctx: any) => {
      // Voice message
      await ctx.db.insert("messages", {
        chat_id: chatId,
        year_month: yearMonth,
        sender_id: customerId,
        bubble_type: "voice",
        content: "https://example.com/voice.mp3",
        metadata: { duration: 30 },
        is_dismissed: false,
        created_at: Date.now(),
        status: "sent",
      });

      // Date selection message
      await ctx.db.insert("messages", {
        chat_id: chatId,
        year_month: yearMonth,
        sender_id: customerId,
        bubble_type: "date",
        content: "2025-01-01",
        metadata: {},
        is_dismissed: false,
        created_at: Date.now(),
        status: "sent",
      });

      // Photo message
      await ctx.db.insert("messages", {
        chat_id: chatId,
        year_month: yearMonth,
        sender_id: customerId,
        bubble_type: "photo",
        content: "https://example.com/photo.jpg",
        metadata: {},
        is_dismissed: false,
        created_at: Date.now(),
        status: "sent",
      });
    });

    // Execute the mutation
    const result = await t.mutation(api.jobs.createJobFromChat, {
      chatId,
      locationLat: 33.5731,
      locationLng: -7.5898,
      priceFloor: 500,
      portfolioConsent: true,
    });

    // Assertions
    expect(result).toBeDefined();
    expect(result!._id).toBeDefined();
    expect(result!.customer_id).toBe(customerId);
    expect(result!.category_id).toBe(categoryId);
    expect(result!.voice_url).toBe("https://example.com/voice.mp3");
    expect(result!.voice_duration).toBe(30);
    expect(result!.photos).toEqual(["https://example.com/photo.jpg"]);
    expect(result!.location_lat).toBe(33.5731);
    expect(result!.location_lng).toBe(-7.5898);
    expect(result!.price_floor).toBe(500);
    expect(result!.portfolio_consent).toBe(true);
    expect(result!.status).toBe("posted");
    expect(result!.broadcasting_phase).toBe(0);
    expect(result!.work_code).toMatch(/^\d{6}$/);

    // Verify chat is linked to job
    const updatedChat = await t.run(async (ctx: any) => {
      return await ctx.db.get(chatId);
    });
    expect(updatedChat.job_id).toBe(result!._id);

    // Verify job status bubble was created
    const jobBubbleMessage = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("messages")
        .withIndex("by_chat_partition", (q: any) => 
          q.eq("chat_id", chatId).eq("year_month", yearMonth)
        )
        .filter((q: any) => q.eq(q.field("bubble_type"), "job"))
        .first();
    });
    expect(jobBubbleMessage).toBeDefined();
    expect(jobBubbleMessage.content).toBe(result!._id);

    // Verify loading bubble was created
    const loadingBubbleMessage = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("messages")
        .withIndex("by_chat_partition", (q: any) => 
          q.eq("chat_id", chatId).eq("year_month", yearMonth)
        )
        .filter((q: any) => 
          q.and(
            q.eq(q.field("bubble_type"), "system_instruction"),
            q.eq(q.field("metadata.messageKey"), "job_posted_loading")
          )
        )
        .first();
    });
    expect(loadingBubbleMessage).toBeDefined();
  });

  test("should throw error when chat not found", async () => {
    const nonExistentChatId = "invalid_chat_id" as any;

    await expect(
      t.mutation(api.jobs.createJobFromChat, {
        chatId: nonExistentChatId,
        locationLat: 33.5731,
        locationLng: -7.5898,
        priceFloor: 500,
        portfolioConsent: true,
      })
    ).rejects.toThrow("Chat not found");
  });

  test("should throw error when job already exists for chat", async () => {
    // Setup test data
    const customerId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        phone: "+1234567890",
        name: "Test Customer",
        user_type: "customer",
        approval_status: "approved",
        balance: 100,
        created_at: Date.now(),
      });
    });

    const categoryId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("categories", {
        name_en: "Plumbing",
        name_fr: "Plomberie", 
        name_ar: "سباكة",
        parent_id: undefined,
        created_at: Date.now(),
      });
    });

    const existingJobId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jobs", {
        customer_id: customerId,
        category_id: categoryId,
        voice_url: "https://example.com/voice.mp3",
        photos: [],
        location_lat: 33.5731,
        location_lng: -7.5898,
        work_code: "123456",
        portfolio_consent: true,
        price_floor: 500,
        status: "posted",
        categorizer_worker_ids: [],
        broadcasting_phase: 0,
        created_at: Date.now(),
      });
    });

    const chatId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("chats", {
        customer_id: customerId,
        category_id: categoryId,
        worker_id: undefined,
        job_id: existingJobId, // Chat already has a job
        is_cleared: false,
        created_at: Date.now(),
      });
    });

    await expect(
      t.mutation(api.jobs.createJobFromChat, {
        chatId,
        locationLat: 33.5731,
        locationLng: -7.5898,
        priceFloor: 500,
        portfolioConsent: true,
      })
    ).rejects.toThrow("Job already created for this chat");
  });

  test("should throw error when category not found", async () => {
    const customerId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        phone: "+1234567890",
        name: "Test Customer",
        user_type: "customer",
        approval_status: "approved",
        balance: 100,
        created_at: Date.now(),
      });
    });

    const chatId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("chats", {
        customer_id: customerId,
        category_id: "invalid_category_id" as any,
        worker_id: undefined,
        job_id: undefined,
        is_cleared: false,
        created_at: Date.now(),
      });
    });

    await expect(
      t.mutation(api.jobs.createJobFromChat, {
        chatId,
        locationLat: 33.5731,
        locationLng: -7.5898,
        priceFloor: 500,
        portfolioConsent: true,
      })
    ).rejects.toThrow("Category not found");
  });

  test("should throw error when voice recording missing", async () => {
    // Setup test data without voice message
    const customerId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        phone: "+1234567890",
        name: "Test Customer",
        user_type: "customer",
        approval_status: "approved",
        balance: 100,
        created_at: Date.now(),
      });
    });

    const categoryId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("categories", {
        name_en: "Plumbing",
        name_fr: "Plomberie",
        name_ar: "سباكة",
        parent_id: undefined,
        created_at: Date.now(),
      });
    });

    const chatId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("chats", {
        customer_id: customerId,
        category_id: categoryId,
        worker_id: undefined,
        job_id: undefined,
        is_cleared: false,
        created_at: Date.now(),
      });
    });

    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    await t.run(async (ctx: any) => {
      await ctx.db.insert("message_partitions", {
        chat_id: chatId,
        year_month: yearMonth,
        message_count: 1,
        created_at: Date.now(),
      });

      // Only date message, no voice
      await ctx.db.insert("messages", {
        chat_id: chatId,
        year_month: yearMonth,
        sender_id: customerId,
        bubble_type: "date",
        content: "2025-01-01",
        metadata: {},
        is_dismissed: false,
        created_at: Date.now(),
        status: "sent",
      });
    });

    await expect(
      t.mutation(api.jobs.createJobFromChat, {
        chatId,
        locationLat: 33.5731,
        locationLng: -7.5898,
        priceFloor: 500,
        portfolioConsent: true,
      })
    ).rejects.toThrow("Voice recording is required to create job");
  });

  test("should throw error when date selection missing", async () => {
    // Setup test data without date message
    const customerId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        phone: "+1234567890",
        name: "Test Customer",
        user_type: "customer",
        approval_status: "approved",
        balance: 100,
        created_at: Date.now(),
      });
    });

    const categoryId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("categories", {
        name_en: "Plumbing",
        name_fr: "Plomberie",
        name_ar: "سباكة",
        parent_id: undefined,
        created_at: Date.now(),
      });
    });

    const chatId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("chats", {
        customer_id: customerId,
        category_id: categoryId,
        worker_id: undefined,
        job_id: undefined,
        is_cleared: false,
        created_at: Date.now(),
      });
    });

    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    await t.run(async (ctx: any) => {
      await ctx.db.insert("message_partitions", {
        chat_id: chatId,
        year_month: yearMonth,
        message_count: 1,
        created_at: Date.now(),
      });

      // Only voice message, no date
      await ctx.db.insert("messages", {
        chat_id: chatId,
        year_month: yearMonth,
        sender_id: customerId,
        bubble_type: "voice",
        content: "https://example.com/voice.mp3",
        metadata: { duration: 30 },
        is_dismissed: false,
        created_at: Date.now(),
        status: "sent",
      });
    });

    await expect(
      t.mutation(api.jobs.createJobFromChat, {
        chatId,
        locationLat: 33.5731,
        locationLng: -7.5898,
        priceFloor: 500,
        portfolioConsent: true,
      })
    ).rejects.toThrow("Date selection is required to create job");
  });
});