import { Client } from "@libsql/client";
import { DatabaseUtils } from "./db-utils";
import { DatabaseError } from "./errors";

export interface HealthCheckResult {
  status: "healthy" | "unhealthy" | "degraded";
  timestamp: number;
  responseTime: number;
  checks: {
    database: {
      status: "up" | "down";
      responseTime: number;
      error?: string | undefined;
    };
    migrations?: {
      status: "up_to_date" | "pending" | "error";
      currentVersion?: string;
      latestVersion?: string;
      error?: string;
    };
  };
  uptime?: number;
  version?: string;
}

export class HealthCheckService {
  private dbUtils: DatabaseUtils;

  constructor(client: Client) {
    this.dbUtils = new DatabaseUtils(client);
  }

  /**
   * Perform a comprehensive health check
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const result: HealthCheckResult = {
      status: "healthy",
      timestamp: startTime,
      responseTime: 0,
      checks: {
        database: {
          status: "up",
          responseTime: 0,
        },
      },
    };

    try {
      // Check database connectivity
      const dbStartTime = Date.now();
      const isDbHealthy = await this.dbUtils.healthCheck();
      const dbResponseTime = Date.now() - dbStartTime;

      result.checks.database = {
        status: isDbHealthy ? "up" : "down",
        responseTime: dbResponseTime,
        error: isDbHealthy ? undefined : "Database connection failed",
      };

      // Check database stats
      try {
        const stats = await this.dbUtils.getStats();
        result.uptime = stats.uptime;
      } catch (error) {
        // Stats might not be available, don't fail the health check for this
        console.warn("Could not retrieve database stats:", error);
      }

      // Determine overall status
      if (!isDbHealthy) {
        result.status = "unhealthy";
      } else if (dbResponseTime > 5000) {
        // 5 second threshold
        result.status = "degraded";
      }

      result.responseTime = Date.now() - startTime;
      return result;
    } catch (error) {
      result.status = "unhealthy";
      result.responseTime = Date.now() - startTime;
      result.checks.database = {
        status: "down",
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };

      return result;
    }
  }

  /**
   * Quick database connectivity check
   */
  async quickHealthCheck(): Promise<boolean> {
    try {
      return await this.dbUtils.healthCheck();
    } catch (error) {
      console.error("Quick health check failed:", error);
      return false;
    }
  }

  /**
   * Check if database is ready for operations
   */
  async isReady(): Promise<boolean> {
    try {
      // Perform a simple query to ensure database is responsive
      const client = (this.dbUtils as any).client as Client;
      await client.execute("SELECT 1");
      return true;
    } catch (error) {
      console.error("Database readiness check failed:", error);
      return false;
    }
  }

  /**
   * Get database performance metrics
   */
  async getPerformanceMetrics(): Promise<{
    averageResponseTime: number;
    totalQueries: number;
    failedQueries: number;
    cacheHitRate?: number | undefined;
  }> {
    try {
      const stats = await this.dbUtils.getStats();

      return {
        averageResponseTime: stats.uptime, // This is a simplified metric
        totalQueries: 0, // Would need query tracking to implement
        failedQueries: 0, // Would need error tracking to implement
        cacheHitRate: undefined, // Not applicable for libSQL
      };
    } catch (error) {
      throw new DatabaseError(`Failed to get performance metrics: ${error}`, {
        cause: error as Error,
        code: "METRICS_ERROR",
      });
    }
  }
}
