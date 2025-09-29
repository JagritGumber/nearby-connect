import { eq, and, or, desc, sql, inArray } from "drizzle-orm";
import { Context } from "hono";
import {
  users,
  posts,
  groupPosts,
  groups,
  groupMembers,
  friendRequests,
} from "../db/schema";
import { getCurrentUser } from "./auth";
import { DefaultContext } from "../types/context";

export interface FeedFilters {
  limit?: number;
  offset?: number;
  includeFriends?: boolean;
  includeGroups?: boolean;
  includeRecent?: boolean;
}

export interface FeedItem {
  id: string;
  type: "post" | "group_post" | "group_activity";
  content: string;
  authorId: string;
  author: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatar: string | null;
  };
  createdAt: number;
  // For posts
  imageUrls?: string | null;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  isPublic?: boolean;
  // For group posts
  groupId?: string;
  groupName?: string;
  // For group activities
  activityType?: "join" | "create" | "update";
  metadata?: Record<string, any>;
}

export interface FeedResult {
  items: FeedItem[];
  total: number;
  hasMore: boolean;
}

/**
 * Get user's personalized feed with 3:3:2 ratio (Friends:Groups:Recency)
 * @param c Hono context
 * @param filters Feed filters including pagination and content types
 * @returns Feed items with mixed content types
 */
export const getUserFeed = async (
  c: Context<DefaultContext>,
  filters: FeedFilters = {}
): Promise<FeedResult> => {
  const currentUser = getCurrentUser(c);
  const db = c.get("db");

  if (!currentUser) {
    throw new Error("User not authenticated");
  }

  const {
    limit = 20,
    offset = 0,
    includeFriends = true,
    includeGroups = true,
    includeRecent = true,
  } = filters;

  try {
    // Get user's friends for friend-based content
    const friendsQuery = db
      .select({ friendId: sql<string>`${friendRequests.receiverId}` })
      .from(friendRequests)
      .where(
        and(
          eq(friendRequests.senderId, currentUser.id),
          eq(friendRequests.status, "accepted")
        )
      )
      .union(
        db
          .select({ friendId: sql<string>`${friendRequests.senderId}` })
          .from(friendRequests)
          .where(
            and(
              eq(friendRequests.receiverId, currentUser.id),
              eq(friendRequests.status, "accepted")
            )
          )
      );

    const friendsResult = await friendsQuery;
    const friendIds = friendsResult.map((f) => f.friendId);

    // Get user's groups for group-based content
    const userGroupsQuery = db
      .select({ groupId: groupMembers.groupId })
      .from(groupMembers)
      .where(eq(groupMembers.userId, currentUser.id));

    const userGroupsResult = await userGroupsQuery;
    const groupIds = userGroupsResult.map((g) => g.groupId);

    const feedItems: FeedItem[] = [];
    let totalCount = 0;

    // Calculate ratios: 3:3:2 for Friends:Groups:Recency
    const ratio = { friends: 3, groups: 3, recent: 2 };
    const itemsPerType = Math.floor(
      limit / (ratio.friends + ratio.groups + ratio.recent)
    );

    // 1. Get posts from friends (3 parts)
    if (includeFriends && friendIds.length > 0 && itemsPerType > 0) {
      const friendPosts = await db
        .select({
          id: posts.id,
          content: posts.content,
          authorId: posts.authorId,
          imageUrls: posts.imageUrls,
          likeCount: posts.likeCount,
          commentCount: posts.commentCount,
          shareCount: posts.shareCount,
          isPublic: posts.isPublic,
          createdAt: posts.createdAt,
          author: {
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatar: users.avatar,
          },
        })
        .from(posts)
        .innerJoin(users, eq(posts.authorId, users.id))
        .where(
          and(
            inArray(posts.authorId, friendIds),
            eq(posts.isPublic, true) // Only public posts
          )
        )
        .orderBy(desc(posts.createdAt))
        .limit(itemsPerType * ratio.friends)
        .offset(offset);

      const friendFeedItems = friendPosts.map((post) => ({
        id: post.id,
        type: "post" as const,
        content: post.content,
        authorId: post.authorId,
        author: post.author,
        createdAt: Number(post.createdAt),
        imageUrls: post.imageUrls,
        likeCount: post.likeCount || 0,
        commentCount: post.commentCount || 0,
        shareCount: post.shareCount || 0,
        isPublic: Boolean(post.isPublic),
      }));

      feedItems.push(...friendFeedItems);
      totalCount += friendFeedItems.length;
    }

    // 2. Get group posts from user's groups (3 parts)
    if (includeGroups && groupIds.length > 0 && itemsPerType > 0) {
      const groupPostsQuery = await db
        .select({
          id: groupPosts.id,
          content: groupPosts.content,
          authorId: groupPosts.authorId,
          groupId: groupPosts.groupId,
          createdAt: groupPosts.createdAt,
          author: {
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatar: users.avatar,
          },
          group: {
            id: groups.id,
            name: groups.name,
          },
        })
        .from(groupPosts)
        .innerJoin(users, eq(groupPosts.authorId, users.id))
        .innerJoin(groups, eq(groupPosts.groupId, groups.id))
        .where(inArray(groupPosts.groupId, groupIds))
        .orderBy(desc(groupPosts.createdAt))
        .limit(itemsPerType * ratio.groups)
        .offset(offset);

      const groupFeedItems = groupPostsQuery.map((post) => ({
        id: post.id,
        type: "group_post" as const,
        content: post.content,
        authorId: post.authorId,
        author: post.author,
        createdAt: Number(post.createdAt),
        groupId: post.groupId,
        groupName: post.group?.name || "Unknown Group",
      }));

      feedItems.push(...groupFeedItems);
      totalCount += groupFeedItems.length;
    }

    // 3. Get recent posts from nearby users or popular content (2 parts)
    if (includeRecent && itemsPerType > 0) {
      const recentPosts = await db
        .select({
          id: posts.id,
          content: posts.content,
          authorId: posts.authorId,
          imageUrls: posts.imageUrls,
          likeCount: posts.likeCount,
          commentCount: posts.commentCount,
          shareCount: posts.shareCount,
          isPublic: posts.isPublic,
          createdAt: posts.createdAt,
          author: {
            id: users.id,
            username: users.username,
            displayName: users.displayName,
            avatar: users.avatar,
          },
        })
        .from(posts)
        .innerJoin(users, eq(posts.authorId, users.id))
        .where(
          and(
            eq(posts.isPublic, true), // Only public posts
            sql`${posts.authorId} != ${currentUser.id}` // Exclude own posts
          )
        )
        .orderBy(desc(posts.createdAt))
        .limit(itemsPerType * ratio.recent)
        .offset(offset);

      const recentFeedItems = recentPosts.map((post) => ({
        id: post.id,
        type: "post" as const,
        content: post.content,
        authorId: post.authorId,
        author: post.author,
        createdAt: Number(post.createdAt),
        imageUrls: post.imageUrls,
        likeCount: post.likeCount || 0,
        commentCount: post.commentCount || 0,
        shareCount: post.shareCount || 0,
        isPublic: Boolean(post.isPublic),
      }));

      feedItems.push(...recentFeedItems);
      totalCount += recentFeedItems.length;
    }

    // Sort all items by creation date (most recent first)
    feedItems.sort((a, b) => b.createdAt - a.createdAt);

    // Apply limit after sorting
    const limitedItems = feedItems.slice(0, limit);

    // Check if there are more items available
    const hasMore = feedItems.length > limit;

    return {
      items: limitedItems,
      total: totalCount,
      hasMore,
    };
  } catch (error) {
    console.error("Error getting user feed:", error);
    throw error;
  }
};

/**
 * Get recent posts from a specific user
 * @param c Hono context
 * @param userId User ID to get posts for
 * @param limit Number of posts to retrieve
 * @returns Array of user's recent posts
 */
export const getUserPosts = async (
  c: Context<DefaultContext>,
  userId: string,
  limit: number = 10
): Promise<FeedItem[]> => {
  const currentUser = getCurrentUser(c);
  const db = c.get("db");

  if (!currentUser) {
    throw new Error("User not authenticated");
  }

  try {
    // Check if the requested user is a friend or if posts are public
    let canViewPrivatePosts = false;

    if (userId !== currentUser.id) {
      // Check friendship
      const friendshipCheck = await db
        .select()
        .from(friendRequests)
        .where(
          or(
            and(
              eq(friendRequests.senderId, currentUser.id),
              eq(friendRequests.receiverId, userId),
              eq(friendRequests.status, "accepted")
            ),
            and(
              eq(friendRequests.senderId, userId),
              eq(friendRequests.receiverId, currentUser.id),
              eq(friendRequests.status, "accepted")
            )
          )
        )
        .limit(1);

      canViewPrivatePosts = friendshipCheck.length > 0;
    } else {
      canViewPrivatePosts = true; // Can always view own posts
    }

    const postsQuery = db
      .select({
        id: posts.id,
        content: posts.content,
        authorId: posts.authorId,
        imageUrls: posts.imageUrls,
        likeCount: posts.likeCount,
        commentCount: posts.commentCount,
        shareCount: posts.shareCount,
        isPublic: posts.isPublic,
        createdAt: posts.createdAt,
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatar: users.avatar,
        },
      })
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .where(
        and(
          eq(posts.authorId, userId),
          or(
            eq(posts.isPublic, true), // Public posts
            canViewPrivatePosts ? undefined : eq(posts.authorId, currentUser.id) // Private posts only for friends/owner
          )
        )
      )
      .orderBy(desc(posts.createdAt))
      .limit(limit);

    const userPosts = await postsQuery;

    return userPosts.map((post) => ({
      id: post.id,
      type: "post" as const,
      content: post.content,
      authorId: post.authorId,
      author: post.author,
      createdAt: Number(post.createdAt),
      imageUrls: post.imageUrls,
      likeCount: post.likeCount || 0,
      commentCount: post.commentCount || 0,
      shareCount: post.shareCount || 0,
      isPublic: Boolean(post.isPublic),
    }));
  } catch (error) {
    console.error("Error getting user posts:", error);
    throw error;
  }
};

/**
 * Get group activity feed (joins, new posts, etc.)
 * @param c Hono context
 * @param groupId Group ID to get activity for
 * @param limit Number of activities to retrieve
 * @returns Array of group activities
 */
export const getGroupActivity = async (
  c: Context<DefaultContext>,
  groupId: string,
  limit: number = 10
): Promise<FeedItem[]> => {
  const currentUser = getCurrentUser(c);
  const db = c.get("db");

  if (!currentUser) {
    throw new Error("User not authenticated");
  }

  try {
    // Verify user is a member of the group
    const membershipCheck = await db
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, currentUser.id)
        )
      )
      .limit(1);

    if (membershipCheck.length === 0) {
      throw new Error("User is not a member of this group");
    }

    // Get recent group posts
    const recentPosts = await db
      .select({
        id: groupPosts.id,
        content: groupPosts.content,
        authorId: groupPosts.authorId,
        groupId: groupPosts.groupId,
        createdAt: groupPosts.createdAt,
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatar: users.avatar,
        },
        group: {
          id: groups.id,
          name: groups.name,
        },
      })
      .from(groupPosts)
      .innerJoin(users, eq(groupPosts.authorId, users.id))
      .innerJoin(groups, eq(groupPosts.groupId, groups.id))
      .where(eq(groupPosts.groupId, groupId))
      .orderBy(desc(groupPosts.createdAt))
      .limit(limit);

    const activities: FeedItem[] = recentPosts.map((post) => ({
      id: post.id,
      type: "group_post" as const,
      content: post.content,
      authorId: post.authorId,
      author: post.author,
      createdAt: Number(post.createdAt),
      groupId: post.groupId,
      groupName: post.group?.name || "Unknown Group",
      activityType: "create" as const,
      metadata: { postType: "group_post" },
    }));

    return activities;
  } catch (error) {
    console.error("Error getting group activity:", error);
    throw error;
  }
};
