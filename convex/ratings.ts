// convex/ratings.ts - Rating system implementation
import { api, internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Submits a rating for a job
 */
export const submitRating = mutation({
  args: {
    jobId: v.id("jobs"),
    raterId: v.id("users"),
    ratedId: v.id("users"),
    rating: v.number(),
    reviewText: v.optional(v.string()),
    ratingType: v.union(v.literal("customer_rates_worker"), v.literal("worker_rates_customer")),
  },
  handler: async (ctx, { jobId, raterId, ratedId, rating, reviewText, ratingType }) => {
    // Validate rating range
    if (rating < 1 || rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }

    // Check if rating already exists for this job and rater
    const existingRating = await ctx.db
      .query("ratings")
      .withIndex("by_job", (q: any) => q.eq("job_id", jobId))
      .filter((q: any) => q.eq(q.field("rater_id"), raterId))
      .first();

    if (existingRating) {
      throw new Error("You have already rated this job");
    }

    // Create the rating
    const ratingId = await ctx.db.insert("ratings", {
      rater_id: raterId,
      rated_id: ratedId,
      job_id: jobId,
      rating,
      review_text: reviewText,
      created_at: Date.now(),
    });

    // Update the user's average rating
    await updateUserAverageRating(ctx, ratedId);

    // Check if both ratings are submitted and expire bubbles if so
    await checkAndExpireRatingBubbles(ctx, jobId);

    return { success: true, ratingId };
  },
});

/**
 * Gets ratings for a user (only ratings they gave, not received)
 */
export const getUserRatings = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    const ratings = await ctx.db
      .query("ratings")
      .withIndex("by_rated", (q: any) => q.eq("rated_id", userId))
      .collect();

    return ratings.map(rating => ({
      ...rating,
      // Don't include sensitive information about who rated them
      rater_id: undefined
    }));
  },
});

/**
 * Gets ratings given by a user
 */
export const getRatingsGiven = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    const ratings = await ctx.db
      .query("ratings")
      .filter((q: any) => q.eq(q.field("rater_id"), userId))
      .collect();

    return ratings;
  },
});

/**
 * Gets average rating for a user
 */
export const getUserAverageRating = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    const ratings = await ctx.db
      .query("ratings")
      .withIndex("by_rated", (q: any) => q.eq("rated_id", userId))
      .collect();

    if (ratings.length === 0) {
      return { average: 0, count: 0 };
    }

    const total = ratings.reduce((sum: number, rating: any) => sum + rating.rating, 0);
    const average = total / ratings.length;

    return { average, count: ratings.length };
  },
});

/**
 * Helper function to update user's average rating
 */
async function updateUserAverageRating(ctx: any, userId: string) {
  const ratings = await ctx.db
    .query("ratings")
    .withIndex("by_rated", (q: any) => q.eq("rated_id", userId))
    .collect();

  if (ratings.length === 0) {
    await ctx.db.patch(userId, { rating: undefined });
    return;
  }

  const total = ratings.reduce((sum: number, rating: any) => sum + rating.rating, 0);
  const average = Math.round((total / ratings.length) * 10) / 10; // Round to 1 decimal

  await ctx.db.patch(userId, { rating: average });

}

/**
 * Helper function to check if both ratings are submitted and expire bubbles
 */
async function checkAndExpireRatingBubbles(ctx: any, jobId: string) {
  const job = await ctx.db.get(jobId);
  if (!job) return;

  // Get all ratings for this job
  const ratings = await ctx.db
    .query("ratings")
    .withIndex("by_job", (q: any) => q.eq("job_id", jobId))
    .collect();

  // Check if we have both customer and worker ratings
  const customerRating = ratings.find((r: any) => r.rater_id === job.customer_id);
  const workerRating = ratings.find((r: any) => r.rater_id === job.worker_id);

  if (customerRating && workerRating) {
    // Both ratings submitted - expire rating bubbles only (chats remain active)
    await expireRatingBubbles(ctx, jobId);

    console.log(`[RATING_COMPLETE] Both ratings submitted for job ${jobId}, rating bubbles expired`);
  }
}

/**
 * Expires rating bubbles after both ratings submitted
 */
async function expireRatingBubbles(ctx: any, jobId: string) {
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

  } catch (error) {
    console.error(`[RATING_EXPIRE] Failed to expire rating bubbles:`, error);
  }
}
