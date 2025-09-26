// convex/chats.test.ts
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

// Helper function to add messages to a chat
async function addMessagesToChat(t: any, chatId: Id<"chats">, customerId: Id<"users">, messageCount: number = 3) {
  await t.run(async (ctx: any) => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const messages = [];
    for (let i = 0; i < messageCount; i++) {
      messages.push({
        chat_id: chatId,
        year_month: currentMonth,
        sender_id: customerId,
        bubble_type: "text",
        content: `Test message ${i + 1}`,
        metadata: {},
        is_dismissed: false,
        created_at: Date.now() - (messageCount - i) * 1000,
        status: "sent",
      });
    }

    for (const message of messages) {
      await ctx.db.insert("messages", message);
    }

    // Create message partition
    await ctx.db.insert("message_partitions", {
      chat_id: chatId,
      year_month: currentMonth,
      message_count: messageCount,
      created_at: Date.now(),
    });
  });
}

describe("Chat creation and retrieval", () => {
  test("getOrCreateCategoryChat creates new chat when none exists", async () => {
    const t = convexTest(schema);

    const customerId = await createTestUser(t, "customer");
    const categoryId = await createTestCategory(t);

    const chat = await t.mutation(api.chats.getOrCreateCategoryChat, {
      customerId,
      categoryId,
    });

    expect(chat).toBeDefined();
    expect(chat).not.toBeNull();

    if (chat) {
      expect(chat.customer_id).toBe(customerId);
      expect(chat.category_id).toBe(categoryId);
      expect(chat.is_cleared).toBe(false);
      expect(chat.job_id).toBeUndefined();
      expect(chat.worker_id).toBeUndefined();
      expect(chat.created_at).toBeDefined();
    }
  });

  test("getOrCreateCategoryChat returns existing chat with messages", async () => {
    const t = convexTest(schema);

    const customerId = await createTestUser(t, "customer");
    const categoryId = await createTestCategory(t);

    // Create initial chat
    const initialChat = await t.mutation(api.chats.getOrCreateCategoryChat, {
      customerId,
      categoryId,
    });

    expect(initialChat).not.toBeNull();
    if (!initialChat) throw new Error("Initial chat creation failed");

    // Add messages to the chat
    await addMessagesToChat(t, initialChat._id, customerId);

    // Try to get chat again - should return same chat
    const retrievedChat = await t.mutation(api.chats.getOrCreateCategoryChat, {
      customerId,
      categoryId,
    });

    expect(retrievedChat).not.toBeNull();
    if (retrievedChat) {
      expect(retrievedChat._id).toBe(initialChat._id);
      expect(retrievedChat.customer_id).toBe(customerId);
      expect(retrievedChat.category_id).toBe(categoryId);
    }
  });

  test("getOrCreateCategoryChat detects fresh chat after reset", async () => {
    const t = convexTest(schema);

    const customerId = await createTestUser(t, "customer");
    const categoryId = await createTestCategory(t);

    // Create chat and add messages
    const chat = await t.mutation(api.chats.getOrCreateCategoryChat, {
      customerId,
      categoryId,
    });

    expect(chat).not.toBeNull();
    if (!chat) throw new Error("Chat creation failed");

    await addMessagesToChat(t, chat._id, customerId);

    // Simulate complete reset by deleting all messages and partitions
    await t.run(async (ctx: any) => {
      // Delete all messages
      const messages = await ctx.db
        .query("messages")
        .filter((q: any) => q.eq(q.field("chat_id"), chat._id))
        .collect();
      
      for (const message of messages) {
        await ctx.db.delete(message._id);
      }

      // Delete all partitions
      const partitions = await ctx.db
        .query("message_partitions")
        .withIndex("by_chat", (q: any) => q.eq("chat_id", chat._id))
        .collect();
      
      for (const partition of partitions) {
        await ctx.db.delete(partition._id);
      }
    });

    // Get chat again - should detect it's fresh
    const freshChat = await t.mutation(api.chats.getOrCreateCategoryChat, {
      customerId,
      categoryId,
    });

    expect(freshChat).not.toBeNull();
    if (freshChat) {
      expect(freshChat._id).toBe(chat._id); // Same chat
      
      // Verify it's detected as fresh
      const isFresh = await t.query(api.chats.isChatFresh, {
        chatId: freshChat._id,
      });
      expect(isFresh).toBe(true);
    }
  });
});

describe("Message retrieval", () => {
  test("getChatMessages returns empty for fresh chat", async () => {
    const t = convexTest(schema);

    const customerId = await createTestUser(t, "customer");
    const categoryId = await createTestCategory(t);

    const chat = await t.mutation(api.chats.getOrCreateCategoryChat, {
      customerId,
      categoryId,
    });

    expect(chat).not.toBeNull();
    if (!chat) throw new Error("Chat creation failed");

    const messages = await t.query(api.chats.getChatMessages, {
      chatId: chat._id,
      paginationOpts: { numItems: 50, cursor: null },
    });

    expect(messages.page).toHaveLength(0);
    expect(messages.isDone).toBe(true);
    expect(messages.continueCursor).toBeNull();
  });

  test("getChatMessages returns messages with sender data", async () => {
    const t = convexTest(schema);

    const customerId = await createTestUser(t, "customer");
    const categoryId = await createTestCategory(t);

    const chat = await t.mutation(api.chats.getOrCreateCategoryChat, {
      customerId,
      categoryId,
    });

    expect(chat).not.toBeNull();
    if (!chat) throw new Error("Chat creation failed");

    // Add messages
    await addMessagesToChat(t, chat._id, customerId, 5);

    const result = await t.query(api.chats.getChatMessages, {
      chatId: chat._id,
      paginationOpts: { numItems: 50, cursor: null },
    });

    expect(result.page).toHaveLength(5);
    expect(result.page[0].sender).toBeDefined();
    expect(result.page[0].sender?.name).toBe("Test customer");
    expect(result.page[0].content).toBe("Test message 1");
    
    // Verify chronological order (oldest first)
    expect(result.page[0].created_at).toBeLessThan(result.page[1].created_at);
  });

  test("getChatMessages handles chat with no current month messages", async () => {
    const t = convexTest(schema);

    const customerId = await createTestUser(t, "customer");
    const categoryId = await createTestCategory(t);

    const chat = await t.mutation(api.chats.getOrCreateCategoryChat, {
      customerId,
      categoryId,
    });

    expect(chat).not.toBeNull();
    if (!chat) throw new Error("Chat creation failed");

    // Add messages to a previous month partition
    await t.run(async (ctx: any) => {
      const lastMonth = "2025-08"; // Previous month
      
      const message = {
        chat_id: chat._id,
        year_month: lastMonth,
        sender_id: customerId,
        bubble_type: "text",
        content: "Old message",
        metadata: {},
        is_dismissed: false,
        created_at: Date.now() - 100000,
        status: "sent",
      };

      await ctx.db.insert("messages", message);

      // Create partition for last month
      await ctx.db.insert("message_partitions", {
        chat_id: chat._id,
        year_month: lastMonth,
        message_count: 1,
        created_at: Date.now() - 100000,
      });
    });

    // Query current month - should be empty but not treated as fresh
    const result = await t.query(api.chats.getChatMessages, {
      chatId: chat._id,
      paginationOpts: { numItems: 50, cursor: null },
    });

    expect(result.page).toHaveLength(0); // No messages in current month
    
    // But chat should not be considered fresh since partitions exist
    const isFresh = await t.query(api.chats.isChatFresh, {
      chatId: chat._id,
    });
    expect(isFresh).toBe(false);
  });
});

describe("Chat state queries", () => {
  test("isChatFresh returns true for new chat", async () => {
    const t = convexTest(schema);

    const customerId = await createTestUser(t, "customer");
    const categoryId = await createTestCategory(t);

    const chat = await t.mutation(api.chats.getOrCreateCategoryChat, {
      customerId,
      categoryId,
    });

    expect(chat).not.toBeNull();
    if (!chat) throw new Error("Chat creation failed");

    const isFresh = await t.query(api.chats.isChatFresh, {
      chatId: chat._id,
    });

    expect(isFresh).toBe(true);
  });

  test("isChatFresh returns false for chat with messages", async () => {
    const t = convexTest(schema);

    const customerId = await createTestUser(t, "customer");
    const categoryId = await createTestCategory(t);

    const chat = await t.mutation(api.chats.getOrCreateCategoryChat, {
      customerId,
      categoryId,
    });

    expect(chat).not.toBeNull();
    if (!chat) throw new Error("Chat creation failed");

    // Add messages
    await addMessagesToChat(t, chat._id, customerId);

    const isFresh = await t.query(api.chats.isChatFresh, {
      chatId: chat._id,
    });

    expect(isFresh).toBe(false);
  });

  test("getChatInfo returns correct chat information", async () => {
    const t = convexTest(schema);

    const customerId = await createTestUser(t, "customer");
    const categoryId = await createTestCategory(t);

    const chat = await t.mutation(api.chats.getOrCreateCategoryChat, {
      customerId,
      categoryId,
    });

    expect(chat).not.toBeNull();
    if (!chat) throw new Error("Chat creation failed");

    // Test fresh chat info
    const freshChatInfo = await t.query(api.chats.getChatInfo, {
      chatId: chat._id,
    });

    expect(freshChatInfo).not.toBeNull();
    if (freshChatInfo) {
      expect(freshChatInfo._id).toBe(chat._id);
      expect(freshChatInfo.messageCount).toBe(0);
      expect(freshChatInfo.isFresh).toBe(true);
    }

    // Add messages and test again
    await addMessagesToChat(t, chat._id, customerId, 7);

    const chatInfoWithMessages = await t.query(api.chats.getChatInfo, {
      chatId: chat._id,
    });

    expect(chatInfoWithMessages).not.toBeNull();
    if (chatInfoWithMessages) {
      expect(chatInfoWithMessages.messageCount).toBe(7);
      expect(chatInfoWithMessages.isFresh).toBe(false);
    }
  });

  test("getChatInfo returns null for non-existent chat", async () => {
    const t = convexTest(schema);

    // Create a valid but non-existent chat ID
    const nonExistentChatId = await t.run(async (ctx: any) => {
      const customerId = await ctx.db.insert("users", {
        phone: "+222999999999",
        password_hash: "temp",
        name: "Temp",
        user_type: "customer",
        balance: 0,
        approval_status: "approved",
        cancellation_count: 0,
        priority_score: 100,
        created_at: Date.now(),
      });

      const categoryId = await ctx.db.insert("categories", {
        name_en: "Temp",
        name_fr: "Temp",
        name_ar: "مؤقت",
        photo_url: "temp.jpg",
        requires_photos: false,
        requires_work_code: false,
        level: 0,
      });

      const tempChatId = await ctx.db.insert("chats", {
        customer_id: customerId,
        category_id: categoryId,
        is_cleared: false,
        created_at: Date.now(),
      });

      // Delete the chat to make ID non-existent
      await ctx.db.delete(tempChatId);
      
      return tempChatId;
    });

    const chatInfo = await t.query(api.chats.getChatInfo, {
      chatId: nonExistentChatId,
    });

    expect(chatInfo).toBeNull();
  });
});

describe("Multi-partition message handling", () => {
  test("getChatInfo counts messages across multiple partitions", async () => {
    const t = convexTest(schema);

    const customerId = await createTestUser(t, "customer");
    const categoryId = await createTestCategory(t);

    const chat = await t.mutation(api.chats.getOrCreateCategoryChat, {
      customerId,
      categoryId,
    });

    expect(chat).not.toBeNull();
    if (!chat) throw new Error("Chat creation failed");

    // Add messages to multiple months
    await t.run(async (ctx: any) => {
      const months = ["2025-08", "2025-09"];
      
      for (const month of months) {
        // Add 3 messages per month
        for (let i = 0; i < 3; i++) {
          await ctx.db.insert("messages", {
            chat_id: chat._id,
            year_month: month,
            sender_id: customerId,
            bubble_type: "text",
            content: `Message ${month}-${i}`,
            metadata: {},
            is_dismissed: false,
            created_at: Date.now() - (months.indexOf(month) * 100000) - (i * 1000),
            status: "sent",
          });
        }

        // Create partition
        await ctx.db.insert("message_partitions", {
          chat_id: chat._id,
          year_month: month,
          message_count: 3,
          created_at: Date.now() - (months.indexOf(month) * 100000),
        });
      }
    });

    const chatInfo = await t.query(api.chats.getChatInfo, {
      chatId: chat._id,
    });

    expect(chatInfo).not.toBeNull();
    if (chatInfo) {
      expect(chatInfo.messageCount).toBe(6); // 3 messages × 2 months
      expect(chatInfo.isFresh).toBe(false);
    }
  });
});

describe("Edge cases", () => {
  test("handles multiple customers with same category", async () => {
    const t = convexTest(schema);

    const customer1 = await createTestUser(t, "customer");
    const customer2 = await createTestUser(t, "customer");
    const categoryId = await createTestCategory(t);

    // Create chats for both customers in same category
    const chat1 = await t.mutation(api.chats.getOrCreateCategoryChat, {
      customerId: customer1,
      categoryId,
    });

    const chat2 = await t.mutation(api.chats.getOrCreateCategoryChat, {
      customerId: customer2,
      categoryId,
    });

    expect(chat1).not.toBeNull();
    expect(chat2).not.toBeNull();

    if (chat1 && chat2) {
      // Should be different chats
      expect(chat1._id).not.toBe(chat2._id);
      expect(chat1.customer_id).toBe(customer1);
      expect(chat2.customer_id).toBe(customer2);
      expect(chat1.category_id).toBe(categoryId);
      expect(chat2.category_id).toBe(categoryId);
    }
  });

  test("handles customer with multiple categories", async () => {
    const t = convexTest(schema);

    const customerId = await createTestUser(t, "customer");
    const category1 = await createTestCategory(t);
    const category2 = await createTestCategory(t);

    // Create chats for same customer in different categories
    const chat1 = await t.mutation(api.chats.getOrCreateCategoryChat, {
      customerId,
      categoryId: category1,
    });

    const chat2 = await t.mutation(api.chats.getOrCreateCategoryChat, {
      customerId,
      categoryId: category2,
    });

    expect(chat1).not.toBeNull();
    expect(chat2).not.toBeNull();

    if (chat1 && chat2) {
      // Should be different chats
      expect(chat1._id).not.toBe(chat2._id);
      expect(chat1.customer_id).toBe(customerId);
      expect(chat2.customer_id).toBe(customerId);
      expect(chat1.category_id).toBe(category1);
      expect(chat2.category_id).toBe(category2);
    }
  });
});