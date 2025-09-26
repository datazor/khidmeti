// convex/fileUpload.ts - File upload workflow for voice/photo messages
import { mutation, internalAction, internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// 1. Client calls this mutation to start upload
export const startFileUpload = mutation({
  args: {
    fileBlob: v.bytes(),
    fileName: v.string(),
    contentType: v.string(),
    fileType: v.union(v.literal("voice"), v.literal("photo")),
    userId: v.id("users"),
    uploadType: v.optional(v.union(v.literal("message"), v.literal("onboarding"))), // Add this line
  },
  handler: async (ctx, args) => {
    // Ensure voice files have .mp4 extension
    let finalFileName = args.fileName;
    if (args.fileType === "voice" && !finalFileName.includes('.')) {
      finalFileName = `${finalFileName}.mp4`;
    }
    
    // Create placeholder upload record
    const uploadRecordId = await ctx.db.insert("uploads", {
      status: "pending",
      fileName: finalFileName, // Use the modified filename
      contentType: args.fileType === "voice" ? "audio/mp4" : args.contentType, // Ensure correct MIME type
      fileType: args.fileType,
      userId: args.userId,
      uploadType: args.uploadType || "message", // Add this line
      created_at: Date.now(),
    });

    // Schedule internal action to handle storage
    await ctx.scheduler.runAfter(0, internal.fileUpload.storeFileAndGenerateUrl, {
      uploadRecordId,
      fileBlob: args.fileBlob,
      contentType: args.fileType === "voice" ? "audio/mp4" : args.contentType,
    });

    return uploadRecordId;
  },
});

// 2. Internal action stores file and gets URL
export const storeFileAndGenerateUrl = internalAction({
  args: {
    uploadRecordId: v.id("uploads"),
    fileBlob: v.bytes(),
    contentType: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Convert ArrayBuffer to Blob
      const blob = new Blob([args.fileBlob], { type: args.contentType });
      
      // Store file in Convex storage
      const storageId = await ctx.storage.store(blob);

      // Generate public URL
      const fileUrl = await ctx.storage.getUrl(storageId);
      
      if (!fileUrl) {
        throw new Error("Failed to generate file URL");
      }

      // Schedule mutation to complete upload
      await ctx.scheduler.runAfter(0, internal.fileUpload.completeFileUpload, {
        uploadRecordId: args.uploadRecordId,
        storageId: storageId,
        fileUrl: fileUrl,
      });

    } catch (error) {
      console.error("File storage failed:", error);
      
      // Mark upload as failed
      await ctx.scheduler.runAfter(0, internal.fileUpload.updateUploadStatus, {
        id: args.uploadRecordId,
        status: "failed",
        errorMessage: String(error),
      });
      
      throw error;
    }
  },
});

// 3. Internal mutation completes upload
export const completeFileUpload = internalMutation({
  args: {
    uploadRecordId: v.id("uploads"),
    storageId: v.string(),
    fileUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.uploadRecordId, {
      status: "completed",
      storageId: args.storageId,
      fileUrl: args.fileUrl,
      completed_at: Date.now(),
    });
  },
});

// 4. Internal mutation for error handling
export const updateUploadStatus = internalMutation({
  args: {
    id: v.id("uploads"),
    status: v.string(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      errorMessage: args.errorMessage,
      completed_at: Date.now(),
    });
  },
});

// 5. Query to get upload status
export const getUploadStatus = query({
  args: { id: v.id("uploads") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// convex/fileUpload.ts - Add this function to your existing file

/**
 * Get upload statuses for multiple upload IDs at once.
 * This is more efficient than making individual queries for each upload
 * when the UploadContext needs to track multiple concurrent uploads.
 * 
 * @param ctx - Convex query context
 * @param args - Object containing array of upload IDs to fetch
 * @returns Array of upload status objects with their current state
 * 
 * Usage in UploadContext:
 * - Called when activeUploads Map has multiple jobs
 * - Reduces query overhead vs individual getUploadStatus calls
 * - Returns only existing uploads (missing IDs are filtered out)
 */
export const getMultipleUploadStatuses = query({
  args: {
    ids: v.array(v.id("uploads"))
  },
  handler: async (ctx, { ids }) => {
    // Fetch all uploads in a single batch operation
    const uploads = await Promise.all(
      ids.map(id => ctx.db.get(id))
    );
    
    // Filter out null results (deleted/non-existent uploads)
    return uploads.filter(upload => upload !== null);
  },
});

/**
 * Alternative implementation using a single database query (more efficient for large batches):
 * 
 * export const getMultipleUploadStatuses = query({
 *   args: {
 *     ids: v.array(v.id("uploads"))
 *   },
 *   handler: async (ctx, { ids }) => {
 *     if (ids.length === 0) return [];
 *     
 *     // Single query with filter - more efficient for large ID arrays
 *     const uploads = await ctx.db
 *       .query("uploads")
 *       .filter(q => ids.includes(q.field("_id")))
 *       .collect();
 *     
 *     return uploads;
 *   },
 * });
 */
