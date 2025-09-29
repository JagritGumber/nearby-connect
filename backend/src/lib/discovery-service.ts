import { eq, and, desc, sql } from "drizzle-orm";
import { Context } from "hono";
import { users, friendRequests } from "../db/schema";
import { getCurrentUser } from "./auth";
import { DefaultContext } from "../types/context";

export interface DiscoveryFilters {
  latitude?: number | undefined;
  longitude?: number | undefined;
  radius?: number; // in kilometers, default 50km
  limit?: number;
  offset?: number;
  interests?: string[]; // For recommendation scoring
}

export interface UserDiscoveryResult {
  id: string;
  username: string | null;
  displayName: string | null;
  avatar: string | null;
  bio: string | null;
  latitude: number | null;
  longitude: number | null;
  isOnline: boolean | null;
  lastSeenAt: number | null;
  distance?: number; // calculated distance in km
  mutualConnections?: number;
  sharedInterests?: number;
  recommendationScore?: number;
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
 * Calculate recommendation score based on mutual connections and shared interests
 * Formula: S = (0.7 × Mutual Connections) + (0.3 × Shared Interests)
 * @param mutualConnections Number of mutual connections
 * @param sharedInterests Number of shared interests
 * @returns Recommendation score between 0-100
 */
function calculateRecommendationScore(
  mutualConnections: number,
  sharedInterests: number
): number {
  const normalizedConnections = Math.min(mutualConnections / 10, 1); // Normalize to max 10 connections
  const normalizedInterests = Math.min(sharedInterests / 5, 1); // Normalize to max 5 shared interests

  return Math.round(
    (0.7 * normalizedConnections + 0.3 * normalizedInterests) * 100
  );
}

/**
 * Discover users within specified radius with recommendation scoring
 * @param c Hono context
 * @param filters Discovery filters including location and pagination
 * @returns Array of user discovery results with distance and recommendation scores
 */
export const discoverUsers = async (
  c: Context<DefaultContext>,
  filters: DiscoveryFilters = {}
): Promise<{ users: UserDiscoveryResult[]; total: number }> => {
  const currentUser = getCurrentUser(c);
  const db = c.get("db");

  if (!currentUser) {
    throw new Error("User not authenticated");
  }

  const {
    latitude,
    longitude,
    radius = 50,
    limit = 20,
    offset = 0,
    interests = [],
  } = filters;

  if (!latitude || !longitude) {
    throw new Error("Latitude and longitude are required for user discovery");
  }

  try {
    // Get current user's friend connections for mutual connection calculation
    const currentUserFriends = await db
      .select({ id: users.id })
      .from(users)
      .innerJoin(friendRequests, eq(users.id, friendRequests.senderId))
      .where(
        and(
          eq(friendRequests.receiverId, currentUser.id),
          eq(friendRequests.status, "accepted")
        )
      );

    const friendIds = currentUserFriends.map((f) => f.id);

    // Build the geospatial query using SQLite math functions
    // This is a simplified approach - in production, consider using PostGIS or spatial indexes
    const usersQuery = db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatar: users.avatar,
        bio: users.bio,
        latitude: users.latitude,
        longitude: users.longitude,
        isOnline: users.isOnline,
        lastSeenAt: users.lastSeenAt,
        // We'll calculate distance and scores in JavaScript due to SQLite limitations
      })
      .from(users)
      .where(
        and(
          // Exclude current user
          sql`${users.id} != ${currentUser.id}`,
          // Only show users who have set their location
          sql`${users.latitude} IS NOT NULL`,
          sql`${users.longitude} IS NOT NULL`,
          // Basic distance filtering (this is approximate)
          // For production, consider using proper geospatial queries
          sql`abs(${users.latitude} - ${latitude}) < ${radius / 111}`, // Rough latitude filtering
          sql`abs(${users.longitude} - ${longitude}) < ${
            radius / (111 * Math.cos((latitude * Math.PI) / 180))
          }` // Rough longitude filtering
        )
      )
      .limit(limit)
      .offset(offset)
      .orderBy(desc(users.lastSeenAt));

    const nearbyUsers = await usersQuery;

    // Calculate distances and recommendation scores
    const usersWithDistance: UserDiscoveryResult[] = [];

    for (const user of nearbyUsers) {
      if (!user.latitude || !user.longitude) continue;

      const distance = calculateDistance(
        latitude,
        longitude,
        user.latitude,
        user.longitude
      );

      // Skip users outside the specified radius
      if (distance > radius) continue;

      // Calculate mutual connections (simplified - would need actual friendship data)
      // For now, we'll use a placeholder calculation
      const mutualConnections = Math.floor(Math.random() * 5); // Placeholder

      // Calculate shared interests (simplified - would need actual interest data)
      const sharedInterests = Math.floor(Math.random() * 3); // Placeholder

      const recommendationScore = calculateRecommendationScore(
        mutualConnections,
        sharedInterests
      );

      usersWithDistance.push({
        ...user,
        distance,
        mutualConnections,
        sharedInterests,
        recommendationScore,
        lastSeenAt: user.lastSeenAt ? Number(user.lastSeenAt) : null,
      });
    }

    // Sort by recommendation score (highest first)
    usersWithDistance.sort(
      (a, b) => (b.recommendationScore || 0) - (a.recommendationScore || 0)
    );

    // Get total count (approximate)
    const totalQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(
        and(
          sql`${users.id} != ${currentUser.id}`,
          sql`${users.latitude} IS NOT NULL`,
          sql`${users.longitude} IS NOT NULL`
        )
      );

    const totalResult = await totalQuery;
    const total = totalResult[0]?.count || 0;

    return {
      users: usersWithDistance,
      total,
    };
  } catch (error) {
    console.error("Error discovering users:", error);
    throw error;
  }
};

/**
 * Get user profile with location and recommendation data
 * @param c Hono context
 * @param userId User ID to get profile for
 * @returns User profile with location and recommendation data
 */
export const getUserProfile = async (
  c: Context<DefaultContext>,
  userId: string
): Promise<UserDiscoveryResult | null> => {
  const currentUser = getCurrentUser(c);
  const db = c.get("db");

  if (!currentUser) {
    throw new Error("User not authenticated");
  }

  try {
    const userProfile = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userProfile.length === 0) {
      return null;
    }

    const user = userProfile[0];

    // Calculate recommendation score if current user has location
    let recommendationScore: number | undefined;
    // Get current user's location from database
    const currentUserProfile = await db
      .select({ latitude: users.latitude, longitude: users.longitude })
      .from(users)
      .where(eq(users.id, currentUser.id))
      .limit(1);

    if (
      currentUserProfile[0]?.latitude &&
      currentUserProfile[0]?.longitude &&
      user.latitude &&
      user.longitude
    ) {
      const distance = calculateDistance(
        currentUserProfile[0].latitude,
        currentUserProfile[0].longitude,
        user.latitude,
        user.longitude
      );

      // Only calculate score if user is within reasonable distance
      if (distance <= 50) {
        const mutualConnections = 0; // Would need actual friendship data
        const sharedInterests = 0; // Would need actual interest data
        recommendationScore = calculateRecommendationScore(
          mutualConnections,
          sharedInterests
        );
      }
    }

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      bio: user.bio,
      latitude: user.latitude,
      longitude: user.longitude,
      isOnline: user.isOnline,
      lastSeenAt: user.lastSeenAt ? Number(user.lastSeenAt) : null,
      recommendationScore: recommendationScore ?? 0,
    };
  } catch (error) {
    console.error("Error getting user profile:", error);
    throw error;
  }
};
