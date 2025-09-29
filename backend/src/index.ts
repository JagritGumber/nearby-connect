import { Hono } from "hono";
import { databaseMiddleware } from "./lib/database";
import { HealthCheckService } from "./lib/health-check";
import { createClerkMiddleware, requireAuth } from "./lib/auth";
import {
  getOrCreateUser,
  updateUserProfile,
  updateUserLocation,
  updateUserOnlineStatus,
} from "./lib/user-service";
import {
  discoverUsers,
  DiscoveryFilters,
  getUserProfile as getDiscoveryUserProfile,
} from "./lib/discovery-service";
import {
  sendFriendRequest,
  updateFriendRequest,
  getPendingFriendRequests,
  getFriendsList,
} from "./lib/friend-service";
import { getUserFeed, getUserPosts } from "./lib/feed-service";
import {
  createGroup,
  getGroups,
  getGroupById,
  GroupFilters,
} from "./lib/groups-service";
import {
  joinGroup,
  leaveGroup,
  getGroupMembers,
  updateMemberRole,
  removeMember,
} from "./lib/group-membership-service";
import {
  createListing,
  getListings,
  getListingById,
  updateListing,
  deleteListing,
  searchListings,
  MarketplaceFilters,
} from "./lib/marketplace-service";
import { DefaultContext } from "./types/context";
import { ChatRoomDurableObject } from "./lib/chat-room-durable-object";
import { PresenceDurableObject } from "./lib/presence-durable-object";
import { messages, chats } from "./db/schema";
import { eq } from "drizzle-orm";
import { createR2Service } from "./lib/r2-service";
import {
  validateFile,
  checkUploadRateLimit,
  checkFileAccess,
  FILE_TYPE_CATEGORIES,
} from "./lib/file-utils";
import { FileCategory, FILE_UPLOAD_CONFIG } from "./lib/r2-service";

// Interface for ChatRoom Durable Object stub
interface ChatRoomStub {
  fetch(request: Request): Promise<Response>;
  getState(): Promise<{
    connectionCount: number;
    userCount: number;
    typingUsers: string[];
  }>;
}

const app = new Hono<DefaultContext>();

// Database middleware to inject database instances
app.use("*", async (c, next) => {
  const { client, db } = databaseMiddleware(c.env);
  c.set("client", client);
  c.set("db", db);
  await next();
});

// Clerk authentication middleware
app.use("*", createClerkMiddleware());

// Health check endpoint
app.get("/health", async (c) => {
  try {
    const client = c.get("client");
    const healthService = new HealthCheckService(client);
    const healthResult = await healthService.performHealthCheck();

    return c.json(healthResult);
  } catch (error) {
    return c.json(
      {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Database readiness check
app.get("/ready", async (c) => {
  try {
    const client = c.get("client");
    const healthService = new HealthCheckService(client);
    const isReady = await healthService.isReady();

    return c.json({
      status: isReady ? "ready" : "not_ready",
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Example API endpoint using database
app.get("/api/users", async (c) => {
  try {
    const db = c.get("db");
    const client = c.get("client");

    // Example query - you'll need to implement actual query builders
    // const users = await db.select().from(users).limit(10);

    return c.json({
      success: true,
      message: "Database connection established successfully",
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Database query failed",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Protected route example - get current user profile
app.get("/api/profile", requireAuth, async (c) => {
  try {
    const userProfile = await getOrCreateUser(c);

    return c.json({
      success: true,
      data: userProfile,
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get profile",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Protected route example - update user profile
app.put("/api/profile", requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const updatedProfile = await updateUserProfile(c, body);

    return c.json({
      success: true,
      data: updatedProfile,
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update profile",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Protected route example - update user location
app.put("/api/location", requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { latitude, longitude } = body;

    if (!latitude || !longitude) {
      return c.json(
        {
          success: false,
          error: "Latitude and longitude are required",
          timestamp: Date.now(),
        },
        400
      );
    }

    const updatedProfile = await updateUserLocation(c, latitude, longitude);

    return c.json({
      success: true,
      data: updatedProfile,
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update location",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Protected route example - update online status
app.put("/api/status", requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { isOnline } = body;

    if (typeof isOnline !== "boolean") {
      return c.json(
        {
          success: false,
          error: "isOnline must be a boolean",
          timestamp: Date.now(),
        },
        400
      );
    }

    const updatedProfile = await updateUserOnlineStatus(c, isOnline);

    return c.json({
      success: true,
      data: updatedProfile,
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update status",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// ===== DISCOVERY ROUTES =====

// Location-based user discovery with geospatial filtering
app.get("/api/discover", requireAuth, async (c) => {
  try {
    const query = c.req.query();
    const filters: DiscoveryFilters = {};
    if (query.latitude) filters.latitude = parseFloat(query.latitude);
    if (query.longitude) filters.longitude = parseFloat(query.longitude);
    filters.radius = query.radius ? parseFloat(query.radius) : 50;
    filters.limit = query.limit ? parseInt(query.limit) : 20;
    filters.offset = query.offset ? parseInt(query.offset) : 0;
    filters.interests = query.interests ? query.interests.split(",") : [];

    const result = await discoverUsers(c, filters);

    return c.json({
      success: true,
      data: result,
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to discover users",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Get user profile for discovery
app.get("/api/users/:userId", requireAuth, async (c) => {
  try {
    const userId = c.req.param("userId");
    const userProfile = await getDiscoveryUserProfile(c, userId);

    if (!userProfile) {
      return c.json(
        {
          success: false,
          error: "User not found",
          timestamp: Date.now(),
        },
        404
      );
    }

    return c.json({
      success: true,
      data: userProfile,
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get user profile",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// ===== FRIEND REQUEST ROUTES =====

// Send friend request
app.post("/api/friend-requests", requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { receiverId } = body;

    if (!receiverId) {
      return c.json(
        {
          success: false,
          error: "Receiver ID is required",
          timestamp: Date.now(),
        },
        400
      );
    }

    const result = await sendFriendRequest(c, { receiverId });

    return c.json({
      success: true,
      data: result,
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to send friend request",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Update friend request (accept/reject)
app.put("/api/friend-requests/:id", requireAuth, async (c) => {
  try {
    const requestId = c.req.param("id");
    const body = await c.req.json();
    const { status } = body;

    if (!status || !["accepted", "rejected"].includes(status)) {
      return c.json(
        {
          success: false,
          error: "Status must be 'accepted' or 'rejected'",
          timestamp: Date.now(),
        },
        400
      );
    }

    const result = await updateFriendRequest(c, requestId, { status });

    return c.json({
      success: true,
      data: result,
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update friend request",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Get pending friend requests
app.get("/api/friend-requests", requireAuth, async (c) => {
  try {
    const result = await getPendingFriendRequests(c);

    return c.json({
      success: true,
      data: result,
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get friend requests",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Get friends list
app.get("/api/friends", requireAuth, async (c) => {
  try {
    const result = await getFriendsList(c);

    return c.json({
      success: true,
      data: result,
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get friends list",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// ===== FEED ROUTES =====

// Get user feed with 3:3:2 ratio
app.get("/api/feed", requireAuth, async (c) => {
  try {
    const query = c.req.query();
    const filters = {
      limit: query.limit ? parseInt(query.limit) : 20,
      offset: query.offset ? parseInt(query.offset) : 0,
      includeFriends: query.includeFriends !== "false",
      includeGroups: query.includeGroups !== "false",
      includeRecent: query.includeRecent !== "false",
    };

    const result = await getUserFeed(c, filters);

    return c.json({
      success: true,
      data: result,
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get feed",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Get posts from specific user
app.get("/api/users/:userId/posts", requireAuth, async (c) => {
  try {
    const userId = c.req.param("userId");
    const query = c.req.query();
    const limit = query.limit ? parseInt(query.limit) : 10;

    const result = await getUserPosts(c, userId, limit);

    return c.json({
      success: true,
      data: result,
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get user posts",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// ===== GROUP ROUTES =====

// Create new group
app.post("/api/groups", requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const result = await createGroup(c, body);

    return c.json({
      success: true,
      data: result,
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create group",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Get groups with filtering
app.get("/api/groups", requireAuth, async (c) => {
  try {
    const query = c.req.query();
    const filters: GroupFilters = {};
    if (query.category) filters.category = query.category;
    if (query.latitude) filters.latitude = parseFloat(query.latitude);
    if (query.longitude) filters.longitude = parseFloat(query.longitude);
    filters.radius = query.radius ? parseFloat(query.radius) : 50;
    filters.limit = query.limit ? parseInt(query.limit) : 20;
    filters.offset = query.offset ? parseInt(query.offset) : 0;
    filters.includePrivate = query.includePrivate === "true";

    const result = await getGroups(c, filters);

    return c.json({
      success: true,
      data: result,
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get groups",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Get group by ID
app.get("/api/groups/:id", requireAuth, async (c) => {
  try {
    const groupId = c.req.param("id");
    const result = await getGroupById(c, groupId);

    if (!result) {
      return c.json(
        {
          success: false,
          error: "Group not found",
          timestamp: Date.now(),
        },
        404
      );
    }

    return c.json({
      success: true,
      data: result,
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get group",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// ===== GROUP MEMBERSHIP ROUTES =====

// Join group
app.post("/api/groups/:id/join", requireAuth, async (c) => {
  try {
    const groupId = c.req.param("id");
    const result = await joinGroup(c, groupId);

    return c.json({
      success: true,
      data: result,
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to join group",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Leave group
app.post("/api/groups/:id/leave", requireAuth, async (c) => {
  try {
    const groupId = c.req.param("id");
    const result = await leaveGroup(c, groupId);

    return c.json({
      success: true,
      data: result,
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to leave group",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Get group members
app.get("/api/groups/:id/members", requireAuth, async (c) => {
  try {
    const groupId = c.req.param("id");
    const query = c.req.query();
    const limit = query.limit ? parseInt(query.limit) : 50;
    const offset = query.offset ? parseInt(query.offset) : 0;

    const result = await getGroupMembers(c, groupId, limit, offset);

    return c.json({
      success: true,
      data: result,
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get group members",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Update member role (admin only)
app.put("/api/groups/:id/members/:memberId/role", requireAuth, async (c) => {
  try {
    const groupId = c.req.param("id");
    const memberId = c.req.param("memberId");
    const body = await c.req.json();
    const { role } = body;

    if (!role || !["admin", "moderator", "member"].includes(role)) {
      return c.json(
        {
          success: false,
          error: "Role must be 'admin', 'moderator', or 'member'",
          timestamp: Date.now(),
        },
        400
      );
    }

    const result = await updateMemberRole(c, groupId, memberId, role);

    return c.json({
      success: true,
      data: result,
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update member role",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Remove member from group (admin only)
app.delete("/api/groups/:id/members/:memberId", requireAuth, async (c) => {
  try {
    const groupId = c.req.param("id");
    const memberId = c.req.param("memberId");

    const result = await removeMember(c, groupId, memberId);

    return c.json({
      success: true,
      data: result,
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to remove member",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// ===== MARKETPLACE ROUTES =====

// Create marketplace listing
app.post("/api/marketplace", requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const result = await createListing(c, body);

    return c.json({
      success: true,
      data: result,
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create listing",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Get marketplace listings
app.get("/api/marketplace", requireAuth, async (c) => {
  try {
    const query = c.req.query();
    const filters: MarketplaceFilters = {};
    if (query.category) filters.category = query.category;
    if (query.condition) filters.condition = query.condition;
    if (query.minPrice) filters.minPrice = parseFloat(query.minPrice);
    if (query.maxPrice) filters.maxPrice = parseFloat(query.maxPrice);
    if (query.latitude) filters.latitude = parseFloat(query.latitude);
    if (query.longitude) filters.longitude = parseFloat(query.longitude);
    filters.radius = query.radius ? parseFloat(query.radius) : 50;
    filters.status = (query.status as "active" | "sold") || "active";
    filters.limit = query.limit ? parseInt(query.limit) : 20;
    filters.offset = query.offset ? parseInt(query.offset) : 0;

    const result = await getListings(c, filters);

    return c.json({
      success: true,
      data: result,
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get listings",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Get specific marketplace listing
app.get("/api/marketplace/:id", requireAuth, async (c) => {
  try {
    const listingId = c.req.param("id");
    const result = await getListingById(c, listingId);

    if (!result) {
      return c.json(
        {
          success: false,
          error: "Listing not found",
          timestamp: Date.now(),
        },
        404
      );
    }

    return c.json({
      success: true,
      data: result,
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get listing",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Update marketplace listing
app.put("/api/marketplace/:id", requireAuth, async (c) => {
  try {
    const listingId = c.req.param("id");
    const body = await c.req.json();
    const result = await updateListing(c, listingId, body);

    return c.json({
      success: true,
      data: result,
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update listing",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Delete marketplace listing (soft delete)
app.delete("/api/marketplace/:id", requireAuth, async (c) => {
  try {
    const listingId = c.req.param("id");
    const result = await deleteListing(c, listingId);

    return c.json({
      success: true,
      data: result,
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to delete listing",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Search marketplace listings
app.get("/api/marketplace/search", requireAuth, async (c) => {
  try {
    const query = c.req.query("q");

    if (!query) {
      return c.json(
        {
          success: false,
          error: "Search query is required",
          timestamp: Date.now(),
        },
        400
      );
    }

    const limit = c.req.query("limit") ? parseInt(c.req.query("limit")!) : 20;
    const result = await searchListings(c, query, limit);

    return c.json({
      success: true,
      data: result,
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to search listings",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// ===== FILE STORAGE ROUTES =====

// Upload single file
app.post("/api/upload", requireAuth, async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json(
        {
          success: false,
          error: "User not authenticated",
          timestamp: Date.now(),
        },
        401
      );
    }

    // Check rate limiting
    if (!checkUploadRateLimit(user.id)) {
      return c.json(
        {
          success: false,
          error: "Upload rate limit exceeded. Please try again later.",
          timestamp: Date.now(),
        },
        429
      );
    }

    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    const category = ((formData.get("category") as string) ||
      FILE_TYPE_CATEGORIES.OTHER) as FileCategory;
    const isPublic = formData.get("isPublic") === "true";
    const expiresAt = formData.get("expiresAt")
      ? parseInt(formData.get("expiresAt") as string)
      : undefined;

    if (!file) {
      return c.json(
        {
          success: false,
          error: "No file provided",
          timestamp: Date.now(),
        },
        400
      );
    }

    // Validate file
    const validation = await validateFile(file);
    if (!validation.isValid) {
      return c.json(
        {
          success: false,
          error: "File validation failed",
          details: validation.errors,
          warnings: validation.warnings,
          timestamp: Date.now(),
        },
        400
      );
    }

    // Create R2 service and upload file
    const r2Service = createR2Service(c);
    const uploadOptions = {
      category,
      isPublic,
      ...(expiresAt && { expiresAt }),
      metadata: {
        uploadedBy: user,
        uploadSource: "api",
      },
    };

    const result = await r2Service.uploadFile(c, file, uploadOptions);

    return c.json({
      success: true,
      data: result,
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to upload file",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Upload multiple files
app.post("/api/upload/multiple", requireAuth, async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json(
        {
          success: false,
          error: "User not authenticated",
          timestamp: Date.now(),
        },
        401
      );
    }

    // Check rate limiting
    if (!checkUploadRateLimit(user.id)) {
      return c.json(
        {
          success: false,
          error: "Upload rate limit exceeded. Please try again later.",
          timestamp: Date.now(),
        },
        429
      );
    }

    const formData = await c.req.formData();
    const files = formData.getAll("files") as File[];
    const category = ((formData.get("category") as string) ||
      FILE_TYPE_CATEGORIES.OTHER) as FileCategory;
    const isPublic = formData.get("isPublic") === "true";
    const expiresAt = formData.get("expiresAt")
      ? parseInt(formData.get("expiresAt") as string)
      : undefined;

    if (!files || files.length === 0) {
      return c.json(
        {
          success: false,
          error: "No files provided",
          timestamp: Date.now(),
        },
        400
      );
    }

    // Validate all files
    const validationResults = await Promise.all(files.map(validateFile));
    const allValid = validationResults.every((v) => v.isValid);

    if (!allValid) {
      const allErrors = validationResults.flatMap((v) => v.errors);
      const allWarnings = validationResults.flatMap((v) => v.warnings);

      return c.json(
        {
          success: false,
          error: "File validation failed",
          details: allErrors,
          warnings: allWarnings,
          timestamp: Date.now(),
        },
        400
      );
    }

    // Create R2 service and upload files
    const r2Service = createR2Service(c);
    const uploadOptions = {
      category,
      isPublic,
      ...(expiresAt && { expiresAt }),
      metadata: {
        uploadedBy: user,
        uploadSource: "api",
      },
    };

    const results = await r2Service.uploadMultipleFiles(
      c,
      files,
      uploadOptions
    );

    return c.json({
      success: true,
      data: results,
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to upload files",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Get file metadata
app.get("/api/files/:key/metadata", requireAuth, async (c) => {
  try {
    const key = c.req.param("key");
    if (!key) {
      return c.json(
        {
          success: false,
          error: "File key is required",
          timestamp: Date.now(),
        },
        400
      );
    }

    const r2Service = createR2Service(c);
    const metadata = await r2Service.getFileMetadata(key);

    if (!metadata) {
      return c.json(
        {
          success: false,
          error: "File not found",
          timestamp: Date.now(),
        },
        404
      );
    }

    // Check access permissions
    const user = c.get("user");
    const accessCheck = checkFileAccess(
      metadata.uploadedBy,
      user?.id || "",
      metadata.isPublic
    );

    if (!accessCheck.allowed) {
      return c.json(
        {
          success: false,
          error: accessCheck.reason || "Access denied",
          timestamp: Date.now(),
        },
        403
      );
    }

    return c.json({
      success: true,
      data: metadata,
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get file metadata",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Download file
app.get("/api/files/:key", requireAuth, async (c) => {
  try {
    const key = c.req.param("key");
    if (!key) {
      return c.json(
        {
          success: false,
          error: "File key is required",
          timestamp: Date.now(),
        },
        400
      );
    }

    const r2Service = createR2Service(c);
    const fileBuffer = await r2Service.downloadFile(key);

    if (!fileBuffer) {
      return c.json(
        {
          success: false,
          error: "File not found",
          timestamp: Date.now(),
        },
        404
      );
    }

    // Get file metadata for content type and access check
    const metadata = await r2Service.getFileMetadata(key);
    if (!metadata) {
      return c.json(
        {
          success: false,
          error: "File metadata not found",
          timestamp: Date.now(),
        },
        404
      );
    }

    // Check access permissions
    const user = c.get("user");
    const accessCheck = checkFileAccess(
      metadata.uploadedBy,
      user?.id || "",
      metadata.isPublic
    );

    if (!accessCheck.allowed) {
      return c.json(
        {
          success: false,
          error: accessCheck.reason || "Access denied",
          timestamp: Date.now(),
        },
        403
      );
    }

    // Return file with proper headers
    return new Response(fileBuffer, {
      headers: {
        "Content-Type": metadata.mimeType,
        "Content-Disposition": `inline; filename="${metadata.originalName}"`,
        "Cache-Control": metadata.isPublic
          ? "public, max-age=3600"
          : "private, max-age=300",
      },
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to download file",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Delete file
app.delete("/api/files/:key", requireAuth, async (c) => {
  try {
    const key = c.req.param("key");
    if (!key) {
      return c.json(
        {
          success: false,
          error: "File key is required",
          timestamp: Date.now(),
        },
        400
      );
    }

    const r2Service = createR2Service(c);
    const deleted = await r2Service.deleteFile(c, key);

    return c.json({
      success: true,
      data: { deleted },
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete file",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Get user's files with pagination
app.get("/api/files", requireAuth, async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json(
        {
          success: false,
          error: "User not authenticated",
          timestamp: Date.now(),
        },
        401
      );
    }

    const query = c.req.query();
    const limit = query.limit ? Math.min(parseInt(query.limit), 100) : 20;
    const offset = query.offset ? parseInt(query.offset) : 0;

    const r2Service = createR2Service(c);
    const files = await r2Service.getUserFiles(c, limit, offset);

    return c.json({
      success: true,
      data: files,
      pagination: {
        limit,
        offset,
        count: files.length,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get user files",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Get file statistics
app.get("/api/files/stats", requireAuth, async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json(
        {
          success: false,
          error: "User not authenticated",
          timestamp: Date.now(),
        },
        401
      );
    }

    const r2Service = createR2Service(c);
    const stats = await r2Service.getFileStats();

    return c.json({
      success: true,
      data: stats,
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get file statistics",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// ===== WEBSOCKET AND REAL-TIME MESSAGING ROUTES =====

// WebSocket upgrade endpoint for chat rooms
app.get("/api/chat/:chatId/ws", requireAuth, async (c) => {
  const chatId = c.req.param("chatId");

  if (!chatId) {
    return c.json(
      {
        success: false,
        error: "Chat ID is required",
        timestamp: Date.now(),
      },
      400
    );
  }

  // Get Durable Object for this chat room
  const chatRoomId = c.env.DO_CHAT_ROOM.idFromName(chatId);
  const chatRoomStub = c.env.DO_CHAT_ROOM.get(chatRoomId);

  // Forward the request to the Durable Object
  return await chatRoomStub.fetch(c.req.raw);
});

// WebSocket upgrade endpoint for presence
app.get("/api/presence/ws", requireAuth, async (c) => {
  // Get Durable Object for presence management
  const presenceId = c.env.DO_PRESENCE.idFromName("global");
  const presenceStub = c.env.DO_PRESENCE.get(presenceId);

  // Forward the request to the Durable Object
  return await presenceStub.fetch(c.req.raw);
});

// Send message to chat room
app.post("/api/chat/:chatId/message", requireAuth, async (c) => {
  try {
    const chatId = c.req.param("chatId");
    const body = await c.req.json();

    if (!chatId) {
      return c.json(
        {
          success: false,
          error: "Chat ID is required",
          timestamp: Date.now(),
        },
        400
      );
    }

    if (!body.content || !body.type) {
      return c.json(
        {
          success: false,
          error: "Message content and type are required",
          timestamp: Date.now(),
        },
        400
      );
    }

    // Get Durable Object for this chat room
    const chatRoomId = c.env.DO_CHAT_ROOM.idFromName(chatId);
    const chatRoomStub = c.env.DO_CHAT_ROOM.get(chatRoomId);

    // Create a new request to send the message
    const messageRequest = new Request(
      `http://internal/chat/${chatId}/message`,
      {
        method: "POST",
        headers: c.req.raw.headers,
        body: JSON.stringify(body),
      }
    );

    // Forward the request to the Durable Object
    const response = await chatRoomStub.fetch(messageRequest);

    if (response.ok) {
      // Also persist message to database
      await persistMessageToDatabase(c, chatId, body);
    }

    return response;
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to send message",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Update typing indicator
app.post("/api/chat/:chatId/typing", requireAuth, async (c) => {
  try {
    const chatId = c.req.param("chatId");
    const body = await c.req.json();

    if (!chatId) {
      return c.json(
        {
          success: false,
          error: "Chat ID is required",
          timestamp: Date.now(),
        },
        400
      );
    }

    // Get Durable Object for this chat room
    const chatRoomId = c.env.DO_CHAT_ROOM.idFromName(chatId);
    const chatRoomStub = c.env.DO_CHAT_ROOM.get(chatRoomId);

    // Create a new request for typing indicator
    const typingRequest = new Request(`http://internal/chat/${chatId}/typing`, {
      method: "POST",
      headers: c.req.raw.headers,
      body: JSON.stringify(body),
    });

    // Forward the request to the Durable Object
    return await chatRoomStub.fetch(typingRequest);
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update typing indicator",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Update user presence
app.post("/api/presence", requireAuth, async (c) => {
  try {
    const body = await c.req.json();

    if (!body.status) {
      return c.json(
        {
          success: false,
          error: "Presence status is required",
          timestamp: Date.now(),
        },
        400
      );
    }

    // Get Durable Object for presence management
    const presenceId = c.env.DO_PRESENCE.idFromName("global");
    const presenceStub = c.env.DO_PRESENCE.get(presenceId);

    // Create a new request for presence update
    const presenceRequest = new Request("http://internal/presence", {
      method: "POST",
      headers: c.req.raw.headers,
      body: JSON.stringify(body),
    });

    // Forward the request to the Durable Object
    return await presenceStub.fetch(presenceRequest);
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update presence",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Get user presence
app.get("/api/presence/:userId", requireAuth, async (c) => {
  try {
    const userId = c.req.param("userId");

    if (!userId) {
      return c.json(
        {
          success: false,
          error: "User ID is required",
          timestamp: Date.now(),
        },
        400
      );
    }

    // Get Durable Object for presence management
    const presenceId = c.env.DO_PRESENCE.idFromName("global");
    const presenceStub = c.env.DO_PRESENCE.get(presenceId);

    // Create a new request to get presence status
    const statusRequest = new Request(`http://internal/presence/${userId}`);

    // Forward the request to the Durable Object
    return await presenceStub.fetch(statusRequest);
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get presence",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Get chat room state
app.get("/api/chat/:chatId/state", requireAuth, async (c) => {
  try {
    const chatId = c.req.param("chatId");

    if (!chatId) {
      return c.json(
        {
          success: false,
          error: "Chat ID is required",
          timestamp: Date.now(),
        },
        400
      );
    }

    // Get Durable Object for this chat room
    const chatRoomId = c.env.DO_CHAT_ROOM.idFromName(chatId);
    const chatRoomStub = c.env.DO_CHAT_ROOM.get(chatRoomId);

    // Get current state from Durable Object
    const state = await (chatRoomStub as unknown as ChatRoomStub).getState();

    return c.json({
      success: true,
      data: state,
      timestamp: Date.now(),
    });
  } catch (error) {
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get chat state",
        timestamp: Date.now(),
      },
      500
    );
  }
});

// Helper function to persist messages to database
async function persistMessageToDatabase(
  c: any,
  chatId: string,
  messageData: any
): Promise<void> {
  try {
    const db = c.get("db");
    const userId = c.get("userId"); // Assuming auth middleware sets this

    // Insert message into database
    await db.insert(messages).values({
      id: crypto.randomUUID(),
      chatId,
      senderId: userId,
      content: messageData.content,
      type: messageData.type,
      metadata: JSON.stringify(messageData.metadata || {}),
      status: "sent",
      sentAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Update chat's last message timestamp
    await db
      .update(chats)
      .set({
        lastMessageAt: Date.now(),
        updatedAt: Date.now(),
      })
      .where(eq(chats.id, chatId));
  } catch (error) {
    console.error("Failed to persist message to database:", error);
    // Don't throw error - WebSocket message was already sent successfully
  }
}

// Legacy endpoint
app.get("/message", (c) => {
  return c.text("Hello Hono!");
});

export default app;
