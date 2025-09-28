import { eq } from "drizzle-orm";
import { Context } from "hono";
import { users } from "../db/schema";
import { getCurrentUser, getClerkClient } from "./auth";

export interface CreateUserData {
  username?: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  latitude?: number;
  longitude?: number;
}

// Get or create user profile
export const getOrCreateUser = async (c: Context) => {
  const user = getCurrentUser(c);
  const clerk = getClerkClient(c);
  const db = c.get("db");

  if (!user) {
    throw new Error("User not authenticated");
  }

  try {
    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, user.id))
      .limit(1);

    if (existingUser.length > 0) {
      return existingUser[0];
    }

    // Get detailed user data from Clerk
    const clerkUser = await clerk.users.getUser(user.id);

    // Create new user profile
    const newUser = {
      id: user.id, // Use Clerk ID as primary key
      clerkId: user.id,
      email: user.email,
      username: user.username || clerkUser.username || null,
      displayName: user.displayName || clerkUser.firstName || null,
      avatar: user.avatar || clerkUser.imageUrl || null,
      bio: null,
      latitude: null,
      longitude: null,
      locationUpdatedAt: null,
      isOnline: true,
      lastSeenAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await db.insert(users).values(newUser);

    return newUser;
  } catch (error) {
    console.error("Error creating user profile:", error);
    throw error;
  }
};

// Update user profile
export const updateUserProfile = async (
  c: Context,
  updates: Partial<CreateUserData>
) => {
  const user = getCurrentUser(c);
  const db = c.get("db");

  if (!user) {
    throw new Error("User not authenticated");
  }

  try {
    const updateData: any = {
      ...updates,
      updatedAt: Date.now(),
    };

    const result = await db
      .update(users)
      .set(updateData)
      .where(eq(users.clerkId, user.id))
      .returning();

    return result[0];
  } catch (error) {
    console.error("Error updating user profile:", error);
    throw error;
  }
};

// Get user by ID
export const getUserById = async (c: Context, userId: string) => {
  const db = c.get("db");

  try {
    const userProfile = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return userProfile[0] || null;
  } catch (error) {
    console.error("Error fetching user:", error);
    throw error;
  }
};

// Update user location
export const updateUserLocation = async (
  c: Context,
  latitude: number,
  longitude: number
) => {
  const user = getCurrentUser(c);
  const db = c.get("db");

  if (!user) {
    throw new Error("User not authenticated");
  }

  try {
    const result = await db
      .update(users)
      .set({
        latitude,
        longitude,
        locationUpdatedAt: Date.now(),
        updatedAt: Date.now(),
      })
      .where(eq(users.clerkId, user.id))
      .returning();

    return result[0];
  } catch (error) {
    console.error("Error updating user location:", error);
    throw error;
  }
};

// Update user online status
export const updateUserOnlineStatus = async (c: Context, isOnline: boolean) => {
  const user = getCurrentUser(c);
  const db = c.get("db");

  if (!user) {
    throw new Error("User not authenticated");
  }

  try {
    const updateData: {
      isOnline: boolean;
      updatedAt: number;
      lastSeenAt?: number;
    } = {
      isOnline,
      updatedAt: Date.now(),
    };

    if (!isOnline) {
      updateData.lastSeenAt = Date.now();
    }

    const result = await db
      .update(users)
      .set(updateData)
      .where(eq(users.clerkId, user.id))
      .returning();

    return result[0];
  } catch (error) {
    console.error("Error updating user online status:", error);
    throw error;
  }
};
