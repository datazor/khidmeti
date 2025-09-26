// convex/workerJobs.submitCategorization.test.ts
import { convexTest } from "convex-test";
import { test, expect, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

async function createCategorizationTestSetup(t: any, groupSize = 6) {
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

  const subcategory1Id = await t.run(async (ctx: any) => {
    return await ctx.db.insert("categories", {
      parent_id: categoryId,
      name_en: "Bathroom Plumbing",
      name_fr: "Plomberie salle de bain",
      name_ar: "سباكة الحمام",
      photo_url: "photo.jpg",
      requires_photos: true,
      requires_work_code: true,
      level: 2,
    });
  });

  const subcategory2Id = await t.run(async (ctx: any) => {
    return await ctx.db.insert("categories", {
      parent_id: categoryId,
      name_en: "Kitchen Plumbing",
      name_fr: "Plomberie cuisine",
      name_ar: "سباكة المطبخ",
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
      name: "Customer",
      user_type: "customer",
      balance: 1000,
      cancellation_count: 0,
      priority_score: 100,
      approval_status: "approved",
      onboarding_status: "completed",
      created_at: Date.now(),
    });
  });

  // Create categorizer workers
  const categorizerIds: any[] = [];
  for (let i = 0; i < groupSize; i++) {
    const workerId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        phone: `+${Math.random().toString().slice(2, 12)}`,
        password_hash: "hash",
        name: `Categorizer ${i + 1}`,
        user_type: "worker",
        balance: 1000,
        cancellation_count: 0,
        priority_score: 100,
        approval_status: "approved",
        onboarding_status: "completed",
        created_at: Date.now(),
      });
    });
    categorizerIds.push(workerId);
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
      categorizer_worker_ids: categorizerIds,
      categorizer_group_size: groupSize,
      broadcasting_phase: 1,
      created_at: Date.now(),
    });
  });

  return { categoryId, subcategory1Id, subcategory2Id, customerId, jobId, categorizerIds };
}

describe("submitCategorization", () => {
  test("should record vote and wait when no majority yet", async () => {
    const t = convexTest(schema);
    const { jobId, subcategory1Id, categorizerIds } = await createCategorizationTestSetup(t, 6);

    // First worker votes
    const result = await t.mutation(api.workerJobs.submitCategorization, {
      jobId,
      workerId: categorizerIds[0],
      subcategoryId: subcategory1Id,
    });

    expect(result.success).toBe(true);
    expect(result.result).toBe("waiting");
    expect(result.currentVotes).toBe(1);
    expect(result.totalNeeded).toBe(6);
    expect(result.majorityThreshold).toBe(4); // >50% of 6

    // Verify vote was recorded
    const vote = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("job_categorizations")
        .withIndex("by_job", (q: any) => q.eq("job_id", jobId))
        .first();
    });

    expect(vote?.worker_id).toBe(categorizerIds[0]);
    expect(vote?.suggested_subcategory_id).toBe(subcategory1Id);
  });

  test("should reach majority and broadcast to winning subcategory", async () => {
    const t = convexTest(schema);
    const { jobId, subcategory1Id, subcategory2Id, categorizerIds } = await createCategorizationTestSetup(t, 6);

    // 4 workers vote for subcategory1 (majority = 4/6)
    for (let i = 0; i < 4; i++) {
      await t.mutation(api.workerJobs.submitCategorization, {
        jobId,
        workerId: categorizerIds[i],
        subcategoryId: subcategory1Id,
      });
    }

    // Check last vote triggers majority
    const votes = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("job_categorizations")
        .withIndex("by_job", (q: any) => q.eq("job_id", jobId))
        .collect();
    });

    expect(votes.length).toBe(4);

    // Verify job updated
    const job = await t.run(async (ctx: any) => ctx.db.get(jobId));
    expect(job?.subcategory_id).toBe(subcategory1Id);
    expect(job?.broadcasting_phase).toBe(2);
  });

  test("should detect tie and broadcast to multiple subcategories", async () => {
    const t = convexTest(schema);
    const { jobId, subcategory1Id, subcategory2Id, categorizerIds } = await createCategorizationTestSetup(t, 6);

    // 3 workers vote for subcategory1
    for (let i = 0; i < 3; i++) {
      await t.mutation(api.workerJobs.submitCategorization, {
        jobId,
        workerId: categorizerIds[i],
        subcategoryId: subcategory1Id,
      });
    }

    // 3 workers vote for subcategory2 (creates 3-3 tie, but not majority)
    for (let i = 3; i < 6; i++) {
      const result = await t.mutation(api.workerJobs.submitCategorization, {
        jobId,
        workerId: categorizerIds[i],
        subcategoryId: subcategory2Id,
      });

      if (i === 5) {
        // Last vote still shows waiting (no majority reached with 3-3 tie)
        expect(result.result).toBe("waiting");
        expect(result.voteDistribution).toEqual({
          [subcategory1Id]: 3,
          [subcategory2Id]: 3,
        });
      }
    }
  });

  test("should detect tie when majority is reached simultaneously", async () => {
    const t = convexTest(schema);
    const { jobId, subcategory1Id, subcategory2Id, categorizerIds } = await createCategorizationTestSetup(t, 4);

    // 2 workers vote for subcategory1
    await t.mutation(api.workerJobs.submitCategorization, {
      jobId,
      workerId: categorizerIds[0],
      subcategoryId: subcategory1Id,
    });
    await t.mutation(api.workerJobs.submitCategorization, {
      jobId,
      workerId: categorizerIds[1],
      subcategoryId: subcategory1Id,
    });

    // Next 2 workers vote for subcategory2 (creates 2-2 tie, no majority)
    await t.mutation(api.workerJobs.submitCategorization, {
      jobId,
      workerId: categorizerIds[2],
      subcategoryId: subcategory2Id,
    });

    const result = await t.mutation(api.workerJobs.submitCategorization, {
      jobId,
      workerId: categorizerIds[3],
      subcategoryId: subcategory2Id,
    });

    expect(result.result).toBe("waiting"); // 2-2 is not majority (need 3/4)
  });

  test("should throw error if worker not authorized", async () => {
    const t = convexTest(schema);
    const { jobId, subcategory1Id } = await createCategorizationTestSetup(t);

    const unauthorizedWorkerId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("users", {
        phone: `+${Math.random().toString().slice(2, 12)}`,
        password_hash: "hash",
        name: "Unauthorized Worker",
        user_type: "worker",
        balance: 1000,
        cancellation_count: 0,
        priority_score: 100,
        approval_status: "approved",
        onboarding_status: "completed",
        created_at: Date.now(),
      });
    });

    await expect(
      t.mutation(api.workerJobs.submitCategorization, {
        jobId,
        workerId: unauthorizedWorkerId,
        subcategoryId: subcategory1Id,
      })
    ).rejects.toThrow("Worker not authorized to categorize this job");
  });

  test("should throw error if worker already voted", async () => {
    const t = convexTest(schema);
    const { jobId, subcategory1Id, subcategory2Id, categorizerIds } = await createCategorizationTestSetup(t);

    // First vote
    await t.mutation(api.workerJobs.submitCategorization, {
      jobId,
      workerId: categorizerIds[0],
      subcategoryId: subcategory1Id,
    });

    // Try to vote again
    await expect(
      t.mutation(api.workerJobs.submitCategorization, {
        jobId,
        workerId: categorizerIds[0],
        subcategoryId: subcategory2Id,
      })
    ).rejects.toThrow("Worker already submitted categorization");
  });

  test("should throw error if subcategory not found", async () => {
    const t = convexTest(schema);
    const { jobId, categorizerIds } = await createCategorizationTestSetup(t);

    const fakeSubcategoryId = "invalid_id" as any;

    await expect(
      t.mutation(api.workerJobs.submitCategorization, {
        jobId,
        workerId: categorizerIds[0],
        subcategoryId: fakeSubcategoryId,
      })
    ).rejects.toThrow();
  });

  test("should throw error if subcategory belongs to wrong category", async () => {
    const t = convexTest(schema);
    const { jobId, categorizerIds } = await createCategorizationTestSetup(t);

    // Create subcategory for different category
    const otherCategoryId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("categories", {
        name_en: "Electrical",
        name_fr: "Électrique",
        name_ar: "كهربائي",
        photo_url: "photo.jpg",
        requires_photos: true,
        requires_work_code: true,
        level: 1,
      });
    });

    const wrongSubcategoryId = await t.run(async (ctx: any) => {
      return await ctx.db.insert("categories", {
        parent_id: otherCategoryId,
        name_en: "Wiring",
        name_fr: "Câblage",
        name_ar: "أسلاك",
        photo_url: "photo.jpg",
        requires_photos: true,
        requires_work_code: true,
        level: 2,
      });
    });

    await expect(
      t.mutation(api.workerJobs.submitCategorization, {
        jobId,
        workerId: categorizerIds[0],
        subcategoryId: wrongSubcategoryId,
      })
    ).rejects.toThrow("Subcategory does not belong to job category");
  });

  test("should throw error if job not found", async () => {
    const t = convexTest(schema);
    const { subcategory1Id, categorizerIds } = await createCategorizationTestSetup(t);

    const fakeJobId = "invalid_id" as any;

    await expect(
      t.mutation(api.workerJobs.submitCategorization, {
        jobId: fakeJobId,
        workerId: categorizerIds[0],
        subcategoryId: subcategory1Id,
      })
    ).rejects.toThrow();
  });

  test("should calculate correct majority threshold for different group sizes", async () => {
    const t = convexTest(schema);

    // Test with group size 5 (majority = 3)
    const { jobId: job5Id, subcategory1Id, categorizerIds: cat5 } = await createCategorizationTestSetup(t, 5);

    // 2 votes - no majority
    await t.mutation(api.workerJobs.submitCategorization, {
      jobId: job5Id,
      workerId: cat5[0],
      subcategoryId: subcategory1Id,
    });
    await t.mutation(api.workerJobs.submitCategorization, {
      jobId: job5Id,
      workerId: cat5[1],
      subcategoryId: subcategory1Id,
    });

    // 3rd vote - reaches majority
    const result = await t.mutation(api.workerJobs.submitCategorization, {
      jobId: job5Id,
      workerId: cat5[2],
      subcategoryId: subcategory1Id,
    });

    expect(result.result).toBe("majority");
    expect(result.subcategoryId).toBe(subcategory1Id);
  });

  test("should handle three-way split without majority", async () => {
    const t = convexTest(schema);
    const { jobId, subcategory1Id, subcategory2Id, categoryId, categorizerIds } = await createCategorizationTestSetup(t, 6);

    const subcategory3Id = await t.run(async (ctx: any) => {
      return await ctx.db.insert("categories", {
        parent_id: categoryId,
        name_en: "Outdoor Plumbing",
        name_fr: "Plomberie extérieure",
        name_ar: "سباكة خارجية",
        photo_url: "photo.jpg",
        requires_photos: true,
        requires_work_code: true,
        level: 2,
      });
    });

    // 2 votes each (no majority)
    await t.mutation(api.workerJobs.submitCategorization, {
      jobId,
      workerId: categorizerIds[0],
      subcategoryId: subcategory1Id,
    });
    await t.mutation(api.workerJobs.submitCategorization, {
      jobId,
      workerId: categorizerIds[1],
      subcategoryId: subcategory1Id,
    });

    await t.mutation(api.workerJobs.submitCategorization, {
      jobId,
      workerId: categorizerIds[2],
      subcategoryId: subcategory2Id,
    });
    await t.mutation(api.workerJobs.submitCategorization, {
      jobId,
      workerId: categorizerIds[3],
      subcategoryId: subcategory2Id,
    });

    await t.mutation(api.workerJobs.submitCategorization, {
      jobId,
      workerId: categorizerIds[4],
      subcategoryId: subcategory3Id,
    });

    const result = await t.mutation(api.workerJobs.submitCategorization, {
      jobId,
      workerId: categorizerIds[5],
      subcategoryId: subcategory3Id,
    });

    expect(result.result).toBe("waiting");
    expect(result.voteDistribution).toEqual({
      [subcategory1Id]: 2,
      [subcategory2Id]: 2,
      [subcategory3Id]: 2,
    });
  });

  test("should track vote distribution correctly", async () => {
    const t = convexTest(schema);
    const { jobId, subcategory1Id, subcategory2Id, categorizerIds } = await createCategorizationTestSetup(t, 6);

    await t.mutation(api.workerJobs.submitCategorization, {
      jobId,
      workerId: categorizerIds[0],
      subcategoryId: subcategory1Id,
    });

    await t.mutation(api.workerJobs.submitCategorization, {
      jobId,
      workerId: categorizerIds[1],
      subcategoryId: subcategory1Id,
    });

    const result = await t.mutation(api.workerJobs.submitCategorization, {
      jobId,
      workerId: categorizerIds[2],
      subcategoryId: subcategory2Id,
    });

    expect(result.voteDistribution).toEqual({
      [subcategory1Id]: 2,
      [subcategory2Id]: 1,
    });
  });

  test("should handle job already categorized (subcategory already assigned)", async () => {
    const t = convexTest(schema);
    const { jobId, subcategory1Id, categorizerIds } = await createCategorizationTestSetup(t, 6);

    // Pre-assign a subcategory to the job
    await t.run(async (ctx: any) => {
      await ctx.db.patch(jobId, {
        subcategory_id: subcategory1Id,
        broadcasting_phase: 2,
      });
    });

    // Try to submit categorization when job is already categorized
    await expect(
      t.mutation(api.workerJobs.submitCategorization, {
        jobId,
        workerId: categorizerIds[0],
        subcategoryId: subcategory1Id,
      })
    ).rejects.toThrow("Job already categorized");
  });

  test("should handle worker with insufficient balance", async () => {
    const t = convexTest(schema);
    const { jobId, subcategory1Id, categorizerIds } = await createCategorizationTestSetup(t, 6);

    // Update worker to have zero balance
    await t.run(async (ctx: any) => {
      await ctx.db.patch(categorizerIds[0], {
        balance: 0,
      });
    });

    // Worker should still be able to categorize (balance check is in getWorkerEligibleJobs, not submitCategorization)
    const result = await t.mutation(api.workerJobs.submitCategorization, {
      jobId,
      workerId: categorizerIds[0],
      subcategoryId: subcategory1Id,
    });

    expect(result.success).toBe(true);
    expect(result.result).toBe("waiting");
  });

  test("should handle job in wrong broadcasting phase", async () => {
    const t = convexTest(schema);
    const { jobId, subcategory1Id, categorizerIds } = await createCategorizationTestSetup(t, 6);

    // Move job to bidding phase (phase 2)
    await t.run(async (ctx: any) => {
      await ctx.db.patch(jobId, {
        broadcasting_phase: 2,
      });
    });

    // Try to submit categorization when job is in wrong phase
    await expect(
      t.mutation(api.workerJobs.submitCategorization, {
        jobId,
        workerId: categorizerIds[0],
        subcategoryId: subcategory1Id,
      })
    ).rejects.toThrow("Job not in categorization phase");
  });

  test("should handle job with no categorizers assigned", async () => {
    const t = convexTest(schema);
    const { jobId, subcategory1Id, categorizerIds } = await createCategorizationTestSetup(t, 6);

    // Remove all categorizers from job
    await t.run(async (ctx: any) => {
      await ctx.db.patch(jobId, {
        categorizer_worker_ids: [],
      });
    });

    // Try to submit categorization when no categorizers are assigned
    await expect(
      t.mutation(api.workerJobs.submitCategorization, {
        jobId,
        workerId: categorizerIds[0],
        subcategoryId: subcategory1Id,
      })
    ).rejects.toThrow("Worker not authorized to categorize this job");
  });

  test("should handle edge case with single categorizer group", async () => {
    const t = convexTest(schema);
    const { jobId, subcategory1Id, categorizerIds } = await createCategorizationTestSetup(t, 1);

    // Single categorizer should immediately reach majority
    const result = await t.mutation(api.workerJobs.submitCategorization, {
      jobId,
      workerId: categorizerIds[0],
      subcategoryId: subcategory1Id,
    });

    expect(result.success).toBe(true);
    expect(result.result).toBe("majority");
    expect(result.subcategoryId).toBe(subcategory1Id);

    // Verify job was updated
    const job = await t.run(async (ctx: any) => ctx.db.get(jobId));
    expect(job?.subcategory_id).toBe(subcategory1Id);
    expect(job?.broadcasting_phase).toBe(2);
  });

  test("should handle very large group size (performance test)", async () => {
    const t = convexTest(schema);
    const { categoryId, subcategory1Id, customerId } = await createCategorizationTestSetup(t);

    // Create 50 workers
    const categorizerIds: any[] = [];
    for (let i = 0; i < 50; i++) {
      const workerId = await t.run(async (ctx: any) => {
        return await ctx.db.insert("users", {
          phone: `+${Math.random().toString().slice(2, 12)}`,
          password_hash: "hash",
          name: `Categorizer ${i + 1}`,
          user_type: "worker",
          balance: 1000,
          cancellation_count: 0,
          priority_score: 100,
          approval_status: "approved",
          onboarding_status: "completed",
          created_at: Date.now(),
        });
      });
      categorizerIds.push(workerId);
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
        categorizer_worker_ids: categorizerIds,
        categorizer_group_size: 50,
        broadcasting_phase: 1,
        created_at: Date.now(),
      });
    });

    // Submit 26 votes (majority threshold for 50 is 26)
    for (let i = 0; i < 26; i++) {
      const result = await t.mutation(api.workerJobs.submitCategorization, {
        jobId,
        workerId: categorizerIds[i],
        subcategoryId: subcategory1Id,
      });

      if (i === 25) {
        // 26th vote should reach majority
        expect(result.result).toBe("majority");
      } else {
        expect(result.result).toBe("waiting");
      }
    }
  });

  test("should handle concurrent vote submissions", async () => {
    const t = convexTest(schema);
    const { jobId, subcategory1Id, subcategory2Id, categorizerIds } = await createCategorizationTestSetup(t, 6);

    // Submit multiple votes concurrently (simulated by rapid sequential calls)
    const promises = [
      t.mutation(api.workerJobs.submitCategorization, {
        jobId,
        workerId: categorizerIds[0],
        subcategoryId: subcategory1Id,
      }),
      t.mutation(api.workerJobs.submitCategorization, {
        jobId,
        workerId: categorizerIds[1],
        subcategoryId: subcategory1Id,
      }),
      t.mutation(api.workerJobs.submitCategorization, {
        jobId,
        workerId: categorizerIds[2],
        subcategoryId: subcategory2Id,
      }),
    ];

    const results = await Promise.all(promises);

    // All votes should be recorded successfully
    results.forEach(result => {
      expect(result.success).toBe(true);
    });

    // Check final vote distribution
    const votes = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("job_categorizations")
        .withIndex("by_job", (q: any) => q.eq("job_id", jobId))
        .collect();
    });

    expect(votes.length).toBe(3);
  });

  test("should handle invalid worker ID format", async () => {
    const t = convexTest(schema);
    const { jobId, subcategory1Id } = await createCategorizationTestSetup(t);

    const invalidWorkerId = "invalid_worker_id" as any;

    await expect(
      t.mutation(api.workerJobs.submitCategorization, {
        jobId,
        workerId: invalidWorkerId,
        subcategoryId: subcategory1Id,
      })
    ).rejects.toThrow();
  });

  test("should handle invalid job ID format", async () => {
    const t = convexTest(schema);
    const { subcategory1Id, categorizerIds } = await createCategorizationTestSetup(t);

    const invalidJobId = "invalid_job_id" as any;

    await expect(
      t.mutation(api.workerJobs.submitCategorization, {
        jobId: invalidJobId,
        workerId: categorizerIds[0],
        subcategoryId: subcategory1Id,
      })
    ).rejects.toThrow();
  });

  test("should handle invalid subcategory ID format", async () => {
    const t = convexTest(schema);
    const { jobId, categorizerIds } = await createCategorizationTestSetup(t);

    const invalidSubcategoryId = "invalid_subcategory_id" as any;

    await expect(
      t.mutation(api.workerJobs.submitCategorization, {
        jobId,
        workerId: categorizerIds[0],
        subcategoryId: invalidSubcategoryId,
      })
    ).rejects.toThrow();
  });

  test("should handle worker who is not approved", async () => {
    const t = convexTest(schema);
    const { jobId, subcategory1Id, categorizerIds } = await createCategorizationTestSetup(t, 6);

    // Update worker to have pending approval status
    await t.run(async (ctx: any) => {
      await ctx.db.patch(categorizerIds[0], {
        approval_status: "pending",
      });
    });

    // Worker should still be able to categorize (approval check is in getWorkerEligibleJobs)
    const result = await t.mutation(api.workerJobs.submitCategorization, {
      jobId,
      workerId: categorizerIds[0],
      subcategoryId: subcategory1Id,
    });

    expect(result.success).toBe(true);
  });

  test("should handle worker who is not a worker type", async () => {
    const t = convexTest(schema);
    const { jobId, subcategory1Id, categorizerIds } = await createCategorizationTestSetup(t, 6);

    // Update worker to be a customer instead of worker
    await t.run(async (ctx: any) => {
      await ctx.db.patch(categorizerIds[0], {
        user_type: "customer",
      });
    });

    // Customer should not be able to categorize
    await expect(
      t.mutation(api.workerJobs.submitCategorization, {
        jobId,
        workerId: categorizerIds[0],
        subcategoryId: subcategory1Id,
      })
    ).rejects.toThrow("Worker not authorized to categorize this job");
  });

  test("should handle job with missing categorizer_group_size field", async () => {
    const t = convexTest(schema);
    const { jobId, subcategory1Id, categorizerIds, categoryId, customerId } = await createCategorizationTestSetup(t, 6);

    // Recreate job without categorizer_group_size
    await t.run(async (ctx: any) => {
      await ctx.db.delete(jobId);
    });

    const newJobId = await t.run(async (ctx: any) => {
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
        categorizer_worker_ids: categorizerIds,
        // categorizer_group_size: undefined (missing)
        broadcasting_phase: 1,
        created_at: Date.now(),
      });
    });

    // Should use categorizer_worker_ids length as fallback
    const result = await t.mutation(api.workerJobs.submitCategorization, {
      jobId: newJobId,
      workerId: categorizerIds[0],
      subcategoryId: subcategory1Id,
    });

    expect(result.success).toBe(true);
    expect(result.totalNeeded).toBe(6); // Should use categorizer_worker_ids length
  });

  test("should handle vote distribution with many subcategories", async () => {
    const t = convexTest(schema);
    const { jobId, categoryId, customerId, categorizerIds } = await createCategorizationTestSetup(t, 10);

    // Create additional subcategories
    const subcategoryIds: any[] = [];
    for (let i = 0; i < 5; i++) {
      const subcategoryId = await t.run(async (ctx: any) => {
        return await ctx.db.insert("categories", {
          parent_id: categoryId,
          name_en: `Specialty Plumbing ${i + 1}`,
          name_fr: `Plomberie spécialisée ${i + 1}`,
          name_ar: `سباكة متخصصة ${i + 1}`,
          photo_url: "photo.jpg",
          requires_photos: true,
          requires_work_code: true,
          level: 2,
        });
      });
      subcategoryIds.push(subcategoryId);
    }

    // Distribute votes across 5 subcategories
    for (let i = 0; i < 10; i++) {
      const subcategoryIndex = i % 5;
      await t.mutation(api.workerJobs.submitCategorization, {
        jobId,
        workerId: categorizerIds[i],
        subcategoryId: subcategoryIds[subcategoryIndex],
      });
    }

    // Check final vote distribution
    const votes = await t.run(async (ctx: any) => {
      return await ctx.db
        .query("job_categorizations")
        .withIndex("by_job", (q: any) => q.eq("job_id", jobId))
        .collect();
    });

    expect(votes.length).toBe(10);

    // Each subcategory should have 2 votes (10 votes / 5 subcategories)
    const voteCounts = new Map<string, number>();
    votes.forEach((vote: { suggested_subcategory_id: string; }) => {
      const count = voteCounts.get(vote.suggested_subcategory_id) || 0;
      voteCounts.set(vote.suggested_subcategory_id, count + 1);
    });

    expect(voteCounts.size).toBe(5);
    Array.from(voteCounts.values()).forEach(count => {
      expect(count).toBe(2);
    });
  });

  test("should handle job cancellation during categorization", async () => {
    const t = convexTest(schema);
    const { jobId, subcategory1Id, categorizerIds } = await createCategorizationTestSetup(t, 6);

    // Cancel the job
    await t.run(async (ctx: any) => {
      await ctx.db.patch(jobId, {
        status: "cancelled",
      });
    });

    // Try to submit categorization for cancelled job
    await expect(
      t.mutation(api.workerJobs.submitCategorization, {
        jobId,
        workerId: categorizerIds[0],
        subcategoryId: subcategory1Id,
      })
    ).rejects.toThrow("Job has been cancelled");
  });

 });
