import { DurableObject } from "cloudflare:workers";

/**
 * ChatRoom Durable Object manages real-time chat functionality for a specific chat room.
 * Handles WebSocket connections, message broadcasting, typing indicators, and user presence.
 */
export class ChatRoomDurableObject extends DurableObject {
  private connections: Map<string, WebSocket> = new Map();
  private userConnections: Map<string, Set<string>> = new Map(); // userId -> Set of connectionIds
  private typingUsers: Set<string> = new Set();
  private heartbeatIntervals: Map<string, number> = new Map();

  /**
   * Handle HTTP requests to the Durable Object
   */
  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    switch (url.pathname) {
      case "/websocket":
        return this.handleWebSocketUpgrade(request);
      case "/message":
        return this.handleMessageRequest(request);
      case "/typing":
        return this.handleTypingRequest(request);
      case "/presence":
        return this.handlePresenceRequest(request);
      default:
        return new Response("Not Found", { status: 404 });
    }
  }

  /**
   * Handle WebSocket upgrade requests
   */
  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get("Upgrade");
    if (upgradeHeader !== "websocket") {
      return new Response("Expected websocket", { status: 400 });
    }

    const { 0: client, 1: server } = new WebSocketPair();
    server.accept();

    // Generate unique connection ID
    const connectionId = crypto.randomUUID();
    const userId = this.getUserIdFromRequest(request);

    // Store connection
    this.connections.set(connectionId, server);
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(connectionId);

    // Set up heartbeat
    this.setupHeartbeat(connectionId, server);

    // Handle WebSocket events
    this.handleWebSocketEvents(connectionId, server, userId);

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Handle message requests (for sending messages)
   */
  private async handleMessageRequest(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const messageData = (await request.json()) as {
        content: string;
        type: string;
        metadata?: any;
      };
      const userId = this.getUserIdFromRequest(request);

      // Validate message data
      if (!messageData.content || !messageData.type) {
        return new Response("Invalid message data", { status: 400 });
      }

      // Broadcast message to all connected users
      await this.broadcastMessage({
        type: "message",
        data: {
          id: crypto.randomUUID(),
          content: messageData.content,
          type: messageData.type,
          senderId: userId,
          timestamp: Date.now(),
          metadata: messageData.metadata || {},
        },
      });

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
      const typingData = (await request.json()) as { isTyping: boolean };
      const userId = this.getUserIdFromRequest(request);

      if (typingData.isTyping) {
        this.typingUsers.add(userId);
      } else {
        this.typingUsers.delete(userId);
      }

      // Broadcast typing indicator
      await this.broadcastMessage({
        type: "typing",
        data: {
          userId,
          isTyping: typingData.isTyping,
          timestamp: Date.now(),
        },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response("Internal server error", { status: 500 });
    }
  }

  /**
   * Handle presence requests
   */
  private async handlePresenceRequest(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    try {
      const presenceData = await request.json() as { status: string };
      const userId = this.getUserIdFromRequest(request);

      // Broadcast presence update
      await this.broadcastMessage({
        type: "presence",
        data: {
          userId,
          status: presenceData.status,
          timestamp: Date.now(),
        },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      return new Response("Internal server error", { status: 500 });
    }
  }

  /**
   * Set up heartbeat for connection monitoring
   */
  private setupHeartbeat(connectionId: string, ws: WebSocket): void {
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      } else {
        this.removeConnection(connectionId);
        clearInterval(interval);
      }
    }, 30000); // 30 seconds

    this.heartbeatIntervals.set(connectionId, interval as any);
  }

  /**
   * Handle WebSocket events
   */
  private handleWebSocketEvents(
    connectionId: string,
    ws: WebSocket,
    userId: string
  ): void {
    ws.addEventListener("message", async (event) => {
      try {
        const message = JSON.parse(event.data.toString());

        switch (message.type) {
          case "pong":
            // Heartbeat response - connection is alive
            break;
          case "message":
            await this.handleClientMessage(message.data, userId);
            break;
          case "typing":
            await this.handleTypingIndicator(message.data, userId);
            break;
          default:
            console.log("Unknown message type:", message.type);
        }
      } catch (error) {
        console.error("Error handling WebSocket message:", error);
      }
    });

    ws.addEventListener("close", () => {
      this.removeConnection(connectionId);
    });

    ws.addEventListener("error", () => {
      this.removeConnection(connectionId);
    });
  }

  /**
   * Handle messages from clients
   */
  private async handleClientMessage(
    messageData: any,
    userId: string
  ): Promise<void> {
    // Broadcast message to all connected users except sender
    await this.broadcastMessage({
      type: "message",
      data: {
        id: crypto.randomUUID(),
        content: messageData.content,
        type: messageData.type || "text",
        senderId: userId,
        timestamp: Date.now(),
        metadata: messageData.metadata || {},
      },
    });
  }

  /**
   * Handle typing indicators from clients
   */
  private async handleTypingIndicator(
    typingData: any,
    userId: string
  ): Promise<void> {
    if (typingData.isTyping) {
      this.typingUsers.add(userId);
    } else {
      this.typingUsers.delete(userId);
    }

    // Broadcast typing indicator to all users except sender
    await this.broadcastMessage({
      type: "typing",
      data: {
        userId,
        isTyping: typingData.isTyping,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Broadcast message to all connected users
   */
  private async broadcastMessage(message: any): Promise<void> {
    const messageStr = JSON.stringify(message);
    const deadConnections: string[] = [];

    for (const [connectionId, ws] of this.connections) {
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
      this.removeConnection(connectionId);
    }
  }

  /**
   * Remove a connection and clean up associated data
   */
  private removeConnection(connectionId: string): void {
    const ws = this.connections.get(connectionId);
    if (ws) {
      ws.close();
      this.connections.delete(connectionId);
    }

    // Remove from heartbeat intervals
    const interval = this.heartbeatIntervals.get(connectionId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(connectionId);
    }

    // Remove from user connections
    for (const [userId, connectionIds] of this.userConnections) {
      if (connectionIds.has(connectionId)) {
        connectionIds.delete(connectionId);
        if (connectionIds.size === 0) {
          this.userConnections.delete(userId);
          // User disconnected completely - broadcast offline status
          this.broadcastMessage({
            type: "presence",
            data: {
              userId,
              status: "offline",
              timestamp: Date.now(),
            },
          });
        }
        break;
      }
    }
  }

  /**
   * Extract user ID from request (from headers or query params)
   */
  private getUserIdFromRequest(request: Request): string {
    // Try to get user ID from headers first (set by auth middleware)
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

    // If no user ID found, generate a temporary one or throw error
    throw new Error("User ID not found in request");
  }

  /**
   * Get current state of the chat room
   */
  async getState(): Promise<{
    connectionCount: number;
    userCount: number;
    typingUsers: string[];
  }> {
    return {
      connectionCount: this.connections.size,
      userCount: this.userConnections.size,
      typingUsers: Array.from(this.typingUsers),
    };
  }
}
