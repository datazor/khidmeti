// convex/workerJobs.bidValidation.test.ts - Tests for bid validation functions
import { convexTest } from "convex-test";
import { test, expect, describe } from "vitest";
import schema from "./schema";
import { api } from "./_generated/api";

// Helper function to create test data for bid validation
async function createBidValidationTestSetup(t: any) {
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

  const adminId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      phone: `+${Math.random().toString().slice(2, 12)}`,
      password_hash: "hash",
      name: "Admin User",
      user_type: "customer", // Temporary - you'd have admin role
      balance: 1000,
      rating: 4.5,
      cancellation_count: 0,
      priority_score: 100,
      approval_status: "approved",
      onboarding_status: "completed",
      created_at: Date.now(),
    });
  });

  return { categoryId, subcategoryId, adminId };
}

describe("validateBidAmount", () => {
  test("should return valid for amount above minimum threshold", async () => {
    const t = convexTest(schema);
    const { subcategoryId, adminId } = await createBidValidationTestSetup(t);

    // Set pricing baseline
    await t.run(async (ctx: any) => {
      return await ctx.db.insert("category_pricing", {
        subcategory_id: subcategoryId,
        baseline_price: 10000, // 10,000 baseline
        minimum_percentage: 70, // 70% minimum
        updated_by: adminId,
        updated_at: Date.now(),
      });
    });

    const result = await t.query(api.workerJobs.validateBidAmount, {
      subcategoryId,
      bidAmount: 5000, // Below 70% of 10,000 (7,000)
    });

    expect(result.isValid).toBe(false);
    expect(result.minimumAmount).toBe(7000);
    expect(result.baselinePrice).toBe(10000);
    expect(result.minimumPercentage).toBe(70);
    expect(result.reason).toBe("Bid must be at least 7000 (70% of baseline 10000)");
  });

  test("should allow any positive bid when no pricing configured", async () => {
    const t = convexTest(schema);
    const { subcategoryId } = await createBidValidationTestSetup(t);

    // No pricing configuration created

    const result = await t.query(api.workerJobs.validateBidAmount, {
      subcategoryId,
      bidAmount: 1000, // Any positive amount
    });

    expect(result.isValid).toBe(true);
    expect(result.minimumAmount).toBe(0);
    expect(result.baselinePrice).toBe(0);
    expect(result.reason).toBeUndefined();
  });

  test("should reject zero or negative bids", async () => {
    const t = convexTest(schema);
    const { subcategoryId } = await createBidValidationTestSetup(t);

    const result = await t.query(api.workerJobs.validateBidAmount, {
      subcategoryId,
      bidAmount: 0, // Zero bid
    });

    expect(result.isValid).toBe(false);
    expect(result.reason).toBe("Bid must be greater than 0");
  });

  test("should handle different minimum percentages correctly", async () => {
    const t = convexTest(schema);
    const { subcategoryId, adminId } = await createBidValidationTestSetup(t);

    // Set pricing baseline with 85% minimum
    await t.run(async (ctx: any) => {
      return await ctx.db.insert("category_pricing", {
        subcategory_id: subcategoryId,
        baseline_price: 20000, // 20,000 baseline
        minimum_percentage: 85, // 85% minimum
        updated_by: adminId,
        updated_at: Date.now(),
      });
    });

    // Test bid at exactly the minimum (should be valid)
    const exactMinResult = await t.query(api.workerJobs.validateBidAmount, {
      subcategoryId,
      bidAmount: 17000, // Exactly 85% of 20,000
    });

    expect(exactMinResult.isValid).toBe(true);
    expect(exactMinResult.minimumAmount).toBe(17000);

    // Test bid below minimum (should be invalid)
    const belowMinResult = await t.query(api.workerJobs.validateBidAmount, {
      subcategoryId,
      bidAmount: 16999, // Just below 85% of 20,000
    });

    expect(belowMinResult.isValid).toBe(false);
    expect(belowMinResult.reason).toBe("Bid must be at least 17000 (85% of baseline 20000)");
  });

  test("should handle edge case of 100% minimum percentage", async () => {
    const t = convexTest(schema);
    const { subcategoryId, adminId } = await createBidValidationTestSetup(t);

    // Set pricing baseline with 100% minimum (no discount allowed)
    await t.run(async (ctx: any) => {
      return await ctx.db.insert("category_pricing", {
        subcategory_id: subcategoryId,
        baseline_price: 15000,
        minimum_percentage: 100, // 100% minimum
        updated_by: adminId,
        updated_at: Date.now(),
      });
    });

    // Test bid below baseline (should be invalid)
    const belowResult = await t.query(api.workerJobs.validateBidAmount, {
      subcategoryId,
      bidAmount: 14999,
    });

    expect(belowResult.isValid).toBe(false);
    expect(belowResult.minimumAmount).toBe(15000);

    // Test bid at baseline (should be valid)
    const exactResult = await t.query(api.workerJobs.validateBidAmount, {
      subcategoryId,
      bidAmount: 15000,
    });

    expect(exactResult.isValid).toBe(true);

    // Test bid above baseline (should be valid)
    const aboveResult = await t.query(api.workerJobs.validateBidAmount, {
      subcategoryId,
      bidAmount: 16000,
    });

    expect(aboveResult.isValid).toBe(true);
  });

  test("should handle very low minimum percentage", async () => {
    const t = convexTest(schema);
    const { subcategoryId, adminId } = await createBidValidationTestSetup(t);

    // Set pricing baseline with very low minimum (10%)
    await t.run(async (ctx: any) => {
      return await ctx.db.insert("category_pricing", {
        subcategory_id: subcategoryId,
        baseline_price: 10000,
        minimum_percentage: 10, // Only 10% minimum
        updated_by: adminId,
        updated_at: Date.now(),
      });
    });

    const result = await t.query(api.workerJobs.validateBidAmount, {
      subcategoryId,
      bidAmount: 1500, // Above 10% of 10,000 (1,000)
    });

    expect(result.isValid).toBe(true);
    expect(result.minimumAmount).toBe(1000); // 10% of 10,000
    expect(result.baselinePrice).toBe(10000);
    expect(result.minimumPercentage).toBe(10);
  });

  test("should handle large baseline prices correctly", async () => {
    const t = convexTest(schema);
    const { subcategoryId, adminId } = await createBidValidationTestSetup(t);

    // Set very high baseline price
    await t.run(async (ctx: any) => {
      return await ctx.db.insert("category_pricing", {
        subcategory_id: subcategoryId,
        baseline_price: 1000000, // 1 million baseline
        minimum_percentage: 75, // 75% minimum
        updated_by: adminId,
        updated_at: Date.now(),
      });
    });

    const result = await t.query(api.workerJobs.validateBidAmount, {
      subcategoryId,
      bidAmount: 800000, // Above 75% of 1,000,000 (750,000)
    });

    expect(result.isValid).toBe(true);
    expect(result.minimumAmount).toBe(750000);
    expect(result.baselinePrice).toBe(1000000);

    // Test below minimum
    const invalidResult = await t.query(api.workerJobs.validateBidAmount, {
      subcategoryId,
      bidAmount: 700000, // Below 75% of 1,000,000
    });

    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.reason).toBe("Bid must be at least 750000 (75% of baseline 1000000)");
  });

  test("should handle non-existent subcategory gracefully", async () => {
    const t = convexTest(schema);

    // Create a valid subcategory ID but don't actually create the subcategory
    const nonExistentSubcategoryId = await t.run(async (ctx: any) => {
      const tempId = await ctx.db.insert("categories", {
        name_en: "Temp Category",
        name_fr: "Catégorie Temp",
        name_ar: "فئة مؤقتة",
        photo_url: "temp.jpg",
        requires_photos: false,
        requires_work_code: false,
        level: 2,
      });
      await ctx.db.delete(tempId);
      return tempId;
    });

    // Should allow any positive bid when subcategory pricing doesn't exist
    const result = await t.query(api.workerJobs.validateBidAmount, {
      subcategoryId: nonExistentSubcategoryId,
      bidAmount: 5000,
    });

    expect(result.isValid).toBe(true);
    expect(result.minimumAmount).toBe(0);
    expect(result.baselinePrice).toBe(0);
  });

  test("should handle decimal amounts in calculation", async () => {
    const t = convexTest(schema);
    const { subcategoryId, adminId } = await createBidValidationTestSetup(t);

    // Set pricing that will result in decimal minimum
    await t.run(async (ctx: any) => {
      return await ctx.db.insert("category_pricing", {
        subcategory_id: subcategoryId,
        baseline_price: 10003, // Odd number to create decimal
        minimum_percentage: 73, // Percentage that creates decimal
        updated_by: adminId,
        updated_at: Date.now(),
      });
    });

    const result = await t.query(api.workerJobs.validateBidAmount, {
      subcategoryId,
      bidAmount: 7302, // Just above the floor calculation
    });

    // The function uses Math.floor, so 10003 * 0.73 = 7302.19 -> floor to 7302
    expect(result.minimumAmount).toBe(7302);
    expect(result.isValid).toBe(true);

    // Test exactly at the floor boundary
    const boundaryResult = await t.query(api.workerJobs.validateBidAmount, {
      subcategoryId,
      bidAmount: 7301, // Below floor
    });

    expect(boundaryResult.isValid).toBe(false);
  });
});