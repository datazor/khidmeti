import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Updates message status when it's delivered to recipient
 * Called when recipient's chat loads the message
 */
export const markMessageAsDelivered = mutation({
  args: {
    messageId: v.id("messages"),
    recipientId: v.id("users"),
  },
  handler: async (ctx, { messageId, recipientId }) => {
    const message = await ctx.db.get(messageId);
    if (!message) return;

    // Only mark as delivered if sender is not the recipient
    if (message.sender_id !== recipientId && message.status === "sent") {
      await ctx.db.patch(messageId, {
        status: "delivered",
        delivered_at: Date.now(),
      });
    }
  },
});

/**
 * Updates message status when recipient reads the message
 * Called when message appears in viewport
 */
export const markMessageAsRead = mutation({
  args: {
    messageId: v.id("messages"),
    recipientId: v.id("users"),
  },
  handler: async (ctx, { messageId, recipientId }) => {
    const message = await ctx.db.get(messageId);
    if (!message) return;

    // Only mark as read if sender is not the recipient
    if (message.sender_id !== recipientId && 
        (message.status === "delivered" || message.status === "sent")) {
      await ctx.db.patch(messageId, {
        status: "read",
        read_at: Date.now(),
      });
    }
  },
});

/**
 * Batch mark multiple messages as delivered for performance
 */
export const markMessagesAsDelivered = mutation({
  args: {
    messageIds: v.array(v.id("messages")),
    recipientId: v.id("users"),
  },
  handler: async (ctx, { messageIds, recipientId }) => {
    const timestamp = Date.now();
    
    for (const messageId of messageIds) {
      const message = await ctx.db.get(messageId);
      if (message && message.sender_id !== recipientId && message.status === "sent") {
        await ctx.db.patch(messageId, {
          status: "delivered",
          delivered_at: timestamp,
        });
      }
    }
  },
});
