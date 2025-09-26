//convex/jobs.ts - Complete implementation with complete chat reset functionality
/**
 * Creates a job posting from a completed chat conversation
 * Extracts all collected data (voice, photos, date, location) and creates formal job
 * Validates conversation completeness before job creation
 * Creates job status bubble and loading bubble in chat for real-time tracking
 * 
 * @param chatId - ID of the chat to convert to job
 * @param locationLat - Customer's latitude for job location
 * @param locationLng - Customer's longitude for job location
 * @param priceFloor - Minimum price customer is willing to pay
 * @param portfolioConsent - Whether customer consents to work being used in portfolio
 * @returns Created job document
 */

import { api, internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Updated createJobFromChat function with worker assignment trigger
export const createJobFromChat = mutation({
  args: {
    chatId: v.id("chats"),
    locationLat: v.number(),
    locationLng: v.number(), 
    priceFloor: v.number(),
    portfolioConsent: v.boolean(),
  },
  handler: async (ctx, { chatId, locationLat, locationLng, priceFloor, portfolioConsent }) => {
    // Verify chat exists
    const chat = await ctx.db.get(chatId);
    if (!chat) {
      throw new Error("Chat not found");
    }

    // ADDED: Validate this is a customer chat (not a worker notification chat)
    if (!chat.customer_id) {
      throw new Error("Cannot create job from worker notification chat");
    }

    // Check if job already created for this chat
    if (chat.job_id) {
      throw new Error("Job already created for this chat");
    }

    // Get category to check requirements
    const category = await ctx.db.get(chat.category_id);
    if (!category) {
      throw new Error("Category not found");
    }

    // Get all messages from the chat to extract data
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_chat_partition", (q) => 
        q.eq("chat_id", chatId).eq("year_month", yearMonth)
      )
      .order("asc")
      .collect();

    // Extract conversation data
    let voiceUrl: string | undefined;
    let voiceDuration: number | undefined;
    let photos: string[] = [];
    let hasConfirmation = false;
    let hasDateSelection = false;

    for (const message of messages) {
      // Skip system messages
      if (message.metadata?.isSystemGenerated) continue;

      switch (message.bubble_type) {
        case "voice":
          if (!voiceUrl) {
            voiceUrl = message.content;
            voiceDuration = message.metadata?.duration || 0;
          }
          break;
        case "photo":
          photos.push(message.content);
          break;
        case "confirmation":
          if (message.content === "yes") hasConfirmation = true;
          break;
        case "date":
          hasDateSelection = true;
          break;
      }
    }

    // Validate conversation completeness
    if (!voiceUrl) {
      throw new Error("Voice recording is required to create job");
    }

    if (!hasDateSelection) {
      throw new Error("Date selection is required to create job");
    }

    // Generate 6-digit completion code
    const workCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Create the job - NOW chat.customer_id is guaranteed to be defined
    const jobId = await ctx.db.insert("jobs", {
      customer_id: chat.customer_id, // Safe now - we validated it exists above
      category_id: chat.category_id,
      subcategory_id: undefined, // Will be set during categorization
      voice_url: voiceUrl,
      voice_duration: voiceDuration,
      photos: photos,
      location_lat: locationLat,
      location_lng: locationLng,
      work_code: workCode,
      portfolio_consent: portfolioConsent,
      price_floor: priceFloor,
      status: "posted",
      categorizer_worker_ids: [], // Will be populated during categorization phase
      broadcasting_phase: 0,
      cancelled_at: undefined,
      cancelled_at_phase: undefined,
      created_at: Date.now(),
    });

    // Link the chat to the job
    await ctx.db.patch(chatId, {
      job_id: jobId,
    });

    // Create job status bubble in chat - NOW chat.customer_id is guaranteed to be string
    await createJobStatusBubble(ctx, chatId, jobId, chat.customer_id);

    // Create loading bubble to show job is being processed - NOW safe
    await createLoadingBubble(ctx, chatId, chat.customer_id, "en"); // TODO: Get actual language

    // After job creation, before worker assignment - get the created job first


    // Trigger worker assignment process
    try {
      await ctx.scheduler.runAfter(0, api.workerJobs.assignCategorizerWorkers, {
        jobId: jobId,
      });
    } catch (error) {
      // Don't throw - job is created, assignment can be retried
    }

    // Return the created job
    return await ctx.db.get(jobId);
  },
});

/**
 * Initiates completion flow when worker sends *1#
 * Sends rating bubbles to both parties AND generates/shares completion code
 */
export const initiateCompletionFlow = mutation({
  args: {
    jobId: v.id("jobs"),
    workerId: v.id("users"),
    customerId: v.id("users"),
  },
  handler: async (ctx, { jobId, workerId, customerId }) => {
    
    const job = await ctx.db.get(jobId);
    if (!job) {
      throw new Error("Job not found");
    }
    
    const worker = await ctx.db.get(workerId);
    const customer = await ctx.db.get(customerId);
    
    if (!worker || !customer) {
      throw new Error("Worker or customer not found");
    }
    
    // Step 1: Send rating bubbles to both parties (existing code)
    await sendRatingBubbleToCustomer(ctx, jobId, customerId, workerId, worker.name);
    await sendRatingBubbleToWorker(ctx, jobId, workerId, customerId, customer.name);
    
    // Step 2: Generate completion code immediately (NEW)
    const codeResult = await generateCompletionCodeInternal(ctx, jobId);
    
    if (!codeResult.success) {
      throw new Error('Failed to generate completion code');
    }
    
    // Step 3: Send completion code to customer (NEW)
    await sendCompletionCodeToCustomer(ctx, jobId, customerId, codeResult.code);
    
    // Step 4: Send completion code input bubble to worker (NEW)
    await sendCompletionCodeInputToWorker(ctx, jobId, workerId);
    
    
    return { 
      success: true, 
      completionCode: codeResult.code,
      ratingsSent: true,
      codeGenerated: true 
    };
  },
});

/**
 * Sends onboarding code to customer after job becomes matched
 */
export const sendOnboardingCodeToCustomer = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    if (!job.onboarding_code) {
      throw new Error("Onboarding code not generated");
    }

    // Find customer's service chat
    const customerChat = await ctx.db
      .query("chats")
      .filter((q) => 
        q.and(
          q.eq(q.field("customer_id"), job.customer_id),
          q.eq(q.field("category_id"), job.category_id),
          q.eq(q.field("worker_id"), undefined) // Service chat
        )
      )
      .first();

    if (!customerChat) {
      throw new Error("Customer service chat not found");
    }

    // Send onboarding code message to customer
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    await ctx.db.insert("messages", {
      chat_id: customerChat._id,
      year_month: yearMonth,
      sender_id: job.customer_id,
      bubble_type: "system_instruction",
      content: `Share this code with the worker when they arrive to start the job: ${job.onboarding_code}`,
      metadata: {
        messageKey: "onboarding_code_delivery",
        jobId: jobId,
        onboardingCode: job.onboarding_code,
        isSystemGenerated: true,
        automated: true,
      },
      is_dismissed: false,
      is_expired: false,
      created_at: Date.now(),
      status: "sent",
      delivered_at: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Schedules periodic reminders for worker to ask for onboarding code
 */
export const scheduleOnboardingReminders = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job || !job.worker_id) {
      throw new Error("Job or worker not found");
    }

    // Find worker's conversation chat
    const workerChat = await ctx.db
      .query("chats")
      .filter((q) => 
        q.and(
          q.eq(q.field("job_id"), jobId),
          q.eq(q.field("worker_id"), job.worker_id),
          q.neq(q.field("customer_id"), undefined) // Conversation chat
        )
      )
      .first();

    if (!workerChat) {
      return { success: false };
    }

    // Schedule reminders every 5 minutes for up to 1 hour
    const reminderIntervals = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]; // minutes

    for (let i = 0; i < reminderIntervals.length; i++) {
      await ctx.scheduler.runAfter(
        reminderIntervals[i] * 60 * 1000, // Convert to milliseconds
        api.messages.createOnboardingReminder,
        {
          chatId: workerChat._id,
          workerId: job.worker_id,
          jobId: jobId,
          reminderNumber: i + 1,
        }
      );
    }

    return { success: true, remindersScheduled: reminderIntervals.length };
  },
});

// Update the existing validateOnboardingCode to expire reminders
export const validateOnboardingCode = mutation({
  args: {
    jobId: v.id("jobs"),
    inputCode: v.string(),
  },
  handler: async (ctx, { jobId, inputCode }) => {
    const job = await ctx.db.get(jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    if (!job.onboarding_code) {
      throw new Error("Onboarding code not generated for this job");
    }

    const isValid = job.onboarding_code === inputCode.trim();
    
    if (isValid) {
      // Trigger status transition
      await ctx.scheduler.runAfter(0, api.jobs.updateJobStatusToInProgress, {
        jobId: jobId
      });

      // NEW: Expire reminder messages
      await ctx.scheduler.runAfter(0, api.messages.expireOnboardingReminders, {
        jobId: jobId
      });
      
    }

    return { 
      success: true, 
      isValid,
      jobStatus: isValid ? "in_progress" : job.status 
    };
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

/**
 * Updates job status when onboarding code is verified
 * Transitions from "matched" to "in_progress"
 */
export const updateJobStatusToInProgress = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    if (job.status !== "matched") {
      throw new Error(`Cannot transition to in_progress from ${job.status}`);
    }

    // Update job status
    await ctx.db.patch(jobId, {
      status: "in_progress",
    });

    // Send notification to customer about job starting
    await notifyCustomerJobStarted(ctx, jobId);

    return { success: true, newStatus: "in_progress" };
  },
});

/**
 * Updates job status when completion code is verified
 * Transitions from "in_progress" to "completed"
 */
export const updateJobStatusToCompleted = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    if (job.status !== "in_progress") {
      throw new Error(`Cannot transition to completed from ${job.status}`);
    }

    // Update job status
    await ctx.db.patch(jobId, {
      status: "completed",
    });

    // Reset chat conversations for both parties (moved from ratings.ts)
    await resetChatsAfterCompletion(ctx, jobId);

    // Trigger rating flow for both parties
    await initiateRatingFlow(ctx, jobId);

    return { success: true, newStatus: "completed" };
  },
});

/**
 * Updates job when cancelled to trigger UI state changes
 */
export const markJobAsCancelled = mutation({
  args: {
    jobId: v.id("jobs"),
    cancelledBy: v.id("users"),
    phase: v.union(
      v.literal("bidding"), 
      v.literal("matched"), 
      v.literal("in_progress")
    ),
  },
  handler: async (ctx, { jobId, cancelledBy, phase }) => {
    
    const job = await ctx.db.get(jobId);
    if (!job) {
      throw new Error("Job not found");
    }
    

    // Update job status
    await ctx.db.patch(jobId, {
      status: "cancelled",
      cancelled_at: Date.now(),
      cancelled_at_phase: phase,
    });

    // Log cancellation
    await ctx.db.insert("job_cancellations", {
      job_id: jobId,
      cancelled_by: cancelledBy,
      phase,
      cancelled_at: Date.now(),
    });

    // Find the chat BEFORE scheduling expiration (while job_id is still valid)
    const chat = await ctx.db
      .query("chats")
      .filter((q) => q.eq(q.field("job_id"), jobId))
      .first();


    // NEW: Expire all messages related to this job IMMEDIATELY (not after delay)
    await ctx.runMutation(api.messages.expireAllJobMessages, {
      jobId: jobId,
    });

    // Expire related worker job bubbles after a delay
    await ctx.scheduler.runAfter(5000, api.messages.expireWorkerJobBubblesForJob, {
      jobId: jobId,
    });

    // NEW: Clear job_id from the chat AFTER expiration
    if (chat) {
      await ctx.db.patch(chat._id, {
        job_id: undefined,
      });
    }

    return { success: true };
  },
});

// Helper function to notify customer when job starts
async function notifyCustomerJobStarted(ctx: any, jobId: string) {
  try {
    const job = await ctx.db.get(jobId);
    if (!job) return;

    // Find customer's service chat
    const customerChat = await ctx.db
      .query("chats")
      .filter((q: any) => 
        q.and(
          q.eq(q.field("customer_id"), job.customer_id),
          q.eq(q.field("category_id"), job.category_id),
          q.eq(q.field("worker_id"), undefined) // Service chat
        )
      )
      .first();

    if (!customerChat) return;

    // Send job started notification
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    await ctx.db.insert("messages", {
      chat_id: customerChat._id,
      year_month: yearMonth,
      sender_id: job.customer_id,
      bubble_type: "system_instruction",
      content: "Work has started on your job. The worker is now on-site.",
      metadata: {
        messageKey: "job_started_notification",
        jobId: jobId,
        isSystemGenerated: true,
        automated: true,
      },
      is_dismissed: false,
      is_expired: false,
      created_at: Date.now(),
      status: "sent",
      delivered_at: Date.now(),
    });

  } catch (error) {
    // Notification failed silently
  }
}

// Helper function to initiate rating flow
async function initiateRatingFlow(ctx: any, jobId: string) {
  try {
    const job = await ctx.db.get(jobId);
    if (!job || !job.worker_id) return;

    // Get worker details for customer rating
    const worker = await ctx.db.get(job.worker_id);
    const customer = await ctx.db.get(job.customer_id);

    if (!worker || !customer) {
      return;
    }

    // Send rating bubbles to both customer and worker
    await sendRatingBubbleToCustomer(ctx, jobId, job.customer_id, job.worker_id, worker.name);
    await sendRatingBubbleToWorker(ctx, jobId, job.worker_id, job.customer_id, customer.name);
  } catch (error) {
    // Rating flow failed silently
  }
}

// Helper function to reset chat conversations after completion code validation
async function resetChatsAfterCompletion(ctx: any, jobId: string) {
  try {
    const job = await ctx.db.get(jobId);
    if (!job) return;

    // Find all chats related to this job
    const jobChats = await ctx.db
      .query("chats")
      .filter((q: any) => q.eq(q.field("job_id"), jobId))
      .collect();

    for (const chat of jobChats) {
      // Reset the chat by removing job reference and worker reference
      await ctx.db.patch(chat._id, {
        job_id: undefined,
        worker_id: undefined,
        is_cleared: false,
        banner_info: undefined
      });

    }
  } catch (error) {
  }
}

// Helper function to send rating bubble to customer
async function sendRatingBubbleToCustomer(ctx: any, jobId: string, customerId: string, workerId: string, workerName: string) {
  
  // Find customer's SERVICE chat (not conversation chat)
  const job = await ctx.db.get(jobId);
  const customerChat = await ctx.db
    .query("chats")
    .filter((q: any) => 
      q.and(
        q.eq(q.field("customer_id"), customerId),
        q.eq(q.field("category_id"), job.category_id),
        q.eq(q.field("worker_id"), undefined) // Service chat has no worker_id
      )
    )
    .first();

  if (!customerChat) {
    return;
  }

  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  await ctx.db.insert("messages", {
    chat_id: customerChat._id,
    year_month: yearMonth,
    sender_id: customerId,
    bubble_type: "rating_request",
    content: `Please rate your experience with ${workerName}`,
    metadata: {
      messageKey: "customer_rating_request",
      jobId: jobId,
      workerId: workerId,
      workerName: workerName,
      ratingType: "customer_rates_worker",
      isSystemGenerated: true,
      automated: true,
      isPrivate: true, // NEW: Mark as private rating
    },
    is_dismissed: false,
    is_expired: false,
    created_at: Date.now(),
    status: "sent",
    delivered_at: Date.now(),
  });
  
}

// Helper function to send rating bubble to worker
async function sendRatingBubbleToWorker(ctx: any, jobId: string, workerId: string, customerId: string, customerName: string) {
  
  // Find worker's CONVERSATION chat
  const conversationChat = await ctx.db
    .query("chats")
    .filter((q: any) => 
      q.and(
        q.eq(q.field("job_id"), jobId),
        q.eq(q.field("worker_id"), workerId),
        q.neq(q.field("customer_id"), undefined) // Conversation chat has customer_id
      )
    )
    .first();

  if (!conversationChat) {
    return;
  }

  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  await ctx.db.insert("messages", {
    chat_id: conversationChat._id,
    year_month: yearMonth,
    sender_id: workerId,
    bubble_type: "rating_request",
    content: `Please rate your experience with ${customerName}`,
    metadata: {
      messageKey: "worker_rating_request",
      jobId: jobId,
      customerId: customerId,
      customerName: customerName,
      ratingType: "worker_rates_customer",
      isSystemGenerated: true,
      automated: true,
      isPrivate: true, // NEW: Mark as private rating
    },
    is_dismissed: false,
    is_expired: false,
    created_at: Date.now(),
    status: "sent",
    delivered_at: Date.now(),
  });
  
}

/**
 * Internal helper to generate completion code (reuses existing logic)
 */
async function generateCompletionCodeInternal(ctx: any, jobId: string) {
  const job = await ctx.db.get(jobId);
  if (!job) {
    return { success: false, error: "Job not found" };
  }

  if (job.completion_code) {
    // Code already exists, return it
    return { success: true, code: job.completion_code };
  }

  // Generate 6-digit completion code
  const completionCode = Math.floor(100000 + Math.random() * 900000).toString();
  
  await ctx.db.patch(jobId, {
    completion_code: completionCode,
  });
  
  return { success: true, code: completionCode };
}

/**
 * Sends completion code to customer's service chat
 * Uses same approach as onboarding code delivery
 */
async function sendCompletionCodeToCustomer(ctx: any, jobId: string, customerId: string, completionCode: string) {
  
  const job = await ctx.db.get(jobId);
  if (!job) {
    return;
  }
  
  // Find customer's service chat (same logic as onboarding code)
  const customerChat = await ctx.db
    .query("chats")
    .filter((q: any) => 
      q.and(
        q.eq(q.field("customer_id"), customerId),
        q.eq(q.field("category_id"), job.category_id),
        q.eq(q.field("worker_id"), undefined) // Service chat
      )
    )
    .first();

  if (!customerChat) {
    return;
  }

  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  // Create system message with completion code
  await ctx.db.insert("messages", {
    chat_id: customerChat._id,
    year_month: yearMonth,
    sender_id: customerId,
    bubble_type: "system_instruction",
    content: `Share this code with the worker only when work is completed: ${completionCode}`,
    metadata: {
      messageKey: "completion_code_delivery",
      jobId: jobId,
      completionCode: completionCode,
      isSystemGenerated: true,
      automated: true,
      codeType: "completion", // NEW: distinguish from onboarding
    },
    is_dismissed: false,
    is_expired: false,
    created_at: Date.now(),
    status: "sent",
    delivered_at: Date.now(),
  });
  
}

/**
 * Sends completion code input bubble to worker's conversation chat
 */
async function sendCompletionCodeInputToWorker(ctx: any, jobId: string, workerId: string) {
  
  // Find worker's conversation chat
  const conversationChat = await ctx.db
    .query("chats")
    .filter((q: any) => 
      q.and(
        q.eq(q.field("job_id"), jobId),
        q.eq(q.field("worker_id"), workerId),
        q.neq(q.field("customer_id"), undefined) // Conversation chat
      )
    )
    .first();

  if (!conversationChat) {
    return;
  }

  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  // Create completion code input bubble
  await ctx.db.insert("messages", {
    chat_id: conversationChat._id,
    year_month: yearMonth,
    sender_id: workerId,
    bubble_type: "system_prompt", // Use system_prompt for input bubbles
    content: "Ask the customer for the completion code to finish this job",
    metadata: {
      messageKey: "completion_code_input",
      jobId: jobId,
      maxLength: 6,
      promptType: "completion_code_input", // NEW: specific prompt type
      isSystemGenerated: true,
      automated: true,
    },
    is_dismissed: false,
    is_expired: false,
    created_at: Date.now(),
    status: "sent",
    delivered_at: Date.now(),
  });
  
}

/**
 * Assigns a worker to a job after successful bid and converts notification chat to conversation chat
 * This transforms the worker's notification chat into a bidirectional conversation chat
 * 
 * @param jobId - ID of the job to assign worker to
 * @param workerId - ID of the worker being assigned
 * @returns Success status and chat ID for immediate conversation
 */
export const assignWorkerToJob = mutation({
  args: {
    jobId: v.id("jobs"),
    workerId: v.id("users"),
  },
  handler: async (ctx, { jobId, workerId }) => {
    // Verify job exists and is in correct state
    const job = await ctx.db.get(jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    if (job.status !== "posted") {
      throw new Error("Job is no longer available for assignment");
    }

    // Verify worker exists and is eligible
    const worker = await ctx.db.get(workerId);
    if (!worker) {
      throw new Error("Worker not found");
    }

    if (worker.user_type !== "worker" || worker.approval_status !== "approved") {
      throw new Error("Worker not eligible for job assignment");
    }

    // Find worker's notification chat for this category
    const workerChat = await ctx.db
      .query("chats")
      .withIndex("by_worker", (q) => q.eq("worker_id", workerId))
      .filter((q) => q.and(
        q.eq(q.field("category_id"), job.category_id),
        q.eq(q.field("customer_id"), undefined) // Only notification chats
      ))
      .first();

    if (!workerChat) {
      throw new Error("Worker notification chat not found");
    }

    // Update job status to matched
    await ctx.db.patch(jobId, {
      status: "matched",
    });

    // Transform notification chat into conversation chat
    await ctx.db.patch(workerChat._id, {
      customer_id: job.customer_id,  // Add customer to enable conversation
      job_id: jobId,                 // Link to specific job
    });

    // Send system message about successful matching
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const timestamp = Date.now();

    await ctx.db.insert("messages", {
      chat_id: workerChat._id,
      year_month: yearMonth,
      sender_id: workerId, // System message from worker's perspective
      bubble_type: "system_notification",
      content: "You have been assigned to this job. You can now communicate directly with the customer.",
      metadata: {
        messageType: "job_matched",
        jobId: jobId,
        customerId: job.customer_id,
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
    await updateMessagePartitionCount(ctx, workerChat._id, yearMonth, timestamp, 1);

    return {
      success: true,
      jobId,
      workerId,
      chatId: workerChat._id,
      jobStatus: "matched",
    };
  },
});

/**
 * Records when a worker views a job posting
 * Prevents duplicate view counting from same worker
 * Used for analytics and job status bubble view count display
 */
export const recordJobView = mutation({
  args: {
    jobId: v.id("jobs"),
    workerId: v.id("users"),
  },
  handler: async (ctx, { jobId, workerId }) => {
    // Verify job exists
    const job = await ctx.db.get(jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    // Verify worker exists
    const worker = await ctx.db.get(workerId);
    if (!worker) {
      throw new Error("Worker not found");
    }

    // Check if already viewed by this worker
    const existingView = await ctx.db
      .query("job_views")
      .withIndex("by_job", (q) => q.eq("job_id", jobId))
      .filter((q) => q.eq(q.field("worker_id"), workerId))
      .first();
    
    if (!existingView) {
      await ctx.db.insert("job_views", {
        job_id: jobId,
        worker_id: workerId,
        viewed_at: Date.now(),
      });
    }

    return { success: true, alreadyViewed: !!existingView };
  },
});

/**
 * Cancels a job posting and logs the cancellation
 * Updates job status and removes job status bubble from chat
 * Available during bidding, matched, and in_progress phases
 */
export const cancelJob = mutation({
  args: {
    jobId: v.id("jobs"),
    userId: v.id("users"),
    phase: v.union(
      v.literal("bidding"), 
      v.literal("matched"), 
      v.literal("in_progress")
    ),
  },
  handler: async (ctx, { jobId, userId, phase }) => {
    // Verify job exists and user is the customer
    const job = await ctx.db.get(jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    if (job.customer_id !== userId) {
      throw new Error("Only the job creator can cancel this job");
    }

    if (job.status === "cancelled") {
      throw new Error("Job is already cancelled");
    }

    if (job.status === "completed") {
      throw new Error("Cannot cancel a completed job");
    }

    // Update job status
    await ctx.db.patch(jobId, {
      status: "cancelled",
      cancelled_at: Date.now(),
      cancelled_at_phase: phase,
    });
    
    // Log cancellation for analytics
    await ctx.db.insert("job_cancellations", {
      job_id: jobId,
      cancelled_by: userId,
      phase,
      cancelled_at: Date.now(),
    });
    
    // Find and remove both job status bubble and loading bubble from chat
    const chat = await ctx.db
      .query("chats")
      .filter((q) => q.eq(q.field("job_id"), jobId))
      .first();

    if (chat) {
      await removeJobStatusBubble(ctx, chat._id, jobId);
      await removeLoadingBubble(ctx, chat._id);
    }

    return { success: true, cancelledAt: Date.now() };
  },
});

/**
 * Updates job status and refreshes job status bubble
 * Called when job progresses through lifecycle (posted -> matched -> in_progress -> completed)
 */
export const updateJobStatus = mutation({
  args: {
    jobId: v.id("jobs"),
    newStatus: v.union(
      v.literal("posted"),
      v.literal("matched"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    workerId: v.optional(v.id("users")),
  },
  handler: async (ctx, { jobId, newStatus, workerId }) => {
    // Verify job exists
    const job = await ctx.db.get(jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    // Update job status
    await ctx.db.patch(jobId, { status: newStatus });

    // Update chat with worker_id when job becomes matched
    if (newStatus === "matched" && workerId) {
      const chat = await ctx.db
        .query("chats")
        .filter((q) => q.eq(q.field("job_id"), jobId))
        .first();
      
      if (chat) {
        await ctx.db.patch(chat._id, { worker_id: workerId });
      }
    }

    // Update job status bubble and handle loading bubble if chat exists
    const chat = await ctx.db
      .query("chats")
      .filter((q) => q.eq(q.field("job_id"), jobId))
      .first();

    if (chat) {
      await updateJobStatusBubble(ctx, chat._id, jobId);
      
      // Remove loading bubble when job moves beyond "posted" status
      if (newStatus !== "posted") {
        await removeLoadingBubble(ctx, chat._id);
      }
    }

    return { success: true, newStatus };
  },
});

/**
 * Gets job view count for display in job status bubble
 */
export const getJobViewCount = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, { jobId }) => {
    const views = await ctx.db
      .query("job_views")
      .withIndex("by_job", (q) => q.eq("job_id", jobId))
      .collect();

    return views.length;
  },
});

/**
 * Gets job data for job status bubble display
 * Returns formatted data needed by JobStatusBubble component
 * NOW INCLUDES: actual photos array instead of just photo count
 */
export const getJobBubbleData = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job) {
      return null;
    }

    // Get view count
    const viewCount = await ctx.db
      .query("job_views")
      .withIndex("by_job", (q) => q.eq("job_id", jobId))
      .collect();

    return {
      jobId: job._id,
      status: job.status,
      voiceUrl: job.voice_url,
      voiceDuration: job.voice_duration || 0,
      photoCount: job.photos.length,
      photos: job.photos, // NEW: Return actual photo URLs array
      viewCount: viewCount.length,
      createdAt: job.created_at,
    };
  },
});

/**
 * Gets onboarding status for a job to determine UI state
 */
export const getOnboardingStatus = query({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job) {
      return null;
    }

    return {
      codeGenerated: !!job.onboarding_code,
      codeEntered: job.status === "in_progress" || job.status === "completed",
      currentStatus: job.status,
    };
  },
});

/**
 * UPDATED: Cancel job and completely clear chat conversation
 * This creates a truly fresh chat experience - as if opening category for first time
 */
export const cancelJobAndClearChat = mutation({
  args: {
    jobId: v.id("jobs"),
    userId: v.id("users"),
    phase: v.union(
      v.literal("bidding"), 
      v.literal("matched"), 
      v.literal("in_progress")
    ),
  },
  handler: async (ctx, { jobId, userId, phase }) => {
    
    // Step 1: Verify job exists and user is the customer
    const job = await ctx.db.get(jobId);
    if (!job) {
      throw new Error("Job not found");
    }


    if (job.customer_id !== userId) {
      throw new Error("Only the job creator can cancel this job");
    }

    if (job.status === "cancelled") {
      throw new Error("Job is already cancelled");
    }

    if (job.status === "completed") {
      throw new Error("Cannot cancel a completed job");
    }

    // Step 2: Update job status
    await ctx.db.patch(jobId, {
      status: "cancelled",
      cancelled_at: Date.now(),
      cancelled_at_phase: phase,
    });
    
    
    // Step 3: Log cancellation for analytics (preserve this data)
    await ctx.db.insert("job_cancellations", {
      job_id: jobId,
      cancelled_by: userId,
      phase,
      cancelled_at: Date.now(),
    });
    
    
    // Step 4: Find the associated chat
    const chat = await ctx.db
      .query("chats")
      .filter((q) => q.eq(q.field("job_id"), jobId))
      .first();

    if (!chat) {
      return { 
        success: true, 
        cancelledAt: Date.now(),
        chatReset: false 
      };
    }
    
    
    try {
      // Step 5: Clear the job_id from the chat FIRST (before any other operations)
      await ctx.db.patch(chat._id, {
        job_id: undefined,  // This is the critical fix - clear job_id immediately
        worker_id: undefined,
        is_cleared: false,
      });
      
      
      // Step 6: COMPLETELY delete all messages and partitions
      await deleteAllChatMessages(ctx, chat._id);
      
      // Step 7: Reset chat to fresh state (job_id already cleared above)
      await resetChatToFreshState(ctx, chat._id);

      
      return { 
        success: true, 
        cancelledAt: Date.now(),
        chatReset: true,
        chatId: chat._id
      };
      
    } catch (resetError) {
      const errorMessage = resetError instanceof Error ? resetError.message : 'Unknown error occurred';
      throw new Error(`Failed to reset chat: ${errorMessage}`);
    }
  },
});

/**
 * Helper function to completely delete all messages and partitions for a chat
 * This ensures the chat returns to a pristine state as if never used
 */
async function deleteAllChatMessages(ctx: any, chatId: string) {
  try {
    // Get ALL message partitions for this chat (across all months)
    const partitions = await ctx.db
      .query("message_partitions")
      .withIndex("by_chat", (q: any) => q.eq("chat_id", chatId))
      .collect();

    let totalMessagesDeleted = 0;

    // Delete messages from each partition, then delete the partition itself
    for (const partition of partitions) {
      // Get all messages in this partition
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_chat_partition", (q: any) => 
          q.eq("chat_id", chatId).eq("year_month", partition.year_month)
        )
        .collect();

      // Delete each message
      for (const message of messages) {
        await ctx.db.delete(message._id);
        totalMessagesDeleted++;
      }

      // Delete the partition itself
      await ctx.db.delete(partition._id);
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to delete chat messages: ${errorMessage}`);
  }
}

/**
 * Helper function to reset chat to completely fresh state
 * Removes all job and worker references, making it ready for new conversation
 */
async function resetChatToFreshState(ctx: any, chatId: string) {
  try {
    await ctx.db.patch(chatId, {
      job_id: undefined,        // Remove job reference
      worker_id: undefined,     // Remove worker reference  
      is_cleared: false,        // Reset cleared flag
      banner_info: undefined    // Clear any banner info
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to reset chat state: ${errorMessage}`);
  }
}

// Helper function to create job status bubble message
async function createJobStatusBubble(
  ctx: any,
  chatId: string,
  jobId: string,
  customerId: string
) {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const timestamp = Date.now();

  // Create job status bubble message
  const messageId = await ctx.db.insert("messages", {
    chat_id: chatId,
    year_month: yearMonth,
    sender_id: customerId,
    bubble_type: "job",
    content: jobId, // Store job ID as content for easy lookup
    metadata: {
      jobId: jobId,
      bubbleType: "job_status",
      isSystemGenerated: true,
      automated: true,
    },
    is_dismissed: false,
    is_expired: false,
    created_at: timestamp,
    status: "sent",
    delivered_at: undefined,
    read_at: undefined,
  });

  // Update message partition count
  await updateMessagePartitionCount(ctx, chatId, yearMonth, timestamp, 1);

  return messageId;
}

// Helper function to create loading bubble message
async function createLoadingBubble(
  ctx: any,
  chatId: string,
  customerId: string,
  language: string
) {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const timestamp = Date.now();

  // Localized loading messages
  const LOADING_MESSAGES = {
    job_posted_loading: {
      en: "Finding workers in your area...",
      fr: "Recherche de travailleurs dans votre région...",
      ar: "البحث عن عمال في منطقتك..."
    }
  };

  const content = LOADING_MESSAGES.job_posted_loading[language as keyof typeof LOADING_MESSAGES.job_posted_loading] 
    || LOADING_MESSAGES.job_posted_loading.en;

  // Create loading bubble message
  const messageId = await ctx.db.insert("messages", {
    chat_id: chatId,
    year_month: yearMonth,
    sender_id: customerId,
    bubble_type: "system_instruction",
    content,
    metadata: {
      messageKey: "job_posted_loading",
      showLoadingAnimation: true,
      isSystemGenerated: true,
      automated: true,
      language,
    },
    is_dismissed: false,
    is_expired: false,
    created_at: timestamp,
    status: "sent",
    delivered_at: undefined,
    read_at: undefined,
  });

  // Update message partition count
  await updateMessagePartitionCount(ctx, chatId, yearMonth, timestamp, 1);

  return messageId;
}

// Helper function to update job status bubble
async function updateJobStatusBubble(
  ctx: any,
  chatId: string,
  jobId: string
) {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Find the job status bubble message
  const jobBubbleMessage = await ctx.db
    .query("messages")
    .withIndex("by_chat_partition", (q: any) => 
      q.eq("chat_id", chatId).eq("year_month", yearMonth)
    )
    .filter((q: any) => 
      q.and(
        q.eq(q.field("bubble_type"), "job"),
        q.eq(q.field("content"), jobId)
      )
    )
    .first();

  if (jobBubbleMessage) {
    // Update the message timestamp to trigger reactivity
    await ctx.db.patch(jobBubbleMessage._id, {
      metadata: {
        ...jobBubbleMessage.metadata,
        lastUpdated: Date.now(),
      }
    });
  }
}

// Helper function to remove job status bubble
async function removeJobStatusBubble(
  ctx: any,
  chatId: string,
  jobId: string
) {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Find the job status bubble message
  const jobBubbleMessage = await ctx.db
    .query("messages")
    .withIndex("by_chat_partition", (q: any) => 
      q.eq("chat_id", chatId).eq("year_month", yearMonth)
    )
    .filter((q: any) => 
      q.and(
        q.eq(q.field("bubble_type"), "job"),
        q.eq(q.field("content"), jobId)
      )
    )
    .first();

  if (jobBubbleMessage) {
    // Delete the message
    await ctx.db.delete(jobBubbleMessage._id);
    await updateMessagePartitionCount(ctx, chatId, yearMonth, Date.now(), -1);
  }
}

// Helper function to remove loading bubble
async function removeLoadingBubble(
  ctx: any,
  chatId: string
) {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Find the loading bubble message
  const loadingBubbleMessage = await ctx.db
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

  if (loadingBubbleMessage) {
    // Delete the message
    await ctx.db.delete(loadingBubbleMessage._id);
    await updateMessagePartitionCount(ctx, chatId, yearMonth, Date.now(), -1);
  }
}

// Helper function to update message partition count with complete deletion support
async function updateMessagePartitionCount(
  ctx: any,
  chatId: string,
  yearMonth: string,
  timestamp: number,
  delta: number
) {
  const existingPartition = await ctx.db
    .query("message_partitions")
    .withIndex("by_chat", (q: any) => q.eq("chat_id", chatId))
    .filter((q: any) => q.eq(q.field("year_month"), yearMonth))
    .first();

  if (existingPartition) {
    const newCount = existingPartition.message_count + delta;
    
    if (newCount <= 0) {
      // Delete partition entirely when count reaches zero
      await ctx.db.delete(existingPartition._id);
      // Partition deleted when count reached zero
    } else {
      await ctx.db.patch(existingPartition._id, {
        message_count: newCount,
      });
    }
  } else if (delta > 0) {
    // Create new partition only when adding messages
    await ctx.db.insert("message_partitions", {
      chat_id: chatId,
      year_month: yearMonth,
      message_count: delta,
      created_at: timestamp,
    });
  }
}

// Add these mutations after existing ones

/**
 * Generates and stores onboarding code for a job when it moves to matched status
 */
export const generateOnboardingCode = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    if (job.onboarding_code) {
      // Code already generated, return existing
      return { success: true, code: job.onboarding_code };
    }

    // Generate 4-digit onboarding code
    const onboardingCode = Math.floor(1000 + Math.random() * 9000).toString();

    await ctx.db.patch(jobId, {
      onboarding_code: onboardingCode,
    });

    return { success: true, code: onboardingCode };
  },
});

/**
 * Generates and stores completion code for a job when worker confirms completion
 */
export const generateCompletionCode = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    if (job.completion_code) {
      // Code already generated, return existing
      return { success: true, code: job.completion_code };
    }

    // Generate 6-digit completion code
    const completionCode = Math.floor(100000 + Math.random() * 900000).toString();

    await ctx.db.patch(jobId, {
      completion_code: completionCode,
    });

    return { success: true, code: completionCode };
  },
});


/**
 * Validates completion code input
 */
export const validateCompletionCode = mutation({
  args: {
    jobId: v.id("jobs"),
    inputCode: v.string(),
  },
  handler: async (ctx, { jobId, inputCode }) => {
    const job = await ctx.db.get(jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    if (!job.completion_code) {
      throw new Error("Completion code not generated for this job");
    }

    const isValid = job.completion_code === inputCode.trim();
    
    if (isValid) {
      // NEW: Trigger status transition
      await ctx.scheduler.runAfter(0, api.jobs.updateJobStatusToCompleted, {
        jobId: jobId
      });
      
    }

    return { 
      success: true, 
      isValid,
      jobStatus: isValid ? "completed" : job.status 
    };
  },
});

/**
 * Expires rating bubbles after both ratings submitted
 */
export const expireRatingBubbles = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, { jobId }) => {
    try {
      const ratingMessages = await ctx.db
        .query("messages")
        .filter((q: any) => 
          q.and(
            q.eq(q.field("bubble_type"), "rating_request"),
            q.eq(q.field("metadata.jobId"), jobId),
            q.eq(q.field("is_expired"), false)
          )
        )
        .collect();

      for (const message of ratingMessages) {
        await ctx.db.patch(message._id, {
          is_expired: true,
        });
      }

    return { success: true, expiredCount: ratingMessages.length };
  } catch (error) {
    throw new Error("Failed to expire rating bubbles");
  }
  },
});

// Add the new chat reset functions at the end of the file

/**
 * Resets customer service chat after job completion
 */
export const resetCustomerServiceChat = mutation({
  args: {
    customerId: v.id("users"),
    categoryId: v.id("categories"),
  },
  handler: async (ctx, { customerId, categoryId }) => {
    try {
      // Find customer's service chat
      const customerChat = await ctx.db
        .query("chats")
        .filter((q) => 
          q.and(
            q.eq(q.field("customer_id"), customerId),
            q.eq(q.field("category_id"), categoryId),
            q.eq(q.field("worker_id"), undefined) // Service chat
          )
        )
        .first();

      if (!customerChat) {
        return { success: false, error: "Service chat not found" };
      }

      // Use the new expiration method
      await ctx.scheduler.runAfter(0, api.chats.expireNonInitialMessages, {
        chatId: customerChat._id,
      });

      // Reset chat state
      await ctx.db.patch(customerChat._id, {
        job_id: undefined,
        worker_id: undefined,
        is_cleared: false,
      });

      // Check if chat needs reinitialization and reinitialize if needed
      await ctx.scheduler.runAfter(500, api.messages.reinitializeCustomerChat, {
        chatId: customerChat._id,
        categoryId: categoryId,
        customerId: customerId,
        language: "en", // TODO: Get user's actual language preference
      });

      return { success: true, chatId: customerChat._id };
    } catch (error) {
      throw error;
    }
  },
});

/**
 * Removes worker conversation chat after job completion
 */
export const removeWorkerConversationChat = mutation({
  args: {
    jobId: v.id("jobs"),
    workerId: v.id("users"),
  },
  handler: async (ctx, { jobId, workerId }) => {

    try {
      // Use the new comprehensive cleanup method
      await ctx.scheduler.runAfter(0, api.chats.removeWorkerConversationChat, {
        jobId: jobId,
        workerId: workerId,
      });

      // Ensure worker has a clean notification chat for future jobs
      const job = await ctx.db.get(jobId);
      if (job) {
        await ctx.scheduler.runAfter(1000, api.chats.ensureWorkerNotificationChat, {
          workerId: workerId,
          categoryId: job.category_id,
        });
      }

      return { success: true };
    } catch (error) {
      console.error(`[CHAT_RESET] Failed to schedule worker cleanup:`, error);
      throw error;
    }
  },
});
