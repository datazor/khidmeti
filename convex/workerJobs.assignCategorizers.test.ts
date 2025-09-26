// convex/workerJobs.assignCategorizers.test.ts
import { convexTest } from "convex-test";
import { test, expect, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

async function createCategorizerTestSetup(t: any) {
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
      cancellation_count: 0,
      priority_score: 100,
      approval_status: "approved",
      onboarding_status: "completed",
      created_at: Date.now(),
    });
  });

  return { categoryId, customerId };
}

async function createWorker(t: any, categoryId: string, isExpert = false) {
  const workerId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      phone: `+${Math.random().toString().slice(2, 12)}`,
      password_hash: "hash",
      name: `Worker ${Math.random().toString(36).slice(2, 7)}`,
      user_type: "worker",
      balance: 1000,
      cancellation_count: 0,
      priority_score: 100,
      approval_status: "approved",
      onboarding_status: "completed",
      created_at: Date.now(),
    });
  });

  // Add skill
  await t.run(async (ctx: any) => {
    await ctx.db.insert("user_skills", {
      user_id: workerId,
      category_id: categoryId,
    });
  });

  // Add as expert if specified
  if (isExpert) {
    await t.run(async (ctx: any) => {
      await ctx.db.insert("expert_categorizers", {
        category_id: categoryId,
        worker_id: workerId,
        designated_by: workerId, // Self-designated for test
        created_at: Date.now(),
      });
    });
  }

  return workerId;
}

describe("assignCategorizerWorkers", () => {
  test("should use global setting when configured", async () => {
    const t = convexTest(schema);
    const { categoryId, customerId } = await createCategorizerTestSetup(t);

    // Set global categorizer group size
    await t.run(async (ctx: any) => {
      await ctx.db.insert("system_settings", {
        setting_key: "categorizer_group_size",
        setting_value: "4",
        created_at: Date.now(),
        updated_at: Date.now(),
      });
    });

    // Create 10 workers
    for (let i = 0; i < 10; i++) {
      await createWorker(t, categoryId, false);
    }

    const jobId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jobs", {
        customer_id: customerId,
        category_id: categoryId,
        voice_url: "voice.mp3",
        photos: [],
        location_lat: 18.0735,
        location_lng: -15.9582,
        portfolio_consent: true,
        price_floor: 5000,
        status: "posted",
        categorizer_worker_ids: [],
        broadcasting_phase: 0,
        created_at: Date.now(),
      });
    });

    const result = await t.mutation(api.workerJobs.assignCategorizerWorkers, {
      jobId,
    });

    expect(result.success).toBe(true);
    expect(result.targetGroupSize).toBe(4);
    expect(result.selectedCount).toBe(4);

    const job = await t.run(async (ctx: any) => ctx.db.get(jobId));
    expect(job?.categorizer_worker_ids.length).toBe(4);
    expect(job?.categorizer_group_size).toBe(4);
    expect(job?.broadcasting_phase).toBe(1);
  });

  test("should default to 6 when no setting configured", async () => {
    const t = convexTest(schema);
    const { categoryId, customerId } = await createCategorizerTestSetup(t);

    // Create 10 workers
    for (let i = 0; i < 10; i++) {
      await createWorker(t, categoryId, false);
    }

    const jobId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jobs", {
        customer_id: customerId,
        category_id: categoryId,
        voice_url: "voice.mp3",
        photos: [],
        location_lat: 18.0735,
        location_lng: -15.9582,
        portfolio_consent: true,
        price_floor: 5000,
        status: "posted",
        categorizer_worker_ids: [],
        broadcasting_phase: 0,
        created_at: Date.now(),
      });
    });

    const result = await t.mutation(api.workerJobs.assignCategorizerWorkers, {
      jobId,
    });

    expect(result.targetGroupSize).toBe(6);
    expect(result.selectedCount).toBe(6);
  });

  test("should prioritize all experts first", async () => {
    const t = convexTest(schema);
    const { categoryId, customerId } = await createCategorizerTestSetup(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("system_settings", {
        setting_key: "categorizer_group_size",
        setting_value: "6",
        created_at: Date.now(),
        updated_at: Date.now(),
      });
    });

    // Create 4 experts
    for (let i = 0; i < 4; i++) {
      await createWorker(t, categoryId, true);
    }

    // Create 5 regular workers
    for (let i = 0; i < 5; i++) {
      await createWorker(t, categoryId, false);
    }

    const jobId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jobs", {
        customer_id: customerId,
        category_id: categoryId,
        voice_url: "voice.mp3",
        photos: [],
        location_lat: 18.0735,
        location_lng: -15.9582,
        portfolio_consent: true,
        price_floor: 5000,
        status: "posted",
        categorizer_worker_ids: [],
        broadcasting_phase: 0,
        created_at: Date.now(),
      });
    });

    const result = await t.mutation(api.workerJobs.assignCategorizerWorkers, {
      jobId,
    });

    expect(result.expertCount).toBe(4);
    expect(result.randomCount).toBe(2); // 6 - 4 = 2
    expect(result.selectedCount).toBe(6);
  });

  test("should fill all slots with experts if enough available", async () => {
    const t = convexTest(schema);
    const { categoryId, customerId } = await createCategorizerTestSetup(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("system_settings", {
        setting_key: "categorizer_group_size",
        setting_value: "6",
        created_at: Date.now(),
        updated_at: Date.now(),
      });
    });

    // Create 10 experts (more than needed)
    for (let i = 0; i < 10; i++) {
      await createWorker(t, categoryId, true);
    }

    const jobId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jobs", {
        customer_id: customerId,
        category_id: categoryId,
        voice_url: "voice.mp3",
        photos: [],
        location_lat: 18.0735,
        location_lng: -15.9582,
        portfolio_consent: true,
        price_floor: 5000,
        status: "posted",
        categorizer_worker_ids: [],
        broadcasting_phase: 0,
        created_at: Date.now(),
      });
    });

    const result = await t.mutation(api.workerJobs.assignCategorizerWorkers, {
      jobId,
    });

    expect(result.expertCount).toBe(6);
    expect(result.randomCount).toBe(0);
    expect(result.selectedCount).toBe(6);
  });

  test("should use only random workers if no experts available", async () => {
    const t = convexTest(schema);
    const { categoryId, customerId } = await createCategorizerTestSetup(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("system_settings", {
        setting_key: "categorizer_group_size",
        setting_value: "4",
        created_at: Date.now(),
        updated_at: Date.now(),
      });
    });

    // Create only regular workers (no experts)
    for (let i = 0; i < 10; i++) {
      await createWorker(t, categoryId, false);
    }

    const jobId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jobs", {
        customer_id: customerId,
        category_id: categoryId,
        voice_url: "voice.mp3",
        photos: [],
        location_lat: 18.0735,
        location_lng: -15.9582,
        portfolio_consent: true,
        price_floor: 5000,
        status: "posted",
        categorizer_worker_ids: [],
        broadcasting_phase: 0,
        created_at: Date.now(),
      });
    });

    const result = await t.mutation(api.workerJobs.assignCategorizerWorkers, {
      jobId,
    });

    expect(result.expertCount).toBe(0);
    expect(result.randomCount).toBe(4);
    expect(result.selectedCount).toBe(4);
  });

  test("should handle fewer available workers than target size", async () => {
    const t = convexTest(schema);
    const { categoryId, customerId } = await createCategorizerTestSetup(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("system_settings", {
        setting_key: "categorizer_group_size",
        setting_value: "10",
        created_at: Date.now(),
        updated_at: Date.now(),
      });
    });

    // Create only 3 workers (less than target of 10)
    for (let i = 0; i < 3; i++) {
      await createWorker(t, categoryId, false);
    }

    const jobId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jobs", {
        customer_id: customerId,
        category_id: categoryId,
        voice_url: "voice.mp3",
        photos: [],
        location_lat: 18.0735,
        location_lng: -15.9582,
        portfolio_consent: true,
        price_floor: 5000,
        status: "posted",
        categorizer_worker_ids: [],
        broadcasting_phase: 0,
        created_at: Date.now(),
      });
    });

    const result = await t.mutation(api.workerJobs.assignCategorizerWorkers, {
      jobId,
    });

    expect(result.targetGroupSize).toBe(10);
    expect(result.selectedCount).toBe(3); // Only 3 available
  });

  test("should throw error if no eligible workers exist", async () => {
    const t = convexTest(schema);
    const { categoryId, customerId } = await createCategorizerTestSetup(t);

    const jobId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jobs", {
        customer_id: customerId,
        category_id: categoryId,
        voice_url: "voice.mp3",
        photos: [],
        location_lat: 18.0735,
        location_lng: -15.9582,
        portfolio_consent: true,
        price_floor: 5000,
        status: "posted",
        categorizer_worker_ids: [],
        broadcasting_phase: 0,
        created_at: Date.now(),
      });
    });

    await expect(
      t.mutation(api.workerJobs.assignCategorizerWorkers, { jobId })
    ).rejects.toThrow("No eligible workers found for this category");
  });

  test("should exclude workers with zero balance", async () => {
    const t = convexTest(schema);
    const { categoryId, customerId } = await createCategorizerTestSetup(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("system_settings", {
        setting_key: "categorizer_group_size",
        setting_value: "3",
        created_at: Date.now(),
        updated_at: Date.now(),
      });
    });

    // Create 2 workers with balance
    await createWorker(t, categoryId, false);
    await createWorker(t, categoryId, false);

    // Create worker with zero balance
    const poorWorkerId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        phone: `+${Math.random().toString().slice(2, 12)}`,
        password_hash: "hash",
        name: "Poor Worker",
        user_type: "worker",
        balance: 0,
        cancellation_count: 0,
        priority_score: 100,
        approval_status: "approved",
        onboarding_status: "completed",
        created_at: Date.now(),
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("user_skills", {
        user_id: poorWorkerId,
        category_id: categoryId,
      });
    });

    const jobId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jobs", {
        customer_id: customerId,
        category_id: categoryId,
        voice_url: "voice.mp3",
        photos: [],
        location_lat: 18.0735,
        location_lng: -15.9582,
        portfolio_consent: true,
        price_floor: 5000,
        status: "posted",
        categorizer_worker_ids: [],
        broadcasting_phase: 0,
        created_at: Date.now(),
      });
    });

    const result = await t.mutation(api.workerJobs.assignCategorizerWorkers, {
      jobId,
    });

    expect(result.selectedCount).toBe(2); // Only 2 eligible
    
    const job = await t.run(async (ctx: any) => ctx.db.get(jobId));
    expect(job?.categorizer_worker_ids).not.toContain(poorWorkerId);
  });

  test("should exclude unapproved workers", async () => {
    const t = convexTest(schema);
    const { categoryId, customerId } = await createCategorizerTestSetup(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("system_settings", {
        setting_key: "categorizer_group_size",
        setting_value: "3",
        created_at: Date.now(),
        updated_at: Date.now(),
      });
    });

    // Create approved worker
    await createWorker(t, categoryId, false);

    // Create pending worker
    const pendingWorkerId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        phone: `+${Math.random().toString().slice(2, 12)}`,
        password_hash: "hash",
        name: "Pending Worker",
        user_type: "worker",
        balance: 1000,
        cancellation_count: 0,
        priority_score: 100,
        approval_status: "pending",
        onboarding_status: "completed",
        created_at: Date.now(),
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("user_skills", {
        user_id: pendingWorkerId,
        category_id: categoryId,
      });
    });

    const jobId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jobs", {
        customer_id: customerId,
        category_id: categoryId,
        voice_url: "voice.mp3",
        photos: [],
        location_lat: 18.0735,
        location_lng: -15.9582,
        portfolio_consent: true,
        price_floor: 5000,
        status: "posted",
        categorizer_worker_ids: [],
        broadcasting_phase: 0,
        created_at: Date.now(),
      });
    });

    const result = await t.mutation(api.workerJobs.assignCategorizerWorkers, {
      jobId,
    });

    expect(result.selectedCount).toBe(1);
    
    const job = await t.run(async (ctx: any) => ctx.db.get(jobId));
    expect(job?.categorizer_worker_ids).not.toContain(pendingWorkerId);
  });

  test("should throw error if categorizers already assigned", async () => {
    const t = convexTest(schema);
    const { categoryId, customerId } = await createCategorizerTestSetup(t);

    const workerId = await createWorker(t, categoryId, false);

    const jobId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jobs", {
        customer_id: customerId,
        category_id: categoryId,
        voice_url: "voice.mp3",
        photos: [],
        location_lat: 18.0735,
        location_lng: -15.9582,
        portfolio_consent: true,
        price_floor: 5000,
        status: "posted",
        categorizer_worker_ids: [workerId],
        broadcasting_phase: 1,
        created_at: Date.now(),
      });
    });

    await expect(
      t.mutation(api.workerJobs.assignCategorizerWorkers, { jobId })
    ).rejects.toThrow("Categorizers already assigned to this job");
  });

  test("should throw error if job not found", async () => {
    const t = convexTest(schema);
    const fakeJobId = "invalid_id" as any;

    await expect(
      t.mutation(api.workerJobs.assignCategorizerWorkers, { jobId: fakeJobId })
    ).rejects.toThrow();
  });

  test("should exclude non-worker users", async () => {
    const t = convexTest(schema);
    const { categoryId, customerId } = await createCategorizerTestSetup(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("system_settings", {
        setting_key: "categorizer_group_size",
        setting_value: "3",
        created_at: Date.now(),
        updated_at: Date.now(),
      });
    });

    // Create worker
    await createWorker(t, categoryId, false);

    // Create customer with skill (shouldn't be selected)
    await t.run(async (ctx: any) => {
      await ctx.db.insert("user_skills", {
        user_id: customerId,
        category_id: categoryId,
      });
    });

    const jobId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jobs", {
        customer_id: customerId,
        category_id: categoryId,
        voice_url: "voice.mp3",
        photos: [],
        location_lat: 18.0735,
        location_lng: -15.9582,
        portfolio_consent: true,
        price_floor: 5000,
        status: "posted",
        categorizer_worker_ids: [],
        broadcasting_phase: 0,
        created_at: Date.now(),
      });
    });

    const result = await t.mutation(api.workerJobs.assignCategorizerWorkers, {
      jobId,
    });

    expect(result.selectedCount).toBe(1);
    
    const job = await t.run(async (ctx: any) => ctx.db.get(jobId));
    expect(job?.categorizer_worker_ids).not.toContain(customerId);
  });

  test("should only select eligible experts", async () => {
    const t = convexTest(schema);
    const { categoryId, customerId } = await createCategorizerTestSetup(t);

    await t.run(async (ctx: any) => {
      await ctx.db.insert("system_settings", {
        setting_key: "categorizer_group_size",
        setting_value: "4",
        created_at: Date.now(),
        updated_at: Date.now(),
      });
    });

    // Create 2 eligible experts
    await createWorker(t, categoryId, true);
    await createWorker(t, categoryId, true);

    // Create ineligible expert (zero balance)
    const poorExpertId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        phone: `+${Math.random().toString().slice(2, 12)}`,
        password_hash: "hash",
        name: "Poor Expert",
        user_type: "worker",
        balance: 0,
        cancellation_count: 0,
        priority_score: 100,
        approval_status: "approved",
        onboarding_status: "completed",
        created_at: Date.now(),
      });
    });

    await t.run(async (ctx: any) => {
      await ctx.db.insert("user_skills", {
        user_id: poorExpertId,
        category_id: categoryId,
      });
      await ctx.db.insert("expert_categorizers", {
        category_id: categoryId,
        worker_id: poorExpertId,
        designated_by: poorExpertId,
        created_at: Date.now(),
      });
    });

    // Create regular workers
    await createWorker(t, categoryId, false);
    await createWorker(t, categoryId, false);

    const jobId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("jobs", {
        customer_id: customerId,
        category_id: categoryId,
        voice_url: "voice.mp3",
        photos: [],
        location_lat: 18.0735,
        location_lng: -15.9582,
        portfolio_consent: true,
        price_floor: 5000,
        status: "posted",
        categorizer_worker_ids: [],
        broadcasting_phase: 0,
        created_at: Date.now(),
      });
    });

    const result = await t.mutation(api.workerJobs.assignCategorizerWorkers, {
      jobId,
    });

    expect(result.expertCount).toBe(2); // Only 2 eligible experts
    expect(result.randomCount).toBe(2); // Fill remaining with random
    
    const job = await t.run(async (ctx: any) => ctx.db.get(jobId));
    expect(job?.categorizer_worker_ids).not.toContain(poorExpertId);
  });
});