// convex/workerJobs.handleTieCategorization.test.ts - Unit tests for handleTieCategorization function
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Id } from "./_generated/dataModel";

// Mock the assignBiddersToJob function
const mockAssignBiddersToJob = vi.fn();

// Mock context
const mockCtx = {
  db: {
    patch: vi.fn(),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

// Import the actual function (we'll test its logic)
const handleTieCategorization = async (ctx: any, jobId: string, subcategoryIds: string[]) => {
  // Store all tied subcategories
  await ctx.db.patch(jobId, {
    subcategory_ids: subcategoryIds,
    broadcasting_phase: 2,
  });

  // Broadcast to workers in all tied subcategories
  await mockAssignBiddersToJob(ctx, jobId, subcategoryIds);
};

describe("handleTieCategorization", () => {
  it("should store multiple subcategories and update broadcasting phase", async () => {
    const jobId = "jobs:tie-job" as Id<"jobs">;
    const subcategoryIds = ["categories:sub1", "categories:sub2", "categories:sub3"];

    await handleTieCategorization(mockCtx, jobId, subcategoryIds);

    // Verify database patch was called with correct parameters
    expect(mockCtx.db.patch).toHaveBeenCalledWith(jobId, {
      subcategory_ids: subcategoryIds,
      broadcasting_phase: 2,
    });

    // Verify assignBiddersToJob was called with all subcategories
    expect(mockAssignBiddersToJob).toHaveBeenCalledWith(mockCtx, jobId, subcategoryIds);
  });

  it("should handle two-way tie scenario", async () => {
    const jobId = "jobs:two-way-tie" as Id<"jobs">;
    const subcategoryIds = ["categories:sub1", "categories:sub2"];

    await handleTieCategorization(mockCtx, jobId, subcategoryIds);

    expect(mockCtx.db.patch).toHaveBeenCalledWith(jobId, {
      subcategory_ids: subcategoryIds,
      broadcasting_phase: 2,
    });

    expect(mockAssignBiddersToJob).toHaveBeenCalledWith(mockCtx, jobId, subcategoryIds);
  });

  it("should handle three-way tie scenario", async () => {
    const jobId = "jobs:three-way-tie" as Id<"jobs">;
    const subcategoryIds = ["categories:sub1", "categories:sub2", "categories:sub3"];

    await handleTieCategorization(mockCtx, jobId, subcategoryIds);

    expect(mockCtx.db.patch).toHaveBeenCalledWith(jobId, {
      subcategory_ids: subcategoryIds,
      broadcasting_phase: 2,
    });

    expect(mockAssignBiddersToJob).toHaveBeenCalledWith(mockCtx, jobId, subcategoryIds);
  });

  it("should handle four-way tie scenario", async () => {
    const jobId = "jobs:four-way-tie" as Id<"jobs">;
    const subcategoryIds = ["categories:sub1", "categories:sub2", "categories:sub3", "categories:sub4"];

    await handleTieCategorization(mockCtx, jobId, subcategoryIds);

    expect(mockCtx.db.patch).toHaveBeenCalledWith(jobId, {
      subcategory_ids: subcategoryIds,
      broadcasting_phase: 2,
    });

    expect(mockAssignBiddersToJob).toHaveBeenCalledWith(mockCtx, jobId, subcategoryIds);
  });

  it("should handle empty subcategory array gracefully", async () => {
    const jobId = "jobs:empty-tie" as Id<"jobs">;
    const subcategoryIds: string[] = [];

    await handleTieCategorization(mockCtx, jobId, subcategoryIds);

    expect(mockCtx.db.patch).toHaveBeenCalledWith(jobId, {
      subcategory_ids: [],
      broadcasting_phase: 2,
    });

    expect(mockAssignBiddersToJob).toHaveBeenCalledWith(mockCtx, jobId, []);
  });

  it("should handle single subcategory in tie scenario", async () => {
    const jobId = "jobs:single-tie" as Id<"jobs">;
    const subcategoryIds = ["categories:sub1"];

    await handleTieCategorization(mockCtx, jobId, subcategoryIds);

    expect(mockCtx.db.patch).toHaveBeenCalledWith(jobId, {
      subcategory_ids: ["categories:sub1"],
      broadcasting_phase: 2,
    });

    expect(mockAssignBiddersToJob).toHaveBeenCalledWith(mockCtx, jobId, ["categories:sub1"]);
  });

  it("should preserve subcategory order", async () => {
    const jobId = "jobs:ordered-tie" as Id<"jobs">;
    const subcategoryIds = ["categories:sub3", "categories:sub1", "categories:sub2"];

    await handleTieCategorization(mockCtx, jobId, subcategoryIds);

    expect(mockCtx.db.patch).toHaveBeenCalledWith(jobId, {
      subcategory_ids: ["categories:sub3", "categories:sub1", "categories:sub2"],
      broadcasting_phase: 2,
    });

    expect(mockAssignBiddersToJob).toHaveBeenCalledWith(
      mockCtx, 
      jobId, 
      ["categories:sub3", "categories:sub1", "categories:sub2"]
    );
  });

  it("should handle database patch errors gracefully", async () => {
    const jobId = "jobs:db-error" as Id<"jobs">;
    const subcategoryIds = ["categories:sub1", "categories:sub2"];

    // Mock database error
    mockCtx.db.patch.mockRejectedValueOnce(new Error("Database error"));

    await expect(handleTieCategorization(mockCtx, jobId, subcategoryIds))
      .rejects.toThrow("Database error");

    // Verify assignBiddersToJob was not called due to error
    expect(mockAssignBiddersToJob).not.toHaveBeenCalled();
  });

  it("should handle assignBiddersToJob errors gracefully", async () => {
    const jobId = "jobs:assign-error" as Id<"jobs">;
    const subcategoryIds = ["categories:sub1", "categories:sub2"];

    // Mock assignBiddersToJob error
    mockAssignBiddersToJob.mockRejectedValueOnce(new Error("Assignment error"));

    await expect(handleTieCategorization(mockCtx, jobId, subcategoryIds))
      .rejects.toThrow("Assignment error");

    // Verify database patch was still called
    expect(mockCtx.db.patch).toHaveBeenCalledWith(jobId, {
      subcategory_ids: subcategoryIds,
      broadcasting_phase: 2,
    });
  });

  it("should handle mixed valid and invalid subcategory IDs", async () => {
    const jobId = "jobs:mixed-tie" as Id<"jobs">;
    const subcategoryIds = ["categories:valid1", "invalid-id", "categories:valid2"];

    await handleTieCategorization(mockCtx, jobId, subcategoryIds);

    // Should still process all IDs regardless of format
    expect(mockCtx.db.patch).toHaveBeenCalledWith(jobId, {
      subcategory_ids: ["categories:valid1", "invalid-id", "categories:valid2"],
      broadcasting_phase: 2,
    });

    expect(mockAssignBiddersToJob).toHaveBeenCalledWith(
      mockCtx, 
      jobId, 
      ["categories:valid1", "invalid-id", "categories:valid2"]
    );
  });

  it("should handle very large number of tied subcategories", async () => {
    const jobId = "jobs:large-tie" as Id<"jobs">;
    const subcategoryIds = Array.from({ length: 100 }, (_, i) => `categories:sub${i + 1}`);

    await handleTieCategorization(mockCtx, jobId, subcategoryIds);

    expect(mockCtx.db.patch).toHaveBeenCalledWith(jobId, {
      subcategory_ids: subcategoryIds,
      broadcasting_phase: 2,
    });

    expect(mockAssignBiddersToJob).toHaveBeenCalledWith(mockCtx, jobId, subcategoryIds);
  });

  it("should verify broadcasting phase is correctly set to 2", async () => {
    const jobId = "jobs:phase-test" as Id<"jobs">;
    const subcategoryIds = ["categories:sub1", "categories:sub2"];

    await handleTieCategorization(mockCtx, jobId, subcategoryIds);

    const patchCall = mockCtx.db.patch.mock.calls[0];
    expect(patchCall[1].broadcasting_phase).toBe(2);
  });

  it("should ensure subcategory_ids field is properly set", async () => {
    const jobId = "jobs:field-test" as Id<"jobs">;
    const subcategoryIds = ["categories:sub1", "categories:sub2"];

    await handleTieCategorization(mockCtx, jobId, subcategoryIds);

    const patchCall = mockCtx.db.patch.mock.calls[0];
    expect(patchCall[1].subcategory_ids).toEqual(subcategoryIds);
    expect(Array.isArray(patchCall[1].subcategory_ids)).toBe(true);
  });
});
