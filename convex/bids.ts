// convex/bids.ts - Bid management and acceptance system
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { api } from "./_generated/api";

/**
 * Helper function to update worker job message bid status
 */
async function updateWorkerJobMessageBidStatus(ctx: any, bidId: string, newStatus: 'accepted' | 'rejected', timestamp: number) {
  // Get bid details
  const bid = await ctx.db.get(bidId);
  if (!bid) {
    console.error(`[BID_STATUS_UPDATE] Bid not found: ${bidId}`);
    return { success: false, error: "Bid not found" };
  }

  // Find the worker's job message
  const workerJobMessage = await ctx.db
    .query("messages")
    .filter((q: any) => 
      q.and(
        q.eq(q.field("bubble_type"), "worker_job"),
        q.eq(q.field("content"), bid.job_id),
        q.eq(q.field("sender_id"), bid.worker_id)
      )
    )
    .first();

  if (!workerJobMessage || !workerJobMessage.metadata?.jobData) {
    console.error(`[BID_STATUS_UPDATE] Worker job message not found for bid: ${bidId}`);
    return { success: false, error: "Worker job message not found" };
  }

  // Update the message metadata
  const updatedJobData = {
    ...workerJobMessage.metadata.jobData,
    bidStatus: newStatus,
    ...(newStatus === 'accepted' && { bidAcceptedAt: timestamp }),
    ...(newStatus === 'rejected' && { bidRejectedAt: timestamp }),
  };

  await ctx.db.patch(workerJobMessage._id, {
    metadata: {
      ...workerJobMessage.metadata,
      jobData: updatedJobData,
    }
  });

  console.log(`[BID_STATUS_UPDATE] Updated worker job message bid status to: ${newStatus}`);
  
  return { 
    success: true, 
    messageId: workerJobMessage._id,
    newStatus 
  };
}

/**
 * Customer accepts a worker's bid
 * - Updates bid status to 'accepted'
 * - Creates dedicated conversation chat for customer-worker communication
 * - Sends system notification to customer's original chat
 * - Preserves customer's original service chat for future job requests
 * - Updates worker job message bid status
 */
export const acceptBid = mutation({
  args: {
    bidId: v.id("bids"),
    customerId: v.id("users"),
  },
  handler: async (ctx, { bidId, customerId }) => {

    // Get bid details
    const bid = await ctx.db.get(bidId);
    if (!bid) {
      throw new Error("Bid not found");
    }

    const job = await ctx.db.get(bid.job_id);
    if (!job || job.customer_id !== customerId) {
      throw new Error("Unauthorized to accept this bid");
    }

    // Get worker details for system message
    const worker = await ctx.db.get(bid.worker_id);
    if (!worker) {
      throw new Error("Worker not found");
    }


    // Update bid status in database
    await ctx.db.patch(bidId, {
      status: 'accepted',
      accepted_at: Date.now(),
    });

    // NEW: Create dedicated customer-worker conversation chat
    const conversationChatId = await ctx.db.insert("chats", {
      customer_id: job.customer_id,
      worker_id: bid.worker_id,
      category_id: job.category_id,
      job_id: job._id,
      is_cleared: false,
      created_at: Date.now(),
    });


    // Find the customer's original chat
    const customerChat = await ctx.db
      .query("chats")
      .filter((q) => 
        q.and(
          q.eq(q.field("customer_id"), customerId),
          q.eq(q.field("category_id"), job.category_id),
          q.eq(q.field("worker_id"), undefined) // Original service chat
        )
      )
      .first();

    if (customerChat) {
      // Send system message to customer's original chat
      const now = new Date();
      const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      await ctx.db.insert("messages", {
        chat_id: customerChat._id,
        year_month: yearMonth,
        sender_id: customerId,
        bubble_type: "system_notification",
        content: `You can now communicate with ${worker.name} directly. Tap here to start the conversation.`,
        metadata: {
          messageType: "bid_accepted_notification",
          conversationChatId: conversationChatId,
          workerId: bid.worker_id,
          workerName: worker.name,
          jobId: job._id,
          isSystemGenerated: true,
          automated: true,
        },
        is_dismissed: false,
        is_expired: false,
        created_at: Date.now(),
        status: "sent",
        delivered_at: Date.now(),
      });

      // Update message partition count
      await updateMessagePartitionCount(ctx, customerChat._id, yearMonth, Date.now(), 1);

    }

    // Update job status and assign worker
    await ctx.db.patch(job._id, {
      status: 'matched',
      worker_id: bid.worker_id,
      matched_at: Date.now(),
    });

    // Generate and send onboarding code
    const onboardingResult = await ctx.scheduler.runAfter(0, api.jobs.generateOnboardingCode, {
      jobId: job._id
    });

    // Send onboarding code to customer
    await ctx.scheduler.runAfter(100, api.jobs.sendOnboardingCodeToCustomer, {
      jobId: job._id
    });

    // Create onboarding code input bubble for worker
    await ctx.scheduler.runAfter(200, api.messages.createOnboardingCodeInputBubble, {
      chatId: conversationChatId,
      workerId: bid.worker_id,
      jobId: job._id
    });

    // Schedule periodic reminders
    await ctx.scheduler.runAfter(300, api.jobs.scheduleOnboardingReminders, {
      jobId: job._id
    });

    // Update worker job message bid status (existing code)
    await updateWorkerJobMessageBidStatus(ctx, bidId, 'accepted', Date.now());


    return {
      success: true,
      bidId,
      workerId: bid.worker_id,
      jobId: job._id,
      conversationChatId: conversationChatId, // NEW: Return conversation chat ID
      customerChatId: customerChat?._id,
    };
  },
});

/**
 * Customer rejects a worker's bid
 */
export const rejectBid = mutation({
  args: {
    bidId: v.id("bids"),
    customerId: v.id("users"),
  },
  handler: async (ctx, { bidId, customerId }) => {

    const bid = await ctx.db.get(bidId);
    if (!bid) {
      throw new Error("Bid not found");
    }

    const job = await ctx.db.get(bid.job_id);
    if (!job || job.customer_id !== customerId) {
      throw new Error("Unauthorized to reject this bid");
    }

    // Update bid status
    await ctx.db.patch(bidId, {
      status: 'rejected',
      rejected_at: Date.now(),
    });

    // Update bid message metadata
    const customerChat = await ctx.db
      .query("chats")
      .filter((q) => 
        q.and(
          q.eq(q.field("customer_id"), customerId),
          q.eq(q.field("category_id"), job.category_id)
        )
      )
      .first();

    if (customerChat) {
      const bidMessage = await ctx.db
        .query("messages")
        .filter((q) => 
          q.and(
            q.eq(q.field("chat_id"), customerChat._id),
            q.eq(q.field("bubble_type"), "bid"),
            q.eq(q.field("content"), bidId)
          )
        )
        .first();

      if (bidMessage && bidMessage.metadata?.bidData) {
        await ctx.db.patch(bidMessage._id, {
          metadata: {
            ...bidMessage.metadata,
            bidData: {
              ...bidMessage.metadata.bidData,
              status: 'rejected',
            }
          }
        });
      }
    }

    // Update worker job message bid status
    await updateWorkerJobMessageBidStatus(ctx, bidId, 'rejected', Date.now());


    return {
      success: true,
      bidId,
    };
  },
});

// Add this helper function at the end of bids.ts
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
