export class DatabaseError extends Error {
  public readonly code: string;
  public override readonly cause?: Error["cause"];

  constructor(
    message: string,
    options?: { cause?: Error["cause"]; code?: string }
  ) {
    super(message);
    this.name = "DatabaseError";
    this.cause = options?.cause;
    this.code = options?.code || "DATABASE_ERROR";

  }
}

export class ConnectionError extends DatabaseError {
  constructor(message: string, cause?: Error["cause"]) {
    super(message, { cause, code: "CONNECTION_ERROR" });
    this.name = "ConnectionError";
  }
}

export class QueryError extends DatabaseError {
  constructor(message: string, cause?: Error["cause"]) {
    super(message, { cause, code: "QUERY_ERROR" });
    this.name = "QueryError";
  }
}

export class MigrationError extends DatabaseError {
  constructor(message: string, cause?: Error["cause"]) {
    super(message, { cause, code: "MIGRATION_ERROR" });
    this.name = "MigrationError";
  }
}

export class ValidationError extends DatabaseError {
  constructor(message: string, cause?: Error) {
    super(message, { cause, code: "VALIDATION_ERROR" });
    this.name = "ValidationError";
  }
}
