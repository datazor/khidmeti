// convex/users.ts
import { validateMauritanianMobile } from "../lib/phoneValidation";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { hash } from "bcryptjs";
import { Id } from "./_generated/dataModel";

export const checkPhoneExists = query({
  args: { phone: v.string() },
  handler: async (ctx, args) => {
    if (!args.phone?.trim()) return false;
    
    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("phone"), args.phone))
      .first();
    
    return user !== null;
  },
});


/**
 * Updates a user's profile information.
 * 
 * Process:
 * 1. Validates that the user exists in the database
 * 2. Validates the name parameter (non-empty, reasonable length)
 * 3. Updates the user's name field in the database
 * 4. Returns success confirmation
 * 
 * Validation Rules:
 * - Name must be between 1 and 100 characters
 * - Name cannot be empty or just whitespace
 * - User must exist in the database
 * 
 * @param userId - The ID of the user to update
 * @param name - The new name for the user
 * @returns Promise<{ success: boolean }> - Success confirmation
 */
export const updateProfile = mutation({
  args: {
    userId: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate name parameter
    const trimmedName = args.name.trim();
    if (trimmedName.length === 0) {
      throw new Error("Name cannot be empty");
    }
    if (trimmedName.length > 100) {
      throw new Error("Name must be less than 100 characters");
    }

    // Verify user exists
    const user = await ctx.db.get(args.userId as Id<"users">);
    if (!user) {
      throw new Error("User not found");
    }

    // Update user's name
    await ctx.db.patch(user._id, {
      name: trimmedName,
    });

    return { success: true };
  },
});

/**
 * Initialize worker onboarding when user type changes to worker
 * Sets onboarding_status to "not_started" and prepares for onboarding flow
 * 
 * @param userId - The ID of the user to initialize as worker
 * @returns Success confirmation with onboarding status
 */
export const initializeAsWorker = mutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify user exists
    const user = await ctx.db.get(args.userId as Id<"users">);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if user is already a worker
    if (user.user_type === "worker") {
      // If already worker but no onboarding status, initialize it
      if (!user.onboarding_status) {
        await ctx.db.patch(user._id, {
          onboarding_status: "not_started",
        });
      }
      return { 
        success: true, 
        onboarding_status: user.onboarding_status || "not_started",
        message: "Worker already initialized" 
      };
    }

    // Update user to worker and initialize onboarding
    await ctx.db.patch(user._id, {
      user_type: "worker",
      onboarding_status: "not_started",
      approval_status: "pending", // Workers start as pending until onboarding complete
    });

    return { 
      success: true, 
      onboarding_status: "not_started",
      message: "Worker onboarding initialized"
    };
  },
});