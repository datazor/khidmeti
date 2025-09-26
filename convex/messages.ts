/**
 * Sends a message to a chat with automatic year-month partitioning and routing
 * Supports all bubble types: text, voice, photo, confirmation, date, system
 * Updates message partition counts for performance tracking
 * Routes messages between service chats and conversation chats when needed
 * 
 * @param chatId - ID of the chat to send message to
 * @param senderId - ID of the user sending the message
 * @param bubbleType - Type of message bubble (text, voice, photo, confirmation, date, system_instruction)
 * @param content - Primary message content (text, URL, value, or instruction)
 * @param metadata - Optional additional data for display and context
 * @returns Created message document
 */

import { api } from "./_generated/api";
import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Detects completion trigger and initiates completion flow
 */
async function handleCompletionTrigger(ctx: any, content: string, chatId: string, senderId: string) {
  if (content.trim() === "*1#") {
    
    // Get the conversation chat to find the job
    const chat = await ctx.db.get(chatId);
    if (!chat || !chat.job_id) {
      return false; // Not a completion trigger context
    }
    
    // Get job details
    const job = await ctx.db.get(chat.job_id);
    if (!job || job.status !== 'in_progress') {
      return false;
    }
    
    // Verify sender is the assigned worker
    if (job.worker_id !== senderId) {
      return false;
    }
    
    // Trigger completion flow immediately
    await ctx.scheduler.runAfter(0, api.jobs.initiateCompletionFlow, {
      jobId: job._id,
      workerId: senderId,
      customerId: job.customer_id,
    });
    
    return true; // Message should be intercepted (not saved as regular message)
  }
  
  return false; // Not a completion trigger
}

export const sendMessage = mutation({
  args: {
    chatId: v.id("chats"),
    senderId: v.id("users"),
    bubbleType: v.union(
      v.literal("text"),
      v.literal("voice"), 
      v.literal("photo"),
      v.literal("confirmation"),
      v.literal("date"),
      v.literal("system_instruction"),
      v.literal("job"),
      v.literal("worker_job"),
      v.literal("onboarding_code_input"), // NEW: Add this line
      v.literal("completion_code_input")   // NEW: Add this line
    ),
    content: v.string(),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, { chatId, senderId, bubbleType, content, metadata }) => {


    // NEW: Check for completion trigger before processing message
    if (bubbleType === "text") {
      const isCompletionTrigger = await handleCompletionTrigger(ctx, content, chatId, senderId);
      if (isCompletionTrigger) {
        return null; // Don't save the "*1#" message itself
      }
    }

    // Existing message creation logic continues...
    const chat = await ctx.db.get(chatId);
    if (!chat) {
      throw new Error("Chat not found");
    }

    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const timestamp = Date.now();

    const messageId = await ctx.db.insert("messages", {
      chat_id: chatId,
      year_month: yearMonth,
      sender_id: senderId,
      bubble_type: bubbleType,
      content,
      metadata,
      is_dismissed: false,
      is_expired: false,
      created_at: timestamp,
      status: "sent",
      delivered_at: timestamp,
    });

    // Update message partition count
    await updateMessagePartitionCount(ctx, chatId, yearMonth, timestamp, 1);

    // Add sender lookup (after getting the chat)
    const sender = await ctx.db.get(senderId);
    if (!sender) {
      throw new Error("Sender not found");
    }

    // Add message routing for customer-worker communication
    const destinations = await getMessageDestinations(ctx, chat, sender);

    // Route message to additional chats (skip the source chat)
    for (const destinationChatId of destinations) {
      if (destinationChatId !== chatId) {
        await createMessageInChat(ctx, destinationChatId, senderId, bubbleType, content, metadata);
      }
    }

    return await ctx.db.get(messageId);
  },
});

/**
 * Creates onboarding code input bubble for worker
 */
export const createOnboardingCodeInputBubble = mutation({
  args: {
    chatId: v.id("chats"),
    workerId: v.id("users"),
    jobId: v.id("jobs"),
  },
  handler: async (ctx, { chatId, workerId, jobId }) => {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const timestamp = Date.now();

    const messageId = await ctx.db.insert("messages", {
      chat_id: chatId,
      year_month: yearMonth,
      sender_id: workerId,
      bubble_type: "onboarding_code_input",
      content: "Ask the customer for the start code to begin work",
      metadata: {
        jobId: jobId,
        maxLength: 4,
        messageKey: "onboarding_code_input",
        isSystemGenerated: true,
        automated: true,
      },
      is_dismissed: false,
      is_expired: false,
      created_at: timestamp,
      status: "sent",
      delivered_at: timestamp,
    });

    // Update message partition count
    await updateMessagePartitionCount(ctx, chatId, yearMonth, timestamp, 1);

    return messageId;
  },
});

/**
 * Creates periodic reminder messages for onboarding code
 */
export const createOnboardingReminder = mutation({
  args: {
    chatId: v.id("chats"),
    workerId: v.id("users"),
    jobId: v.id("jobs"),
    reminderNumber: v.number(),
  },
  handler: async (ctx, { chatId, workerId, jobId, reminderNumber }) => {
    // Check if onboarding code has already been entered
    const job = await ctx.db.get(jobId);
    if (!job || job.status !== "matched") {
      return null; // Job status changed, don't send reminder
    }

    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const timestamp = Date.now();

    const reminderMessages = [
      "Don't forget to ask the customer for the start code before beginning work",
      "Please get the start code from the customer to proceed",
      "Remember to collect the start code from the customer",
      "Ask the customer for their start code to begin the job",
    ];

    const content = reminderMessages[reminderNumber % reminderMessages.length];

    const messageId = await ctx.db.insert("messages", {
      chat_id: chatId,
      year_month: yearMonth,
      sender_id: workerId,
      bubble_type: "system_instruction",
      content: content,
      metadata: {
        messageKey: "onboarding_code_reminder",
        jobId: jobId,
        reminderNumber: reminderNumber,
        isSystemGenerated: true,
        automated: true,
        isReminder: true,
      },
      is_dismissed: false,
      is_expired: false,
      created_at: timestamp,
      status: "sent",
      delivered_at: timestamp,
    });

    await updateMessagePartitionCount(ctx, chatId, yearMonth, timestamp, 1);

    return messageId;
  },
});

/**
 * Expires onboarding reminder messages after code is validated
 */
export const expireOnboardingReminders = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, { jobId }) => {
    // Find all reminder messages for this job
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Get all chats related to this job
    const jobChats = await ctx.db
      .query("chats")
      .filter((q) => q.eq(q.field("job_id"), jobId))
      .collect();

    let expiredCount = 0;

    for (const chat of jobChats) {
      const reminderMessages = await ctx.db
        .query("messages")
        .withIndex("by_chat_partition", (q) => 
          q.eq("chat_id", chat._id).eq("year_month", yearMonth)
        )
        .filter((q) => 
          q.and(
            q.eq(q.field("is_expired"), false),
            q.eq(q.field("metadata.messageKey"), "onboarding_code_reminder"),
            q.eq(q.field("metadata.jobId"), jobId)
          )
        )
        .collect();

      for (const message of reminderMessages) {
        await ctx.db.patch(message._id, {
          is_expired: true,
        });
        expiredCount++;
      }
    }

    return { success: true, expiredCount };
  },
});

// Helper function to determine routing destinations
async function getMessageDestinations(ctx: any, sourceChat: any, sender: any): Promise<string[]> {
  const destinations = [sourceChat._id]; // Always include source
  
  // Only route for jobs that exist
  if (!sourceChat.job_id) {
    return destinations;
  }
  
  const job = await ctx.db.get(sourceChat.job_id);
  if (!job) {
    return destinations;
  }

  if (sender.user_type === "customer") {
    // Customer: route from service chat to conversation chat
    const conversationChat = await ctx.db
      .query("chats")
      .filter((q: any) => q.and(
        q.eq(q.field("job_id"), job._id),
        q.eq(q.field("customer_id"), job.customer_id),
        q.eq(q.field("worker_id"), job.worker_id),
        q.neq(q.field("_id"), sourceChat._id) // Different from source
      ))
      .first();
    
    if (conversationChat) {
      destinations.push(conversationChat._id);
    }
  } 
  
  else if (sender.user_type === "worker") {
    // Worker: route from conversation chat to service chat
    const serviceChat = await ctx.db
      .query("chats")
      .filter((q: any) => q.and(
        q.eq(q.field("customer_id"), job.customer_id),
        q.eq(q.field("category_id"), job.category_id),
        q.eq(q.field("worker_id"), undefined), // Service chat has no worker
        q.neq(q.field("_id"), sourceChat._id) // Different from source
      ))
      .first();
    
    if (serviceChat) {
      destinations.push(serviceChat._id);
    }
  }
  
  return destinations;
}

// Helper to create message in specific chat
async function createMessageInChat(ctx: any, chatId: string, senderId: string, bubbleType: string, content: string, metadata: any) {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const timestamp = Date.now();

  const messageId = await ctx.db.insert("messages", {
    chat_id: chatId,
    year_month: yearMonth,
    sender_id: senderId,
    bubble_type: bubbleType,
    content,
    metadata,
    is_dismissed: false,
    is_expired: false,
    created_at: timestamp,
    status: "sent",
    delivered_at: timestamp,
  });

  // Update partition count
  await updateMessagePartitionCount(ctx, chatId, yearMonth, timestamp, 1);
  
  return messageId;
}

export const deleteMessage = mutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, { messageId }) => {
    // Get the message to delete
    const message = await ctx.db.get(messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    const chatId = message.chat_id;
    const yearMonth = message.year_month;

    // Delete the message
    await ctx.db.delete(messageId);

    // Update message partition count
    const partition = await ctx.db
      .query("message_partitions")
      .withIndex("by_chat", (q) => q.eq("chat_id", chatId))
      .filter((q) => q.eq(q.field("year_month"), yearMonth))
      .first();

    if (partition && partition.message_count > 0) {
      await ctx.db.patch(partition._id, {
        message_count: partition.message_count - 1,
      });

      // If count reaches 0, delete the partition
      if (partition.message_count - 1 === 0) {
        await ctx.db.delete(partition._id);
      }
    }

    return { success: true, deletedMessageId: messageId };
  },
});

export const deleteMultipleMessages = mutation({
  args: {
    messageIds: v.array(v.id("messages")),
  },
  handler: async (ctx, { messageIds }) => {
    const deletedIds = [];
    const partitionUpdates = new Map<string, { partitionId: any; currentCount: number }>();

    // Process each message
    for (const messageId of messageIds) {
      const message = await ctx.db.get(messageId);
      if (!message) {
        continue; // Skip if message doesn't exist
      }

      const chatId = message.chat_id;
      const yearMonth = message.year_month;
      const partitionKey = `${chatId}-${yearMonth}`;

      // Delete the message
      await ctx.db.delete(messageId);
      deletedIds.push(messageId);

      // Track partition updates
      if (!partitionUpdates.has(partitionKey)) {
        const partition = await ctx.db
          .query("message_partitions")
          .withIndex("by_chat", (q) => q.eq("chat_id", chatId))
          .filter((q) => q.eq(q.field("year_month"), yearMonth))
          .first();

        if (partition) {
          partitionUpdates.set(partitionKey, {
            partitionId: partition._id,
            currentCount: partition.message_count,
          });
        }
      }

      // Decrement count for this partition
      const partitionData = partitionUpdates.get(partitionKey);
      if (partitionData) {
        partitionData.currentCount -= 1;
      }
    }

    // Apply partition updates
    for (const [, { partitionId, currentCount }] of partitionUpdates) {
      if (currentCount <= 0) {
        await ctx.db.delete(partitionId);
      } else {
        await ctx.db.patch(partitionId, {
          message_count: currentCount,
        });
      }
    }

    return { 
      success: true, 
      deletedCount: deletedIds.length,
      deletedMessageIds: deletedIds 
    };
  },
});

export const deleteVoiceAndQuickReply = mutation({
  args: {
    voiceMessageId: v.id("messages"),
    quickReplyMessageId: v.id("messages"),
  },
  handler: async (ctx, { voiceMessageId, quickReplyMessageId }) => {
    // Verify both messages exist and belong to the same chat
    const voiceMessage = await ctx.db.get(voiceMessageId);
    const quickReplyMessage = await ctx.db.get(quickReplyMessageId);

    if (!voiceMessage || !quickReplyMessage) {
      throw new Error("One or both messages not found");
    }

    if (voiceMessage.chat_id !== quickReplyMessage.chat_id) {
      throw new Error("Messages belong to different chats");
    }

    // Verify message types
    if (voiceMessage.bubble_type !== "voice") {
      throw new Error("First message is not a voice message");
    }

    if (!quickReplyMessage.metadata?.options || !Array.isArray(quickReplyMessage.metadata.options)) {
      throw new Error("Second message is not a quick reply message");
    }

    // Delete both messages directly here instead of calling another mutation
    const deletedIds = [];
    const partitionUpdates = new Map<string, { partitionId: any; currentCount: number }>();

    for (const messageId of [voiceMessageId, quickReplyMessageId]) {
      const message = await ctx.db.get(messageId);
      if (!message) continue;

      const chatId = message.chat_id;
      const yearMonth = message.year_month;
      const partitionKey = `${chatId}-${yearMonth}`;

      // Delete the message
      await ctx.db.delete(messageId);
      deletedIds.push(messageId);

      // Track partition updates
      if (!partitionUpdates.has(partitionKey)) {
        const partition = await ctx.db
          .query("message_partitions")
          .withIndex("by_chat", (q) => q.eq("chat_id", chatId))
          .filter((q) => q.eq(q.field("year_month"), yearMonth))
          .first();

        if (partition) {
          partitionUpdates.set(partitionKey, {
            partitionId: partition._id,
            currentCount: partition.message_count,
          });
        }
      }

      // Decrement count for this partition
      const partitionData = partitionUpdates.get(partitionKey);
      if (partitionData) {
        partitionData.currentCount -= 1;
      }
    }

    // Apply partition updates
    for (const [, { partitionId, currentCount }] of partitionUpdates) {
      if (currentCount <= 0) {
        await ctx.db.delete(partitionId);
      } else {
        await ctx.db.patch(partitionId, {
          message_count: currentCount,
        });
      }
    }

    return { 
      success: true, 
      deletedCount: deletedIds.length,
      deletedMessageIds: deletedIds 
    };
  },
});

// Helper function to update message partition count
async function updateMessagePartitionCount(ctx: any, chatId: string, yearMonth: string, timestamp: number, delta: number) {
  const existingPartition = await ctx.db
    .query("message_partitions")
    .withIndex("by_chat", (q: any) => q.eq("chat_id", chatId))
    .filter((q: any) => q.eq(q.field("year_month"), yearMonth))
    .first();

  if (existingPartition) {
    await ctx.db.patch(existingPartition._id, {
      message_count: existingPartition.message_count + delta,
    });
  } else if (delta > 0) {
    await ctx.db.insert("message_partitions", {
      chat_id: chatId,
      year_month: yearMonth,
      message_count: delta,
      created_at: timestamp,
    });
  }
}

// Add after existing mutations

/**
 * Marks a single message as expired (hidden from display but preserved in database)
 */
export const expireMessage = mutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, { messageId }) => {
    const message = await ctx.db.get(messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    await ctx.db.patch(messageId, {
      is_expired: true,
    });

    return { success: true, messageId };
  },
});

/**
 * Marks multiple messages as expired in batch
 */
export const expireMultipleMessages = mutation({
  args: {
    messageIds: v.array(v.id("messages")),
  },
  handler: async (ctx, { messageIds }) => {
    const expiredIds = [];

    for (const messageId of messageIds) {
      const message = await ctx.db.get(messageId);
      if (message) {
        await ctx.db.patch(messageId, {
          is_expired: true,
        });
        expiredIds.push(messageId);
      }
    }

    return { 
      success: true, 
      expiredCount: expiredIds.length,
      expiredMessageIds: expiredIds 
    };
  },
});

/**
 * Expires messages by filter criteria (useful for bulk operations)
 */
export const expireMessagesByFilter = mutation({
  args: {
    chatId: v.id("chats"),
    bubbleTypes: v.optional(v.array(v.string())),
    excludeBubbleTypes: v.optional(v.array(v.string())),
    metadataKey: v.optional(v.string()),
    metadataValue: v.optional(v.any()),
  },
  handler: async (ctx, { chatId, bubbleTypes, excludeBubbleTypes, metadataKey, metadataValue }) => {
    // Get current year-month partition
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Query messages in the current partition
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat_partition", (q) => 
        q.eq("chat_id", chatId).eq("year_month", yearMonth)
      )
      .collect();

    // Filter messages based on criteria
    const messagesToExpire = messages.filter(msg => {
      // Skip already expired messages
      if (msg.is_expired) return false;

      // Filter by bubble types if specified
      if (bubbleTypes && !bubbleTypes.includes(msg.bubble_type)) return false;
      if (excludeBubbleTypes && excludeBubbleTypes.includes(msg.bubble_type)) return false;

      // Filter by metadata if specified
      if (metadataKey && metadataValue !== undefined) {
        const metadataMatch = msg.metadata?.[metadataKey] === metadataValue;
        if (!metadataMatch) return false;
      }

      return true;
    });

    // Expire the filtered messages
    for (const message of messagesToExpire) {
      await ctx.db.patch(message._id, {
        is_expired: true,
      });
    }

    return {
      success: true,
      expiredCount: messagesToExpire.length,
      expiredMessageIds: messagesToExpire.map(m => m._id),
    };
  },
});

/**
 * Expires all worker job bubbles for a cancelled job
 */
export const expireWorkerJobBubblesForJob = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, { jobId }) => {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // Find all worker job messages for this job
    const workerJobMessages = await ctx.db
      .query("messages")
      .filter((q) => 
        q.and(
          q.eq(q.field("bubble_type"), "worker_job"),
          q.eq(q.field("content"), jobId),
          q.eq(q.field("is_expired"), false)
        )
      )
      .collect();

    let expiredCount = 0;

    for (const message of workerJobMessages) {
      await ctx.db.patch(message._id, {
        is_expired: true,
      });
      expiredCount++;
    }

    return { success: true, expiredCount };
  },
});

/**
 * Expires all messages related to a cancelled job
 * This includes messages in all chats associated with the job
 */
export const expireAllJobMessages = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, { jobId }) => {
    
    // Get all chats related to this job
    const jobChats = await ctx.db
      .query("chats")
      .filter((q) => q.eq(q.field("job_id"), jobId))
      .collect();

    
    let totalExpiredCount = 0;

    for (const chat of jobChats) {
    
      // Get current year-month partition
      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      // Find all messages in this chat that are not expired
      const messagesToExpire = await ctx.db
        .query("messages")
        .withIndex("by_chat_partition", (q) => 
          q.eq("chat_id", chat._id).eq("year_month", yearMonth)
        )
        .filter((q) => 
          q.and(
            q.eq(q.field("is_expired"), false)
          )
        )
        .collect();

      
      let chatExpiredCount = 0;

      // Expire all messages in this chat
      for (const message of messagesToExpire) {
        
        await ctx.db.patch(message._id, {
          is_expired: true,
        });
        chatExpiredCount++;
      }

      totalExpiredCount += chatExpiredCount;
    }
    
    return { success: true, expiredCount: totalExpiredCount };
  },
});

/**
 * Validate onboarding code in conversation chat
 */
export const validateOnboardingCodeInChat = mutation({
  args: {
    chatId: v.id("chats"),
    jobId: v.id("jobs"),
    inputCode: v.string(),
    messageId: v.id("messages"), // The onboarding input bubble
  },
  handler: async (ctx, { chatId, jobId, inputCode, messageId }) => {
    // Validate code against job
    const job = await ctx.db.get(jobId);
    if (!job || !job.onboarding_code) {
      throw new Error("Invalid job or no onboarding code");
    }

    const isValid = job.onboarding_code === inputCode.trim();

    if (isValid) {
      // Update job to in_progress
      await ctx.db.patch(jobId, {
        status: "in_progress"
      });

      // Expire the onboarding input bubble
      await ctx.db.patch(messageId, {
        is_expired: true
      });

      // Send success message - use worker_id directly since it should be defined at this point
      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      await ctx.db.insert("messages", {
        chat_id: chatId,
        year_month: yearMonth,
        sender_id: job.worker_id!,
        bubble_type: "system_notification",
        content: "Work started! You can now begin the job.",
        metadata: {
          messageKey: "work_started",
          jobId: jobId,
          isSystemGenerated: true,
        },
        is_dismissed: false,
        is_expired: false,
        created_at: Date.now(),
        status: "sent",
        delivered_at: Date.now(),
      });
    }

    return { success: true, isValid, jobStatus: isValid ? "in_progress" : "matched" };
  },
});

/**
 * Reinitializes customer chat with initial system messages after job completion
 */
export const reinitializeCustomerChat = mutation({
  args: {
    chatId: v.id("chats"),
    categoryId: v.id("categories"),
    customerId: v.id("users"),
    language: v.union(v.literal("en"), v.literal("fr"), v.literal("ar")),
  },
  handler: async (ctx, { chatId, categoryId, customerId, language }) => {
    // Get category details for initial messages
    const category = await ctx.db.get(categoryId);
    if (!category) {
      throw new Error("Category not found");
    }

    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const timestamp = Date.now();

    // Create the initial 2 system messages
    const welcomeMessageId = await ctx.db.insert("messages", {
      chat_id: chatId,
      year_month: yearMonth,
      sender_id: customerId,
      bubble_type: "system_instruction",
      content: getLocalizedMessage("welcome", language, { categoryName: category.name_en }),
      metadata: {
        messageKey: "welcome",
        categoryId: categoryId,
        isInitialInstruction: true,
        isSystemGenerated: true,
        automated: true,
        step: 1,
      },
      is_dismissed: false,
      is_expired: false,
      created_at: timestamp,
      status: "sent",
      delivered_at: timestamp,
    });

    const instructionMessageId = await ctx.db.insert("messages", {
      chat_id: chatId,
      year_month: yearMonth,
      sender_id: customerId,
      bubble_type: "system_instruction", 
      content: getLocalizedMessage("voice_instruction", language),
      metadata: {
        messageKey: "voice_instruction",
        categoryId: categoryId,
        isInitialInstruction: true,
        isSystemGenerated: true,
        automated: true,
        step: 2,
      },
      is_dismissed: false,
      is_expired: false,
      created_at: timestamp + 100, // Slight delay for ordering
      status: "sent",
      delivered_at: timestamp + 100,
    });

    // Update message partition count
    await updateMessagePartitionCount(ctx, chatId, yearMonth, timestamp, 2);

    return {
      success: true,
      welcomeMessageId,
      instructionMessageId,
      messageCount: 2,
    };
  },
});

// Helper function to get localized messages
function getLocalizedMessage(key: string, language: string, variables?: Record<string, string>): string {
  const messages: Record<string, Record<string, string>> = {
    welcome: {
      en: `Welcome! Let's help you find the right worker for ${variables?.categoryName || 'your service'}.`,
      fr: `Bienvenue! Aidons-vous à trouver le bon travailleur pour ${variables?.categoryName || 'votre service'}.`,
      ar: `مرحباً! دعنا نساعدك في العثور على العامل المناسب لـ ${variables?.categoryName || 'خدمتك'}.`
    },
    voice_instruction: {
      en: "Please record a voice message describing what you need help with.",
      fr: "Veuillez enregistrer un message vocal décrivant ce dont vous avez besoin.",
      ar: "يرجى تسجيل رسالة صوتية تصف ما تحتاج المساعدة فيه."
    }
  };

  const messageGroup = messages[key];
  if (!messageGroup) return key;
  
  return messageGroup[language] || messageGroup["en"] || key;
}
