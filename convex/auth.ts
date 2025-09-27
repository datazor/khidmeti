// convex/auth.ts
import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";


/**
 * Internal mutation to store hashed OTP in the database.
 * 
 * This internal mutation handles:
 * 1. Setting expiration time (10 minutes from creation)
 * 2. Checking for existing unverified OTPs for the phone number
 * 3. Either updating existing OTP or creating new record
 * 4. Resetting attempt counter for fresh verification attempts
 * 
 * Security Note: Only receives pre-hashed OTP tokens from actions.
 * Never handles plaintext OTP codes directly.
 * 
 * @param phone - The user's phone number
 * @param token_hash - The bcrypt hashed OTP token
 * @returns void
 */
export const storeOTPHash = internalMutation({
  args: {
    phone: v.string(),
    token_hash: v.string(),
  },
  handler: async (ctx, args) => {
    // Set expiration time (10 minutes from now)
    const expires_at = Date.now() + 10 * 60 * 1000;

    // Check for an existing, unverified OTP for this phone
    const existingOTPs = await ctx.db
      .query("otps")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .collect();

    const activeOTP = existingOTPs.find(
      (otp) => !otp.is_verified && otp.expires_at > Date.now()
    );

    if (activeOTP) {
      // Update the existing OTP document with new hash
      await ctx.db.patch(activeOTP._id, {
        token_hash: args.token_hash,
        expires_at,
        attempts: 0,
        created_at: Date.now(),
      });
    } else {
      // Create a new OTP document
      await ctx.db.insert("otps", {
        phone: args.phone,
        token_hash: args.token_hash,
        expires_at,
        attempts: 0,
        is_verified: false,
        created_at: Date.now(),
      });
    }
  },
});

export const markOTPVerified = mutation({
  args: {
    otpId: v.id("otps"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.otpId, {
      is_verified: true,
    });
  },
});

export const incrementOTPAttempts = mutation({
  args: {
    otpId: v.id("otps"),
  },
  handler: async (ctx, args) => {
    // Get the current OTP record to ensure we have the latest attempts value
    const currentOTP = await ctx.db.get(args.otpId);
    
    if (!currentOTP) {
      throw new Error("OTP record not found");
    }
    
    // Increment based on the current value in the database
    await ctx.db.patch(args.otpId, {
      attempts: currentOTP.attempts + 1,
    });
    
    return currentOTP.attempts + 1; // Return the new attempt count
  },
});

export const resetOTPAttempts = mutation({
  args: {
    otpId: v.id("otps"),
  },
  handler: async (ctx, args) => {
    // Get the current OTP record to ensure it exists
    const currentOTP = await ctx.db.get(args.otpId);
    
    if (!currentOTP) {
      throw new Error("OTP record not found");
    }
    
    // Reset attempts to 0 and update created_at to current time
    await ctx.db.patch(args.otpId, {
      attempts: 0,
      created_at: Date.now(),
    });
    
    return true;
  },
});

export const getOTPByPhone = query({
  args: {
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    const otpRecords = await ctx.db
      .query("otps")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .collect();

    return otpRecords.find(
      (otp) => 
        !otp.is_verified && 
        otp.expires_at > Date.now()
    );
  },
});


/**
 * Validates a session token and returns the associated user ID
 * 
 * @param sessionToken - The session token to validate
 * @returns User ID if token is valid and not expired, null otherwise
 */
export const validateSessionToken = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }): Promise<{ userId: Id<"users"> | null }> => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("access_token", sessionToken))
      .filter((q) => q.gt(q.field("expires_at"), Date.now()))
      .first();
    
    if (session) {
      // Update last activity
      await ctx.db.patch(session._id, {
        last_activity: Date.now(),
      });
    }
    
    return { userId: session?.user_id || null };
  },
});

/**
 * Creates a new session for a user and device
 * Deletes any existing session for the same user/device combination
 * 
 * @param userId - The user ID
 * @param deviceId - The device identifier
 * @returns The new session token
 */
export const generateNewSession = mutation({
  args: { 
    userId: v.id("users"), 
    deviceId: v.string() 
  },
  handler: async (ctx, { userId, deviceId }): Promise<{ sessionToken: string }> => {
    // Delete existing session for this user/device
    const existingSession = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .filter((q) => q.eq(q.field("device_id"), deviceId))
      .first();
    
    if (existingSession) {
      await ctx.db.delete(existingSession._id);
    }
    
    // Generate new session token
    const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
    const now = Date.now();
    const expiresAt = now + (30 * 60 * 1000); // 30 minutes
    
    // Create new session
    await ctx.db.insert("sessions", {
      user_id: userId,
      device_id: deviceId,
      access_token: sessionToken,
      expires_at: expiresAt,
      created_at: now,
      last_activity: now,
    });
    
    return { sessionToken };
  },
});



/**
 * Invalidates a session by its token
 * 
 * @param sessionToken - The session token to invalidate
 * @returns Success status
 */
export const invalidateSession = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }): Promise<{ success: boolean }> => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("access_token", sessionToken))
      .first();
    
    if (session) {
      await ctx.db.delete(session._id);
      return { success: true };
    }
    
    return { success: false };
  },
});

/**
 * Invalidates all sessions for a user
 * 
 * @param userId - The user ID
 * @returns Number of sessions invalidated
 */
export const invalidateAllUserSessions = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<{ count: number }> => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();
    
    await Promise.all(sessions.map(session => ctx.db.delete(session._id)));
    
    return { count: sessions.length };
  },
});

/**
 * Revokes a refresh token
 * 
 * @param refreshToken - The refresh token to revoke
 * @returns Success status
 */
export const revokeRefreshToken = mutation({
  args: { refreshToken: v.string() },
  handler: async (ctx, { refreshToken }): Promise<{ success: boolean }> => {
    const token = await ctx.db
      .query("refresh_tokens")
      .filter((q) => q.eq(q.field("token_hash"), refreshToken))
      .first();
    
    if (token) {
      await ctx.db.patch(token._id, { is_revoked: true });
      return { success: true };
    }
    
    return { success: false };
  },
});

/**
 * Revokes all refresh tokens for a user
 * 
 * @param userId - The user ID
 * @returns Number of tokens revoked
 */
export const revokeAllUserTokens = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<{ count: number }> => {
    const tokens = await ctx.db
      .query("refresh_tokens")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .filter((q) => q.eq(q.field("is_revoked"), false))
      .collect();
    
    await Promise.all(tokens.map(token => 
      ctx.db.patch(token._id, { is_revoked: true })
    ));
    
    return { count: tokens.length };
  },
});



/**
 * Internal query to get user by phone number
 * Used by validateCredentials action
 * 
 * @param phone - User's phone number
 * @returns User record with password hash
 */
export const getUserByPhoneInternal = internalQuery({
  args: { phone: v.string() },
  handler: async (ctx, { phone }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .first();
  },
});

/**
 * Gets user data by ID (excludes sensitive information)
 * 
 * @param userId - The user ID
 * @returns User data without password hash
 */
export const getUserById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    
    if (!user) {
      return null;
    }
    
    // Return user without sensitive fields
    const { password_hash, ...safeUser } = user;
    return safeUser;
  },
});

/**
 * Cleanup expired tokens (should be called periodically)
 * Removes expired sessions and refresh tokens
 * 
 * @returns Cleanup statistics
 */
export const cleanupExpiredTokens = mutation({
  args: {},
  handler: async (ctx): Promise<{ sessionsRemoved: number; tokensRemoved: number }> => {
    const now = Date.now();
    
    // Remove expired sessions
    const expiredSessions = await ctx.db
      .query("sessions")
      .filter((q) => q.lt(q.field("expires_at"), now))
      .collect();
    
    await Promise.all(expiredSessions.map(session => ctx.db.delete(session._id)));
    
    // Remove expired refresh tokens
    const expiredTokens = await ctx.db
      .query("refresh_tokens")
      .filter((q) => q.lt(q.field("expires_at"), now))
      .collect();
    
    await Promise.all(expiredTokens.map(token => ctx.db.delete(token._id)));
    
    return {
      sessionsRemoved: expiredSessions.length,
      tokensRemoved: expiredTokens.length,
    };
  },
});

export const getValidRefreshTokens = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("refresh_tokens")
      .filter((q) => 
        q.and(
          q.gt(q.field("expires_at"), Date.now()),
          q.eq(q.field("is_revoked"), false)
        )
      )
      .collect();
  },
});
