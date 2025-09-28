import { Client } from "@libsql/client";
import { DatabaseError } from "./errors";

export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
};

export class DatabaseUtils {
  constructor(private client: Client) {}

  /**
   * Execute a query with retry logic and error handling
   */
  async executeWithRetry<T>(
    query: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<T> {
    const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
      try {
        return await query();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on certain types of errors
        if (this.isNonRetryableError(error)) {
          throw new DatabaseError(
            `Non-retryable database error: ${lastError.message}`,
            {
              cause: lastError,
              code: "NON_RETRYABLE_ERROR",
            }
          );
        }

        if (attempt === opts.maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          opts.baseDelay * Math.pow(2, attempt),
          opts.maxDelay
        );

        await this.sleep(delay);
      }
    }

    throw new DatabaseError(
      `Database operation failed after ${opts.maxRetries} retries: ${
        lastError!.message
      }`,
      {
        cause: lastError,
        code: "MAX_RETRIES_EXCEEDED",
      }
    );
  }

  /**
   * Check if an error should not be retried
   */
  private isNonRetryableError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);

    // Don't retry constraint violations, syntax errors, etc.
    const nonRetryablePatterns = [
      /constraint failed/i,
      /syntax error/i,
      /no such table/i,
      /no such column/i,
      /unauthorized/i,
      /forbidden/i,
    ];

    return nonRetryablePatterns.some((pattern) => pattern.test(message));
  }

  /**
   * Sleep for a specified number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Execute a health check query
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.execute("SELECT 1");
      return true;
    } catch (error) {
      console.error("Database health check failed:", error);
      return false;
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalConnections: number;
    activeConnections: number;
    uptime: number;
  }> {
    try {
      // Note: These stats might not be available in all database types
      // This is a basic implementation that can be extended
      const startTime = Date.now();

      await this.client.execute("SELECT COUNT(*) FROM sqlite_master");

      return {
        totalConnections: 1, // libSQL typically uses single connections
        activeConnections: 1,
        uptime: Date.now() - startTime,
      };
    } catch (error) {
      throw new DatabaseError(`Failed to get database stats: ${error}`, {
        cause: error as Error,
        code: "STATS_ERROR",
      });
    }
  }

  /**
   * Clean up old data (utility for maintenance)
   */
  async cleanupOldData(olderThanDays: number): Promise<{
    deletedRecords: number;
    tablesCleaned: string[];
  }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    const cutoffTimestamp = Math.floor(cutoffDate.getTime() / 1000);

    const result = {
      deletedRecords: 0,
      tablesCleaned: [] as string[],
    };

    try {
      // This is a generic cleanup function - in practice, you'd want
      // more specific cleanup logic based on your data retention policies

      // Example: Clean old messages without replies
      const deletedMessages = await this.client.execute({
        sql: "DELETE FROM messages WHERE reply_to_id IS NULL AND created_at < ?",
        args: [cutoffTimestamp],
      });

      if (deletedMessages.rowsAffected > 0) {
        result.deletedRecords += Number(deletedMessages.rowsAffected);
        result.tablesCleaned.push("messages");
      }

      return result;
    } catch (error) {
      throw new DatabaseError(`Cleanup failed: ${error}`, {
        cause: error as Error,
        code: "CLEANUP_ERROR",
      });
    }
  }
}
