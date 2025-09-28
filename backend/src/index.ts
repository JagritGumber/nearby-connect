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
        error: error instanceof Error ? error.message : "Failed to update profile",
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
        error: error instanceof Error ? error.message : "Failed to update location",
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
        error: error instanceof Error ? error.message : "Failed to update status",
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
