// convex/workerJobs.getWorkerEligibleJobs.test.ts - Tests for worker job eligibility
import { convexTest } from "convex-test";
import { test, expect, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

// Helper function to create test data
async function createTestSetup(t: any) {
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

  return { categoryId, customerId };
}

describe("getWorkerEligibleJobs", () => {
  test("should return empty array when worker has zero balance", async () => {
    const t = convexTest(schema);
    const { categoryId, customerId } = await createTestSetup(t);

    const workerId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        phone: `+${Math.random().toString().slice(2, 12)}`,
        password_hash: "hash",
        name: "Zero Balance Worker",
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

    const result = await t.query(api.workerJobs.getWorkerEligibleJobs, {
      workerId,
    });

    expect(result).toEqual([]);
  });

  test("should throw error when user is not a worker", async () => {
    const t = convexTest(schema);
    const { customerId } = await createTestSetup(t);

    await expect(
      t.query(api.workerJobs.getWorkerEligibleJobs, { workerId: customerId })
    ).rejects.toThrow("User is not a worker");
  });

  test("should return jobs when worker is in categorizer_worker_ids and has balance", async () => {
    const t = convexTest(schema);
    const { categoryId, customerId } = await createTestSetup(t);

    const workerId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        phone: `+${Math.random().toString().slice(2, 12)}`,
        password_hash: "hash",
        name: "Test Worker",
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

    const jobId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jobs", {
        customer_id: customerId,
        category_id: categoryId,
        voice_url: "voice.mp3",
        photos: ["photo1.jpg", "photo2.jpg"],
        location_lat: 18.0735,
        location_lng: -15.9582,
        work_code: "123456",
        portfolio_consent: true,
        price_floor: 5000,
        status: "posted",
        categorizer_worker_ids: [workerId], // Worker is assigned
        broadcasting_phase: 1,
        created_at: Date.now(),
      });
    });

    const result = await t.query(api.workerJobs.getWorkerEligibleJobs, {
      workerId,
    });

    expect(result).toHaveLength(1);
    expect(result[0].jobId).toBe(jobId);
    expect(result[0].categoryId).toBe(categoryId);
    expect(result[0].categoryName).toBe("Plumbing");
    expect(result[0].voiceUrl).toBe("voice.mp3");
    expect(result[0].photos).toEqual(["photo1.jpg", "photo2.jpg"]);
    expect(result[0].priceFloor).toBe(5000);
    expect(result[0].broadcastingPhase).toBe(1);
  });

  test("should filter out jobs where worker is not in categorizer_worker_ids", async () => {
    const t = convexTest(schema);
    const { categoryId, customerId } = await createTestSetup(t);

    const workerId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        phone: `+${Math.random().toString().slice(2, 12)}`,
        password_hash: "hash",
        name: "Test Worker",
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

    const otherWorkerId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        phone: `+${Math.random().toString().slice(2, 12)}`,
        password_hash: "hash",
        name: "Other Worker",
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

    // Create job with OTHER worker in categorizer_worker_ids
    await t.run(async (ctx: any) => {
      return await ctx.db.insert("jobs", {
        customer_id: customerId,
        category_id: categoryId,
        voice_url: "voice.mp3",
        photos: [],
        location_lat: 18.0735,
        location_lng: -15.9582,
        work_code: "123456",
        portfolio_consent: true,
        price_floor: 5000,
        status: "posted",
        categorizer_worker_ids: [otherWorkerId], // Different worker assigned
        broadcasting_phase: 1,
        created_at: Date.now(),
      });
    });

    const result = await t.query(api.workerJobs.getWorkerEligibleJobs, {
      workerId,
    });

    expect(result).toEqual([]);
  });

  test("should only return jobs in posted status with broadcasting_phase > 0", async () => {
    const t = convexTest(schema);
    const { categoryId, customerId } = await createTestSetup(t);

    const workerId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        phone: `+${Math.random().toString().slice(2, 12)}`,
        password_hash: "hash",
        name: "Test Worker",
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

    // Create job with broadcasting_phase = 0 (should be filtered out)
    await t.run(async (ctx: any) => {
      return await ctx.db.insert("jobs", {
        customer_id: customerId,
        category_id: categoryId,
        voice_url: "voice1.mp3",
        photos: [],
        location_lat: 18.0735,
        location_lng: -15.9582,
        work_code: "123456",
        portfolio_consent: true,
        price_floor: 5000,
        status: "posted",
        categorizer_worker_ids: [workerId],
        broadcasting_phase: 0, // Should be filtered out
        created_at: Date.now(),
      });
    });

    // Create job with completed status (should be filtered out)
    await t.run(async (ctx: any) => {
      return await ctx.db.insert("jobs", {
        customer_id: customerId,
        category_id: categoryId,
        voice_url: "voice2.mp3",
        photos: [],
        location_lat: 18.0735,
        location_lng: -15.9582,
        work_code: "123457",
        portfolio_consent: true,
        price_floor: 5000,
        status: "completed", // Should be filtered out
        categorizer_worker_ids: [workerId],
        broadcasting_phase: 1,
        created_at: Date.now(),
      });
    });

    // Create valid job (should be included)
    await t.run(async (ctx: any) => {
      return await ctx.db.insert("jobs", {
        customer_id: customerId,
        category_id: categoryId,
        voice_url: "voice3.mp3",
        photos: [],
        location_lat: 18.0735,
        location_lng: -15.9582,
        work_code: "123458",
        portfolio_consent: true,
        price_floor: 5000,
        status: "posted", // Valid status
        categorizer_worker_ids: [workerId],
        broadcasting_phase: 1, // Valid phase
        created_at: Date.now(),
      });
    });

    const result = await t.query(api.workerJobs.getWorkerEligibleJobs, {
      workerId,
    });

    // Should only return the one valid job
    expect(result).toHaveLength(1);
    expect(result[0].voiceUrl).toBe("voice3.mp3");
  });
});