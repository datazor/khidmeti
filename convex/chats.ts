//convex/chats.ts - Updated with fresh chat detection and re-initialization
/**
 * Gets existing chat for a customer-category pair or creates a new one
 * Updated to detect fresh chats (no messages) and trigger re-initialization
 * Used when customer taps a category to start service request conversation
 * Returns chat ID for immediate message loading/sending
 * 
 * @param customerId - ID of the customer starting the chat
 * @param categoryId - ID of the service category being requested
 * @returns Chat document with all fields populated
 */

import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getOrCreateCategoryChat = mutation({
  args: {
    customerId: v.id("users"),
    categoryId: v.id("categories"),
  },
  handler: async (ctx, { customerId, categoryId }) => {
    
    // Check if chat already exists for this customer-category pair
    const existingChat = await ctx.db
      .query("chats")
      .withIndex("by_customer", (q) => q.eq("customer_id", customerId))
      .filter((q) => q.eq(q.field("category_id"), categoryId))
      .first();

    if (existingChat) {
      
      // Check if this is a fresh chat (no messages after reset)
      const hasMessages = await ctx.db
        .query("message_partitions")
        .withIndex("by_chat", (q) => q.eq("chat_id", existingChat._id))
        .first();
      
      
      // If no message partitions exist, this is a fresh chat needing initialization
      if (!hasMessages) {
        // Mark in metadata that this chat needs fresh initialization
        // The frontend/useChat will detect this and send initial instructions
        await ctx.db.patch(existingChat._id, {
          // Don't modify any fields, just return the fresh chat
          // The absence of message partitions indicates need for initialization
        });
      }
      
      return existingChat;
    }

    
    // Create new chat
    const chatId = await ctx.db.insert("chats", {
        customer_id: customerId,
        category_id: categoryId,
        is_cleared: false,
        created_at: Date.now(),
        job_id: undefined,
        worker_id: undefined
    });

    // Get the created chat to return
    const newChat = await ctx.db.get(chatId);
    return newChat;
  },
});

/**
 * Retrieves paginated messages for a chat with performance optimization
 * Uses year-month partitioning and reverse chronological order for efficient loading
 * Returns messages in display order (oldest first) for FlatList rendering
 * Updated to handle fresh chats that have been reset
 * 
 * @param chatId - ID of the chat to retrieve messages from
 * @param paginationOpts - Cursor and limit for pagination
 * @returns Paginated messages with continuation info
 */
export const getChatMessages = query({
  args: {
    chatId: v.id("chats"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { chatId, paginationOpts }) => {
    // DEBUG: Log query start
    
    // Get current year-month for partitioning
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // Check if any partitions exist for this chat
    const hasAnyPartitions = await ctx.db
      .query("message_partitions")
      .withIndex("by_chat", (q) => q.eq("chat_id", chatId))
      .first();
    
    // If no partitions exist, return empty result (fresh chat)
    if (!hasAnyPartitions) {
      return {
        page: [],
        isDone: true,
        continueCursor: null,
      };
    }
    
    // Query messages in chronological order (oldest first) using compound index
    const result = await ctx.db
      .query("messages")
      .withIndex("by_chat_partition", (q) => 
        q.eq("chat_id", chatId).eq("year_month", currentYearMonth)
      )
      .filter((q) => q.eq(q.field("is_expired"), false)) // Filter out expired messages
      .order("asc") // Oldest first for natural chat order
      .paginate(paginationOpts);
    
    
      
    // Get unique sender IDs for batch user lookup
    const senderIds = [...new Set(result.page.map(msg => msg.sender_id))];
    
    // Batch fetch user data
    const users = await Promise.all(
      senderIds.map(async (senderId) => {
        const user = await ctx.db.get(senderId);
        return user;
      })
    );
    
    // Create user lookup map for efficiency
    const userMap = new Map();
    users.forEach(user => {
      if (user) userMap.set(user._id, user);
    });
    
    // Attach sender data to each message
    const messagesWithSenders = result.page.map(message => ({
      ...message,
      sender: userMap.get(message.sender_id) || null
    }));
    
    
    return {
      ...result,
      page: messagesWithSenders
    };
  },
});

/**
 * NEW: Helper query to check if a chat is fresh (needs initialization)
 * Used by frontend to determine if initial system messages should be sent
 * 
 * @param chatId - ID of the chat to check
 * @returns Boolean indicating if chat has no messages
 */
export const isChatFresh = query({
  args: {
    chatId: v.id("chats"),
  },
  handler: async (ctx, { chatId }) => {
    // Check if any message partitions exist for this chat
    const hasMessages = await ctx.db
      .query("message_partitions")
      .withIndex("by_chat", (q) => q.eq("chat_id", chatId))
      .first();
    
    return !hasMessages; // True if no partitions = fresh chat
  },
});

/**
 * NEW: Get chat basic info without messages
 * Useful for checking chat state without loading all messages
 * 
 * @param chatId - ID of the chat to get info for
 * @returns Chat document with basic information
 */
export const getChatInfo = query({
  args: {
    chatId: v.id("chats"),
  },
  handler: async (ctx, { chatId }) => {
    const chat = await ctx.db.get(chatId);
    if (!chat) {
      return null;
    }
    
    // Get message count across all partitions
    const partitions = await ctx.db
      .query("message_partitions")
      .withIndex("by_chat", (q) => q.eq("chat_id", chatId))
      .collect();
    
    const totalMessages = partitions.reduce((sum, partition) => sum + partition.message_count, 0);
    
    return {
      ...chat,
      messageCount: totalMessages,
      isFresh: totalMessages === 0,
    };
  },
})

/**
 * Gets all chats for a worker (both notification chats and conversation chats)
 * Used by workers to see their unified chat interface
 * 
 * @param workerId - ID of the worker
 * @returns Array of chats where worker is participant
 */
export const getWorkerChats = query({
  args: { workerId: v.id("users") },
  handler: async (ctx, { workerId }) => {
    return await ctx.db
      .query("chats")
      .withIndex("by_worker", (q) => q.eq("worker_id", workerId))
      .order("desc")
      .collect();
  },
});

/**
 * Gets worker's chat for a specific category (for navigation from category selection)
 * Returns existing notification/conversation chat or null if none exists
 * 
 * @param workerId - ID of the worker
 * @param categoryId - ID of the category
 * @returns Chat document or null
 */
export const getWorkerChatForCategory = query({
  args: {
    workerId: v.id("users"),
    categoryId: v.id("categories"),
  },
  handler: async (ctx, { workerId, categoryId }) => {
    // Find worker's chat for this category (notification or conversation)
    return await ctx.db
      .query("chats")
      .withIndex("by_worker", (q) => q.eq("worker_id", workerId))
      .filter((q) => q.eq(q.field("category_id"), categoryId))
      .first();
  },
});

/**
 * Gets or creates worker's notification chat for a category
 * Used when worker navigates to a category but no chat exists yet
 * Creates notification chat (customer_id = undefined) ready to receive job notifications
 * 
 * @param workerId - ID of the worker
 * @param categoryId - ID of the category
 * @returns Chat document (existing or newly created)
 */
export const getOrCreateWorkerCategoryChat = mutation({
  args: {
    workerId: v.id("users"),
    categoryId: v.id("categories"),
  },
  handler: async (ctx, { workerId, categoryId }) => {
    
    // Look for notification chat ONLY (customer_id = undefined)
    const existingNotificationChat = await ctx.db
      .query("chats")
      .withIndex("by_worker", (q) => q.eq("worker_id", workerId))
      .filter((q) => 
        q.and(
          q.eq(q.field("category_id"), categoryId),
          q.eq(q.field("customer_id"), undefined), // NOTIFICATION CHAT ONLY
          q.eq(q.field("job_id"), undefined) // NO SPECIFIC JOB
        )
      )
      .first();

    if (existingNotificationChat) {
      return existingNotificationChat;
    }

    // Create notification chat
    const chatId = await ctx.db.insert("chats", {
      customer_id: undefined, // NO CUSTOMER - notification chat
      worker_id: workerId,
      category_id: categoryId,
      job_id: undefined, // NO SPECIFIC JOB
      is_cleared: false,
      created_at: Date.now(),
    });

    const newChat = await ctx.db.get(chatId);
    return newChat;
  },
});

/**
 * Gets worker's notification chats only (where customer_id is undefined)
 * Used to separate notification feeds from conversation feeds if needed
 * 
 * @param workerId - ID of the worker
 * @returns Array of notification chats
 */
export const getWorkerNotificationChats = query({
  args: { workerId: v.id("users") },
  handler: async (ctx, { workerId }) => {
    return await ctx.db
      .query("chats")
      .withIndex("by_worker", (q) => q.eq("worker_id", workerId))
      .filter((q) => q.eq(q.field("customer_id"), undefined)) // Only notification chats
      .order("desc")
      .collect();
  },
});

/**
 * Gets worker's conversation chats only (where customer_id is defined)
 * Used to show active job conversations separate from notifications
 * 
 * @param workerId - ID of the worker
 * @returns Array of conversation chats
 */
export const getWorkerConversationChats = query({
  args: { workerId: v.id("users") },
  handler: async (ctx, { workerId }) => {
    return await ctx.db
      .query("chats")
      .withIndex("by_worker", (q) => q.eq("worker_id", workerId))
      .filter((q) => q.neq(q.field("customer_id"), undefined))
      .order("desc")
      .collect();
  },
});

/**
 * Gets conversation chat for a specific job (both customer and worker have access)
 * Used when navigating from WorkerJobBubble to direct communication
 */
export const getConversationChatByJob = query({
  args: {
    jobId: v.id("jobs"),
    userId: v.id("users"), 
  },
  handler: async (ctx, { jobId, userId }) => {
    // Find conversation chat where both customer_id and worker_id are defined
    // and matches the job, and user is either customer or worker
    const conversationChat = await ctx.db
      .query("chats")
      .filter((q) => 
        q.and(
          q.eq(q.field("job_id"), jobId),
          q.neq(q.field("customer_id"), undefined),
          q.neq(q.field("worker_id"), undefined),
          q.or(
            q.eq(q.field("customer_id"), userId),
            q.eq(q.field("worker_id"), userId)
          )
        )
      )
      .first();

    return conversationChat;
  },
});

/**
 * Gets a specific chat by ID with user access validation
 * Used for direct navigation to existing chats
 */
export const getSpecificChat = query({
  args: {
    chatId: v.id("chats"),
    userId: v.id("users"),
  },
  handler: async (ctx, { chatId, userId }) => {
    const chat = await ctx.db.get(chatId);
    
    if (!chat) {
      return null;
    }

    // Check if user has access to this chat
    const hasAccess = 
      (chat.customer_id && chat.customer_id === userId) ||
      (chat.worker_id && chat.worker_id === userId);

    if (!hasAccess) {
      return null;
    }

    return chat;
  },
});

/**
 * Mutation version of getSpecificChat for one-time async calls
 * Used when navigating directly to a chat
 */
export const loadSpecificChat = mutation({
  args: {
    chatId: v.id("chats"),
    userId: v.id("users"),
  },
  handler: async (ctx, { chatId, userId }) => {
    const chat = await ctx.db.get(chatId);
    
    if (!chat) {
      return null;
    }

    // Check if user has access to this chat
    const hasAccess = 
      (chat.customer_id && chat.customer_id === userId) ||
      (chat.worker_id && chat.worker_id === userId);

    if (!hasAccess) {
      return null;
    }

    return chat;
  },
});

/**
 * Add a diagnostic query to check what chats exist
 */
export const debugWorkerChats = query({
  args: { workerId: v.id("users") },
  handler: async (ctx, { workerId }) => {
    const allChats = await ctx.db
      .query("chats")
      .withIndex("by_worker", (q) => q.eq("worker_id", workerId))
      .collect();
    
    return allChats.map(chat => ({
      id: chat._id,
      category_id: chat.category_id,
      customer_id: chat.customer_id,
      job_id: chat.job_id,
      created_at: chat.created_at
    }));
  },
});

/**
 * Marks all messages except initial system messages as expired
 */
export const expireNonInitialMessages = mutation({
  args: {
    chatId: v.id("chats"),
  },
  handler: async (ctx, { chatId }) => {

    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Get all messages in current partition
    const allMessages = await ctx.db
      .query("messages")
      .withIndex("by_chat_partition", (q) => 
        q.eq("chat_id", chatId).eq("year_month", yearMonth)
      )
      .filter((q) => q.eq(q.field("is_expired"), false))
      .collect();

    let expiredCount = 0;

    for (const message of allMessages) {
      // Only keep initial system instruction messages
      const isInitialSystemMessage = 
        message.bubble_type === "system_instruction" && 
        message.metadata?.isInitialInstruction === true;

      if (!isInitialSystemMessage) {
        await ctx.db.patch(message._id, {
          is_expired: true,
        });
        expiredCount++;
      }
    }


    return {
      success: true,
      expiredCount,
      remainingMessages: allMessages.length - expiredCount,
    };
  },
});

/**
 * Checks if a chat needs reinitialization (no non-expired messages)
 */
export const checkChatNeedsReinit = query({
  args: {
    chatId: v.id("chats"),
  },
  handler: async (ctx, { chatId }) => {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Count non-expired messages
    const activeMessages = await ctx.db
      .query("messages")
      .withIndex("by_chat_partition", (q) => 
        q.eq("chat_id", chatId).eq("year_month", yearMonth)
      )
      .filter((q) => q.eq(q.field("is_expired"), false))
      .collect();

    // Check if only initial system messages remain
    const nonSystemMessages = activeMessages.filter(msg => 
      !(msg.bubble_type === "system_instruction" && msg.metadata?.isInitialInstruction)
    );

    return {
      needsReinit: nonSystemMessages.length === 0,
      activeMessageCount: activeMessages.length,
      nonSystemMessageCount: nonSystemMessages.length,
    };
  },
});

/**
 * Completely removes worker conversation chat and all associated data
 */
export const removeWorkerConversationChat = mutation({
  args: {
    jobId: v.id("jobs"),
    workerId: v.id("users"),
  },
  handler: async (ctx, { jobId, workerId }) => {

    try {
      // Find all conversation chats for this job and worker
      const conversationChats = await ctx.db
        .query("chats")
        .filter((q) => 
          q.and(
            q.eq(q.field("job_id"), jobId),
            q.eq(q.field("worker_id"), workerId),
            q.neq(q.field("customer_id"), undefined) // Only conversation chats
          )
        )
        .collect();

      let totalMessagesDeleted = 0;
      let totalPartitionsDeleted = 0;
      let totalChatsDeleted = 0;

      for (const chat of conversationChats) {
        // Delete all messages in all partitions for this chat
        const partitions = await ctx.db
          .query("message_partitions")
          .withIndex("by_chat", (q) => q.eq("chat_id", chat._id))
          .collect();

        for (const partition of partitions) {
          // Delete all messages in this partition
          const messages = await ctx.db
            .query("messages")
            .withIndex("by_chat_partition", (q) => 
              q.eq("chat_id", chat._id).eq("year_month", partition.year_month)
            )
            .collect();

          for (const message of messages) {
            await ctx.db.delete(message._id);
            totalMessagesDeleted++;
          }

          // Delete the partition
          await ctx.db.delete(partition._id);
          totalPartitionsDeleted++;
        }

        // Delete the chat itself
        await ctx.db.delete(chat._id);
        totalChatsDeleted++;

      }


      return {
        success: true,
        chatsDeleted: totalChatsDeleted,
        messagesDeleted: totalMessagesDeleted,
        partitionsDeleted: totalPartitionsDeleted,
      };

    } catch (error) {
      throw error;
    }
  },
});

/**
 * Ensures worker returns to clean category job feed (notification chat only)
 */
export const ensureWorkerNotificationChat = mutation({
  args: {
    workerId: v.id("users"),
    categoryId: v.id("categories"),
  },
  handler: async (ctx, { workerId, categoryId }) => {

    // Check if worker has a notification chat for this category
    const notificationChat = await ctx.db
      .query("chats")
      .withIndex("by_worker", (q) => q.eq("worker_id", workerId))
      .filter((q) => 
        q.and(
          q.eq(q.field("category_id"), categoryId),
          q.eq(q.field("customer_id"), undefined), // Notification chat
          q.eq(q.field("job_id"), undefined) // Not tied to specific job
        )
      )
      .first();

    if (notificationChat) {
      return {
        success: true,
        chatId: notificationChat._id,
        existed: true,
      };
    }

    // Create new notification chat
    const chatId = await ctx.db.insert("chats", {
      customer_id: undefined,
      worker_id: workerId,
      category_id: categoryId,
      job_id: undefined,
      is_cleared: false,
      created_at: Date.now(),
    });


    return {
      success: true,
      chatId: chatId,
      existed: false,
    };
  },
});
