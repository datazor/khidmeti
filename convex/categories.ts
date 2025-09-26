// convex/categories.ts - Complete implementation with subcategory support for worker jobs
import { query } from './_generated/server';
import { v } from 'convex/values';

/**
 * Gets all top-level categories (level 0) with localized names
 * Used for main category selection in customer interface
 */
export const getCategories = query({
  args: { 
    language: v.optional(v.union(v.literal("en"), v.literal("fr"), v.literal("ar")))
  },
  handler: async (ctx, args) => {
    const categories = await ctx.db
      .query('categories')
      .withIndex('by_level', (q) => q.eq('level', 0))
      .collect();
    
    const language = args.language || "en";
    
    return categories
      .map(category => ({
        ...category,
        name: category[`name_${language}`] || category.name_en
      }))
      .sort((a, b) => a.name.localeCompare(b.name, language));
  },
});

/**
 * Gets a specific category by ID with localized name
 * Used for displaying category details and navigation
 */
export const getCategoryById = query({
  args: { 
    categoryId: v.id('categories'),
    language: v.optional(v.union(v.literal("en"), v.literal("fr"), v.literal("ar")))
  },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.categoryId);
    if (!category) return null;
    
    const language = args.language || "en";
    
    return {
      ...category,
      name: category[`name_${language}`] || category.name_en
    };
  },
});

/**
 * Gets subcategories for a given parent category
 * Used by workers for job categorization in SubcategoryCarousel
 * Returns formatted data ready for UI consumption
 */
export const getSubcategories = query({
  args: { 
    categoryId: v.id('categories'),
    language: v.optional(v.union(v.literal("en"), v.literal("fr"), v.literal("ar")))
  },
  handler: async (ctx, args) => {
    const subcategories = await ctx.db
      .query('categories')
      .withIndex('by_parent', (q) => q.eq('parent_id', args.categoryId))
      .collect();
    
    const language = args.language || "en";
    
    return subcategories
      .map(subcategory => ({
        id: subcategory._id,
        nameEn: subcategory.name_en,
        nameFr: subcategory.name_fr,
        nameAr: subcategory.name_ar,
        name: subcategory[`name_${language}`] || subcategory.name_en, // Localized name
        photoUrl: subcategory.photo_url,
        requiresPhotos: subcategory.requires_photos,
        requiresWorkCode: subcategory.requires_work_code,
        level: subcategory.level,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, language));
  },
});

/**
 * Gets pricing baseline for a subcategory
 * Used for bid validation in worker interface
 * Returns pricing config or null if not configured
 */
export const getCategoryPricingBaseline = query({
  args: {
    subcategoryId: v.id('categories'),
  },
  handler: async (ctx, { subcategoryId }) => {
    const pricing = await ctx.db
      .query('category_pricing')
      .withIndex('by_subcategory', (q) => q.eq('subcategory_id', subcategoryId))
      .first();

    if (!pricing) {
      return null;
    }

    return {
      subcategoryId: pricing.subcategory_id,
      baselinePrice: pricing.baseline_price,
      minimumPercentage: pricing.minimum_percentage,
      minimumAmount: Math.floor((pricing.baseline_price * pricing.minimum_percentage) / 100),
      updatedAt: pricing.updated_at,
    };
  },
});

/**
 * Gets all subcategories for multiple parent categories
 * Used when workers need to see subcategories across different main categories
 * Useful for bulk operations or admin interfaces
 */
export const getSubcategoriesForCategories = query({
  args: {
    categoryIds: v.array(v.id('categories')),
    language: v.optional(v.union(v.literal("en"), v.literal("fr"), v.literal("ar")))
  },
  handler: async (ctx, { categoryIds, language = "en" }) => {
    const subcategoriesMap = new Map();
    
    for (const categoryId of categoryIds) {
      const subcategories = await ctx.db
        .query('categories')
        .withIndex('by_parent', (q) => q.eq('parent_id', categoryId))
        .collect();
      
      const formattedSubcategories = subcategories.map(subcategory => ({
        id: subcategory._id,
        parentId: categoryId,
        nameEn: subcategory.name_en,
        nameFr: subcategory.name_fr,
        nameAr: subcategory.name_ar,
        name: subcategory[`name_${language}`] || subcategory.name_en,
        photoUrl: subcategory.photo_url,
        requiresPhotos: subcategory.requires_photos,
        requiresWorkCode: subcategory.requires_work_code,
        level: subcategory.level,
      }));
      
      subcategoriesMap.set(categoryId, formattedSubcategories);
    }
    
    return Object.fromEntries(subcategoriesMap);
  },
});

/**
 * Gets category hierarchy with all levels
 * Used for admin interfaces and comprehensive category management
 * Returns nested structure showing parent-child relationships
 */
export const getCategoryHierarchy = query({
  args: {
    language: v.optional(v.union(v.literal("en"), v.literal("fr"), v.literal("ar")))
  },
  handler: async (ctx, { language = "en" }) => {
    // Get all categories
    const allCategories = await ctx.db
      .query('categories')
      .collect();
    
    // Group by level for easier processing
    const categoriesByLevel = allCategories.reduce((acc, category) => {
      if (!acc[category.level]) acc[category.level] = [];
      acc[category.level].push({
        ...category,
        name: category[`name_${language}`] || category.name_en
      });
      return acc;
    }, {} as Record<number, any[]>);
    
    // Build hierarchy starting from level 0
    const buildHierarchy = (parentId: string | null = null, level = 0): any[] => {
      const categories = categoriesByLevel[level] || [];
      return categories
        .filter(cat => cat.parent_id === parentId)
        .map(category => ({
          ...category,
          children: buildHierarchy(category._id, level + 1)
        }))
        .sort((a, b) => a.name.localeCompare(b.name, language));
    };
    
    return buildHierarchy();
  },
});