// convex/users.test.ts
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { Id } from "./_generated/dataModel";

// Helper to create a test user
async function createTestUser(t: any, userType: "customer" | "worker" = "customer") {
  return await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      phone: "+22212345678",
      password_hash: "hashed_password",
      name: "Test User",
      user_type: userType,
      balance: 0,
      approval_status: "approved",
      cancellation_count: 0,
      priority_score: 100,
      created_at: Date.now(),
      onboarding_status: "not_started",
    });
  });
}

// Tests for checkPhoneExists query
test("checkPhoneExists returns true for existing phone", async () => {
  const t = convexTest(schema);
  
  // Create a user with a specific phone
  await createTestUser(t);

  const result = await t.query(api.users.checkPhoneExists, { 
    phone: "+22212345678" 
  });

  expect(result).toBe(true);
});

test("checkPhoneExists returns false for non-existing phone", async () => {
  const t = convexTest(schema);

  const result = await t.query(api.users.checkPhoneExists, { 
    phone: "+22298765432" 
  });

  expect(result).toBe(false);
});

test("checkPhoneExists returns false for empty phone", async () => {
  const t = convexTest(schema);

  const result = await t.query(api.users.checkPhoneExists, { 
    phone: "" 
  });

  expect(result).toBe(false);
});

test("checkPhoneExists returns false for whitespace-only phone", async () => {
  const t = convexTest(schema);

  const result = await t.query(api.users.checkPhoneExists, { 
    phone: "   " 
  });

  expect(result).toBe(false);
});

// Tests for updateProfile mutation
test("updateProfile updates user name successfully", async () => {
  const t = convexTest(schema);
  const userId = await createTestUser(t);

  const result = await t.mutation(api.users.updateProfile, { 
    userId: userId as unknown as string, 
    name: "Updated Name" 
  });

  expect(result.success).toBe(true);

  // Verify the name was updated in database
  const user = await t.run(async (ctx: any) => {
    return await ctx.db.get(userId);
  });

  expect(user.name).toBe("Updated Name");
});

test("updateProfile trims whitespace from name", async () => {
  const t = convexTest(schema);
  const userId = await createTestUser(t);

  const result = await t.mutation(api.users.updateProfile, { 
    userId: userId as unknown as string, 
    name: "  Trimmed Name  " 
  });

  expect(result.success).toBe(true);

  // Verify the name was trimmed
  const user = await t.run(async (ctx: any) => {
    return await ctx.db.get(userId);
  });

  expect(user.name).toBe("Trimmed Name");
});

test("updateProfile throws error for empty name", async () => {
  const t = convexTest(schema);
  const userId = await createTestUser(t);

  await expect(
    t.mutation(api.users.updateProfile, { 
      userId: userId as unknown as string, 
      name: "" 
    })
  ).rejects.toThrow("Name cannot be empty");
});

test("updateProfile throws error for whitespace-only name", async () => {
  const t = convexTest(schema);
  const userId = await createTestUser(t);

  await expect(
    t.mutation(api.users.updateProfile, { 
      userId: userId as unknown as string, 
      name: "   " 
    })
  ).rejects.toThrow("Name cannot be empty");
});

test("updateProfile throws error for name over 100 characters", async () => {
  const t = convexTest(schema);
  const userId = await createTestUser(t);

  const longName = "a".repeat(101);

  await expect(
    t.mutation(api.users.updateProfile, { 
      userId: userId as unknown as string, 
      name: longName 
    })
  ).rejects.toThrow("Name must be less than 100 characters");
});

test("updateProfile throws error for non-existent user", async () => {
  const t = convexTest(schema);

  const fakeUserId = "user_12345678901234567890123" as Id<"users">;

  await expect(
    t.mutation(api.users.updateProfile, { 
      userId: fakeUserId as unknown as string, 
      name: "Valid Name" 
    })
  ).rejects.toThrow("User not found");
});

test("updateProfile accepts name at maximum length (100 characters)", async () => {
  const t = convexTest(schema);
  const userId = await createTestUser(t);

  const maxLengthName = "a".repeat(100);

  const result = await t.mutation(api.users.updateProfile, { 
    userId: userId as unknown as string, 
    name: maxLengthName 
  });

  expect(result.success).toBe(true);

  // Verify the name was updated
  const user = await t.run(async (ctx: any) => {
    return await ctx.db.get(userId);
  });

  expect(user.name).toBe(maxLengthName);
  expect(user.name).toHaveLength(100);
});

// Tests for initializeAsWorker mutation
test("initializeAsWorker converts customer to worker and initializes onboarding", async () => {
  const t = convexTest(schema);
  const userId = await createTestUser(t, "customer");

  const result = await t.mutation(api.users.initializeAsWorker, { 
    userId: userId as unknown as string 
  });

  expect(result.success).toBe(true);
  expect(result.onboarding_status).toBe("not_started");
  expect(result.message).toBe("Worker onboarding initialized");

  // Verify user was converted to worker in database
  const user = await t.run(async (ctx: any) => {
    return await ctx.db.get(userId);
  });

  expect(user.user_type).toBe("worker");
  expect(user.onboarding_status).toBe("not_started");
  expect(user.approval_status).toBe("pending");
});

test("initializeAsWorker handles already-worker user with onboarding status", async () => {
  const t = convexTest(schema);
  const userId = await createTestUser(t, "worker");

  // Set existing onboarding status
  await t.run(async (ctx: any) => {
    await ctx.db.patch(userId, { onboarding_status: "selfie_completed" });
  });

  const result = await t.mutation(api.users.initializeAsWorker, { 
    userId: userId as unknown as string 
  });

  expect(result.success).toBe(true);
  expect(result.onboarding_status).toBe("selfie_completed");
  expect(result.message).toBe("Worker already initialized");

  // Verify nothing changed in database
  const user = await t.run(async (ctx: any) => {
    return await ctx.db.get(userId);
  });

  expect(user.user_type).toBe("worker");
  expect(user.onboarding_status).toBe("selfie_completed");
});

test("initializeAsWorker initializes onboarding for worker without status", async () => {
  const t = convexTest(schema);
  
  // Create worker without onboarding_status (simulating old data)
  const userId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      phone: "+22212345678",
      password_hash: "hashed_password",
      name: "Test Worker",
      user_type: "worker",
      balance: 0,
      approval_status: "approved",
      cancellation_count: 0,
      priority_score: 100,
      created_at: Date.now(),
      onboarding_status: "not_started",
    });
  });

  // Remove onboarding_status to simulate legacy data
  await t.run(async (ctx: any) => {
    await ctx.db.patch(userId, { onboarding_status: undefined });
  });

  const result = await t.mutation(api.users.initializeAsWorker, { 
    userId: userId as unknown as string 
  });

  expect(result.success).toBe(true);
  expect(result.onboarding_status).toBe("not_started");
  expect(result.message).toBe("Worker already initialized");

  // Verify onboarding status was set
  const user = await t.run(async (ctx: any) => {
    return await ctx.db.get(userId);
  });

  expect(user.user_type).toBe("worker");
  expect(user.onboarding_status).toBe("not_started");
});

test("initializeAsWorker throws error for non-existent user", async () => {
  const t = convexTest(schema);

  const fakeUserId = "user_12345678901234567890123" as Id<"users">;

  await expect(
    t.mutation(api.users.initializeAsWorker, { 
      userId: fakeUserId as unknown as string 
    })
  ).rejects.toThrow("User not found");
});

test("initializeAsWorker preserves existing user data when converting", async () => {
  const t = convexTest(schema);
  
  // Create customer with specific data
  const userId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      phone: "+22212345678",
      password_hash: "hashed_password",
      name: "Test Customer",
      user_type: "customer",
      balance: 1500,
      approval_status: "approved",
      cancellation_count: 2,
      priority_score: 85,
      created_at: Date.now(),
      onboarding_status: "not_started",
      location_lat: 18.0735,
      location_lng: -15.9582,
    });
  });

  const result = await t.mutation(api.users.initializeAsWorker, { 
    userId: userId as unknown as string 
  });

  expect(result.success).toBe(true);

  // Verify other data was preserved
  const user = await t.run(async (ctx: any) => {
    return await ctx.db.get(userId);
  });

  expect(user.user_type).toBe("worker");
  expect(user.onboarding_status).toBe("not_started");
  expect(user.approval_status).toBe("pending"); // Changed
  expect(user.name).toBe("Test Customer"); // Preserved
  expect(user.phone).toBe("+22212345678"); // Preserved
  expect(user.balance).toBe(1500); // Preserved
  expect(user.cancellation_count).toBe(2); // Preserved
  expect(user.priority_score).toBe(85); // Preserved
  expect(user.location_lat).toBe(18.0735); // Preserved
  expect(user.location_lng).toBe(-15.9582); // Preserved
});

test("initializeAsWorker sets approval status to pending for new workers", async () => {
  const t = convexTest(schema);
  
  // Create customer with approved status
  const userId = await t.run(async (ctx: any) => {
    return await ctx.db.insert("users", {
      phone: "+22212345678",
      password_hash: "hashed_password",
      name: "Test Customer",
      user_type: "customer",
      balance: 0,
      approval_status: "approved",
      cancellation_count: 0,
      priority_score: 100,
      created_at: Date.now(),
      onboarding_status: "not_started",
    });
  });

  await t.mutation(api.users.initializeAsWorker, { 
    userId: userId as unknown as string 
  });

  // Verify approval status changed to pending
  const user = await t.run(async (ctx: any) => {
    return await ctx.db.get(userId);
  });

  expect(user.approval_status).toBe("pending");
});