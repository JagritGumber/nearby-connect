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

// Legacy endpoint
app.get("/message", (c) => {
  return c.text("Hello Hono!");
});

export default app;
