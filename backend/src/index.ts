import { Hono } from "hono";
import { databaseMiddleware } from "./lib/database";
import { HealthCheckService } from "./lib/health-check";

const app = new Hono<{
  Bindings: CloudflareBindings;
  Variables: {
    client: ReturnType<typeof databaseMiddleware>["client"];
    db: ReturnType<typeof databaseMiddleware>["db"];
  };
}>();

// Database middleware to inject database instances
app.use("*", async (c, next) => {
  const { client, db } = databaseMiddleware(c.env);
  c.set("client", client);
  c.set("db", db);
  await next();
});

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

// Legacy endpoint
app.get("/message", (c) => {
  return c.text("Hello Hono!");
});

export default app;
