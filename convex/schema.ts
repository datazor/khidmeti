import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // CORE TABLES
  users: defineTable({
    phone: v.string(),
    password_hash: v.string(),
    name: v.string(),
    user_type: v.union(v.literal("customer"), v.literal("worker")),
    rating: v.optional(v.number()),
    balance: v.number(),
    location_lat: v.optional(v.number()),
    location_lng: v.optional(v.number()),
    photo_url: v.optional(v.string()), // Profile photo for workers
    photo_storage_id: v.optional(v.string()),
    approval_status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected")
    ),
    rejection_reason: v.optional(v.string()),
    cancellation_count: v.number(),
    priority_score: v.number(),
    created_at: v.number(),
    onboarding_status: v.union(
      v.literal("not_started"),
      v.literal("selfie_completed"),
      v.literal("documents_completed"),
      v.literal("categories_completed"),
      v.literal("additional_files_completed"),
      v.literal("completed")
    ),
    onboarding_completed_at: v.optional(v.number()),
    selfie_url: v.optional(v.string()), // Selfie for ID verification
    selfie_storage_id: v.optional(v.string()),
    current_onboarding_step: v.optional(v.number()),
  }).index("by_phone", ["phone"])
    .index("by_type_status", ["user_type", "approval_status"])
    .index("by_location", ["location_lat", "location_lng"])
    .index("by_onboarding_status", ["user_type", "onboarding_status"]),

  sessions: defineTable({
    user_id: v.id("users"),
    device_id: v.string(),
    access_token: v.string(),
    expires_at: v.number(),
    created_at: v.number(),
    last_activity: v.number(),
  }).index("by_user", ["user_id"])
    .index("by_token", ["access_token"]),

  refresh_tokens: defineTable({
    user_id: v.id("users"),
    token_hash: v.string(),
    expires_at: v.number(),
    is_revoked: v.boolean(),
    created_at: v.number(),
  }).index("by_user", ["user_id"]),

  otps: defineTable({
    phone: v.string(),
    token_hash: v.string(),
    expires_at: v.number(),
    attempts: v.number(),
    is_verified: v.boolean(),
    created_at: v.number(),
  }).index("by_phone", ["phone"]),

  user_documents: defineTable({
    user_id: v.id("users"),
    document_type: v.union(
      v.literal("id_front"),
      v.literal("id_back"),
      v.literal("passport"),
      v.literal("residency_permit_front"),
      v.literal("residency_permit_back"),
      v.literal("certification"),
      v.literal("license"),
      v.literal("additional_file")
    ), file_url: v.string(),
    verification_status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected")
    ),

    created_at: v.number(),
  }).index("by_user", ["user_id"]),

  // convex/schema.ts - Update categories table
  categories: defineTable({
    parent_id: v.optional(v.id("categories")),
    name_en: v.string(),
    name_fr: v.string(),
    name_ar: v.string(),
    photo_url: v.string(), // Add this for category images
    requires_photos: v.boolean(),
    requires_work_code: v.boolean(),
    level: v.number(),
  }).index("by_level", ["level"])
    .index("by_parent", ["parent_id"]),

  user_skills: defineTable({
    user_id: v.id("users"),
    category_id: v.id("categories"),
    experience_rating: v.optional(v.number()), // 1-5 star rating for the category
  }).index("by_user", ["user_id"])
    .index("by_category", ["category_id"]),

  geographic_zones: defineTable({
    name: v.string(),
    polygon_coordinates: v.array(v.object({
      lat: v.number(),
      lng: v.number()
    })),
    price_multiplier: v.number(),
  }),

  jobs: defineTable({
  customer_id: v.id("users"),
  category_id: v.id("categories"),
  subcategory_id: v.optional(v.id("categories")),
  voice_url: v.optional(v.string()),
  photos: v.array(v.string()),
  location_lat: v.number(),
  location_lng: v.number(),
  work_code: v.optional(v.string()),
  onboarding_code: v.optional(v.string()),
  completion_code: v.optional(v.string()),
  portfolio_consent: v.boolean(),
  price_floor: v.number(),
  voice_duration: v.optional(v.number()),
  cancelled_at: v.optional(v.number()),
  cancelled_at_phase: v.optional(v.union(
    v.literal("bidding"),
    v.literal("matched"),
    v.literal("in_progress")
  )),
  status: v.union(
    v.literal("posted"),
    v.literal("matched"),
    v.literal("in_progress"),
    v.literal("completed"),
    v.literal("cancelled")
  ),
  worker_id: v.optional(v.id("users")),
  matched_at: v.optional(v.number()),
  categorizer_worker_ids: v.array(v.id("users")),
  broadcasting_phase: v.number(),
  categorizer_group_size: v.optional(v.number()), // NEW
  subcategory_ids: v.optional(v.array(v.id("categories"))), // NEW
  created_at: v.number(),
}).index("by_category_status", ["category_id", "status", "created_at"])
  .index("by_location", ["location_lat", "location_lng"])
  .index("by_customer", ["customer_id"]),

  job_categorizations: defineTable({
  job_id: v.id("jobs"),
  worker_id: v.id("users"),
  suggested_subcategory_id: v.id("categories"),
  created_at: v.number(),
}).index("by_job", ["job_id"])
  .index("by_worker", ["worker_id"])
  .index("by_job_worker", ["job_id", "worker_id"]), // NEW

  bids: defineTable({
    job_id: v.id("jobs"),
    worker_id: v.id("users"),
    amount: v.number(),
    equipment_cost: v.number(),
    expires_at: v.number(),
    priority_window_end: v.number(),
    status: v.optional(v.union(v.literal("pending"), v.literal("accepted"), v.literal("rejected"))),
    accepted_at: v.optional(v.number()),
    rejected_at: v.optional(v.number()),
    created_at: v.number(),
  }).index("by_job", ["job_id"])
    .index("by_worker", ["worker_id", "created_at"])
    .index("by_job_worker", ["job_id", "worker_id"]),

  // COMMUNICATION
  chats: defineTable({
    category_id: v.id("categories"), // Added for category-based chat creation
    job_id: v.optional(v.id("jobs")), // Made optional - set when job created
    customer_id: v.optional(v.id("users")),
    worker_id: v.optional(v.id("users")), // Made optional - set when worker assigned
    banner_info: v.optional(v.string()),
    is_cleared: v.boolean(),
    created_at: v.number(),
  }).index("by_job", ["job_id"])
    .index("by_customer", ["customer_id"])
    .index("by_worker", ["worker_id"])
    .index("by_category", ["category_id"]),

  message_partitions: defineTable({
    chat_id: v.id("chats"),
    year_month: v.string(), // "2024-01"
    message_count: v.number(),
    created_at: v.number(),
  }).index("by_chat", ["chat_id"]),

  messages: defineTable({
    chat_id: v.id("chats"),
    year_month: v.string(),
    sender_id: v.id("users"),
    bubble_type: v.string(),
    content: v.string(),
    metadata: v.optional(v.any()),
    is_dismissed: v.boolean(),
    is_expired: v.boolean(), // ADD THIS LINE
    created_at: v.number(),
    status: v.optional(v.union(
      v.literal("sending"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("read"),
      v.literal("failed")
    )),
    delivered_at: v.optional(v.number()),
    read_at: v.optional(v.number()),
  }).index("by_chat_partition", ["chat_id", "year_month", "created_at"]),

  // SYSTEM
  transactions: defineTable({
    user_id: v.id("users"),
    amount: v.number(),
    type: v.union(
      v.literal("credit"),
      v.literal("debit"),
      v.literal("commission")
    ),
    balance_after: v.number(),
    created_at: v.number(),
  }).index("by_user", ["user_id"]),

  ratings: defineTable({
    rater_id: v.id("users"),
    rated_id: v.id("users"),
    job_id: v.id("jobs"),
    rating: v.number(),
    review_text: v.optional(v.string()),
    created_at: v.number(),
  }).index("by_rated", ["rated_id"])
    .index("by_job", ["job_id"]),

  configs: defineTable({
    key: v.string(),
    value: v.string(),
    category: v.string(),
    description: v.string(),
  }).index("by_key", ["key"])
    .index("by_category", ["category"]),

  // convex/schema.ts
  uploads: defineTable({
    status: v.string(),
    fileName: v.string(),
    contentType: v.string(),
    fileType: v.union(v.literal("voice"), v.literal("photo")),
    userId: v.id("users"),
    uploadType: v.optional(v.string()), // Add this line
    storageId: v.optional(v.string()),
    fileUrl: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    created_at: v.number(),
    completed_at: v.optional(v.number()),
  }),

  job_views: defineTable({
    job_id: v.id("jobs"),
    worker_id: v.id("users"),
    viewed_at: v.number(),
  }).index("by_job", ["job_id"])
    .index("by_worker", ["worker_id"]),

  job_cancellations: defineTable({
    job_id: v.id("jobs"),
    cancelled_by: v.id("users"),
    phase: v.union(
      v.literal("bidding"),
      v.literal("matched"),
      v.literal("in_progress")
    ),
    cancelled_at: v.number(),
  }).index("by_job", ["job_id"])
    .index("by_user", ["cancelled_by"]),

   worker_configs: defineTable({
  max_categories: v.number(),
  created_at: v.number(),
  updated_at: v.number(),
}).index("by_updated", ["updated_at"]), 

// Expert categorizers designated by admins
expert_categorizers: defineTable({
  category_id: v.id("categories"),
  worker_id: v.id("users"),
  designated_by: v.id("users"), // admin who added them
  created_at: v.number(),
}).index("by_category", ["category_id"])
  .index("by_worker", ["worker_id"]),

// Pricing baselines for auction protection  
category_pricing: defineTable({
  subcategory_id: v.id("categories"),
  baseline_price: v.number(),
  minimum_percentage: v.number(), // e.g. 70
  updated_by: v.id("users"),
  updated_at: v.number(),
}).index("by_subcategory", ["subcategory_id"]),


system_settings: defineTable({
  setting_key: v.string(),
  setting_value: v.string(),
  created_at: v.number(),
  updated_at: v.number(),
}).index("by_key", ["setting_key"]),  
});
