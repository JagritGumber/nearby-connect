import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { Context } from "hono";
import { users, marketplaceListings } from "../db/schema";
import { getCurrentUser } from "./auth";
import { DefaultContext } from "../types/context";

export interface CreateListingData {
  title: string;
  description: string;
  price: number;
  category?: string;
  condition?: "new" | "like_new" | "good" | "fair" | "poor";
  imageUrls?: string[];
  latitude?: number;
  longitude?: number;
  address?: string;
}

export interface UpdateListingData {
  title?: string;
  description?: string;
  price?: number;
  category?: string;
  condition?: "new" | "like_new" | "good" | "fair" | "poor";
  imageUrls?: string[];
  latitude?: number;
  longitude?: number;
  address?: string;
  status?: "active" | "sold" | "deleted";
}

export interface MarketplaceFilters {
  category?: string;
  condition?: string;
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  radius?: number; // in kilometers
  status?: "active" | "sold";
  limit?: number;
  offset?: number;
}

export interface MarketplaceListingResult {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string | null;
  condition: string | null;
  imageUrls: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  status: "active" | "sold" | "deleted";
  viewCount: number;
  createdAt: number;
  updatedAt: number;
  seller?: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatar: string | null;
  };
  distance?: number; // calculated distance in km
}

/**
 * Calculate distance between two geographical points using Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in kilometers
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Create a new marketplace listing
 * @param c Hono context
 * @param data Listing creation data
 * @returns Created listing result
 */
export const createListing = async (
  c: Context<DefaultContext>,
  data: CreateListingData
): Promise<MarketplaceListingResult> => {
  const currentUser = getCurrentUser(c);
  const db = c.get("db");

  if (!currentUser) {
    throw new Error("User not authenticated");
  }

  const {
    title,
    description,
    price,
    category,
    condition,
    imageUrls,
    latitude,
    longitude,
    address,
  } = data;

  // Validate required fields
  if (!title || title.trim().length === 0) {
    throw new Error("Title is required");
  }

  if (!description || description.trim().length === 0) {
    throw new Error("Description is required");
  }

  if (!price || price <= 0) {
    throw new Error("Price must be greater than 0");
  }

  if (title.length > 200) {
    throw new Error("Title must be less than 200 characters");
  }

  if (description.length > 2000) {
    throw new Error("Description must be less than 2000 characters");
  }

  try {
    // Create new listing
    const newListing = {
      id: crypto.randomUUID(),
      sellerId: currentUser.id,
      title: title.trim(),
      description: description.trim(),
      price,
      category: category?.trim() || null,
      condition,
      imageUrls: imageUrls ? JSON.stringify(imageUrls) : null,
      latitude,
      longitude,
      address: address?.trim() || null,
      status: "active" as const,
      viewCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db
      .insert(marketplaceListings)
      .values(newListing)
      .returning();

    const createdListing = result[0];

    // Get seller details for response
    const sellerDetails = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatar: users.avatar,
      })
      .from(users)
      .where(eq(users.id, currentUser.id))
      .limit(1);

    return {
      id: createdListing.id,
      title: createdListing.title,
      description: createdListing.description,
      price: createdListing.price,
      category: createdListing.category,
      condition: createdListing.condition,
      imageUrls: createdListing.imageUrls,
      latitude: createdListing.latitude,
      longitude: createdListing.longitude,
      address: createdListing.address,
      status:
        (createdListing.status as "active" | "sold" | "deleted") || "active",
      viewCount: createdListing.viewCount || 0,
      createdAt: Number(createdListing.createdAt),
      updatedAt: Number(createdListing.updatedAt),
      seller: sellerDetails[0],
    };
  } catch (error) {
    console.error("Error creating marketplace listing:", error);
    throw error;
  }
};

/**
 * Get marketplace listings with optional filtering
 * @param c Hono context
 * @param filters Marketplace filters including location and pagination
 * @returns Array of marketplace listings
 */
export const getListings = async (
  c: Context<DefaultContext>,
  filters: MarketplaceFilters = {}
): Promise<{ listings: MarketplaceListingResult[]; total: number }> => {
  const currentUser = getCurrentUser(c);
  const db = c.get("db");

  if (!currentUser) {
    throw new Error("User not authenticated");
  }

  const {
    category,
    condition,
    minPrice,
    maxPrice,
    latitude,
    longitude,
    radius = 50,
    status = "active",
    limit = 20,
    offset = 0,
  } = filters;

  try {
    // Build the listings query
    let whereConditions = [];

    // Filter by status
    whereConditions.push(eq(marketplaceListings.status, status));

    // Filter by category if provided
    if (category) {
      whereConditions.push(eq(marketplaceListings.category, category));
    }

    // Filter by condition if provided
    if (condition) {
      whereConditions.push(eq(marketplaceListings.condition, condition as "new" | "like_new" | "good" | "fair" | "poor"));
    }

    // Filter by price range if provided
    if (minPrice !== undefined) {
      whereConditions.push(gte(marketplaceListings.price, minPrice));
    }

    if (maxPrice !== undefined) {
      whereConditions.push(lte(marketplaceListings.price, maxPrice));
    }

    // Add location filtering if coordinates provided
    if (latitude && longitude) {
      whereConditions.push(
        sql`${marketplaceListings.latitude} IS NOT NULL`,
        sql`${marketplaceListings.longitude} IS NOT NULL`,
        // Basic distance filtering (approximate)
        sql`abs(${marketplaceListings.latitude} - ${latitude}) < ${
          radius / 111
        }`,
        sql`abs(${marketplaceListings.longitude} - ${longitude}) < ${
          radius / (111 * Math.cos((latitude * Math.PI) / 180))
        }`
      );
    }

    const listingsQuery = db
      .select({
        id: marketplaceListings.id,
        title: marketplaceListings.title,
        description: marketplaceListings.description,
        price: marketplaceListings.price,
        category: marketplaceListings.category,
        condition: marketplaceListings.condition,
        imageUrls: marketplaceListings.imageUrls,
        latitude: marketplaceListings.latitude,
        longitude: marketplaceListings.longitude,
        address: marketplaceListings.address,
        status: marketplaceListings.status,
        viewCount: marketplaceListings.viewCount,
        createdAt: marketplaceListings.createdAt,
        updatedAt: marketplaceListings.updatedAt,
        seller: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatar: users.avatar,
        },
      })
      .from(marketplaceListings)
      .innerJoin(users, eq(marketplaceListings.sellerId, users.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(marketplaceListings.createdAt))
      .limit(limit)
      .offset(offset);

    const listingsList = await listingsQuery;

    // Calculate distances and parse image URLs
    const listingsWithDetails: MarketplaceListingResult[] = [];

    for (const listing of listingsList) {
      let distance: number | undefined;
      if (latitude && longitude && listing.latitude && listing.longitude) {
        distance = calculateDistance(
          latitude,
          longitude,
          listing.latitude,
          listing.longitude
        );
        // Skip listings outside the specified radius
        if (distance > radius) continue;
      }

      listingsWithDetails.push({
        id: listing.id,
        title: listing.title,
        description: listing.description,
        price: listing.price,
        category: listing.category,
        condition: listing.condition,
        imageUrls: listing.imageUrls,
        latitude: listing.latitude,
        longitude: listing.longitude,
        address: listing.address,
        status: (listing.status as "active" | "sold" | "deleted") || "active",
        viewCount: listing.viewCount || 0,
        createdAt: Number(listing.createdAt),
        updatedAt: Number(listing.updatedAt),
        seller: listing.seller,
        distance: distance ?? 0,
      });
    }

    // Get total count
    const totalQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(marketplaceListings)
      .innerJoin(users, eq(marketplaceListings.sellerId, users.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    const totalResult = await totalQuery;
    const total = totalResult[0]?.count || 0;

    return {
      listings: listingsWithDetails,
      total,
    };
  } catch (error) {
    console.error("Error getting marketplace listings:", error);
    throw error;
  }
};

/**
 * Get listing by ID
 * @param c Hono context
 * @param listingId Listing ID to get details for
 * @returns Listing details
 */
export const getListingById = async (
  c: Context<DefaultContext>,
  listingId: string
): Promise<MarketplaceListingResult | null> => {
  const currentUser = getCurrentUser(c);
  const db = c.get("db");

  if (!currentUser) {
    throw new Error("User not authenticated");
  }

  try {
    const listingQuery = await db
      .select({
        id: marketplaceListings.id,
        title: marketplaceListings.title,
        description: marketplaceListings.description,
        price: marketplaceListings.price,
        category: marketplaceListings.category,
        condition: marketplaceListings.condition,
        imageUrls: marketplaceListings.imageUrls,
        latitude: marketplaceListings.latitude,
        longitude: marketplaceListings.longitude,
        address: marketplaceListings.address,
        status: marketplaceListings.status,
        viewCount: marketplaceListings.viewCount,
        createdAt: marketplaceListings.createdAt,
        updatedAt: marketplaceListings.updatedAt,
        seller: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatar: users.avatar,
        },
      })
      .from(marketplaceListings)
      .innerJoin(users, eq(marketplaceListings.sellerId, users.id))
      .where(eq(marketplaceListings.id, listingId))
      .limit(1);

    if (listingQuery.length === 0) {
      return null;
    }

    const listing = listingQuery[0];

    // Increment view count
    await db
      .update(marketplaceListings)
      .set({
        viewCount: (listing.viewCount || 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(marketplaceListings.id, listingId));

    return {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      price: listing.price,
      category: listing.category,
      condition: listing.condition,
      imageUrls: listing.imageUrls,
      latitude: listing.latitude,
      longitude: listing.longitude,
      address: listing.address,
      status: (listing.status as "active" | "sold" | "deleted") || "active",
      viewCount: (listing.viewCount || 0) + 1,
      createdAt: Number(listing.createdAt),
      updatedAt: Number(listing.updatedAt),
      seller: listing.seller,
    };
  } catch (error) {
    console.error("Error getting listing by ID:", error);
    throw error;
  }
};

/**
 * Update marketplace listing
 * @param c Hono context
 * @param listingId Listing ID to update
 * @param data Update data
 * @returns Updated listing result
 */
export const updateListing = async (
  c: Context<DefaultContext>,
  listingId: string,
  data: UpdateListingData
): Promise<MarketplaceListingResult> => {
  const currentUser = getCurrentUser(c);
  const db = c.get("db");

  if (!currentUser) {
    throw new Error("User not authenticated");
  }

  try {
    // Check if listing exists and user is the seller
    const existingListing = await db
      .select()
      .from(marketplaceListings)
      .where(
        and(
          eq(marketplaceListings.id, listingId),
          eq(marketplaceListings.sellerId, currentUser.id)
        )
      )
      .limit(1);

    if (existingListing.length === 0) {
      throw new Error(
        "Listing not found or you don't have permission to edit it"
      );
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.description !== undefined)
      updateData.description = data.description.trim();
    if (data.price !== undefined) updateData.price = data.price;
    if (data.category !== undefined) updateData.category = data.category.trim();
    if (data.condition !== undefined) updateData.condition = data.condition;
    if (data.imageUrls !== undefined)
      updateData.imageUrls = data.imageUrls
        ? JSON.stringify(data.imageUrls)
        : null;
    if (data.latitude !== undefined) updateData.latitude = data.latitude;
    if (data.longitude !== undefined) updateData.longitude = data.longitude;
    if (data.address !== undefined) updateData.address = data.address.trim();
    if (data.status !== undefined) updateData.status = data.status;

    // Update the listing
    const result = await db
      .update(marketplaceListings)
      .set(updateData)
      .where(eq(marketplaceListings.id, listingId))
      .returning();

    const updatedListing = result[0];

    // Get seller details for response
    const sellerDetails = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatar: users.avatar,
      })
      .from(users)
      .where(eq(users.id, currentUser.id))
      .limit(1);

    return {
      id: updatedListing.id,
      title: updatedListing.title,
      description: updatedListing.description,
      price: updatedListing.price,
      category: updatedListing.category,
      condition: updatedListing.condition,
      imageUrls: updatedListing.imageUrls,
      latitude: updatedListing.latitude,
      longitude: updatedListing.longitude,
      address: updatedListing.address,
      status:
        (updatedListing.status as "active" | "sold" | "deleted") || "active",
      viewCount: updatedListing.viewCount || 0,
      createdAt: Number(updatedListing.createdAt),
      updatedAt: Number(updatedListing.updatedAt),
      seller: sellerDetails[0],
    };
  } catch (error) {
    console.error("Error updating listing:", error);
    throw error;
  }
};

/**
 * Delete marketplace listing
 * @param c Hono context
 * @param listingId Listing ID to delete
 * @returns Deletion result
 */
export const deleteListing = async (
  c: Context<DefaultContext>,
  listingId: string
): Promise<{ success: boolean; message: string }> => {
  const currentUser = getCurrentUser(c);
  const db = c.get("db");

  if (!currentUser) {
    throw new Error("User not authenticated");
  }

  try {
    // Check if listing exists and user is the seller
    const existingListing = await db
      .select()
      .from(marketplaceListings)
      .where(
        and(
          eq(marketplaceListings.id, listingId),
          eq(marketplaceListings.sellerId, currentUser.id)
        )
      )
      .limit(1);

    if (existingListing.length === 0) {
      throw new Error(
        "Listing not found or you don't have permission to delete it"
      );
    }

    // Soft delete by setting status to "deleted"
    await db
      .update(marketplaceListings)
      .set({
        status: "deleted",
        updatedAt: new Date(),
      })
      .where(eq(marketplaceListings.id, listingId));

    return {
      success: true,
      message: "Listing deleted successfully",
    };
  } catch (error) {
    console.error("Error deleting listing:", error);
    throw error;
  }
};

/**
 * Search listings by title or description
 * @param c Hono context
 * @param query Search query
 * @param limit Number of results to return
 * @returns Array of matching listings
 */
export const searchListings = async (
  c: Context<DefaultContext>,
  query: string,
  limit: number = 20
): Promise<MarketplaceListingResult[]> => {
  const currentUser = getCurrentUser(c);
  const db = c.get("db");

  if (!currentUser) {
    throw new Error("User not authenticated");
  }

  if (!query || query.trim().length === 0) {
    return [];
  }

  const searchTerm = `%${query.trim()}%`;

  try {
    const listingsQuery = await db
      .select({
        id: marketplaceListings.id,
        title: marketplaceListings.title,
        description: marketplaceListings.description,
        price: marketplaceListings.price,
        category: marketplaceListings.category,
        condition: marketplaceListings.condition,
        imageUrls: marketplaceListings.imageUrls,
        latitude: marketplaceListings.latitude,
        longitude: marketplaceListings.longitude,
        address: marketplaceListings.address,
        status: marketplaceListings.status,
        viewCount: marketplaceListings.viewCount,
        createdAt: marketplaceListings.createdAt,
        updatedAt: marketplaceListings.updatedAt,
        seller: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatar: users.avatar,
        },
      })
      .from(marketplaceListings)
      .innerJoin(users, eq(marketplaceListings.sellerId, users.id))
      .where(
        and(
          eq(marketplaceListings.status, "active"),
          sql`(${marketplaceListings.title} LIKE ${searchTerm} OR ${marketplaceListings.description} LIKE ${searchTerm})`
        )
      )
      .orderBy(desc(marketplaceListings.createdAt))
      .limit(limit);

    return listingsQuery.map((listing) => ({
      id: listing.id,
      title: listing.title,
      description: listing.description,
      price: listing.price,
      category: listing.category,
      condition: listing.condition,
      imageUrls: listing.imageUrls,
      latitude: listing.latitude,
      longitude: listing.longitude,
      address: listing.address,
      status: (listing.status as "active" | "sold" | "deleted") || "active",
      viewCount: listing.viewCount || 0,
      createdAt: Number(listing.createdAt),
      updatedAt: Number(listing.updatedAt),
      seller: listing.seller,
    }));
  } catch (error) {
    console.error("Error searching listings:", error);
    throw error;
  }
};
