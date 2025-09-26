// convex/workerJobs.ts - Worker job reception and bidding functionality
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Gets jobs that a worker is eligible to see based on:
 * 1. Worker has balance > 0
 * 2. Worker is assigned as categorizer in jobs.categorizer_worker_ids
 * 3. Job is in "posted" status
 * 
 * @param workerId - ID of the worker requesting jobs
 * @returns Array of jobs with relevant data for worker interface
 */
export const getWorkerEligibleJobs = query({
  args: {
    workerId: v.id("users"),
  },
  handler: async (ctx, { workerId }) => {


    // Check worker exists and has sufficient balance
    const worker = await ctx.db.get(workerId);
    if (!worker) {
      throw new Error("Worker not found");
    }


    if (worker.user_type !== "worker") {
      throw new Error("User is not a worker");
    }

    if (worker.balance <= 0) {
      // Return empty array instead of error - workers with no balance see no jobs
      return [];
    }

    // Get jobs where worker is assigned as categorizer and job is posted
    const jobs = await ctx.db
      .query("jobs")
      .filter((q) => 
        q.and(
          q.eq(q.field("status"), "posted"),
          q.gt(q.field("broadcasting_phase"), 0) // Only jobs in categorization phase
        )
      )
      .collect();

    // Filter jobs where this worker is in categorizer_worker_ids
    const eligibleJobs = jobs.filter(job => 
      job.categorizer_worker_ids.includes(workerId)
    );



    // Enrich jobs with category data and format for worker interface
    const enrichedJobs = await Promise.all(
      eligibleJobs.map(async (job) => {
        const category = await ctx.db.get(job.category_id);
        const customer = await ctx.db.get(job.customer_id);

        return {
          jobId: job._id,
          categoryId: job.category_id,
          categoryName: category?.name_en || "Unknown Category",
          categoryNameFr: category?.name_fr || "",
          categoryNameAr: category?.name_ar || "",
          voiceUrl: job.voice_url,
          voiceDuration: job.voice_duration || 0,
          photos: job.photos,
          locationLat: job.location_lat,
          locationLng: job.location_lng,
          priceFloor: job.price_floor,
          portfolioConsent: job.portfolio_consent,
          broadcastingPhase: job.broadcasting_phase,
          customerName: customer?.name || "Customer",
          createdAt: job.created_at,
          hasSubcategory: !!job.subcategory_id,
          subcategoryId: job.subcategory_id,
        };
      })
    );

    return enrichedJobs;
  },
});

/**
 * Assigns categorizers to a job using expert-first strategy
 * 1. Gets configurable group size from database
 * 2. Selects all available expert categorizers first
 * 3. Fills remaining slots with random workers
 * 4. Stores final group size for vote calculations
 */
export const assignCategorizerWorkers = mutation({
  args: {
    jobId: v.id("jobs"),
  },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    if (job.categorizer_worker_ids.length > 0) {
      throw new Error("Categorizers already assigned to this job");
    }

    // **NEW STEP 1: Check if category has subcategories**
    const subcategories = await ctx.db
      .query("categories")
      .withIndex("by_parent", (q) => q.eq("parent_id", job.category_id))
      .collect();

    // **NEW STEP 2: If no subcategories exist, skip categorization entirely**
    if (subcategories.length === 0) {
      // Set job to bidding phase immediately
      await ctx.db.patch(jobId, {
        subcategory_id: job.category_id, // Use parent category as subcategory
        broadcasting_phase: 2, // Skip to bidding phase
        categorizer_worker_ids: [], // No categorizers needed
        categorizer_group_size: 0, // No categorization group
      });

      // Broadcast directly to all workers in parent category
      await assignBiddersToJob(ctx, jobId, [job.category_id]);

      return {
        success: true,
        skippedCategorization: true,
        broadcastedToCategory: job.category_id,
        reason: "No subcategories exist for this category",
      };
    }

    // **EXISTING LOGIC CONTINUES UNCHANGED FROM HERE**
    // Get configurable group size from database
    const targetGroupSize = await getCategorizerGroupSize(ctx, job.category_id);

    // Get all workers skilled in this category
    const skilledWorkers = await ctx.db
      .query("user_skills")
      .withIndex("by_category", (q) => q.eq("category_id", job.category_id))
      .collect();

    // Filter eligible workers (balance > 0, approved)
    const eligibleWorkers = await Promise.all(
      skilledWorkers.map(async (skill) => {
        const worker = await ctx.db.get(skill.user_id);
        const isEligible = 
          worker && 
          worker.balance > 0 && 
          worker.approval_status === "approved" && 
          worker.user_type === "worker";
        return isEligible ? worker : null;
      })
    );

    const validWorkers = eligibleWorkers.filter(Boolean);

    if (validWorkers.length === 0) {
      throw new Error("No eligible workers found for this category");
    }

    // Get expert categorizers for this category
    const expertCategorizers = await ctx.db
      .query("expert_categorizers")
      .withIndex("by_category", (q) => q.eq("category_id", job.category_id))
      .collect();

    const selectedCategorizers: Id<"users">[] = [];

    // STEP 1: Select all available experts first
    const availableExperts = expertCategorizers
      .map(expert => expert.worker_id)
      .filter(workerId => 
        validWorkers.some(worker => worker!._id === workerId)
      );

    const shuffledExperts = availableExperts.sort(() => 0.5 - Math.random());
    const expertsToUse = shuffledExperts.slice(0, Math.min(targetGroupSize, shuffledExperts.length));
    selectedCategorizers.push(...expertsToUse);

    // STEP 2: Fill remaining slots with random workers
    const remainingSlots = targetGroupSize - selectedCategorizers.length;

    if (remainingSlots > 0) {
      const nonExpertWorkers = validWorkers
        .filter(worker => !selectedCategorizers.includes(worker!._id))
        .map(worker => worker!._id);

      const shuffledRandom = nonExpertWorkers.sort(() => 0.5 - Math.random());
      const randomToUse = shuffledRandom.slice(0, remainingSlots);
      selectedCategorizers.push(...randomToUse);
    }

    // Update job with selected categorizers and store group size
    await ctx.db.patch(jobId, {
      categorizer_worker_ids: selectedCategorizers,
      broadcasting_phase: 1,
      categorizer_group_size: targetGroupSize,
    });

    // Send job notifications to selected categorizers
    await Promise.all(
      selectedCategorizers.map(async (workerId) => {
        await sendJobToWorkerChat(ctx, jobId, workerId);
      })
    );

    return {
      success: true,
      targetGroupSize,
      selectedCount: selectedCategorizers.length,
      expertCount: expertsToUse.length,
      randomCount: selectedCategorizers.length - expertsToUse.length,
    };
  },
});

/**
 * Gets configurable categorizer group size from database
 * Falls back to default of 6 if not configured
 */
async function getCategorizerGroupSize(ctx: any, categoryId: string): Promise<number> {
  // Check global system setting
  const globalSetting = await ctx.db
    .query("system_settings")
    .withIndex("by_key", (q: any) => q.eq("setting_key", "categorizer_group_size"))
    .first();
  
  if (globalSetting?.setting_value) {
    return parseInt(globalSetting.setting_value);
  }

  // Fallback to default
  return 6;
}

/**
 * Handles tie scenario by broadcasting to multiple subcategories
 */
async function handleTieCategorization(ctx: any, jobId: string, subcategoryIds: string[]) {
  // Store all tied subcategories
  await ctx.db.patch(jobId, {
    subcategory_ids: subcategoryIds,
    broadcasting_phase: 2,
  });

  // Broadcast to workers in all tied subcategories
  await assignBiddersToJob(ctx, jobId, subcategoryIds);
}

/**
 * Worker submits categorization decision with voting logic
 * Analyzes votes after submission to determine next action:
 * - Majority reached → broadcast to winning subcategory
 * - Tie detected → broadcast to all tied subcategories
 * - No decision → wait for more votes
 */
export const submitCategorization = mutation({
  args: {
    jobId: v.id("jobs"),
    workerId: v.id("users"),
    subcategoryId: v.id("categories"),
  },
  handler: async (ctx, { jobId, workerId, subcategoryId }) => {
    // Verify job exists
    const job = await ctx.db.get(jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    // Check job status
    if (job.status === "cancelled") {
      throw new Error("Job has been cancelled");
    }

    // Check if already categorized
    if (job.subcategory_id) {
      throw new Error("Job already categorized");
    }

    // Check broadcasting phase
    if (job.broadcasting_phase !== 1) {
      throw new Error("Job not in categorization phase");
    }

    // Verify worker is authorized
    if (!job.categorizer_worker_ids.includes(workerId)) {
      throw new Error("Worker not authorized to categorize this job");
    }

    // Verify worker type
    const worker = await ctx.db.get(workerId);
    if (!worker || worker.user_type !== "worker") {
      throw new Error("Worker not authorized to categorize this job");
    }

    // Check if worker already voted
    const existingVote = await ctx.db
      .query("job_categorizations")
      .withIndex("by_job_worker", (q) => 
        q.eq("job_id", jobId).eq("worker_id", workerId)
      )
      .first();

    if (existingVote) {
      throw new Error("Worker already submitted categorization");
    }

    // Verify subcategory belongs to job's category
    const subcategory = await ctx.db.get(subcategoryId);
    if (!subcategory) {
      throw new Error("Subcategory not found");
    }

    if (subcategory.parent_id !== job.category_id) {
      throw new Error("Subcategory does not belong to job category");
    }

    // Record the vote
    await ctx.db.insert("job_categorizations", {
      job_id: jobId,
      worker_id: workerId,
      suggested_subcategory_id: subcategoryId,
      created_at: Date.now(),
    });

    // Analyze votes to determine next action
    const voteAnalysis = await analyzeCategorizationVotes(ctx, jobId);

    // Update worker_job message metadata
    const workerJobMessage = await ctx.db
      .query("messages")
      .filter((q) => 
        q.and(
          q.eq(q.field("bubble_type"), "worker_job"),
          q.eq(q.field("content"), jobId),
          q.eq(q.field("sender_id"), workerId)
        )
      )
      .first();

    if (workerJobMessage && workerJobMessage.metadata?.jobData) {
      await ctx.db.patch(workerJobMessage._id, {
        metadata: {
          ...workerJobMessage.metadata,
          jobData: {
            ...workerJobMessage.metadata.jobData,
            hasVoted: true,
            votedSubcategoryId: subcategoryId,
            votingProgress: {
              currentVotes: voteAnalysis.currentVotes,
              totalCategorizers: voteAnalysis.totalCategorizers,
              majorityThreshold: voteAnalysis.majorityThreshold,
            }
          }
        }
      });
    }

    if (voteAnalysis.hasDecision) {
      if (voteAnalysis.isTie) {
        // TIE SCENARIO: Broadcast to multiple subcategories
        await handleTieCategorization(ctx, jobId, voteAnalysis.tiedSubcategories);
        
        return {
          success: true,
          result: "tie",
          tiedSubcategories: voteAnalysis.tiedSubcategories,
          voteDistribution: voteAnalysis.voteDistribution,
        };
      } else {
        // CLEAR WINNER: Broadcast to single subcategory
        await ctx.db.patch(jobId, {
          subcategory_id: voteAnalysis.winningSubcategory as Id<"categories">,
          broadcasting_phase: 2,
        });

        // Update all categorizer messages to show final result
        const allCategorizerMessages = await ctx.db
          .query("messages")
          .filter((q) => 
            q.and(
              q.eq(q.field("bubble_type"), "worker_job"),
              q.eq(q.field("content"), jobId)
            )
          )
          .collect();

        await Promise.all(
          allCategorizerMessages.map(async (msg) => {
            if (msg.metadata?.jobData) {
              await ctx.db.patch(msg._id, {
                metadata: {
                  ...msg.metadata,
                  jobData: {
                    ...msg.metadata.jobData,
                    hasSubcategory: true,
                    subcategoryId: voteAnalysis.winningSubcategory,
                    broadcastingPhase: 2,
                  }
                }
              });
            }
          })
        );

        await assignBiddersToJob(ctx, jobId, [voteAnalysis.winningSubcategory!]);

        return {
          success: true,
          result: "majority",
          subcategoryId: voteAnalysis.winningSubcategory,
          voteDistribution: voteAnalysis.voteDistribution,
        };
      }
    } else {
      // NO DECISION YET: Wait for more votes
      return {
        success: true,
        result: "waiting",
        currentVotes: voteAnalysis.currentVotes,
        totalNeeded: voteAnalysis.totalCategorizers,
        majorityThreshold: voteAnalysis.majorityThreshold,
        voteDistribution: voteAnalysis.voteDistribution,
      };
    }
  },
});

/**
 * Validates if a bid amount meets the minimum threshold (auction protection)
 * Checks against category pricing baseline and minimum percentage
 * 
 * @param subcategoryId - Subcategory to check pricing for
 * @param bidAmount - Proposed bid amount
 * @returns Validation result with minimum required amount
 */
export const validateBidAmount = query({
  args: {
    subcategoryId: v.id("categories"),
    bidAmount: v.number(),
  },
  handler: async (ctx, { subcategoryId, bidAmount }) => {
    // Get pricing baseline for subcategory
    const pricing = await ctx.db
      .query("category_pricing")
      .withIndex("by_subcategory", (q) => q.eq("subcategory_id", subcategoryId))
      .first();

    if (!pricing) {
      // No pricing configured - allow any positive bid
      return {
        isValid: bidAmount > 0,
        minimumAmount: 0,
        baselinePrice: 0,
        reason: bidAmount <= 0 ? "Bid must be greater than 0" : undefined,
      };
    }

    const minimumAmount = Math.floor(
      (pricing.baseline_price * pricing.minimum_percentage) / 100
    );

    const isValid = bidAmount >= minimumAmount;

    return {
      isValid,
      minimumAmount,
      baselinePrice: pricing.baseline_price,
      minimumPercentage: pricing.minimum_percentage,
      reason: !isValid 
        ? `Bid must be at least ${minimumAmount} (${pricing.minimum_percentage}% of baseline ${pricing.baseline_price})`
        : undefined,
    };
  },
});

/**
 * Worker submits bid for a job
 * Validates bid amount and creates bid record with service fees
 * 
 * @param jobId - ID of the job to bid on
 * @param workerId - ID of the worker placing bid
 * @param amount - Base bid amount (before service fees)
 * @param equipmentCost - Additional equipment costs
 * @returns Created bid with calculated service fees
 */
export const submitWorkerBid = mutation({
  args: {
    jobId: v.id("jobs"),
    workerId: v.id("users"),
    amount: v.number(),
    equipmentCost: v.optional(v.number()),
  },
  handler: async (ctx, { jobId, workerId, amount, equipmentCost = 0 }) => {
    // Verify job and worker
    const job = await ctx.db.get(jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    const worker = await ctx.db.get(workerId);
    if (!worker) {
      throw new Error("Worker not found");
    }

    if (worker.balance <= 0) {
      throw new Error("Insufficient balance to place bid");
    }

    if (job.status !== "posted") {
      throw new Error("Job is no longer accepting bids");
    }

    if (!job.subcategory_id) {
      throw new Error("Job not yet categorized");
    }

    // Check if worker already placed a bid
    const existingBid = await ctx.db
      .query("bids")
      .withIndex("by_job", (q) => q.eq("job_id", jobId))
      .filter((q) => q.eq(q.field("worker_id"), workerId))
      .first();

    if (existingBid) {
      throw new Error("Worker already placed a bid for this job");
    }

    // Validate bid amount against baseline
    const validationResult = await validateBidAmountHelper(ctx, job.subcategory_id, amount);

    if (!validationResult.isValid) {
      throw new Error(validationResult.reason || "Invalid bid amount");
    }

    // Calculate service fees (example: 10% platform fee)
    const platformFeePercentage = 10;
    const serviceFee = Math.floor((amount * platformFeePercentage) / 100);
    const totalAmount = amount + equipmentCost + serviceFee;

    // Set bid expiration (24 hours from now)
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000);
    
    // Set priority window (first 2 hours for high-priority workers)
    const priorityWindowEnd = Date.now() + (2 * 60 * 60 * 1000);

    // Create the bid with initial pending status
    const bidId = await ctx.db.insert("bids", {
      job_id: jobId,
      worker_id: workerId,
      amount: totalAmount, // Total amount including fees
      equipment_cost: equipmentCost,
      expires_at: expiresAt,
      priority_window_end: priorityWindowEnd,
      status: 'pending', // ADD THIS LINE - explicitly set pending status
      created_at: Date.now(),
    });

    // UPDATE the worker_job message metadata after bid submission
    const workerJobMessage = await ctx.db
      .query("messages")
      .filter((q) => 
        q.and(
          q.eq(q.field("bubble_type"), "worker_job"),
          q.eq(q.field("content"), jobId),
          q.eq(q.field("sender_id"), workerId) // ADD THIS to ensure we update the right worker's message
        )
      )
      .first();

    if (workerJobMessage && workerJobMessage.metadata?.jobData) {
      await ctx.db.patch(workerJobMessage._id, {
        metadata: {
          ...workerJobMessage.metadata,
          jobData: {
            ...workerJobMessage.metadata.jobData,
            // ADD BID STATUS FIELDS:
            bidStatus: 'pending',
            bidId: bidId,
            bidAmount: amount, // Base amount without fees
            bidEquipmentCost: equipmentCost,
            bidServiceFee: serviceFee,
            bidTotalAmount: totalAmount,
            bidSubmittedAt: Date.now(),
          }
        }
      });
    }




    // NEW: Send bid notification to customer
    try {
      await sendBidToCustomer(ctx, jobId, bidId, workerId);
    } catch (bidNotificationError) {
      console.error('[BID_SUBMISSION_DEBUG] sendBidToCustomer failed:', bidNotificationError);
      // Don't throw - bid is created, notification failure shouldn't break the bid
    }

    return {
      success: true,
      bidId,
      baseAmount: amount,
      equipmentCost,
      serviceFee,
      totalAmount,
      expiresAt,
      priorityWindowEnd,
    };
  },
});

async function sendBidToCustomer(ctx: any, jobId: string, bidId: string, workerId: string) {


  try {
    const job = await ctx.db.get(jobId);
 
    
    if (!job) {
      return;
    }

    const worker = await ctx.db.get(workerId);
    const bid = await ctx.db.get(bidId);
    

    
    if (!worker || !bid) {
      return;
    }
    
    // Find customer's chat for this job
    const customerChat = await ctx.db
      .query("chats")
      .filter((q: any) => 
        q.and(
          q.eq(q.field("customer_id"), job.customer_id),
          q.eq(q.field("category_id"), job.category_id)
        )
      )
      .first();
    

    
    if (!customerChat) {
      return;
    }

    // Prepare bid data for the bubble
    const bidData = {
      bidId: bid._id,
      workerId: worker._id,
      workerName: worker.name,
      workerPhotoUrl: worker.photo_url,
      workerRating: worker.rating || 4.5,
      workerReviewCount: 23,
      bidAmount: bid.amount - bid.equipment_cost - Math.floor(bid.amount * 0.1),
      equipmentCost: bid.equipment_cost,
      serviceFee: Math.floor(bid.amount * 0.1),
      totalAmount: bid.amount,
      experienceLevel: 'intermediate' as const,
      status: 'pending' as const,
      createdAt: bid.created_at,
      expiresAt: bid.expires_at,
    };


    // Create bid notification message
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    

    
    const messageId = await ctx.db.insert("messages", {
      chat_id: customerChat._id,
      year_month: yearMonth,
      sender_id: workerId,
      bubble_type: "bid",
      content: bidId,
      metadata: { bidData },
      is_dismissed: false,
      is_expired: false, // ADD THIS LINE
      created_at: Date.now(),
      status: "sent",
    });


  } catch (error) {
    console.error('[BID_NOTIFICATION_DEBUG] Error in sendBidToCustomer:', error);
    throw error;
  }
}

// Helper function to assign bidders when job moves to phase 2
async function assignBiddersToJob(ctx: any, jobId: string, categoryIds: string[]) {
  const allWorkers = new Set<string>();

  for (const categoryId of categoryIds) {
    // **CHANGE: Query works for both parent categories and subcategories**
    // When a parent category ID is passed, it finds workers skilled in that category
    const categoryWorkers = await ctx.db
      .query("user_skills")
      .withIndex("by_category", (q: { eq: (arg0: string, arg1: string) => any; }) => 
        q.eq("category_id", categoryId)
      )
      .collect();

    const eligibleWorkers = await Promise.all(
      categoryWorkers.map(async (skill: { user_id: any; }) => {
        const worker = await ctx.db.get(skill.user_id);
        return worker && 
               worker.balance > 0 && 
               worker.approval_status === "approved" && 
               worker.user_type === "worker" 
          ? worker._id 
          : null;
      })
    );

    const validWorkerIds = eligibleWorkers.filter(Boolean) as string[];
    validWorkerIds.forEach(id => allWorkers.add(id));
  }

  // **NEW: Send worker_job bubbles to all eligible workers**
  const workerIds = Array.from(allWorkers);
  await Promise.all(
    workerIds.map(async (workerId) => {
      await sendJobToWorkerChat(ctx, jobId, workerId);
    })
  );

  return allWorkers.size;
}

/**
 * Sends job notification to worker's chat in the relevant category
 * Creates worker job bubble message for categorization tasks
 * Handles chat creation, message partitioning, and error recovery
 * UPDATED: Uses correct worker_id field instead of misusing customer_id
 * 
 * @param ctx - Convex mutation context
 * @param jobId - ID of the job to send to worker
 * @param workerId - ID of the worker to notify
 * @returns Message ID of created notification or error indicator
 */
async function sendJobToWorkerChat(ctx: any, jobId: string, workerId: string): Promise<string> {


  try {
    // Validate inputs
    if (!jobId || !workerId) {
      throw new Error("Missing required parameters: jobId or workerId");
    }

    // Get job details to extract category
    const job = await ctx.db.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    // Verify worker exists and is eligible
    const worker = await ctx.db.get(workerId);
    if (!worker) {
      throw new Error(`Worker not found: ${workerId}`);
    }

    if (worker.user_type !== "worker") {
      throw new Error(`User ${workerId} is not a worker`);
    }

    if (worker.approval_status !== "approved") {
      throw new Error(`Worker ${workerId} is not approved`);
    }

    // Verify category exists
    const category = await ctx.db.get(job.category_id);
    if (!category) {
      throw new Error(`Category not found: ${job.category_id}`);
    }

    const customer = await ctx.db.get(job.customer_id);

    // FIXED: Find or create worker chat using correct worker_id field
    // UPDATED: Always send new jobs to notification chat, not conversation chat
    let workerChat = await ctx.db
      .query("chats")
      .withIndex("by_worker", (q: any) => q.eq("worker_id", workerId))
      .filter((q: any) => 
        q.and(
          q.eq(q.field("category_id"), job.category_id),
          q.eq(q.field("customer_id"), undefined) // Always use notification chat
        )
      )
      .first();

    // Create chat if it doesn't exist
    if (!workerChat) {
      const workerChatId = await ctx.db.insert("chats", {
        customer_id: undefined,      // FIXED: No customer initially
        worker_id: workerId,         // FIXED: Worker in correct field
        category_id: job.category_id,
        job_id: undefined,           // No specific job yet
        is_cleared: false,
        created_at: Date.now(),
      });

      workerChat = await ctx.db.get(workerChatId);
      if (!workerChat) {
        throw new Error("Failed to create worker chat");
      }
    }



    // Prevent duplicate notifications
    const existingNotification = await checkForExistingJobNotification(ctx, workerChat._id, jobId);
    if (existingNotification) {
      return existingNotification;
    }

    // Before calling createWorkerJobMessage
    
    const messageId = await createWorkerJobMessage(ctx, workerChat._id, workerId, jobId, job, category, customer);
    


    return messageId;
  } catch (error) {
    console.error('[WORKER_MSG_DEBUG] Error in sendJobToWorkerChat:', error);
    throw error;
  }
}

/**
 * Checks if job notification already exists to prevent duplicates
 */
async function checkForExistingJobNotification(ctx: any, chatId: string, jobId: string): Promise<string | null> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const existingMessage = await ctx.db
    .query("messages")
    .withIndex("by_chat_partition", (q: any) => q.eq("chat_id", chatId).eq("year_month", yearMonth))
    .filter((q: any) => 
      q.and(
        q.eq(q.field("bubble_type"), "worker_job"),
        q.eq(q.field("content"), jobId)
      )
    )
    .first();

  return existingMessage ? existingMessage._id : null;
}

/**
 * Creates the actual worker job message with FULL metadata including jobData
 * This is what WorkerJobBubble expects to receive
 */
async function createWorkerJobMessage(ctx: any, chatId: string, workerId: string, jobId: string, job: any, category: any, customer: any): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const timestamp = Date.now();

  // CHECK if worker already has a bid for this job
  const existingBid = await getWorkerBidForJob(ctx, jobId, workerId);

  // Create the complete jobData object that WorkerJobBubble expects
  const jobData = {
    jobId: job._id,
    categoryId: job.category_id,
    categoryName: category.name_en || "Unknown Category",
    categoryNameFr: category.name_fr || category.name_en || "",
    categoryNameAr: category.name_ar || category.name_en || "",
    voiceUrl: job.voice_url,
    voiceDuration: job.voice_duration || 0,
    photos: job.photos || [],
    locationLat: job.location_lat,
    locationLng: job.location_lng,
    priceFloor: job.price_floor,
    portfolioConsent: job.portfolio_consent,
    broadcastingPhase: job.broadcasting_phase,
    customerName: customer?.name || "Customer",
    createdAt: job.created_at,
    hasSubcategory: !!job.subcategory_id,
    subcategoryId: job.subcategory_id,
    
    // ADD BID INFORMATION IF EXISTS:
    ...(existingBid && {
      bidStatus: existingBid.status || 'pending',
      bidId: existingBid._id,
      bidAmount: existingBid.amount - existingBid.equipment_cost - Math.floor(existingBid.amount * 0.1), // Base amount
      bidEquipmentCost: existingBid.equipment_cost,
      bidServiceFee: Math.floor(existingBid.amount * 0.1),
      bidTotalAmount: existingBid.amount,
      bidSubmittedAt: existingBid.created_at,
      bidAcceptedAt: existingBid.accepted_at,
      bidRejectedAt: existingBid.rejected_at,
    }),
  };

  // Create worker job notification message
  const messageId = await ctx.db.insert("messages", {
    chat_id: chatId,
    year_month: yearMonth,
    sender_id: workerId,
    bubble_type: "worker_job",
    content: jobId,
    metadata: {
      jobId: jobId,
      bubbleType: "worker_job_notification",
      messageType: "categorization_request",
      jobCategory: job.category_id,
      jobStatus: job.status,
      broadcastingPhase: job.broadcasting_phase,
      isSystemGenerated: true,
      automated: true,
      createdAt: timestamp,
      // THIS IS THE KEY FIX: Include the full jobData object
      jobData: jobData,
    },
    is_dismissed: false,
    is_expired: false, // ADD THIS LINE
    created_at: timestamp,
    status: "sent",
    delivered_at: timestamp,
    read_at: undefined,
  });

  // Update message partition count
  await updateMessagePartitionCount(ctx, chatId, yearMonth, timestamp, 1);

  return messageId;
}

/**
 * Updates message partition count with proper error handling
 */
async function updateMessagePartitionCount(ctx: any, chatId: string, yearMonth: string, timestamp: number, delta: number): Promise<void> {
  try {
    const existingPartition = await ctx.db
      .query("message_partitions")
      .withIndex("by_chat", (q: any) => q.eq("chat_id", chatId))
      .filter((q: any) => q.eq(q.field("year_month"), yearMonth))
      .first();

    if (existingPartition) {
      const newCount = existingPartition.message_count + delta;
      
      if (newCount <= 0) {
        await ctx.db.delete(existingPartition._id);
      } else {
        await ctx.db.patch(existingPartition._id, {
          message_count: newCount,
        });
      }
    } else if (delta > 0) {
      await ctx.db.insert("message_partitions", {
        chat_id: chatId,
        year_month: yearMonth,
        message_count: delta,
        created_at: timestamp,
      });
    }
  } catch (error) {
    // Don't throw - partition counting is not critical for functionality
  }
}

// Helper function for bid validation (shared logic with validateBidAmount query)
async function validateBidAmountHelper(ctx: any, subcategoryId: string, bidAmount: number) {
  // Get pricing baseline for subcategory
  const pricing = await ctx.db
    .query("category_pricing")
    .withIndex("by_subcategory", (q: { eq: (arg0: string, arg1: string) => any; }) => q.eq("subcategory_id", subcategoryId))
    .first();

  if (!pricing) {
    // No pricing configured - allow any positive bid
    return {
      isValid: bidAmount > 0,
      minimumAmount: 0,
      baselinePrice: 0,
      reason: bidAmount <= 0 ? "Bid must be greater than 0" : undefined,
    };
  }

  const minimumAmount = Math.floor(
    (pricing.baseline_price * pricing.minimum_percentage) / 100
  );

  const isValid = bidAmount >= minimumAmount;

  return {
    isValid,
    minimumAmount,
    baselinePrice: pricing.baseline_price,
    minimumPercentage: pricing.minimum_percentage,
    reason: !isValid 
      ? `Bid must be at least ${minimumAmount} (${pricing.minimum_percentage}% of baseline ${pricing.baseline_price})`
      : undefined,
  };
}

/**
 * Helper function to get worker's bid for a specific job
 * Returns bid data if exists, null otherwise
 */
async function getWorkerBidForJob(ctx: any, jobId: string, workerId: string) {
  try {
    const bid = await ctx.db
      .query("bids")
      .withIndex("by_job_worker", (q: any) => q.eq("job_id", jobId).eq("worker_id", workerId))
      .first();

    return bid;
  } catch (error) {
    return null;
  }
}

/**
 * Updates worker job message metadata when bid status changes
 * Called from bids.ts when customer accepts/rejects bid
 */
export const updateWorkerJobBidStatus = mutation({
  args: {
    bidId: v.id("bids"),
    newStatus: v.union(v.literal("accepted"), v.literal("rejected")),
    timestamp: v.number(),
  },
  handler: async (ctx, { bidId, newStatus, timestamp }) => {
    // Get bid details
    const bid = await ctx.db.get(bidId);
    if (!bid) {
      return { success: false, error: "Bid not found" };
    }

    // Find the worker's job message
    const workerJobMessage = await ctx.db
      .query("messages")
      .filter((q) => 
        q.and(
          q.eq(q.field("bubble_type"), "worker_job"),
          q.eq(q.field("content"), bid.job_id),
          q.eq(q.field("sender_id"), bid.worker_id)
        )
      )
      .first();

    if (!workerJobMessage || !workerJobMessage.metadata?.jobData) {
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
    
    return { 
      success: true, 
      messageId: workerJobMessage._id,
      newStatus 
    };
  },
});

/**
 * Analyzes categorization votes to determine if decision can be made
 * Checks for majority (>50%) or tie scenarios
 * 
 * @param ctx - Convex context
 * @param jobId - Job being categorized
 * @returns Vote analysis with decision status
 */
async function analyzeCategorizationVotes(ctx: any, jobId: string) {
  const job = await ctx.db.get(jobId);
  if (!job) {
    throw new Error("Job not found");
  }

  // Get target group size (either stored or from categorizer_worker_ids length)
  const totalCategorizers = job.categorizer_group_size || job.categorizer_worker_ids.length;
  
  // Get all votes submitted so far
  const votes = await ctx.db
    .query("job_categorizations")
    .withIndex("by_job", (q: any) => q.eq("job_id", jobId))
    .collect();

  // Count votes per subcategory
  const voteCounts = new Map<string, number>();
  votes.forEach((vote: { suggested_subcategory_id: string; }) => {
    const count = voteCounts.get(vote.suggested_subcategory_id) || 0;
    voteCounts.set(vote.suggested_subcategory_id, count + 1);
  });

  // Calculate majority threshold (>50%)
  const majorityThreshold = Math.floor(totalCategorizers / 2) + 1;
  
  // Find subcategory(ies) with most votes
  const maxVotes = Math.max(...Array.from(voteCounts.values()), 0);
  const topSubcategories = Array.from(voteCounts.entries())
    .filter(([_, count]) => count === maxVotes)
    .map(([subcategoryId, _]) => subcategoryId);

  // Determine decision status
  const hasDecision = maxVotes >= majorityThreshold;
  const isTie = hasDecision && topSubcategories.length > 1;
  const hasAllVotes = votes.length === totalCategorizers;

  return {
    hasDecision,
    isTie,
    winningSubcategory: !isTie && hasDecision ? topSubcategories[0] : null,
    tiedSubcategories: isTie ? topSubcategories : [],
    currentVotes: votes.length,
    totalCategorizers,
    majorityThreshold,
    hasAllVotes,
    voteDistribution: Object.fromEntries(voteCounts),
  };
}
