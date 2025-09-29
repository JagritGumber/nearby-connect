import { eq, and } from "drizzle-orm";
import { Context } from "hono";
import { pushTokens, notificationPreferences } from "../db/schema";
import { DefaultContext } from "../types/context";

interface ExpoPushResponse {
  data?: Array<{
    status: string;
    message?: string;
    details?: Record<string, unknown>;
  }>;
  errors?: Array<{
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }>;
}

export interface NotificationPayload {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null | undefined;
  badge?: number | undefined;
  priority?: "default" | "normal" | "high";
  categoryId?: string | undefined;
  channelId?: string | undefined;
}

interface PushTokenRecord {
  id: string;
  token: string;
  userId: string;
  platform: string;
  isActive: boolean | null;
  lastUsedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface NotificationPreferencesRecord {
  id: string;
  userId: string;
  newMessages: boolean;
  newMessagesSound: boolean;
  newMessagesVibration: boolean;
  friendRequests: boolean;
  friendRequestsSound: boolean;
  friendRequestsVibration: boolean;
  marketplaceInquiries: boolean;
  marketplaceInquiriesSound: boolean;
  marketplaceInquiriesVibration: boolean;
  groupInvitations: boolean;
  groupInvitationsSound: boolean;
  groupInvitationsVibration: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone: string;
  createdAt: number;
  updatedAt: number;
}

export interface NotificationTemplate {
  title: string;
  body: string;
  sound?: "default" | null;
  badge?: number;
  categoryId?: string;
}

export type NotificationType =
  | "new_message"
  | "friend_request"
  | "marketplace_inquiry"
  | "group_invitation"
  | "mention";

export class NotificationService {
  private expoPushUrl = "https://exp.host/--/api/v2/push/send";

  constructor(private context: Context<DefaultContext>) {}

  /**
   * Send push notification to a user
   */
  async sendNotification(
    userId: string,
    type: NotificationType,
    template: NotificationTemplate,
    data?: Record<string, unknown>
  ): Promise<boolean> {
    try {
      // Get user's push tokens
      const tokens = await this.getUserPushTokens(userId);
      if (tokens.length === 0) {
        console.log(`No push tokens found for user ${userId}`);
        return false;
      }

      // Check notification preferences
      const preferences = await this.getUserNotificationPreferences(userId);
      if (!this.shouldSendNotification(type, preferences)) {
        console.log(`User ${userId} has disabled ${type} notifications`);
        return false;
      }

      // Check quiet hours
      if (this.isInQuietHours(preferences)) {
        console.log(`User ${userId} is in quiet hours`);
        return false;
      }

      // Prepare notification payload
      const payload = this.createNotificationPayload(
        tokens.map((tokenRecord) => tokenRecord.token),
        template,
        data,
        preferences
      );

      // Send to Expo Push API
      const result = await this.sendToExpo(payload);

      // Update token usage
      await this.updateTokenUsage(tokens);

      return result.success;
    } catch (error) {
      console.error("Error sending notification:", error);
      return false;
    }
  }

  /**
   * Send notification to multiple users
   */
  async sendBulkNotification(
    userIds: string[],
    type: NotificationType,
    template: NotificationTemplate,
    data?: Record<string, unknown>
  ): Promise<{ success: boolean; sentCount: number; failedCount: number }> {
    let sentCount = 0;
    let failedCount = 0;

    // Process in batches to avoid overwhelming the API
    const batchSize = 10;
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);

      const batchPromises = batch.map(async (userId) => {
        try {
          const success = await this.sendNotification(
            userId,
            type,
            template,
            data
          );
          return success;
        } catch (error) {
          console.error(`Error sending notification to user ${userId}:`, error);
          return false;
        }
      });

      const results = await Promise.all(batchPromises);
      sentCount += results.filter((r) => r).length;
      failedCount += results.filter((r) => !r).length;
    }

    return {
      success: failedCount === 0,
      sentCount,
      failedCount,
    };
  }

  /**
   * Register or update push token for user
   */
  async registerPushToken(
    userId: string,
    token: string,
    platform: "ios" | "android",
    deviceId?: string,
    appVersion?: string
  ): Promise<void> {
    const db = this.context.get("db");

    // Check if token already exists
    const existingToken = await db
      .select()
      .from(pushTokens)
      .where(and(eq(pushTokens.userId, userId), eq(pushTokens.token, token)))
      .limit(1);

    if (existingToken.length > 0) {
      // Update existing token
      await db
        .update(pushTokens)
        .set({
          isActive: true,
          lastUsedAt: new Date(),
          appVersion,
          updatedAt: new Date(),
        })
        .where(eq(pushTokens.id, existingToken[0].id));
    } else {
      // Create new token entry
      await db.insert(pushTokens).values({
        id: crypto.randomUUID(),
        userId,
        token,
        deviceId,
        platform,
        appVersion,
        isActive: true,
        lastUsedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  /**
   * Remove push token
   */
  async removePushToken(userId: string, token: string): Promise<void> {
    const db = this.context.get("db");

    await db
      .update(pushTokens)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(and(eq(pushTokens.userId, userId), eq(pushTokens.token, token)));
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(
    userId: string,
    preferences: Partial<typeof notificationPreferences.$inferInsert>
  ): Promise<void> {
    const db = this.context.get("db");

    // Check if preferences exist
    const existing = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      // Update existing preferences
      await db
        .update(notificationPreferences)
        .set({
          ...preferences,
          updatedAt: new Date(),
        })
        .where(eq(notificationPreferences.id, existing[0].id));
    } else {
      // Create new preferences with defaults
      await db.insert(notificationPreferences).values({
        id: crypto.randomUUID(),
        userId,
        newMessages: true,
        newMessagesSound: true,
        newMessagesVibration: true,
        friendRequests: true,
        friendRequestsSound: true,
        friendRequestsVibration: true,
        marketplaceInquiries: true,
        marketplaceInquiriesSound: true,
        marketplaceInquiriesVibration: true,
        groupInvitations: true,
        groupInvitationsSound: true,
        groupInvitationsVibration: true,
        timezone: "UTC",
        ...preferences,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  /**
   * Get notification templates for different types
   */
  getNotificationTemplate(
    type: NotificationType,
    data?: Record<string, unknown>
  ): NotificationTemplate {
    const templates: Record<NotificationType, NotificationTemplate> = {
      new_message: {
        title: (data as { senderName?: string })?.senderName
          ? `New message from ${(data as { senderName?: string }).senderName}`
          : "New message",
        body:
          (data as { messageContent?: string })?.messageContent ||
          "You have received a new message",
        sound: "default",
        categoryId: "MESSAGE",
      },
      friend_request: {
        title: "New friend request",
        body: (data as { senderName?: string })?.senderName
          ? `${
              (data as { senderName?: string }).senderName
            } sent you a friend request`
          : "You have a new friend request",
        sound: "default",
        categoryId: "FRIEND_REQUEST",
      },
      marketplace_inquiry: {
        title: "Marketplace inquiry",
        body: (data as { itemTitle?: string })?.itemTitle
          ? `Someone is interested in your "${
              (data as { itemTitle?: string }).itemTitle
            }"`
          : "You have a marketplace inquiry",
        sound: "default",
        categoryId: "MARKETPLACE",
      },
      group_invitation: {
        title: "Group invitation",
        body: (data as { groupName?: string })?.groupName
          ? `You've been invited to join "${
              (data as { groupName?: string }).groupName
            }"`
          : "You have a group invitation",
        sound: "default",
        categoryId: "GROUP",
      },
      mention: {
        title: "You were mentioned",
        body: (data as { mentionerName?: string })?.mentionerName
          ? `${
              (data as { mentionerName?: string }).mentionerName
            } mentioned you`
          : "You were mentioned",
        sound: "default",
        categoryId: "MENTION",
      },
    };

    return templates[type];
  }

  /**
   * Private methods
   */
  private async getUserPushTokens(userId: string) {
    const db = this.context.get("db");

    return await db
      .select()
      .from(pushTokens)
      .where(and(eq(pushTokens.userId, userId), eq(pushTokens.isActive, true)));
  }

  private async getUserNotificationPreferences(userId: string) {
    const db = this.context.get("db");

    const preferences = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);

    return preferences[0];
  }

  private shouldSendNotification(
    type: NotificationType,
    preferences: Record<string, unknown> | undefined
  ): boolean {
    if (!preferences) return true; // Default to enabled if no preferences set

    switch (type) {
      case "new_message":
        return preferences.newMessages === 1;
      case "friend_request":
        return preferences.friendRequests === 1;
      case "marketplace_inquiry":
        return preferences.marketplaceInquiries === 1;
      case "group_invitation":
        return preferences.groupInvitations === 1;
      case "mention":
        return preferences.newMessages === 1; // Mentions use message preferences
      default:
        return true;
    }
  }

  private isInQuietHours(
    preferences: Record<string, unknown> | undefined
  ): boolean {
    if (!preferences?.quietHoursStart || !preferences?.quietHoursEnd) {
      return false;
    }

    const now = new Date();
    const userTime = new Date(
      now.toLocaleString("en-US", { timeZone: (preferences as { timezone?: string })?.timezone || "UTC" })
    );
    const currentTime = userTime.getHours() * 60 + userTime.getMinutes();

    const quietHoursStart = (preferences as { quietHoursStart?: string })?.quietHoursStart;
    const quietHoursEnd = (preferences as { quietHoursEnd?: string })?.quietHoursEnd;

    if (!quietHoursStart || !quietHoursEnd) {
      return false;
    }

    const [startHour, startMin] = quietHoursStart.split(":").map(Number);
    const [endHour, endMin] = quietHoursEnd.split(":").map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime <= endTime) {
      // Same day quiet hours
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Overnight quiet hours
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  private createNotificationPayload(
    tokens: string[],
    template: NotificationTemplate,
    data?: Record<string, unknown>,
    preferences?: Record<string, unknown>
  ): NotificationPayload[] {
    return tokens.map((token) => ({
      to: token,
      title: template.title,
      body: template.body,
      data: data || {},
      sound: this.shouldPlaySound(template, preferences)
        ? template.sound
        : null,
      badge: template.badge,
      priority: template.categoryId === "MESSAGE" ? "high" : "default",
      categoryId: template.categoryId,
      channelId: this.getChannelId(template.categoryId, preferences),
    }));
  }

  private shouldPlaySound(
    template: NotificationTemplate,
    preferences?: Record<string, unknown>
  ): boolean {
    if (!preferences || !template.categoryId) return true;

    switch (template.categoryId) {
      case "MESSAGE":
        return (preferences as { newMessagesSound?: number })?.newMessagesSound === 1;
      case "FRIEND_REQUEST":
        return (preferences as { friendRequestsSound?: number })?.friendRequestsSound === 1;
      case "MARKETPLACE":
        return (preferences as { marketplaceInquiriesSound?: number })?.marketplaceInquiriesSound === 1;
      case "GROUP":
        return (preferences as { groupInvitationsSound?: number })?.groupInvitationsSound === 1;
      default:
        return true;
    }
  }

  private getChannelId(
    categoryId?: string,
    preferences?: Record<string, unknown>
  ): string | undefined {
    if (!preferences || !categoryId) return undefined;

    // Return appropriate channel ID based on notification type and vibration preference
    switch (categoryId) {
      case "MESSAGE":
        return (preferences as { newMessagesVibration?: number })?.newMessagesVibration === 1
          ? "messages_with_vibration"
          : "messages_silent";
      case "FRIEND_REQUEST":
        return (preferences as { friendRequestsVibration?: number })?.friendRequestsVibration === 1
          ? "friend_requests_with_vibration"
          : "friend_requests_silent";
      case "MARKETPLACE":
        return (preferences as { marketplaceInquiriesVibration?: number })?.marketplaceInquiriesVibration === 1
          ? "marketplace_with_vibration"
          : "marketplace_silent";
      case "GROUP":
        return (preferences as { groupInvitationsVibration?: number })?.groupInvitationsVibration === 1
          ? "groups_with_vibration"
          : "groups_silent";
      default:
        return undefined;
    }
  }

  private async sendToExpo(
    payload: NotificationPayload[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(this.expoPushUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(
          `Expo API error: ${response.status} ${response.statusText}`
        );
      }

      const result = (await response.json()) as ExpoPushResponse;

      // Check for errors in the response
      if (result.errors && result.errors.length > 0) {
        console.error("Expo push errors:", result.errors);
        return { success: false, error: "Some notifications failed to send" };
      }

      return { success: true };
    } catch (error) {
      console.error("Error sending to Expo:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async updateTokenUsage(tokens: PushTokenRecord[]): Promise<void> {
    const db = this.context.get("db");
    const now = Date.now();

    // Update last used timestamp for all tokens
    await Promise.all(
      tokens.map((token) =>
        db
          .update(pushTokens)
          .set({ lastUsedAt: new Date(), updatedAt: new Date() })
          .where(eq(pushTokens.id, token.id))
      )
    );
  }
}
