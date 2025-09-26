// convex/actions.ts
import { action, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { v } from "convex/values";
import { hash, compare } from "bcryptjs";
import { validateMauritanianMobile } from "../lib/phoneValidation";
import { Id } from "./_generated/dataModel";

/**
 * Generates and stores a One-Time Password (OTP) using Convex actions.
 * 
 * This action handles:
 * 1. Phone number validation
 * 2. OTP generation (using Math.random() - allowed in actions)
 * 3. OTP hashing (using bcrypt - allowed in actions)
 * 4. Storage via internal mutation
 * 5. Development logging
 * 
 * Security Note: The plain-text OTP is never stored in the database.
 * Only the bcrypt hash is stored. The OTP is logged for development only.
 * 
 * @param phone - The user's phone number (must be valid Mauritanian format)
 * @returns Promise<{ success: boolean }> - Success confirmation
 */
export const generateAndStoreOTP = action({
  args: {
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate the phone number format
    const isValidPhone = validateMauritanianMobile(args.phone);
    if (!isValidPhone) {
      throw new Error("Invalid Mauritanian phone number");
    }

    // Generate OTP code (allowed in actions)
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash the OTP for secure storage (allowed in actions)
    const token_hash = await hash(otpCode, 10);

    // Store OTP via internal mutation
    await ctx.runMutation(internal.auth.storeOTPHash, {
      phone: args.phone,
      token_hash,
    });

    // Log OTP for development/testing (allowed in actions)
    console.log(`🔢 OTP generated for ${args.phone}: ${otpCode}`);
    console.log(`⏰ Expires in 10 minutes`);

    // Return success (never return the actual code)
    return { success: true };
  },
});

export const validateOTP = action({
  args: {
    phone: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const validOTP = await ctx.runQuery(api.auth.getOTPByPhone, {
      phone: args.phone,
    });

    if (!validOTP) {
      return { valid: false, error: "Invalid or expired OTP" };
    }

    // Compare the submitted code with the stored hash using bcrypt
    const isValid = await compare(args.code, validOTP.token_hash);

    if (isValid) {
      await ctx.runMutation(api.auth.markOTPVerified, {
        otpId: validOTP._id,
      });
      return { valid: true };
    } else {
      // Remove the currentAttempts parameter - let the mutation handle it
      const newAttemptCount = await ctx.runMutation(api.auth.incrementOTPAttempts, {
        otpId: validOTP._id,
      });
      
      console.log(`OTP attempt failed for ${args.phone}. Attempts: ${newAttemptCount}`);
      
      return { valid: false, error: "Incorrect code" };
    }
  },
});

/**
 * Creates a new user in the system with complete profile information.
 * 
 * This is an action (not mutation) because it needs to hash passwords using bcrypt,
 * which requires Node.js modules not available in the isolated mutation environment.
 * 
 * Process:
 * 1. Validates the phone number using Mauritanian mobile validation
 * 2. Hashes the provided password using bcrypt with salt rounds of 10
 * 3. Calls internal mutation to create user record in database
 * 4. Returns the newly created user ID
 * 
 * @param phone - The user's phone number (must be valid Mauritanian format)
 * @param userType - The type of user account ("customer" or "worker")
 * @param password - The user's password (will be hashed before storage)
 * @param name - The user's full name
 * @returns Promise<{ userId: Id<"users"> }> - The ID of the newly created user
 */
export const createUser = action({
  args: {
    phone: v.string(),
    userType: v.union(v.literal("customer"), v.literal("worker")),
    password: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args): Promise<{ userId: Id<"users"> }> => {
    // Validate the phone number format
    const isValidPhone = validateMauritanianMobile(args.phone);
    if (!isValidPhone) {
      throw new Error("Invalid Mauritanian phone number");
    }

    // Validate name is not empty
    const trimmedName = args.name.trim();
    if (!trimmedName) {
      throw new Error("Name cannot be empty");
    }

    // Validate password length (minimum security requirement)
    if (args.password.length < 6) {
      throw new Error("Password must be at least 6 characters long");
    }

    try {
      // Hash the password using bcrypt
      const password_hash = await hash(args.password, 10);

      // Call internal mutation to create user in database
      const userId = await ctx.runMutation(internal.actions.createUserInternal, {
        phone: args.phone,
        userType: args.userType,
        password_hash,
        name: trimmedName,
      });

      return { userId };
    } catch (error) {
      // Re-throw with more context if needed
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Failed to create user account");
    }
  },
});

/**
 * Internal mutation to create user record in database.
 * 
 * This function is called by the createUser action after password hashing.
 * It handles the actual database insertion with all validation and default values.
 * 
 * Process:
 * 1. Checks if user already exists with the given phone number
 * 2. Sets appropriate approval status based on user type
 * 3. Calculates initial priority score
 * 4. Creates user record with all required fields
 * 5. Returns the new user ID
 * 
 * Default Values:
 * - rating: undefined (calculated after first reviews)
 * - location: undefined (to be set when user shares location)
 * - rejection_reason: undefined (only set if user gets rejected)
 * - balance: 0 (workers need to top up)
 * - cancellation_count: 0 (tracks reliability)
 * 
 * @param phone - Validated phone number
 * @param userType - User account type
 * @param password_hash - Pre-hashed password from bcrypt
 * @param name - User's full name (already trimmed)
 * @returns Promise<Id<"users">> - The ID of the newly created user
 */
export const createUserInternal = internalMutation({
  args: {
    phone: v.string(),
    userType: v.union(v.literal("customer"), v.literal("worker")),
    password_hash: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if user already exists with this phone number
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();

    if (existingUser) {
      throw new Error("User with this phone number already exists");
    }

    // Set approval status based on user type
    // Customers are auto-approved, workers need manual approval
    const approval_status = args.userType === "customer" ? "approved" : "pending";

    // Calculate initial priority score
    // Customers start with higher priority for better service matching
    const priority_score = args.userType === "customer" ? 100 : 50;

    // Create the new user record
const userId = await ctx.db.insert("users", {
  phone: args.phone,
  password_hash: args.password_hash, // Already hashed by action
  name: args.name, // User's full name
  user_type: args.userType,
  rating: undefined, // Will be calculated after receiving reviews
  balance: 0, // Workers need to top up, customers pay per job
  location_lat: undefined, // To be set when user shares location
  location_lng: undefined, // To be set when user shares location
  approval_status, // "approved" for customers, "pending" for workers
  rejection_reason: undefined, // Only set if worker application is rejected
  cancellation_count: 0, // Tracks user reliability
  priority_score, // Used for job matching algorithms
  created_at: Date.now(), // Unix timestamp of account creation
  onboarding_status: "not_started", // Initialize onboarding status for all users
});

    return userId;
  },
});

export const generateRefreshToken = action({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<{ refreshToken: string }> => {
    // Generate cryptographically secure token
    const refreshToken = `refresh_${Date.now()}_${crypto.randomUUID().replace(/-/g, '')}`;
    const now = Date.now();
    const expiresAt = now + (90 * 24 * 60 * 60 * 1000); // 90 days
    
    // Hash token before storing
    const tokenHash = await hash(refreshToken, 12);
    
    await ctx.runMutation(internal.actions.storeRefreshToken, {
      userId,
      tokenHash,
      expiresAt,
      createdAt: now,
    });
    
    return { refreshToken };
  },
});

export const storeRefreshToken = internalMutation({
  args: {
    userId: v.id("users"),
    tokenHash: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("refresh_tokens", {
      user_id: args.userId,
      token_hash: args.tokenHash,
      expires_at: args.expiresAt,
      is_revoked: false,
      created_at: args.createdAt,
    });
  },
});

/**
 * Validates user credentials (phone and password)
 * This is an action because it needs bcrypt for password comparison
 * 
 * @param phone - User's phone number
 * @param password - User's password
 * @returns User ID if credentials are valid, null otherwise
 */
export const validateCredentials = action({
  args: { 
    phone: v.string(), 
    password: v.string() 
  },
  handler: async (ctx, { phone, password }): Promise<{ userId: Id<"users"> | null }> => {
    // Get user by phone using internal query
    const user = await ctx.runQuery(internal.auth.getUserByPhoneInternal, { phone });
    
    if (!user) {
      return { userId: null };
    }
    
    // Compare password with stored hash
    const isValidPassword = await compare(password, user.password_hash);
    
    return { userId: isValidPassword ? user._id : null };
  },
});

export const validateRefreshToken = action({
  args: { refreshToken: v.string() },
  handler: async (ctx, { refreshToken }): Promise<{ userId: Id<"users"> | null }> => {
    const tokens = await ctx.runQuery(api.auth.getValidRefreshTokens);
    
    for (const token of tokens) {
      const isValid = await compare(refreshToken, token.token_hash);
      if (isValid) {
        return { userId: token.user_id };
      }
    }
    
    return { userId: null };
  },
});