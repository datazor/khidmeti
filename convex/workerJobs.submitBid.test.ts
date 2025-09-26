// convex/workerJobs.submitBid.test.ts - Tests for bid submission functions
import { convexTest } from "convex-test";
import { test, expect, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

// Helper function to create test data for bid submission
async function createBidSubmissionTestSetup(t: any) {
  const categoryId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("categories", {
      name_en: "Plumbing",
      name_fr: "Plomberie",
      name_ar: "سباكة",
      photo_url: "photo.jpg",
      requires_photos: true,
      requires_work_code: true,
      level: 1,
    });
  });

  const subcategoryId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("categories", {
      parent_id: categoryId,
      name_en: "Bathroom Plumbing",
      name_fr: "Plomberie de salle de bain",
      name_ar: "سباكة الحمام",
      photo_url: "photo.jpg",
      requires_photos: true,
      requires_work_code: true,
      level: 2,
    });
  });

  const customerId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      phone: `+${Math.random().toString().slice(2, 12)}`,
      password_hash: "hash",
      name: "Test Customer",
      user_type: "customer",
      balance: 1000,
      rating: 4.5,
      cancellation_count: 0,
      priority_score: 100,
      approval_status: "approved",
      onboarding_status: "completed",
      created_at: Date.now(),
    });
  });

  const workerId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      phone: `+${Math.random().toString().slice(2, 12)}`,
      password_hash: "hash",
      name: "Bidding Worker",
      user_type: "worker",
      balance: 1000,
      rating: 4.5,
      cancellation_count: 0,
      priority_score: 100,
      approval_status: "approved",
      onboarding_status: "completed",
      created_at: Date.now(),
    });
  });

  return { categoryId, subcategoryId, customerId, workerId };
}

describe("submitWorkerBid", () => {
  test("should successfully submit valid bid with service fees", async () => {
    const t = convexTest(schema);
    const { categoryId, subcategoryId, customerId, workerId } = await createBidSubmissionTestSetup(t);

    const jobId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jobs", {
        customer_id: customerId,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        voice_url: "voice.mp3",
        photos: [],
        location_lat: 18.0735,
        location_lng: -15.9582,
        work_code: "123456",
        portfolio_consent: true,
        price_floor: 5000,
        status: "posted",
        categorizer_worker_ids: [],
        broadcasting_phase: 2, // Bidding phase
        created_at: Date.now(),
      });
    });

    const baseAmount = 8000;
    const equipmentCost = 500;

    const result = await t.mutation(api.workerJobs.submitWorkerBid, {
      jobId,
      workerId,
      amount: baseAmount,
      equipmentCost,
    });

    expect(result.success).toBe(true);
    expect(result.baseAmount).toBe(baseAmount);
    expect(result.equipmentCost).toBe(equipmentCost);
    expect(result.serviceFee).toBe(800); // 10% of 8000
    expect(result.totalAmount).toBe(9300); // 8000 + 500 + 800
    expect(result.bidId).toBeDefined();
    expect(result.expiresAt).toBeGreaterThan(Date.now());
    expect(result.priorityWindowEnd).toBeGreaterThan(Date.now());

    // Verify bid was created
    const bid = await t.run(async (ctx: any) => {
      return await ctx.db.get(result.bidId);
    });

    expect(bid?.job_id).toBe(jobId);
    expect(bid?.worker_id).toBe(workerId);
    expect(bid?.amount).toBe(9300); // Total amount
    expect(bid?.equipment_cost).toBe(equipmentCost);
  });

  test("should throw error when worker has insufficient balance", async () => {
    const t = convexTest(schema);
    const { categoryId, subcategoryId, customerId } = await createBidSubmissionTestSetup(t);

    const poorWorkerId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        phone: `+${Math.random().toString().slice(2, 12)}`,
        password_hash: "hash",
        name: "Poor Worker",
        user_type: "worker",
        balance: 0, // Zero balance
        rating: 4.5,
        cancellation_count: 0,
        priority_score: 100,
        approval_status: "approved",
        onboarding_status: "completed",
        created_at: Date.now(),
      });
    });

    const jobId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jobs", {
        customer_id: customerId,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        voice_url: "voice.mp3",
        photos: [],
        location_lat: 18.0735,
        location_lng: -15.9582,
        work_code: "123456",
        portfolio_consent: true,
        price_floor: 5000,
        status: "posted",
        categorizer_worker_ids: [],
        broadcasting_phase: 2,
        created_at: Date.now(),
      });
    });

    await expect(
      t.mutation(api.workerJobs.submitWorkerBid, {
        jobId,
        workerId: poorWorkerId,
        amount: 8000,
      })
    ).rejects.toThrow("Insufficient balance to place bid");
  });

  test("should throw error when job not yet categorized", async () => {
    const t = convexTest(schema);
    const { categoryId, customerId, workerId } = await createBidSubmissionTestSetup(t);

    const jobId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jobs", {
        customer_id: customerId,
        category_id: categoryId,
        // subcategory_id: undefined, // Not categorized yet
        voice_url: "voice.mp3",
        photos: [],
        location_lat: 18.0735,
        location_lng: -15.9582,
        work_code: "123456",
        portfolio_consent: true,
        price_floor: 5000,
        status: "posted",
        categorizer_worker_ids: [],
        broadcasting_phase: 1, // Still in categorization phase
        created_at: Date.now(),
      });
    });

    await expect(
      t.mutation(api.workerJobs.submitWorkerBid, {
        jobId,
        workerId,
        amount: 8000,
      })
    ).rejects.toThrow("Job not yet categorized");
  });

  test("should throw error when worker already placed a bid", async () => {
    const t = convexTest(schema);
    const { categoryId, subcategoryId, customerId, workerId } = await createBidSubmissionTestSetup(t);

    const jobId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jobs", {
        customer_id: customerId,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        voice_url: "voice.mp3",
        photos: [],
        location_lat: 18.0735,
        location_lng: -15.9582,
        work_code: "123456",
        portfolio_consent: true,
        price_floor: 5000,
        status: "posted",
        categorizer_worker_ids: [],
        broadcasting_phase: 2,
        created_at: Date.now(),
      });
    });

    // Create existing bid
    await t.run(async (ctx: any) => {
      return await ctx.db.insert("bids", {
        job_id: jobId,
        worker_id: workerId,
        amount: 8000,
        equipment_cost: 0,
        expires_at: Date.now() + 24 * 60 * 60 * 1000,
        priority_window_end: Date.now() + 2 * 60 * 60 * 1000,
        created_at: Date.now(),
      });
    });

    await expect(
      t.mutation(api.workerJobs.submitWorkerBid, {
        jobId,
        workerId,
        amount: 9000, // Different amount
      })
    ).rejects.toThrow("Worker already placed a bid for this job");
  });

  test("should throw error when bid amount is below minimum threshold", async () => {
    const t = convexTest(schema);
    const { categoryId, subcategoryId, customerId, workerId } = await createBidSubmissionTestSetup(t);

    // Set pricing baseline with high minimum
    await t.run(async (ctx: any) => {
      return await ctx.db.insert("category_pricing", {
        subcategory_id: subcategoryId,
        baseline_price: 10000,
        minimum_percentage: 80, // 80% minimum = 8000
        updated_by: customerId,
        updated_at: Date.now(),
      });
    });

    const jobId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jobs", {
        customer_id: customerId,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        voice_url: "voice.mp3",
        photos: [],
        location_lat: 18.0735,
        location_lng: -15.9582,
        work_code: "123456",
        portfolio_consent: true,
        price_floor: 5000,
        status: "posted",
        categorizer_worker_ids: [],
        broadcasting_phase: 2,
        created_at: Date.now(),
      });
    });

    await expect(
      t.mutation(api.workerJobs.submitWorkerBid, {
        jobId,
        workerId,
        amount: 6000, // Below 80% of 10000 (8000)
      })
    ).rejects.toThrow("Bid must be at least 8000 (80% of baseline 10000)");
  });

  test("should calculate service fees correctly", async () => {
    const t = convexTest(schema);
    const { categoryId, subcategoryId, customerId, workerId } = await createBidSubmissionTestSetup(t);

    const jobId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jobs", {
        customer_id: customerId,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        voice_url: "voice.mp3",
        photos: [],
        location_lat: 18.0735,
        location_lng: -15.9582,
        work_code: "123456",
        portfolio_consent: true,
        price_floor: 5000,
        status: "posted",
        categorizer_worker_ids: [],
        broadcasting_phase: 2,
        created_at: Date.now(),
      });
    });

    const baseAmount = 15000;
    const equipmentCost = 2000;

    const result = await t.mutation(api.workerJobs.submitWorkerBid, {
      jobId,
      workerId,
      amount: baseAmount,
      equipmentCost,
    });

    // Service fee calculation: 10% of base amount
    const expectedServiceFee = Math.floor((baseAmount * 10) / 100); // 1500
    const expectedTotal = baseAmount + equipmentCost + expectedServiceFee; // 18500

    expect(result.serviceFee).toBe(expectedServiceFee);
    expect(result.totalAmount).toBe(expectedTotal);
    expect(result.baseAmount).toBe(baseAmount);
    expect(result.equipmentCost).toBe(equipmentCost);
  });

  test("should handle job in wrong status", async () => {
    const t = convexTest(schema);
    const { categoryId, subcategoryId, customerId, workerId } = await createBidSubmissionTestSetup(t);

    const jobId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jobs", {
        customer_id: customerId,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        voice_url: "voice.mp3",
        photos: [],
        location_lat: 18.0735,
        location_lng: -15.9582,
        work_code: "123456",
        portfolio_consent: true,
        price_floor: 5000,
        status: "completed", // Wrong status
        categorizer_worker_ids: [],
        broadcasting_phase: 2,
        created_at: Date.now(),
      });
    });

    await expect(
      t.mutation(api.workerJobs.submitWorkerBid, {
        jobId,
        workerId,
        amount: 8000,
      })
    ).rejects.toThrow("Job is no longer accepting bids");
  });

  test("should handle bid without equipment cost", async () => {
    const t = convexTest(schema);
    const { categoryId, subcategoryId, customerId, workerId } = await createBidSubmissionTestSetup(t);

    const jobId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jobs", {
        customer_id: customerId,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        voice_url: "voice.mp3",
        photos: [],
        location_lat: 18.0735,
        location_lng: -15.9582,
        work_code: "123456",
        portfolio_consent: true,
        price_floor: 5000,
        status: "posted",
        categorizer_worker_ids: [],
        broadcasting_phase: 2,
        created_at: Date.now(),
      });
    });

    const baseAmount = 10000;

    const result = await t.mutation(api.workerJobs.submitWorkerBid, {
      jobId,
      workerId,
      amount: baseAmount,
      // equipmentCost not provided (should default to 0)
    });

    expect(result.success).toBe(true);
    expect(result.baseAmount).toBe(baseAmount);
    expect(result.equipmentCost).toBe(0);
    expect(result.serviceFee).toBe(1000); // 10% of 10000
    expect(result.totalAmount).toBe(11000); // 10000 + 0 + 1000
  });

  test("should set correct expiration and priority window times", async () => {
    const t = convexTest(schema);
    const { categoryId, subcategoryId, customerId, workerId } = await createBidSubmissionTestSetup(t);

    const jobId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jobs", {
        customer_id: customerId,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        voice_url: "voice.mp3",
        photos: [],
        location_lat: 18.0735,
        location_lng: -15.9582,
        work_code: "123456",
        portfolio_consent: true,
        price_floor: 5000,
        status: "posted",
        categorizer_worker_ids: [],
        broadcasting_phase: 2,
        created_at: Date.now(),
      });
    });

    const beforeSubmission = Date.now();

    const result = await t.mutation(api.workerJobs.submitWorkerBid, {
      jobId,
      workerId,
      amount: 8000,
    });

    const afterSubmission = Date.now();

    // Check expiration time (24 hours from now)
    const expectedExpiration = beforeSubmission + (24 * 60 * 60 * 1000);
    expect(result.expiresAt).toBeGreaterThanOrEqual(expectedExpiration);
    expect(result.expiresAt).toBeLessThanOrEqual(afterSubmission + (24 * 60 * 60 * 1000));

    // Check priority window (2 hours from now)
    const expectedPriorityEnd = beforeSubmission + (2 * 60 * 60 * 1000);
    expect(result.priorityWindowEnd).toBeGreaterThanOrEqual(expectedPriorityEnd);
    expect(result.priorityWindowEnd).toBeLessThanOrEqual(afterSubmission + (2 * 60 * 60 * 1000));

    // Priority window should be before expiration
    expect(result.priorityWindowEnd).toBeLessThan(result.expiresAt);
  });
});