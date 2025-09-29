import { eq, and, desc, sql } from "drizzle-orm";
import { Context } from "hono";
import { users, groups, groupMembers } from "../db/schema";
import { getCurrentUser } from "./auth";
import { DefaultContext } from "../types/context";

export interface CreateGroupData {
  name: string;
  description?: string;
  avatar?: string;
  coverImage?: string;
  category?: string;
  isPrivate?: boolean;
  latitude?: number;
  longitude?: number;
  address?: string;
}

export interface GroupFilters {
  category?: string;
  latitude?: number | undefined;
  longitude?: number | undefined;
  radius?: number; // in kilometers
  limit?: number;
  offset?: number;
  includePrivate?: boolean;
}

export interface GroupResult {
  id: string;
  name: string;
  description: string | null;
  avatar: string | null;
  coverImage: string | null;
  category: string | null;
  isPrivate: boolean;
  memberCount: number;
  createdBy: string;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  createdAt: number;
  updatedAt: number;
  creator?: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatar: string | null;
  };
  distance?: number; // calculated distance in km
  isMember?: boolean;
  userRole?: "admin" | "moderator" | "member";
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
 * Create a new group
 * @param c Hono context
 * @param data Group creation data
 * @returns Created group result
 */
export const createGroup = async (
  c: Context<DefaultContext>,
  data: CreateGroupData
): Promise<GroupResult> => {
  const currentUser = getCurrentUser(c);
  const db = c.get("db");

  if (!currentUser) {
    throw new Error("User not authenticated");
  }

  const {
    name,
    description,
    avatar,
    coverImage,
    category,
    isPrivate = false,
    latitude,
    longitude,
    address,
  } = data;

  // Validate required fields
  if (!name || name.trim().length === 0) {
    throw new Error("Group name is required");
  }

  if (name.length > 100) {
    throw new Error("Group name must be less than 100 characters");
  }

  try {
    // Create new group
    const newGroup = {
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description?.trim() || null,
      avatar,
      coverImage,
      category: category?.trim() || null,
      isPrivate,
      memberCount: 1, // Creator is the first member
      createdBy: currentUser.id,
      latitude,
      longitude,
      address: address?.trim() || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.insert(groups).values(newGroup).returning();

    const createdGroup = result[0];

    // Add creator as admin member
    await db.insert(groupMembers).values({
      id: crypto.randomUUID(),
      groupId: createdGroup.id,
      userId: currentUser.id,
      role: "admin",
      joinedAt: new Date(),
    });

    // Get creator details for response
    const creatorDetails = await db
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
      id: createdGroup.id,
      name: createdGroup.name,
      description: createdGroup.description,
      avatar: createdGroup.avatar,
      coverImage: createdGroup.coverImage,
      category: createdGroup.category,
      isPrivate: Boolean(createdGroup.isPrivate),
      memberCount: createdGroup.memberCount || 0,
      createdBy: createdGroup.createdBy,
      latitude: createdGroup.latitude,
      longitude: createdGroup.longitude,
      address: createdGroup.address,
      createdAt: Number(createdGroup.createdAt),
      updatedAt: Number(createdGroup.updatedAt),
      creator: creatorDetails[0],
      isMember: true,
      userRole: "admin",
    };
  } catch (error) {
    console.error("Error creating group:", error);
    throw error;
  }
};

/**
 * Get available groups with optional filtering
 * @param c Hono context
 * @param filters Group filters including location and pagination
 * @returns Array of groups with distance and membership info
 */
export const getGroups = async (
  c: Context<DefaultContext>,
  filters: GroupFilters = {}
): Promise<{ groups: GroupResult[]; total: number }> => {
  const currentUser = getCurrentUser(c);
  const db = c.get("db");

  if (!currentUser) {
    throw new Error("User not authenticated");
  }

  const {
    category,
    latitude,
    longitude,
    radius = 50,
    limit = 20,
    offset = 0,
    includePrivate = false,
  } = filters;

  try {
    // Get current user's group memberships for membership info
    const userMemberships = await db
      .select({
        groupId: groupMembers.groupId,
        role: groupMembers.role,
      })
      .from(groupMembers)
      .where(eq(groupMembers.userId, currentUser.id));

    const userGroupIds = userMemberships.map((m) => m.groupId);
    const membershipMap = new Map(
      userMemberships.map((m) => [m.groupId, m.role])
    );

    // Build the groups query
    let whereConditions = [];

    // Filter by category if provided
    if (category) {
      whereConditions.push(eq(groups.category, category));
    }

    // Filter private groups if not including private or user is not a member
    if (!includePrivate) {
      whereConditions.push(eq(groups.isPrivate, false));
    }

    // Add location filtering if coordinates provided
    if (latitude && longitude) {
      whereConditions.push(
        sql`${groups.latitude} IS NOT NULL`,
        sql`${groups.longitude} IS NOT NULL`,
        // Basic distance filtering (approximate)
        sql`abs(${groups.latitude} - ${latitude}) < ${radius / 111}`,
        sql`abs(${groups.longitude} - ${longitude}) < ${
          radius / (111 * Math.cos((latitude * Math.PI) / 180))
        }`
      );
    }

    const groupsQuery = db
      .select({
        id: groups.id,
        name: groups.name,
        description: groups.description,
        avatar: groups.avatar,
        coverImage: groups.coverImage,
        category: groups.category,
        isPrivate: groups.isPrivate,
        memberCount: groups.memberCount,
        createdBy: groups.createdBy,
        latitude: groups.latitude,
        longitude: groups.longitude,
        address: groups.address,
        createdAt: groups.createdAt,
        updatedAt: groups.updatedAt,
        creator: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatar: users.avatar,
        },
      })
      .from(groups)
      .innerJoin(users, eq(groups.createdBy, users.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(groups.createdAt))
      .limit(limit)
      .offset(offset);

    const groupsList = await groupsQuery;

    // Calculate distances and add membership info
    const groupsWithDetails: GroupResult[] = [];

    for (const group of groupsList) {
      let distance: number | undefined;
      if (latitude && longitude && group.latitude && group.longitude) {
        distance = calculateDistance(
          latitude,
          longitude,
          group.latitude,
          group.longitude
        );
        // Skip groups outside the specified radius
        if (distance > radius) continue;
      }

      const isMember = userGroupIds.includes(group.id);
      const userRole = membershipMap.get(group.id);

      groupsWithDetails.push({
        id: group.id,
        name: group.name,
        description: group.description,
        avatar: group.avatar,
        coverImage: group.coverImage,
        category: group.category,
        isPrivate: Boolean(group.isPrivate),
        memberCount: group.memberCount || 0,
        createdBy: group.createdBy,
        latitude: group.latitude,
        longitude: group.longitude,
        address: group.address,
        createdAt: Number(group.createdAt),
        updatedAt: Number(group.updatedAt),
        creator: group.creator,
        distance: distance ?? 0,
        isMember,
        userRole: isMember
          ? (userRole as "admin" | "moderator" | "member")
          : "member",
      });
    }

    // Get total count
    const totalQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(groups)
      .innerJoin(users, eq(groups.createdBy, users.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    const totalResult = await totalQuery;
    const total = totalResult[0]?.count || 0;

    return {
      groups: groupsWithDetails,
      total,
    };
  } catch (error) {
    console.error("Error getting groups:", error);
    throw error;
  }
};

/**
 * Get group details by ID
 * @param c Hono context
 * @param groupId Group ID to get details for
 * @returns Group details with membership info
 */
export const getGroupById = async (
  c: Context<DefaultContext>,
  groupId: string
): Promise<GroupResult | null> => {
  const currentUser = getCurrentUser(c);
  const db = c.get("db");

  if (!currentUser) {
    throw new Error("User not authenticated");
  }

  try {
    // Get group details
    const groupQuery = await db
      .select({
        id: groups.id,
        name: groups.name,
        description: groups.description,
        avatar: groups.avatar,
        coverImage: groups.coverImage,
        category: groups.category,
        isPrivate: groups.isPrivate,
        memberCount: groups.memberCount,
        createdBy: groups.createdBy,
        latitude: groups.latitude,
        longitude: groups.longitude,
        address: groups.address,
        createdAt: groups.createdAt,
        updatedAt: groups.updatedAt,
        creator: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatar: users.avatar,
        },
      })
      .from(groups)
      .innerJoin(users, eq(groups.createdBy, users.id))
      .where(eq(groups.id, groupId))
      .limit(1);

    if (groupQuery.length === 0) {
      return null;
    }

    const group = groupQuery[0];

    // Check if user is a member (for private groups)
    let isMember = false;
    let userRole: "admin" | "moderator" | "member" | undefined;

    if (group.isPrivate) {
      const membershipCheck = await db
        .select({
          role: groupMembers.role,
        })
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, currentUser.id)
          )
        )
        .limit(1);

      if (membershipCheck.length > 0) {
        isMember = true;
        userRole = membershipCheck[0].role as "admin" | "moderator" | "member";
      }
    } else {
      // For public groups, check membership for additional info
      const membershipCheck = await db
        .select({
          role: groupMembers.role,
        })
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, currentUser.id)
          )
        )
        .limit(1);

      if (membershipCheck.length > 0) {
        isMember = true;
        userRole = membershipCheck[0].role as "admin" | "moderator" | "member";
      }
    }

    // If private group and user is not a member, don't return details
    if (group.isPrivate && !isMember) {
      throw new Error("Access denied to private group");
    }

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      avatar: group.avatar,
      coverImage: group.coverImage,
      category: group.category,
      isPrivate: Boolean(group.isPrivate),
      memberCount: group.memberCount || 0,
      createdBy: group.createdBy,
      latitude: group.latitude,
      longitude: group.longitude,
      address: group.address,
      createdAt: Number(group.createdAt),
      updatedAt: Number(group.updatedAt),
      creator: group.creator,
      isMember,
      userRole: userRole || "member",
    };
  } catch (error) {
    console.error("Error getting group by ID:", error);
    throw error;
  }
};

/**
 * Update group member count
 * @param c Hono context
 * @param groupId Group ID to update
 * @param increment Increment value (positive or negative)
 * @returns Updated member count
 */
export const updateGroupMemberCount = async (
  c: Context<DefaultContext>,
  groupId: string,
  increment: number
): Promise<number> => {
  const db = c.get("db");

  try {
    const result = await db
      .update(groups)
      .set({
        memberCount: sql`${groups.memberCount} + ${increment}`,
        updatedAt: new Date(),
      })
      .where(eq(groups.id, groupId))
      .returning({
        memberCount: groups.memberCount,
      });

    return result[0].memberCount || 0;
  } catch (error) {
    console.error("Error updating group member count:", error);
    throw error;
  }
};
