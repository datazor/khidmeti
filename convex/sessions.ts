// convex/sessions.ts
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { generateSecureToken } from "./lib/tokenGenerator";
import { Id } from "./_generated/dataModel";

/**
 * Generates a new session for an authenticated user.
 * 
 * Process:
 * 1. Validates that the user exists in the database
 * 2. Generates a secure session token using cryptographically secure randomness
 * 3. Creates a new session record with:
 *    - User ID reference
 *    - Device ID for device identification
 *    - Access token for authentication
 *    - Creation timestamp
 *    - Expiration timestamp (24 hours from creation)
 *    - Last activity timestamp
 * 4. Returns the access token for client storage
 * 
 * Security Note: Access tokens should be stored securely on the client
 * (HttpOnly cookies or secure local storage) and never in plain text.
 * Tokens are generated using cryptographically secure random number generation.
 * 
 * @param userId - The ID of the authenticated user
 * @param deviceId - The device identifier for this session
 * @returns Promise<{ sessionToken: string }> - The generated access token
 */
export const generateSession = mutation({
  args: {
    userId: v.string(),
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    // Verify user exists
    const user = await ctx.db.get(args.userId as Id<"users">);
    if (!user) {
      throw new Error("User not found");
    }

    // Generate secure access token (32 bytes = 64 hex characters)
    const accessToken = generateSecureToken(32);
    
    // Set expiration (24 hours from now)
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    
    // Create session record
    await ctx.db.insert("sessions", {
      user_id: args.userId as Id<"users">,
      device_id: args.deviceId,
      access_token: accessToken, // Use access_token to match schema
      created_at: Date.now(),
      expires_at: expiresAt,
      last_activity: Date.now(),
    });

    return { sessionToken: accessToken }; // Return consistent field name
  },
});