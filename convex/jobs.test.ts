// convex/jobs.test.ts
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { Id } from "./_generated/dataModel";

// Helper function to create test user
async function createTestUser(t: any, userType: "customer" | "worker" = "customer") {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      phone: `+222${Math.floor(Math.random() * 100000000)}`,
      password_hash: "hashed_password",
      name: `Test ${userType}`,
      user_type: userType,
      balance: 0,
      approval_status: "approved",
      cancellation_count: 0,
      priority_score: 100,
      created_at: Date.now(),
    });
  });
}

// Helper function to create test category
async function createTestCategory(t: any) {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("categories", {
      name_en: "Test Service",
      name_fr: "Service Test",
      name_ar: "خدمة تجريبية",
      photo_url: "https://example.com/photo.jpg",
      requires_photos: true,
      requires_work_code: true,
      level: 0,
    });
  });
}

// Helper function to create test chat with messages
async function createTestChatWithMessages(t: any, customerId: Id<"users">, categoryId: Id<"categories">) {
  const chatId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("chats", {
      customer_id: customerId,
      category_id: categoryId,
      is_cleared: false,
      created_at: Date.now(),
    });
  });

  // Create messages in current month
  await t.run(async (ctx: any) => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const messages = [
      {
        chat_id: chatId,
        year_month: currentMonth,
        sender_id: customerId,
        bubble_type: "system_instruction",
        content: "Welcome message",
        metadata: { isSystemGenerated: true },
        is_dismissed: false,
        created_at: Date.now() - 5000,
        status: "sent",
      },
      {
        chat_id: chatId,
        year_month: currentMonth,
        sender_id: customerId,
        bubble_type: "voice",
        content: "https://example.com/voice.mp3",
        metadata: { duration: 30 },
        is_dismissed: false,
        created_at: Date.now() - 4000,
        status: "sent",
      },
      {
        chat_id: chatId,
        year_month: currentMonth,
        sender_id: customerId,
        bubble_type: "date",
        content: new Date().toISOString(),
        metadata: { selectedDate: new Date().toISOString() },
        is_dismissed: false,
        created_at: Date.now() - 3000,
        status: "sent",
      },
      {
        chat_id: chatId,
        year_month: currentMonth,
        sender_id: customerId,
        bubble_type: "photo",
        content: "https://example.com/photo.jpg",
        metadata: { uploadId: "upload_123" },
        is_dismissed: false,
        created_at: Date.now() - 2000,
        status: "sent",
      }
    ];

    for (const message of messages) {
      await ctx.db.insert("messages", message);
    }

    // Create message partition
    await ctx.db.insert("message_partitions", {
      chat_id: chatId,
      year_month: currentMonth,
      message_count: messages.length,
      created_at: Date.now(),
    });
  });

  return chatId;
}

describe("Jobs functionality", () => {
  test("createJobFromChat creates job successfully with all required data", async () => {
    const t = convexTest(schema);

    const customerId = await createTestUser(t, "customer");
    const categoryId = await createTestCategory(t);
    const chatId = await createTestChatWithMessages(t, customerId, categoryId);

    const jobData = {
      chatId,
      locationLat: 18.0735,
      locationLng: -15.9582,
      priceFloor: 5000,
      portfolioConsent: true,
    };

    const job = await t.mutation(api.jobs.createJobFromChat, jobData);

    expect(job).toBeDefined();
    expect(job).not.toBeNull();
    
    if (job) {
      expect(job.customer_id).toBe(customerId);
      expect(job.category_id).toBe(categoryId);
      expect(job.voice_url).toBe("https://example.com/voice.mp3");
      expect(job.photos).toEqual(["https://example.com/photo.jpg"]);
      expect(job.location_lat).toBe(18.0735);
      expect(job.location_lng).toBe(-15.9582);
      expect(job.price_floor).toBe(5000);
      expect(job.portfolio_consent).toBe(true);
      expect(job.status).toBe("posted");
      expect(job.work_code).toMatch(/^\d{6}$/);
    }
  });

  test("createJobFromChat throws error when voice message missing", async () => {
    const t = convexTest(schema);

    const customerId = await createTestUser(t, "customer");
    const categoryId = await createTestCategory(t);
    
    // Create chat without voice message
    const chatId = await t.run(async (ctx: any) => {
      const chat = await ctx.db.insert("chats", {
        customer_id: customerId,
        category_id: categoryId,
        is_cleared: false,
        created_at: Date.now(),
      });

      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      // Add only text message, no voice
      await ctx.db.insert("messages", {
        chat_id: chat,
        year_month: yearMonth,
        sender_id: customerId,
        bubble_type: "text",
        content: "Text message only",
        metadata: {},
        is_dismissed: false,
        created_at: Date.now(),
        status: "sent",
      });

      return chat;
    });

    await expect(
      t.mutation(api.jobs.createJobFromChat, {
        chatId,
        locationLat: 18.0735,
        locationLng: -15.9582,
        priceFloor: 5000,
        portfolioConsent: true,
      })
    ).rejects.toThrow("Voice recording is required to create job");
  });

  test("cancelJobAndClearChat completely resets chat to fresh state", async () => {
    const t = convexTest(schema);

    const customerId = await createTestUser(t, "customer");
    const categoryId = await createTestCategory(t);
    const chatId = await createTestChatWithMessages(t, customerId, categoryId);

    // Create job first
    const job = await t.mutation(api.jobs.createJobFromChat, {
      chatId,
      locationLat: 18.0735,
      locationLng: -15.9582,
      priceFloor: 5000,
      portfolioConsent: true,
    });

    expect(job).toBeDefined();
    expect(job).not.toBeNull();
    
    if (!job) {
      throw new Error("Job creation failed");
    }

    // Verify initial state has messages
    const initialMessages = await t.run(async (ctx: any) => {
      return await ctx.db.query("messages")
        .filter((q: any) => q.eq(q.field("chat_id"), chatId))
        .collect();
    });
    expect(initialMessages.length).toBeGreaterThan(0);

    // Cancel job and clear chat
    const result = await t.mutation(api.jobs.cancelJobAndClearChat, {
      jobId: job._id,
      userId: customerId,
      phase: "bidding",
    });

    expect(result.success).toBe(true);
    expect(result.chatReset).toBe(true);

    // Verify ALL messages are deleted
    const remainingMessages = await t.run(async (ctx: any) => {
      return await ctx.db.query("messages")
        .filter((q: any) => q.eq(q.field("chat_id"), chatId))
        .collect();
    });
    expect(remainingMessages).toHaveLength(0);

    // Verify ALL message partitions are deleted
    const remainingPartitions = await t.run(async (ctx: any) => {
      return await ctx.db.query("message_partitions")
        .withIndex("by_chat", (q: any) => q.eq("chat_id", chatId))
        .collect();
    });
    expect(remainingPartitions).toHaveLength(0);

    // Verify chat is reset to fresh state
    const resetChat = await t.run(async (ctx: any) => {
      return await ctx.db.get(chatId);
    });
    expect(resetChat?.job_id).toBeUndefined();
    expect(resetChat?.worker_id).toBeUndefined();
    expect(resetChat?.is_cleared).toBe(false);
    expect(resetChat?.banner_info).toBeUndefined();
    
    // Essential fields should remain
    expect(resetChat?.customer_id).toBe(customerId);
    expect(resetChat?.category_id).toBe(categoryId);

    // Verify job is cancelled but preserved
    const cancelledJob = await t.run(async (ctx: any) => {
      return await ctx.db.get(job._id);
    });
    expect(cancelledJob?.status).toBe("cancelled");
    expect(cancelledJob?.cancelled_at_phase).toBe("bidding");
  });
});

describe("Error handling", () => {
  test("cancelJobAndClearChat throws error for completed job", async () => {
    const t = convexTest(schema);

    const customerId = await createTestUser(t, "customer");
    const categoryId = await createTestCategory(t);
    const chatId = await createTestChatWithMessages(t, customerId, categoryId);

    const job = await t.mutation(api.jobs.createJobFromChat, {
      chatId,
      locationLat: 18.0735,
      locationLng: -15.9582,
      priceFloor: 5000,
      portfolioConsent: true,
    });

    expect(job).toBeDefined();
    expect(job).not.toBeNull();
    
    if (!job) {
      throw new Error("Job creation failed");
    }

    // Mark job as completed
    await t.run(async (ctx: any) => {
      await ctx.db.patch(job._id, { status: "completed" });
    });

    await expect(
      t.mutation(api.jobs.cancelJobAndClearChat, {
        jobId: job._id,
        userId: customerId,
        phase: "bidding",
      })
    ).rejects.toThrow("Cannot cancel a completed job");
  });

  test("cancelJobAndClearChat throws error for wrong user", async () => {
    const t = convexTest(schema);

    const customerId = await createTestUser(t, "customer");
    const wrongUserId = await createTestUser(t, "customer");
    const categoryId = await createTestCategory(t);
    const chatId = await createTestChatWithMessages(t, customerId, categoryId);

    const job = await t.mutation(api.jobs.createJobFromChat, {
      chatId,
      locationLat: 18.0735,
      locationLng: -15.9582,
      priceFloor: 5000,
      portfolioConsent: true,
    });

    expect(job).toBeDefined();
    expect(job).not.toBeNull();
    
    if (!job) {
      throw new Error("Job creation failed");
    }

    await expect(
      t.mutation(api.jobs.cancelJobAndClearChat, {
        jobId: job._id,
        userId: wrongUserId,
        phase: "bidding",
      })
    ).rejects.toThrow("Only the job creator can cancel this job");
  });
});

describe("Job data and analytics", () => {
  test("getJobBubbleData returns correct job information", async () => {
    const t = convexTest(schema);

    const customerId = await createTestUser(t, "customer");
    const workerId = await createTestUser(t, "worker");
    const categoryId = await createTestCategory(t);
    const chatId = await createTestChatWithMessages(t, customerId, categoryId);

    const job = await t.mutation(api.jobs.createJobFromChat, {
      chatId,
      locationLat: 18.0735,
      locationLng: -15.9582,
      priceFloor: 5000,
      portfolioConsent: true,
    });

    expect(job).toBeDefined();
    expect(job).not.toBeNull();
    
    if (!job) {
      throw new Error("Job creation failed");
    }

    // Add job view
    await t.mutation(api.jobs.recordJobView, {
      jobId: job._id,
      workerId: workerId,
    });

    const jobData = await t.query(api.jobs.getJobBubbleData, {
      jobId: job._id,
    });

    expect(jobData).toBeDefined();
    expect(jobData).not.toBeNull();
    
    if (jobData) {
      expect(jobData.jobId).toBe(job._id);
      expect(jobData.status).toBe("posted");
      expect(jobData.voiceUrl).toBe("https://example.com/voice.mp3");
      expect(jobData.photos).toEqual(["https://example.com/photo.jpg"]);
      expect(jobData.viewCount).toBe(1);
    }
  });

  test("recordJobView prevents duplicate views from same worker", async () => {
    const t = convexTest(schema);

    const customerId = await createTestUser(t, "customer");
    const workerId = await createTestUser(t, "worker");
    const categoryId = await createTestCategory(t);
    const chatId = await createTestChatWithMessages(t, customerId, categoryId);

    const job = await t.mutation(api.jobs.createJobFromChat, {
      chatId,
      locationLat: 18.0735,
      locationLng: -15.9582,
      priceFloor: 5000,
      portfolioConsent: true,
    });

    expect(job).toBeDefined();
    expect(job).not.toBeNull();
    
    if (!job) {
      throw new Error("Job creation failed");
    }

    // First view
    const result1 = await t.mutation(api.jobs.recordJobView, {
      jobId: job._id,
      workerId: workerId,
    });
    expect(result1.success).toBe(true);
    expect(result1.alreadyViewed).toBe(false);

    // Second view from same worker
    const result2 = await t.mutation(api.jobs.recordJobView, {
      jobId: job._id,
      workerId: workerId,
    });
    expect(result2.success).toBe(true);
    expect(result2.alreadyViewed).toBe(true);

    // Verify view count is still 1
    const viewCount = await t.query(api.jobs.getJobViewCount, {
      jobId: job._id,
    });
    expect(viewCount).toBe(1);
  });
});