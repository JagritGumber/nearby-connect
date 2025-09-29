import { eq, and, desc, sql } from "drizzle-orm";
import { Context } from "hono";
import { users, groups, groupMembers } from "../db/schema";
import { getCurrentUser } from "./auth";
import { updateGroupMemberCount } from "./groups-service";
import { DefaultContext } from "../types/context";

export interface GroupMemberResult {
  id: string;
  userId: string;
  groupId: string;
  role: "admin" | "moderator" | "member";
  joinedAt: number;
  user?: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatar: string | null;
    isOnline: boolean | null;
    lastSeenAt: number | null;
  };
}

export interface JoinGroupResult {
  success: boolean;
  message: string;
  member?: GroupMemberResult;
}

/**
 * Join a group
 * @param c Hono context
 * @param groupId Group ID to join
 * @returns Join result with membership details
 */
export const joinGroup = async (
  c: Context<DefaultContext>,
  groupId: string
): Promise<JoinGroupResult> => {
  const currentUser = getCurrentUser(c);
  const db = c.get("db");

  if (!currentUser) {
    throw new Error("User not authenticated");
  }

  try {
    // Check if group exists
    const group = await db
      .select()
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1);

    if (group.length === 0) {
      throw new Error("Group not found");
    }

    const groupData = group[0];

    // Check if user is already a member
    const existingMembership = await db
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, currentUser.id)
        )
      )
      .limit(1);

    if (existingMembership.length > 0) {
      throw new Error("User is already a member of this group");
    }

    // Check if group is private and requires approval
    if (groupData.isPrivate) {
      // For private groups, we might want to implement an approval system
      // For now, we'll allow joining but mark as pending
      // This could be extended to send a request to group admins
    }

    // Add user as group member
    const newMember = {
      id: crypto.randomUUID(),
      groupId,
      userId: currentUser.id,
      role: "member" as const,
      joinedAt: new Date(),
    };

    const result = await db.insert(groupMembers).values(newMember).returning();

    const createdMembership = result[0];

    // Update group member count
    await updateGroupMemberCount(c, groupId, 1);

    // Get user details for response
    const userDetails = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatar: users.avatar,
        isOnline: users.isOnline,
        lastSeenAt: users.lastSeenAt,
      })
      .from(users)
      .where(eq(users.id, currentUser.id))
      .limit(1);

    const memberResult: GroupMemberResult = {
      id: createdMembership.id,
      userId: createdMembership.userId,
      groupId: createdMembership.groupId,
      role:
        (createdMembership.role as "admin" | "moderator" | "member") ||
        "member",
      joinedAt: Number(createdMembership.joinedAt),
      user: userDetails[0]
        ? {
            ...userDetails[0],
            lastSeenAt: userDetails[0].lastSeenAt
              ? Number(userDetails[0].lastSeenAt)
              : null,
          }
        : {
            id: currentUser.id,
            username: null,
            displayName: null,
            avatar: null,
            isOnline: null,
            lastSeenAt: null,
          },
    };

    return {
      success: true,
      message: "Successfully joined the group",
      member: memberResult,
    };
  } catch (error) {
    console.error("Error joining group:", error);
    throw error;
  }
};

/**
 * Leave a group
 * @param c Hono context
 * @param groupId Group ID to leave
 * @returns Leave result
 */
export const leaveGroup = async (
  c: Context<DefaultContext>,
  groupId: string
): Promise<JoinGroupResult> => {
  const currentUser = getCurrentUser(c);
  const db = c.get("db");

  if (!currentUser) {
    throw new Error("User not authenticated");
  }

  try {
    // Check if user is a member of the group
    const membership = await db
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, currentUser.id)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      throw new Error("User is not a member of this group");
    }

    const memberData = membership[0];

    // Check if user is the group creator (cannot leave if they're the only admin)
    const group = await db
      .select({
        createdBy: groups.createdBy,
        memberCount: groups.memberCount,
      })
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1);

    if (group.length === 0) {
      throw new Error("Group not found");
    }

    const groupData = group[0];

    // If user is the creator and it's the only member, prevent leaving
    if (
      groupData.createdBy === currentUser.id &&
      (groupData.memberCount || 0) <= 1
    ) {
      throw new Error("Cannot leave group as the creator and only member");
    }

    // Remove membership
    await db
      .delete(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, currentUser.id)
        )
      );

    // Update group member count
    await updateGroupMemberCount(c, groupId, -1);

    return {
      success: true,
      message: "Successfully left the group",
    };
  } catch (error) {
    console.error("Error leaving group:", error);
    throw error;
  }
};

/**
 * Get group members
 * @param c Hono context
 * @param groupId Group ID to get members for
 * @param limit Number of members to retrieve
 * @param offset Offset for pagination
 * @returns Array of group members with user details
 */
export const getGroupMembers = async (
  c: Context<DefaultContext>,
  groupId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ members: GroupMemberResult[]; total: number }> => {
  const currentUser = getCurrentUser(c);
  const db = c.get("db");

  if (!currentUser) {
    throw new Error("User not authenticated");
  }

  try {
    // Check if group exists
    const group = await db
      .select()
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1);

    if (group.length === 0) {
      throw new Error("Group not found");
    }

    const groupData = group[0];

    // Check if user has permission to view members
    if (groupData.isPrivate) {
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
        throw new Error("Access denied to view private group members");
      }
    }

    // Get group members with user details
    const membersQuery = await db
      .select({
        id: groupMembers.id,
        userId: groupMembers.userId,
        groupId: groupMembers.groupId,
        role: groupMembers.role,
        joinedAt: groupMembers.joinedAt,
        user: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatar: users.avatar,
          isOnline: users.isOnline,
          lastSeenAt: users.lastSeenAt,
        },
      })
      .from(groupMembers)
      .innerJoin(users, eq(groupMembers.userId, users.id))
      .where(eq(groupMembers.groupId, groupId))
      .orderBy(desc(groupMembers.role), desc(groupMembers.joinedAt))
      .limit(limit)
      .offset(offset);

    const members: GroupMemberResult[] = membersQuery.map((member) => ({
      id: member.id,
      userId: member.userId,
      groupId: member.groupId,
      role: member.role as "admin" | "moderator" | "member",
      joinedAt: Number(member.joinedAt),
      user: {
        ...member.user,
        lastSeenAt: member.user.lastSeenAt
          ? Number(member.user.lastSeenAt)
          : null,
      },
    }));

    // Get total count
    const totalQuery = await db
      .select({ count: sql<number>`count(*)` })
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId));

    const totalResult = await totalQuery;
    const total = totalResult[0]?.count || 0;

    return {
      members,
      total,
    };
  } catch (error) {
    console.error("Error getting group members:", error);
    throw error;
  }
};

/**
 * Update member role in group
 * @param c Hono context
 * @param groupId Group ID
 * @param memberId Member user ID to update
 * @param newRole New role for the member
 * @returns Updated membership result
 */
export const updateMemberRole = async (
  c: Context<DefaultContext>,
  groupId: string,
  memberId: string,
  newRole: "admin" | "moderator" | "member"
): Promise<GroupMemberResult> => {
  const currentUser = getCurrentUser(c);
  const db = c.get("db");

  if (!currentUser) {
    throw new Error("User not authenticated");
  }

  try {
    // Check if current user is an admin of the group
    const currentUserMembership = await db
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

    if (
      currentUserMembership.length === 0 ||
      currentUserMembership[0].role !== "admin"
    ) {
      throw new Error("Only group admins can update member roles");
    }

    // Check if target member exists in the group
    const targetMembership = await db
      .select()
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, memberId)
        )
      )
      .limit(1);

    if (targetMembership.length === 0) {
      throw new Error("Member not found in group");
    }

    // Update member role
    const result = await db
      .update(groupMembers)
      .set({
        role: newRole,
      })
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, memberId)
        )
      )
      .returning();

    const updatedMembership = result[0];

    // Get user details for response
    const userDetails = await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatar: users.avatar,
        isOnline: users.isOnline,
        lastSeenAt: users.lastSeenAt,
      })
      .from(users)
      .where(eq(users.id, memberId))
      .limit(1);

    return {
      id: updatedMembership.id,
      userId: updatedMembership.userId,
      groupId: updatedMembership.groupId,
      role: updatedMembership.role as "admin" | "moderator" | "member",
      joinedAt: Number(updatedMembership.joinedAt),
      user: userDetails[0]
        ? {
            ...userDetails[0],
            lastSeenAt: userDetails[0].lastSeenAt
              ? Number(userDetails[0].lastSeenAt)
              : null,
          }
        : {
            id: memberId,
            username: null,
            displayName: null,
            avatar: null,
            isOnline: null,
            lastSeenAt: null,
          },
    };
  } catch (error) {
    console.error("Error updating member role:", error);
    throw error;
  }
};

/**
 * Remove member from group
 * @param c Hono context
 * @param groupId Group ID
 * @param memberId Member user ID to remove
 * @returns Removal result
 */
export const removeMember = async (
  c: Context<DefaultContext>,
  groupId: string,
  memberId: string
): Promise<JoinGroupResult> => {
  const currentUser = getCurrentUser(c);
  const db = c.get("db");

  if (!currentUser) {
    throw new Error("User not authenticated");
  }

  try {
    // Check if current user is an admin of the group
    const currentUserMembership = await db
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

    if (
      currentUserMembership.length === 0 ||
      currentUserMembership[0].role !== "admin"
    ) {
      throw new Error("Only group admins can remove members");
    }

    // Cannot remove the group creator
    const group = await db
      .select({
        createdBy: groups.createdBy,
      })
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1);

    if (group.length === 0) {
      throw new Error("Group not found");
    }

    if (group[0].createdBy === memberId) {
      throw new Error("Cannot remove the group creator");
    }

    // Remove member
    await db
      .delete(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, memberId)
        )
      );

    // Update group member count
    await updateGroupMemberCount(c, groupId, -1);

    return {
      success: true,
      message: "Member removed from group successfully",
    };
  } catch (error) {
    console.error("Error removing member:", error);
    throw error;
  }
};
