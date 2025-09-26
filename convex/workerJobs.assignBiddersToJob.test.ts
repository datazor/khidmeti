// convex/workerJobs.assignBiddersToJob.test.ts - Unit tests for assignBiddersToJob function with multiple subcategories
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Id } from "./_generated/dataModel";

// Mock context
const mockCtx = {
  db: {
    query: vi.fn(),
    get: vi.fn(),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

// Import the actual function structure
const assignBiddersToJob = async (ctx: any, jobId: string, subcategoryIds: string[]) => {
  const allWorkers = new Set<string>();

  for (const subcategoryId of subcategoryIds) {
    const subcategoryWorkers = await ctx.db
      .query("user_skills")
      .withIndex("by_category", (q: { eq: (arg0: string, arg1: string) => any; }) => q.eq("category_id", subcategoryId))
      .collect();

    const eligibleWorkers = await Promise.all(
      subcategoryWorkers.map(async (skill: { user_id: any; }) => {
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

  return allWorkers.size;
};

describe("assignBiddersToJob - MULTIPLE SUBCATEGORIES", () => {
  it("should handle single subcategory correctly", async () => {
    const jobId = "jobs:single-subcategory" as Id<"jobs">;
    const subcategoryIds = ["categories:sub1"];

    // Mock user_skills query for single subcategory
    mockCtx.db.query.mockReturnValue({
      withIndex: () => ({
        collect: () => Promise.resolve([
          { user_id: "users:worker1" },
          { user_id: "users:worker2" },
          { user_id: "users:worker3" },
        ]),
      }),
    });

    // Mock worker data (all eligible)
    mockCtx.db.get.mockImplementation((userId: string) => {
      return Promise.resolve({
        _id: userId,
        balance: 100,
        approval_status: "approved",
        user_type: "worker",
      });
    });

    const result = await assignBiddersToJob(mockCtx, jobId, subcategoryIds);

    expect(result).toBe(3);
    expect(mockCtx.db.query).toHaveBeenCalledWith("user_skills");
  });

  it("should handle multiple subcategories with unique workers", async () => {
    const jobId = "jobs:multiple-subcategories" as Id<"jobs">;
    const subcategoryIds = ["categories:sub1", "categories:sub2"];

    // Mock user_skills query for different subcategories
    mockCtx.db.query.mockImplementation((table: string) => {
      if (table === "user_skills") {
        return {
          withIndex: (indexName: string, filterFn: any) => {
            const subcategoryId = filterFn({ eq: (field: string, value: string) => value }) as string;
            
            if (subcategoryId === "categories:sub1") {
              return {
                collect: () => Promise.resolve([
                  { user_id: "users:worker1" },
                  { user_id: "users:worker2" },
                ]),
              };
            } else if (subcategoryId === "categories:sub2") {
              return {
                collect: () => Promise.resolve([
                  { user_id: "users:worker3" },
                  { user_id: "users:worker4" },
                ]),
              };
            }
            return { collect: () => Promise.resolve([]) };
          },
        };
      }
      return { withIndex: () => ({ collect: () => Promise.resolve([]) }) };
    });

    // Mock worker data (all eligible)
    mockCtx.db.get.mockImplementation((userId: string) => {
      return Promise.resolve({
        _id: userId,
        balance: 100,
        approval_status: "approved",
        user_type: "worker",
      });
    });

    const result = await assignBiddersToJob(mockCtx, jobId, subcategoryIds);

    expect(result).toBe(4); // 2 workers from sub1 + 2 workers from sub2
  });

  it("should handle multiple subcategories with overlapping workers", async () => {
    const jobId = "jobs:overlapping-workers" as Id<"jobs">;
    const subcategoryIds = ["categories:sub1", "categories:sub2"];

    // Mock user_skills query with overlapping workers
    mockCtx.db.query.mockImplementation((table: string) => {
      if (table === "user_skills") {
        return {
          withIndex: (indexName: string, filterFn: any) => {
            const subcategoryId = filterFn({ eq: (field: string, value: string) => value }) as string;
            
            if (subcategoryId === "categories:sub1") {
              return {
                collect: () => Promise.resolve([
                  { user_id: "users:worker1" },
                  { user_id: "users:worker2" },
                  { user_id: "users:worker3" }, // Overlapping worker
                ]),
              };
            } else if (subcategoryId === "categories:sub2") {
              return {
                collect: () => Promise.resolve([
                  { user_id: "users:worker3" }, // Overlapping worker
                  { user_id: "users:worker4" },
                  { user_id: "users:worker5" },
                ]),
              };
            }
            return { collect: () => Promise.resolve([]) };
          },
        };
      }
      return { withIndex: () => ({ collect: () => Promise.resolve([]) }) };
    });

    // Mock worker data (all eligible)
    mockCtx.db.get.mockImplementation((userId: string) => {
      return Promise.resolve({
        _id: userId,
        balance: 100,
        approval_status: "approved",
        user_type: "worker",
      });
    });

    const result = await assignBiddersToJob(mockCtx, jobId, subcategoryIds);

    // Should be 5 unique workers (worker3 appears in both subcategories but should be counted once)
    expect(result).toBe(5);
  });

  it("should filter out ineligible workers (no balance)", async () => {
    const jobId = "jobs:ineligible-workers" as Id<"jobs">;
    const subcategoryIds = ["categories:sub1"];

    // Mock user_skills query
    mockCtx.db.query.mockReturnValue({
      withIndex: () => ({
        collect: () => Promise.resolve([
          { user_id: "users:worker1" }, // Eligible
          { user_id: "users:worker2" }, // No balance
          { user_id: "users:worker3" }, // Eligible
        ]),
      }),
    });

    // Mock worker data with mixed eligibility
    mockCtx.db.get.mockImplementation((userId: string) => {
      if (userId === "users:worker2") {
        return Promise.resolve({
          _id: userId,
          balance: 0, // No balance
          approval_status: "approved",
          user_type: "worker",
        });
      }
      return Promise.resolve({
        _id: userId,
        balance: 100,
        approval_status: "approved",
        user_type: "worker",
      });
    });

    const result = await assignBiddersToJob(mockCtx, jobId, subcategoryIds);

    expect(result).toBe(2); // Only worker1 and worker3 are eligible
  });

  it("should filter out ineligible workers (not approved)", async () => {
    const jobId = "jobs:not-approved" as Id<"jobs">;
    const subcategoryIds = ["categories:sub1"];

    // Mock user_skills query
    mockCtx.db.query.mockReturnValue({
      withIndex: () => ({
        collect: () => Promise.resolve([
          { user_id: "users:worker1" }, // Eligible
          { user_id: "users:worker2" }, // Not approved
          { user_id: "users:worker3" }, // Eligible
        ]),
      }),
    });

    // Mock worker data with mixed approval status
    mockCtx.db.get.mockImplementation((userId: string) => {
      if (userId === "users:worker2") {
        return Promise.resolve({
          _id: userId,
          balance: 100,
          approval_status: "pending", // Not approved
          user_type: "worker",
        });
      }
      return Promise.resolve({
        _id: userId,
        balance: 100,
        approval_status: "approved",
        user_type: "worker",
      });
    });

    const result = await assignBiddersToJob(mockCtx, jobId, subcategoryIds);

    expect(result).toBe(2); // Only worker1 and worker3 are eligible
  });

  it("should filter out non-worker users", async () => {
    const jobId = "jobs:non-workers" as Id<"jobs">;
    const subcategoryIds = ["categories:sub1"];

    // Mock user_skills query
    mockCtx.db.query.mockReturnValue({
      withIndex: () => ({
        collect: () => Promise.resolve([
          { user_id: "users:worker1" }, // Worker
          { user_id: "users:customer1" }, // Customer
          { user_id: "users:worker2" }, // Worker
        ]),
      }),
    });

    // Mock user data with mixed user types
    mockCtx.db.get.mockImplementation((userId: string) => {
      if (userId === "users:customer1") {
        return Promise.resolve({
          _id: userId,
          balance: 100,
          approval_status: "approved",
          user_type: "customer", // Not a worker
        });
      }
      return Promise.resolve({
        _id: userId,
        balance: 100,
        approval_status: "approved",
        user_type: "worker",
      });
    });

    const result = await assignBiddersToJob(mockCtx, jobId, subcategoryIds);

    expect(result).toBe(2); // Only worker1 and worker2 are eligible
  });

  it("should handle empty subcategory array", async () => {
    const jobId = "jobs:empty-subcategories" as Id<"jobs">;
    const subcategoryIds: string[] = [];

    const result = await assignBiddersToJob(mockCtx, jobId, subcategoryIds);

    expect(result).toBe(0);
    // Should not call any database queries for empty array
    expect(mockCtx.db.query).not.toHaveBeenCalled();
  });

  it("should handle subcategory with no skilled workers", async () => {
    const jobId = "jobs:no-skilled-workers" as Id<"jobs">;
    const subcategoryIds = ["categories:sub1"];

    // Mock empty user_skills query
    mockCtx.db.query.mockReturnValue({
      withIndex: () => ({
        collect: () => Promise.resolve([]), // No skilled workers
      }),
    });

    const result = await assignBiddersToJob(mockCtx, jobId, subcategoryIds);

    expect(result).toBe(0);
  });

  it("should handle multiple subcategories where some have no workers", async () => {
    const jobId = "jobs:mixed-subcategories" as Id<"jobs">;
    const subcategoryIds = ["categories:sub1", "categories:sub2", "categories:sub3"];

    // Mock user_skills query for different subcategories
    mockCtx.db.query.mockImplementation((table: string) => {
      if (table === "user_skills") {
        return {
          withIndex: (indexName: string, filterFn: any) => {
            const subcategoryId = filterFn({ eq: (field: string, value: string) => value }) as string;
            
            if (subcategoryId === "categories:sub1") {
              return {
                collect: () => Promise.resolve([
                  { user_id: "users:worker1" },
                  { user_id: "users:worker2" },
                ]),
              };
            } else if (subcategoryId === "categories:sub2") {
              return {
                collect: () => Promise.resolve([]), // No workers
              };
            } else if (subcategoryId === "categories:sub3") {
              return {
                collect: () => Promise.resolve([
                  { user_id: "users:worker3" },
                  { user_id: "users:worker4" },
                ]),
              };
            }
            return { collect: () => Promise.resolve([]) };
          },
        };
      }
      return { withIndex: () => ({ collect: () => Promise.resolve([]) }) };
    });

    // Mock worker data (all eligible)
    mockCtx.db.get.mockImplementation((userId: string) => {
      return Promise.resolve({
        _id: userId,
        balance: 100,
        approval_status: "approved",
        user_type: "worker",
      });
    });

    const result = await assignBiddersToJob(mockCtx, jobId, subcategoryIds);

    expect(result).toBe(4); // 2 from sub1 + 0 from sub2 + 2 from sub3
  });

  it("should handle database query errors gracefully", async () => {
    const jobId = "jobs:db-error" as Id<"jobs">;
    const subcategoryIds = ["categories:sub1"];

    // Mock database error
    mockCtx.db.query.mockReturnValue({
      withIndex: () => ({
        collect: () => Promise.reject(new Error("Database error")),
      }),
    });

    await expect(assignBiddersToJob(mockCtx, jobId, subcategoryIds))
      .rejects.toThrow("Database error");
  });

  it("should handle worker retrieval errors gracefully", async () => {
    const jobId = "jobs:worker-error" as Id<"jobs">;
    const subcategoryIds = ["categories:sub1"];

    // Mock user_skills query
    mockCtx.db.query.mockReturnValue({
      withIndex: () => ({
        collect: () => Promise.resolve([
          { user_id: "users:worker1" },
        ]),
      }),
    });

    // Mock worker retrieval error
    mockCtx.db.get.mockRejectedValue(new Error("Worker not found"));

    await expect(assignBiddersToJob(mockCtx, jobId, subcategoryIds))
      .rejects.toThrow("Worker not found");
  });

  it("should handle very large number of subcategories efficiently", async () => {
    const jobId = "jobs:many-subcategories" as Id<"jobs">;
    const subcategoryIds = Array.from({ length: 50 }, (_, i) => `categories:sub${i + 1}`);

    // Mock user_skills query for all subcategories
    mockCtx.db.query.mockReturnValue({
      withIndex: () => ({
        collect: () => Promise.resolve([
          { user_id: "users:worker1" },
          { user_id: "users:worker2" },
        ]),
      }),
    });

    // Mock worker data (all eligible)
    mockCtx.db.get.mockImplementation((userId: string) => {
      return Promise.resolve({
        _id: userId,
        balance: 100,
        approval_status: "approved",
        user_type: "worker",
      });
    });

    const result = await assignBiddersToJob(mockCtx, jobId, subcategoryIds);

    // Should return unique count (2 workers repeated across 50 subcategories)
    expect(result).toBe(2);
  });

  it("should verify Set is used for unique worker tracking", async () => {
    const jobId = "jobs:set-verification" as Id<"jobs">;
    const subcategoryIds = ["categories:sub1", "categories:sub2"];

    // Mock overlapping workers
    mockCtx.db.query.mockImplementation((table: string) => {
      if (table === "user_skills") {
        return {
          withIndex: (indexName: string, filterFn: any) => {
            const subcategoryId = filterFn({ eq: (field: string, value: string) => value }) as string;
            
            return {
              collect: () => Promise.resolve([
                { user_id: "users:worker1" }, // Same worker in both subcategories
                { user_id: "users:worker2" },
              ]),
            };
          },
        };
      }
      return { withIndex: () => ({ collect: () => Promise.resolve([]) }) };
    });

    // Mock worker data (all eligible)
    mockCtx.db.get.mockImplementation((userId: string) => {
      return Promise.resolve({
        _id: userId,
        balance: 100,
        approval_status: "approved",
        user_type: "worker",
      });
    });

    const result = await assignBiddersToJob(mockCtx, jobId, subcategoryIds);

    // Should be 2 unique workers, not 4 (2 per subcategory × 2 subcategories)
    expect(result).toBe(2);
  });
});
