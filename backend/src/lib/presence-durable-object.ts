import { DurableObject } from "cloudflare:workers";

/**
 * Interface for user presence data
 */
interface UserPresence {
  userId: string;
  status: "online" | "away" | "offline";
  lastSeenAt: number;
  deviceInfo?: string | undefined;
  currentChatId?: string | undefined;
  isTyping?: boolean | undefined;
  typingInChatId?: string | undefined;
}

/**
 * Interface for typing indicator data
 */
interface TypingIndicator {
  userId: string;
  chatId: string;
  timestamp: number;
}

/**
 * Presence Durable Object manages user presence, typing indicators, and online status
 * across the entire platform. Provides real-time presence information for all users.
 */
export class PresenceDurableObject extends DurableObject {
  private userPresence: Map<string, UserPresence> = new Map();
  private typingIndicators: Map<string, TypingIndicator> = new Map();
  private presenceSubscribers: Map<string, WebSocket> = new Map();
  private heartbeatIntervals: Map<string, number> = new Map();

  /**
   * Handle HTTP requests to the Durable Object
   */
  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    switch (url.pathname) {
      case "/websocket":
        return this.handleWebSocketUpgrade(request);
      case "/presence":
        return this.handlePresenceRequest(request);
      case "/typing":
        return this.handleTypingRequest(request);
      case "/status":
        return this.handleStatusRequest(request);
      default:
        return new Response("Not Found", { status: 404 });
    }
  }

  /**
   * Handle WebSocket upgrade for presence subscriptions
   */
  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected websocket", { status: 400 });
    }

    const { 0: client, 1: server } = new WebSocketPair();
    server.accept();

    const connectionId = crypto.randomUUID();
    this.presenceSubscribers.set(connectionId, server);

    // Set up heartbeat
    this.setupHeartbeat(connectionId, server);

    // Send current presence state to new subscriber
    await this.sendCurrentPresenceState(server);

    // Handle WebSocket events
    this.handlePresenceWebSocketEvents(connectionId, server);

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Handle presence update requests
   */
  private async handlePresenceRequest(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const presenceData = (await request.json()) as {
        userId: string;
        status: "online" | "away" | "offline";
        deviceInfo?: string;
        currentChatId?: string;
      };

      const userId = this.getUserIdFromRequest(request);

      // Update user presence
      const updatedPresence: UserPresence = {
        userId,
        status: presenceData.status,
        lastSeenAt: Date.now(),
        deviceInfo: presenceData.deviceInfo,
        currentChatId: presenceData.currentChatId,
      };

      this.userPresence.set(userId, updatedPresence);

      // Broadcast presence update to all subscribers
      await this.broadcastPresenceUpdate({
        type: "presence_update",
        data: updatedPresence,
      });

      // Store in Durable Object storage for persistence
      await this.ctx.storage.put(`presence:${userId}`, updatedPresence);

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response("Internal server error", { status: 500 });
    }
  }

  /**
   * Handle typing indicator requests
   */
  private async handleTypingRequest(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const typingData = (await request.json()) as {
        chatId: string;
        isTyping: boolean;
      };

      const userId = this.getUserIdFromRequest(request);

      if (typingData.isTyping) {
        // User started typing
        const typingIndicator: TypingIndicator = {
          userId,
          chatId: typingData.chatId,
          timestamp: Date.now(),
        };

        this.typingIndicators.set(
          `${userId}:${typingData.chatId}`,
          typingIndicator
        );

        // Update user presence to show typing status
        const currentPresence = this.userPresence.get(userId);
        if (currentPresence) {
          currentPresence.isTyping = true;
          currentPresence.typingInChatId = typingData.chatId;
          this.userPresence.set(userId, currentPresence);
        }

        // Broadcast typing indicator
        await this.broadcastPresenceUpdate({
          type: "typing_start",
          data: typingIndicator,
        });
      } else {
        // User stopped typing
        const typingKey = `${userId}:${typingData.chatId}`;
        this.typingIndicators.delete(typingKey);

        // Update user presence to remove typing status
        const currentPresence = this.userPresence.get(userId);
        if (currentPresence) {
          currentPresence.isTyping = false;
          currentPresence.typingInChatId = undefined;
          this.userPresence.set(userId, currentPresence);
        }

        // Broadcast typing stop
        await this.broadcastPresenceUpdate({
          type: "typing_stop",
          data: {
            userId,
            chatId: typingData.chatId,
            timestamp: Date.now(),
          },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response("Internal server error", { status: 500 });
    }
  }

  /**
   * Handle status requests (GET current presence state)
   */
  private async handleStatusRequest(request: Request): Promise<Response> {
    try {
      const userId = this.getUserIdFromRequest(request);
      const presence = this.userPresence.get(userId);

      if (!presence) {
        return new Response(JSON.stringify({ status: "offline" }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(presence), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response("Internal server error", { status: 500 });
    }
  }

  /**
   * Set up heartbeat for presence monitoring
   */
  private setupHeartbeat(connectionId: string, ws: WebSocket): void {
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      } else {
        this.removePresenceSubscriber(connectionId);
        clearInterval(interval);
      }
    }, 30000); // 30 seconds

    this.heartbeatIntervals.set(connectionId, interval as any);
  }

  /**
   * Handle WebSocket events for presence subscribers
   */
  private handlePresenceWebSocketEvents(
    connectionId: string,
    ws: WebSocket
  ): void {
    ws.addEventListener("message", async (event) => {
      try {
        const message = JSON.parse(event.data.toString());

        if (message.type === "pong") {
          // Heartbeat response - connection is alive
          return;
        }

        // Handle other presence-related messages if needed
        console.log("Presence WebSocket message:", message);
      } catch (error) {
        console.error("Error handling presence WebSocket message:", error);
      }
    });

    ws.addEventListener("close", () => {
      this.removePresenceSubscriber(connectionId);
    });

    ws.addEventListener("error", () => {
      this.removePresenceSubscriber(connectionId);
    });
  }

  /**
   * Send current presence state to a new subscriber
   */
  private async sendCurrentPresenceState(ws: WebSocket): Promise<void> {
    const presenceArray = Array.from(this.userPresence.values());
    const typingArray = Array.from(this.typingIndicators.values());

    const stateMessage = {
      type: "presence_state",
      data: {
        users: presenceArray,
        typing: typingArray,
        timestamp: Date.now(),
      },
    };

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(stateMessage));
    }
  }

  /**
   * Broadcast presence update to all subscribers
   */
  private async broadcastPresenceUpdate(update: any): Promise<void> {
    const messageStr = JSON.stringify(update);
    const deadConnections: string[] = [];

    for (const [connectionId, ws] of this.presenceSubscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(messageStr);
        } catch (error) {
          deadConnections.push(connectionId);
        }
      } else {
        deadConnections.push(connectionId);
      }
    }

    // Clean up dead connections
    for (const connectionId of deadConnections) {
      this.removePresenceSubscriber(connectionId);
    }
  }

  /**
   * Remove a presence subscriber and clean up
   */
  private removePresenceSubscriber(connectionId: string): void {
    const ws = this.presenceSubscribers.get(connectionId);
    if (ws) {
      ws.close();
      this.presenceSubscribers.delete(connectionId);
    }

    // Remove from heartbeat intervals
    const interval = this.heartbeatIntervals.get(connectionId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(connectionId);
    }
  }

  /**
   * Extract user ID from request
   */
  private getUserIdFromRequest(request: Request): string {
    // Try to get user ID from headers first
    const userId =
      request.headers.get("X-User-ID") ||
      request.headers.get("CF-Access-JWT-Claims");

    if (userId) {
      return userId;
    }

    // Fallback to query parameter
    const url = new URL(request.url);
    const queryUserId = url.searchParams.get("userId");

    if (queryUserId) {
      return queryUserId;
    }

    throw new Error("User ID not found in request");
  }

  /**
   * Get current presence state for all users
   */
  async getAllPresence(): Promise<UserPresence[]> {
    return Array.from(this.userPresence.values());
  }

  /**
   * Get presence for a specific user
   */
  async getUserPresence(userId: string): Promise<UserPresence | undefined> {
    return this.userPresence.get(userId);
  }

  /**
   * Get typing indicators for a specific chat
   */
  async getTypingIndicators(chatId: string): Promise<TypingIndicator[]> {
    return Array.from(this.typingIndicators.values()).filter(
      (indicator) => indicator.chatId === chatId
    );
  }

  /**
   * Clean up expired typing indicators (older than 10 seconds)
   */
  private async cleanupExpiredTypingIndicators(): Promise<void> {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, indicator] of this.typingIndicators) {
      if (now - indicator.timestamp > 10000) {
        // 10 seconds
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      const indicator = this.typingIndicators.get(key);
      if (indicator) {
        this.typingIndicators.delete(key);

        // Update user presence
        const userPresence = this.userPresence.get(indicator.userId);
        if (userPresence) {
          userPresence.isTyping = false;
          userPresence.typingInChatId = undefined;
          this.userPresence.set(indicator.userId, userPresence);
        }

        // Broadcast typing stop
        await this.broadcastPresenceUpdate({
          type: "typing_stop",
          data: {
            userId: indicator.userId,
            chatId: indicator.chatId,
            timestamp: now,
          },
        });
      }
    }
  }

  /**
   * Periodic cleanup of expired data
   */
  override async alarm(): Promise<void> {
    await this.cleanupExpiredTypingIndicators();

    // Clean up old presence data (users not seen for 5 minutes)
    const fiveMinutesAgo = Date.now() - 300000;
    for (const [userId, presence] of this.userPresence) {
      if (
        presence.lastSeenAt < fiveMinutesAgo &&
        presence.status === "online"
      ) {
        presence.status = "offline";
        this.userPresence.set(userId, presence);

        await this.broadcastPresenceUpdate({
          type: "presence_update",
          data: presence,
        });
      }
    }
  }
}
