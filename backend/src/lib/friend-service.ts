import { eq, and, or, desc, sql } from "drizzle-orm";
import { Context } from "hono";
import { users, friendRequests } from "../db/schema";
import { getCurrentUser } from "./auth";
import { DefaultContext } from "../types/context";

export interface CreateFriendRequestData {
  receiverId: string;
}

export interface UpdateFriendRequestData {
  status: "accepted" | "rejected";
}

export interface FriendRequestResult {
  id: string;
  senderId: string;
  receiverId: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: number;
  updatedAt: number;
  sender?: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatar: string | null;
  };
  receiver?: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatar: string | null;
  };
}

export interface FriendProfile {
  id: string;
  username: string | null;
  displayName: string | null;
  avatar: string | null;
  bio: string | null;
  isOnline: boolean | null;
  lastSeenAt: number | null;
}

/**
 * Send a friend request to another user
 * @param c Hono context
 * @param data Friend request data containing receiver ID
 * @returns Created friend request result
 */
export const sendFriendRequest = async (
  c: Context<DefaultContext>,
  data: CreateFriendRequestData
): Promise<FriendRequestResult> => {
  const currentUser = getCurrentUser(c);
  const db = c.get("db");

  if (!currentUser) {
    throw new Error("User not authenticated");
  }

  const { receiverId } = data;

  // Validate receiver exists
  const receiver = await db
    .select()
    .from(users)
    .where(eq(users.id, receiverId))
    .limit(1);

  if (receiver.length === 0) {
    throw new Error("Receiver user not found");
  }

  // Check if users are trying to friend themselves
  if (currentUser.id === receiverId) {
    throw new Error("Cannot send friend request to yourself");
  }

  // Check if friend request already exists (in either direction)
  const existingRequest = await db
    .select()
    .from(friendRequests)
    .where(
      or(
        and(
          eq(friendRequests.senderId, currentUser.id),
          eq(friendRequests.receiverId, receiverId)
        ),
        and(
          eq(friendRequests.senderId, receiverId),
          eq(friendRequests.receiverId, currentUser.id)
        )
      )
    )
    .limit(1);

  if (existingRequest.length > 0) {
    const request = existingRequest[0];
    if (request.status === "accepted") {
      throw new Error("Users are already friends");
    } else if (request.status === "pending") {
      throw new Error("Friend request already exists");
    }
  }

  try {
    // Create new friend request
    const newRequest = {
      id: crypto.randomUUID(),
      senderId: currentUser.id,
      receiverId,
      status: "pending" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db
      .insert(friendRequests)
      .values(newRequest)
      .returning();

    const createdRequest = result[0];

    // Fetch sender and receiver details for response
    const [senderDetails, receiverDetails] = await Promise.all([
      db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatar: users.avatar,
        })
        .from(users)
        .where(eq(users.id, createdRequest.senderId))
        .limit(1),
      db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatar: users.avatar,
        })
        .from(users)
        .where(eq(users.id, createdRequest.receiverId))
        .limit(1),
    ]);

    return {
      id: createdRequest.id,
      senderId: createdRequest.senderId,
      receiverId: createdRequest.receiverId,
      status: createdRequest.status || "pending",
      createdAt: Number(createdRequest.createdAt),
      updatedAt: Number(createdRequest.updatedAt),
      sender: senderDetails[0],
      receiver: receiverDetails[0],
    };
  } catch (error) {
    console.error("Error sending friend request:", error);
    throw error;
  }
};

/**
 * Update friend request status (accept/reject)
 * @param c Hono context
 * @param requestId Friend request ID to update
 * @param data Update data containing new status
 * @returns Updated friend request result
 */
export const updateFriendRequest = async (
  c: Context<DefaultContext>,
  requestId: string,
  data: UpdateFriendRequestData
): Promise<FriendRequestResult> => {
  const currentUser = getCurrentUser(c);
  const db = c.get("db");

  if (!currentUser) {
    throw new Error("User not authenticated");
  }

  const { status } = data;

  try {
    // Get the friend request and verify current user is the receiver
    const request = await db
      .select()
      .from(friendRequests)
      .where(eq(friendRequests.id, requestId))
      .limit(1);

    if (request.length === 0) {
      throw new Error("Friend request not found");
    }

    const friendRequest = request[0];

    // Only the receiver can update the request status
    if (friendRequest.receiverId !== currentUser.id) {
      throw new Error("Only the receiver can update friend request status");
    }

    // Only pending requests can be updated
    if (friendRequest.status !== "pending") {
      throw new Error("Friend request has already been processed");
    }

    // Update the request status
    const result = await db
      .update(friendRequests)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(friendRequests.id, requestId))
      .returning();

    const updatedRequest = result[0];

    // Fetch sender and receiver details for response
    const [senderDetails, receiverDetails] = await Promise.all([
      db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatar: users.avatar,
        })
        .from(users)
        .where(eq(users.id, updatedRequest.senderId))
        .limit(1),
      db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatar: users.avatar,
        })
        .from(users)
        .where(eq(users.id, updatedRequest.receiverId))
        .limit(1),
    ]);

    return {
      id: updatedRequest.id,
      senderId: updatedRequest.senderId,
      receiverId: updatedRequest.receiverId,
      status: updatedRequest.status || "pending",
      createdAt: Number(updatedRequest.createdAt),
      updatedAt: Number(updatedRequest.updatedAt),
      sender: senderDetails[0],
      receiver: receiverDetails[0],
    };
  } catch (error) {
    console.error("Error updating friend request:", error);
    throw error;
  }
};

/**
 * Get pending friend requests for current user
 * @param c Hono context
 * @returns Array of pending friend requests
 */
export const getPendingFriendRequests = async (
  c: Context<DefaultContext>
): Promise<FriendRequestResult[]> => {
  const currentUser = getCurrentUser(c);
  const db = c.get("db");

  if (!currentUser) {
    throw new Error("User not authenticated");
  }

  try {
    // Get pending requests where current user is the receiver
    const requests = await db
      .select()
      .from(friendRequests)
      .where(
        and(
          eq(friendRequests.receiverId, currentUser.id),
          eq(friendRequests.status, "pending")
        )
      )
      .orderBy(desc(friendRequests.createdAt));

    // Fetch sender details for each request
    const requestsWithDetails = await Promise.all(
      requests.map(async (request) => {
        const senderDetails = await db
          .select({
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatar: users.avatar,
          })
          .from(users)
          .where(eq(users.id, request.senderId))
          .limit(1);

        return {
          id: request.id,
          senderId: request.senderId,
          receiverId: request.receiverId,
          status: request.status || "pending",
          createdAt: Number(request.createdAt),
          updatedAt: Number(request.updatedAt),
          sender: senderDetails[0],
          receiver: {
            id: currentUser.id,
            username: null, // We don't need receiver details in this context
            displayName: null,
            avatar: null,
          },
        };
      })
    );

    return requestsWithDetails;
  } catch (error) {
    console.error("Error getting pending friend requests:", error);
    throw error;
  }
};

/**
 * Get friends list for current user
 * @param c Hono context
 * @returns Array of friend profiles
 */
export const getFriendsList = async (
  c: Context<DefaultContext>
): Promise<FriendProfile[]> => {
  const currentUser = getCurrentUser(c);
  const db = c.get("db");

  if (!currentUser) {
    throw new Error("User not authenticated");
  }

  try {
    // Get accepted friend requests where current user is either sender or receiver
    const sentRequests = await db
      .select({
        friendId: friendRequests.receiverId,
      })
      .from(friendRequests)
      .where(
        and(
          eq(friendRequests.senderId, currentUser.id),
          eq(friendRequests.status, "accepted")
        )
      );

    const receivedRequests = await db
      .select({
        friendId: friendRequests.senderId,
      })
      .from(friendRequests)
      .where(
        and(
          eq(friendRequests.receiverId, currentUser.id),
          eq(friendRequests.status, "accepted")
        )
      );

    const friendIds = [
      ...sentRequests.map((r) => r.friendId),
      ...receivedRequests.map((r) => r.friendId),
    ];

    if (friendIds.length === 0) {
      return [];
    }

    // Get friend profiles
    const friends = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatar: users.avatar,
        bio: users.bio,
        isOnline: users.isOnline,
        lastSeenAt: users.lastSeenAt,
      })
      .from(users)
      .where(sql`users.id IN (${friendIds.join(",")})`)
      .orderBy(desc(users.isOnline), desc(users.lastSeenAt));

    return friends.map((friend) => ({
      id: friend.id,
      username: friend.username,
      displayName: friend.displayName,
      avatar: friend.avatar,
      bio: friend.bio,
      isOnline: friend.isOnline,
      lastSeenAt: friend.lastSeenAt ? Number(friend.lastSeenAt) : null,
    }));
  } catch (error) {
    console.error("Error getting friends list:", error);
    throw error;
  }
};
