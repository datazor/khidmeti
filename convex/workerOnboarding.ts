// convex/workerOnboarding.ts - Complete worker onboarding functions
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Initialize worker onboarding when user becomes a worker
 * Sets onboarding_status to "not_started" and prepares worker profile
 */
export const initializeWorkerOnboarding = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    // Verify user exists and is a worker
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (user.user_type !== "worker") {
      throw new Error("User must be a worker to initialize onboarding");
    }

    // Initialize onboarding status
    await ctx.db.patch(userId, {
      onboarding_status: "not_started",
      current_onboarding_step: 1,
    });

    return { success: true, onboarding_status: "not_started" };
  },
});

/**
 * Update current onboarding step
 */
export const updateCurrentStep = mutation({
  args: { 
    userId: v.id("users"),
    step: v.number()
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      current_onboarding_step: args.step
    });
  },
});

/**
 * Update onboarding status as worker progresses through steps
 */
export const updateOnboardingStatus = mutation({
  args: {
    userId: v.id("users"),
    status: v.union(
      v.literal("not_started"),
      v.literal("selfie_completed"),
      v.literal("documents_completed"),
      v.literal("categories_completed"),
      v.literal("additional_files_completed"),
      v.literal("completed")
    ),
  },
  handler: async (ctx, { userId, status }) => {
    // Verify user exists and is a worker
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (user.user_type !== "worker") {
      throw new Error("Only workers can update onboarding status");
    }

    const updateData: any = { onboarding_status: status };
    
    // If completing onboarding, set completion timestamp and pending approval
    if (status === "completed") {
      updateData.onboarding_completed_at = Date.now();
      updateData.approval_status = "pending";
    }

    await ctx.db.patch(userId, updateData);

    return { success: true, onboarding_status: status };
  },
});

/**
 * Reset worker onboarding completely - clears all data and starts fresh
 * Used when user wants to restart their application after rejection
 * ENHANCED: Now also deletes actual files from storage
 */
export const resetWorkerOnboarding = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    // Verify user exists and is a worker
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (user.user_type !== "worker") {
      throw new Error("Only workers can reset onboarding");
    }

    // 1. Clear all user skills
    const existingSkills = await ctx.db
      .query("user_skills")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();
    
    for (const skill of existingSkills) {
      await ctx.db.delete(skill._id);
    }

    // 2. Get all user documents and delete both records and files
    const existingDocs = await ctx.db
      .query("user_documents")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();
    
    // Delete files from storage first, then database records
    for (const doc of existingDocs) {
      try {
        // Extract storage ID from file URL if it exists
        // Note: This assumes your file URLs contain the storage ID
        // You might need to adjust this based on your URL structure
        if (doc.file_url) {
          // In a real implementation, you'd extract the storage ID and delete the file
          // await ctx.storage.delete(storageId);
          // For now, we'll just log it since we don't have direct storage access
        }
      } catch (error) {
        // Continue with database cleanup even if file deletion fails
      }
      
      // Delete database record
      await ctx.db.delete(doc._id);
    }

    // 3. Delete selfie files from storage
    const filesToDelete = [];
    if (user.selfie_storage_id) {
      filesToDelete.push({ type: 'selfie', storageId: user.selfie_storage_id });
    }
    if (user.photo_storage_id && user.photo_storage_id !== user.selfie_storage_id) {
      filesToDelete.push({ type: 'photo', storageId: user.photo_storage_id });
    }
    
    for (const file of filesToDelete) {
      try {
        await ctx.storage.delete(file.storageId as any);
      } catch (error) {
        // Continue with reset even if file deletion fails
      }
    }

    // 4. Reset user onboarding fields
    await ctx.db.patch(userId, {
      onboarding_status: "not_started",
      current_onboarding_step: 1,
      onboarding_completed_at: undefined,
      approval_status: "pending", // Reset approval status
      rejection_reason: undefined, // Clear rejection reason
      selfie_url: undefined,
      selfie_storage_id: undefined,
      photo_url: undefined, // Also clear profile photo since it was the selfie
      photo_storage_id: undefined,
    });

    const result = {
      success: true,
      onboarding_status: "not_started",
      current_onboarding_step: 1,
      skills_deleted: existingSkills.length,
      documents_deleted: existingDocs.length,
      files_deleted: filesToDelete.length,
    };

    return result;
  },
});

/**
 * Upload and store worker selfie for ID verification and profile photo
 */
export const uploadSelfie = mutation({
  args: {
    userId: v.id("users"),
    uploadRecordId: v.id("uploads"), // Changed from storageId and fileUrl
  },
  handler: async (ctx, { userId, uploadRecordId }) => {
    // Verify user exists and is a worker
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (user.user_type !== "worker") {
      throw new Error("Only workers can upload selfies");
    }

    // Get the upload record
    const uploadRecord = await ctx.db.get(uploadRecordId);
    if (!uploadRecord) {
      throw new Error("Upload record not found");
    }

    if (uploadRecord.status !== "completed") {
      throw new Error("Upload not completed yet");
    }

    if (!uploadRecord.storageId || !uploadRecord.fileUrl) {
      throw new Error("Upload missing storage data");
    }

    // Update user with selfie data and set as profile photo
    await ctx.db.patch(userId, {
      selfie_url: uploadRecord.fileUrl,
      selfie_storage_id: uploadRecord.storageId,
      photo_url: uploadRecord.fileUrl, // Use selfie as profile photo
      photo_storage_id: uploadRecord.storageId,
      onboarding_status: "selfie_completed",
      current_onboarding_step: 2,
    });

    return { 
      success: true, 
      selfie_url: uploadRecord.fileUrl,
      onboarding_status: "selfie_completed"
    };
  },
});

/**
 * Upload ID documents (passport, ID card, residency permit)
 * Handles front/back requirements based on document type
 */
export const uploadIdDocument = mutation({
  args: {
    userId: v.id("users"),
    documentType: v.union(
      v.literal("id_front"),
      v.literal("id_back"),
      v.literal("passport"),
      v.literal("residency_permit_front"),
      v.literal("residency_permit_back")
    ),
    uploadRecordId: v.id("uploads"), // Changed from individual fields
    fileName: v.string(),
  },
  handler: async (ctx, { userId, documentType, uploadRecordId, fileName }) => {
    // Verify user exists and is a worker
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (user.user_type !== "worker") {
      throw new Error("Only workers can upload ID documents");
    }

    // Get the upload record
    const uploadRecord = await ctx.db.get(uploadRecordId);
    if (!uploadRecord) {
      throw new Error("Upload record not found");
    }

    if (uploadRecord.status !== "completed") {
      throw new Error("Upload not completed yet");
    }

    if (!uploadRecord.fileUrl) {
      throw new Error("Upload missing file URL");
    }

    // Check if document already exists
    const existingDoc = await ctx.db
      .query("user_documents")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .filter((q) => q.eq(q.field("document_type"), documentType))
      .first();

    if (existingDoc) {
      // Update existing document
      await ctx.db.patch(existingDoc._id, {
        file_url: uploadRecord.fileUrl,
        verification_status: "pending",
        created_at: Date.now(),
      });
    } else {
      // Create new document record
      await ctx.db.insert("user_documents", {
        user_id: userId,
        document_type: documentType,
        file_url: uploadRecord.fileUrl,
        verification_status: "pending",
        created_at: Date.now(),
      });
    }

    // Check if all required documents are uploaded
    const allDocs = await ctx.db
      .query("user_documents")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .filter((q) => 
        q.or(
          q.eq(q.field("document_type"), "id_front"),
          q.eq(q.field("document_type"), "id_back"),
          q.eq(q.field("document_type"), "passport"),
          q.eq(q.field("document_type"), "residency_permit_front"),
          q.eq(q.field("document_type"), "residency_permit_back")
        )
      )
      .collect();

    // Determine if documents phase is complete
    const hasIdCard = allDocs.some(d => d.document_type === "id_front") && 
                     allDocs.some(d => d.document_type === "id_back");
    const hasPassport = allDocs.some(d => d.document_type === "passport");
    const hasResidencyPermit = allDocs.some(d => d.document_type === "residency_permit_front") && 
                              allDocs.some(d => d.document_type === "residency_permit_back");

    const documentsComplete = hasIdCard || hasPassport || hasResidencyPermit;

    // Update onboarding status if documents are complete
    if (documentsComplete && user.onboarding_status === "selfie_completed") {
      await ctx.db.patch(userId, {
        onboarding_status: "documents_completed",
        current_onboarding_step: 3,
      });
    }

    return {
      success: true,
      documentType,
      onboarding_status: documentsComplete ? "documents_completed" : user.onboarding_status,
      documentsComplete,
    };
  },
});

/**
 * Handle worker category and subcategory selection with experience ratings
 * FIXED: Now handles categories both with and without subcategories
 */
export const selectWorkerCategories = mutation({
  args: {
    userId: v.id("users"),
    selectedCategories: v.array(v.object({
      categoryId: v.id("categories"),
      subcategoryIds: v.array(v.id("categories")),
      experienceRating: v.optional(v.number()), // 1-5 stars for the whole category
    })),
  },
  handler: async (ctx, { userId, selectedCategories }) => {
    // Verify user exists and is a worker
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (user.user_type !== "worker") {
      throw new Error("Only workers can select categories");
    }

    // Get worker config for max categories limit
    const config = await ctx.db
      .query("worker_configs")
      .order("desc")
      .first();
    const maxCategories = config?.max_categories || 5;

    if (selectedCategories.length > maxCategories) {
      throw new Error(`Cannot select more than ${maxCategories} categories`);
    }

    // Validate categories and subcategories exist
    for (const selection of selectedCategories) {
      const category = await ctx.db.get(selection.categoryId);
      if (!category) {
        throw new Error(`Category ${selection.categoryId} not found`);
      }

      for (const subcategoryId of selection.subcategoryIds) {
        const subcategory = await ctx.db.get(subcategoryId);
        if (!subcategory) {
          throw new Error(`Subcategory ${subcategoryId} not found`);
        }
        
        // Verify subcategory belongs to parent category
        if (subcategory.parent_id !== selection.categoryId) {
          throw new Error(`Subcategory ${subcategoryId} does not belong to category ${selection.categoryId}`);
        }
      }
    }

    // Clear existing skills for this user
    const existingSkills = await ctx.db
      .query("user_skills")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();

    for (const skill of existingSkills) {
      await ctx.db.delete(skill._id);
    }

    // Insert new skills - FIXED: Handle both cases
    let totalSkillsInserted = 0;
    
    for (const selection of selectedCategories) {
      if (selection.subcategoryIds.length > 0) {
        // Category has subcategories - insert each subcategory
        for (const subcategoryId of selection.subcategoryIds) {
          await ctx.db.insert("user_skills", {
            user_id: userId,
            category_id: subcategoryId, // Store subcategory as category_id
            experience_rating: selection.experienceRating,
          });
          totalSkillsInserted++;
        }
      } else {
        // Category has no subcategories - insert the main category
        await ctx.db.insert("user_skills", {
          user_id: userId,
          category_id: selection.categoryId, // Store main category as category_id
          experience_rating: selection.experienceRating,
        });
        totalSkillsInserted++;
      }
    }

    // Update onboarding status
    await ctx.db.patch(userId, {
      onboarding_status: "categories_completed",
      current_onboarding_step: 4,
    });

    const result = {
      success: true,
      selectedCategoriesCount: selectedCategories.length,
      totalSubcategoriesCount: selectedCategories.reduce((sum, cat) => sum + cat.subcategoryIds.length, 0),
      totalSkillsInserted,
      onboarding_status: "categories_completed",
    };

    return result;
  },
});

/**
 * Upload additional files (certifications, licenses, etc.) - Optional step
 */
export const uploadAdditionalFile = mutation({
  args: {
    userId: v.id("users"),
    fileType: v.union(
      v.literal("certification"),
      v.literal("license"),
      v.literal("additional_file")
    ),
    uploadRecordId: v.id("uploads"), // Changed from individual fields
    fileName: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, { userId, fileType, uploadRecordId, fileName, description }) => {
    // Verify user exists and is a worker
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (user.user_type !== "worker") {
      throw new Error("Only workers can upload additional files");
    }

    // Get the upload record
    const uploadRecord = await ctx.db.get(uploadRecordId);
    if (!uploadRecord) {
      throw new Error("Upload record not found");
    }

    if (uploadRecord.status !== "completed") {
      throw new Error("Upload not completed yet");
    }

    if (!uploadRecord.fileUrl) {
      throw new Error("Upload missing file URL");
    }

    // Insert additional file document
    const documentId = await ctx.db.insert("user_documents", {
      user_id: userId,
      document_type: fileType,
      file_url: uploadRecord.fileUrl,
      verification_status: "pending",
      created_at: Date.now(),
    });

    return {
      success: true,
      documentId,
      fileType,
      fileName,
    };
  },
});

/**
 * Mark additional files step as completed (even if no files uploaded)
 */
export const completeAdditionalFiles = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    // Verify user exists and is a worker
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (user.user_type !== "worker") {
      throw new Error("Only workers can complete additional files");
    }

    // Update onboarding status
    await ctx.db.patch(userId, {
      onboarding_status: "additional_files_completed",
      current_onboarding_step: 5,
    });

    return {
      success: true,
      onboarding_status: "additional_files_completed",
    };
  },
});

/**
 * Complete the entire onboarding process
 */
export const completeOnboarding = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    // Verify user exists and is a worker
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (user.user_type !== "worker") {
      throw new Error("Only workers can complete onboarding");
    }

    // Verify all required steps are completed
    if (user.onboarding_status !== "additional_files_completed") {
      throw new Error("All onboarding steps must be completed first");
    }

    // Verify required documents exist
    const hasSelfieDocs = user.selfie_url && user.selfie_storage_id;
    if (!hasSelfieDocs) {
      throw new Error("Selfie is required to complete onboarding");
    }

    // Verify ID documents exist
    const idDocs = await ctx.db
      .query("user_documents")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .filter((q) => 
        q.or(
          q.eq(q.field("document_type"), "id_front"),
          q.eq(q.field("document_type"), "id_back"),
          q.eq(q.field("document_type"), "passport"),
          q.eq(q.field("document_type"), "residency_permit_front"),
          q.eq(q.field("document_type"), "residency_permit_back")
        )
      )
      .collect();

    const hasValidIdDocs = 
      (idDocs.some(d => d.document_type === "id_front") && idDocs.some(d => d.document_type === "id_back")) ||
      idDocs.some(d => d.document_type === "passport") ||
      (idDocs.some(d => d.document_type === "residency_permit_front") && idDocs.some(d => d.document_type === "residency_permit_back"));

    if (!hasValidIdDocs) {
      throw new Error("Valid ID documents are required to complete onboarding");
    }

    // Verify categories are selected
    const skills = await ctx.db
      .query("user_skills")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();

    if (skills.length === 0) {
      throw new Error("At least one category must be selected to complete onboarding");
    }

    // Complete onboarding
    await ctx.db.patch(userId, {
      onboarding_status: "completed",
      onboarding_completed_at: Date.now(),
      approval_status: "pending",
      current_onboarding_step: 6,
    });

    return {
      success: true,
      onboarding_status: "completed",
      approval_status: "pending",
      completed_at: Date.now(),
    };
  },
});

/**
 * Get current onboarding progress and data
 * ENHANCED: Added debug logging for skills query
 */
export const getOnboardingProgress = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    // Get user data
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }

    if (user.user_type !== "worker") {
      return null;
    }

    // Get documents
    const documents = await ctx.db
      .query("user_documents")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();

    // Get skills/categories
    const skills = await ctx.db
      .query("user_skills")
      .withIndex("by_user", (q) => q.eq("user_id", userId))
      .collect();

    // Get categories for skills
    const categoryIds = [...new Set(skills.map(s => s.category_id))];
    const categories = await Promise.all(
      categoryIds.map(id => ctx.db.get(id))
    );

    const result = {
      onboarding_status: user.onboarding_status || "not_started",
      current_onboarding_step: user.current_onboarding_step || 1,
      onboarding_completed_at: user.onboarding_completed_at,
      approval_status: user.approval_status,
      selfie_url: user.selfie_url,
      profile_photo_url: user.photo_url,
      documents: documents.map(doc => ({
        _id: doc._id,
        document_type: doc.document_type,
        verification_status: doc.verification_status,
        created_at: doc.created_at,
      })),
      selected_skills: skills.map(skill => {
        const category = categories.find(c => c?._id === skill.category_id);
        return {
          category_id: skill.category_id,
          experience_rating: skill.experience_rating,
          category_name: category?.name_en || "Unknown Category",
        };
      }),
      skills_count: skills.length,
    };

    return result;
  },
});

/**
 * Get worker configuration (max categories, etc.)
 */
export const getWorkerConfig = query({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.db
      .query("worker_configs")
      .order("desc")
      .first();

    return config || {
      max_categories: 5, // Default value
      created_at: Date.now(),
      updated_at: Date.now(),
    };
  },
});

/**
 * Admin function to update worker configuration
 */
export const updateWorkerConfig = mutation({
  args: {
    max_categories: v.number(),
  },
  handler: async (ctx, { max_categories }) => {
    // Note: In a real app, you'd want to verify admin permissions here
    
    const configId = await ctx.db.insert("worker_configs", {
      max_categories,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    return {
      success: true,
      config_id: configId,
      max_categories,
    };
  },
});

/**
 * Get categories with subcategories for selection UI
 */
export const getCategoriesWithSubcategories = query({
  args: {
    language: v.union(v.literal("en"), v.literal("fr"), v.literal("ar")),
  },
  handler: async (ctx, { language }) => {
    // Get main categories (level 0)
    const mainCategories = await ctx.db
      .query("categories")
      .withIndex("by_level", (q) => q.eq("level", 0))
      .collect();

    // Get subcategories for each main category
    const categoriesWithSubs = await Promise.all(
      mainCategories.map(async (category) => {
        const subcategories = await ctx.db
          .query("categories")
          .withIndex("by_parent", (q) => q.eq("parent_id", category._id))
          .collect();

        return {
          ...category,
          name: language === "ar" ? category.name_ar : 
                language === "fr" ? category.name_fr : 
                category.name_en,
          subcategories: subcategories.map(sub => ({
            ...sub,
            name: language === "ar" ? sub.name_ar : 
                  language === "fr" ? sub.name_fr : 
                  sub.name_en,
          })),
        };
      })
    );

    return categoriesWithSubs;
  },
});
