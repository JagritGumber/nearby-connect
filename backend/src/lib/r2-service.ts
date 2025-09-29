import { Context } from "hono";
import { eq, and, desc, sql } from "drizzle-orm";
import { files } from "../db/schema";
import { getCurrentUser } from "./auth";
import { DefaultContext } from "../types/context";

// File upload configuration
export const FILE_UPLOAD_CONFIG = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: [
    // Images
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/avif",
    // Documents
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    // Audio
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "audio/mp4",
    // Video
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
    "video/x-msvideo",
    "video/webm",
  ] as string[],
  maxFilesPerUpload: 10,
} as const;

// File type categories for organization
export const FILE_CATEGORIES = {
  AVATAR: "avatar",
  MARKETPLACE: "marketplace",
  POST: "post",
  CHAT: "chat",
  DOCUMENT: "document",
  OTHER: "other",
} as const;

export type FileCategory =
  (typeof FILE_CATEGORIES)[keyof typeof FILE_CATEGORIES];

export interface FileUploadOptions {
  category?: FileCategory;
  isPublic?: boolean;
  expiresAt?: number;
  metadata?: Record<string, any>;
}

export interface FileUploadResult {
  key: string;
  url: string;
  filename: string;
  size: number;
  mimeType: string;
  etag?: string;
  checksum?: R2Checksums;
}

export interface FileMetadata {
  id: string;
  key: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  bucket: string;
  etag?: string | undefined;
  checksum?: string | undefined;
  metadata?: Record<string, any> | undefined;
  isPublic: boolean;
  downloadCount: number;
  lastAccessedAt?: number | undefined;
  expiresAt?: number | undefined;
  createdAt: number;
  updatedAt: number;
}

/**
 * R2 Storage Service for file operations
 */
export class R2Service {
  private r2: R2Bucket;
  private db: DefaultContext["Variables"]["db"];

  constructor(r2: R2Bucket, db: DefaultContext["Variables"]["db"]) {
    this.r2 = r2;
    this.db = db;
  }

  /**
   * Generate a unique file key for R2 storage
   */
  private generateFileKey(filename: string, category?: FileCategory): string {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const extension = filename.split(".").pop() || "";
    const baseName = filename.replace(/\.[^/.]+$/, "");

    const categoryPrefix = category ? `${category}/` : "";
    return `${categoryPrefix}${timestamp}-${randomSuffix}-${baseName}.${extension}`;
  }

  /**
   * Validate file before upload
   */
  private validateFile(file: File): void {
    if (file.size > FILE_UPLOAD_CONFIG.maxFileSize) {
      throw new Error(
        `File size exceeds maximum allowed size of ${
          FILE_UPLOAD_CONFIG.maxFileSize / (1024 * 1024)
        }MB`
      );
    }

    if (!FILE_UPLOAD_CONFIG.allowedMimeTypes.includes(file.type)) {
      throw new Error(`File type ${file.type} is not allowed`);
    }
  }

  /**
   * Upload a single file to R2
   */
  async uploadFile(
    c: Context,
    file: File,
    options: FileUploadOptions = {}
  ): Promise<FileUploadResult> {
    const user = getCurrentUser(c);
    if (!user) {
      throw new Error("User not authenticated");
    }

    this.validateFile(file);

    const key = this.generateFileKey(file.name, options.category);
    const buffer = await file.arrayBuffer();

    try {
      // Upload to R2
      const r2Object = await this.r2.put(key, buffer, {
        httpMetadata: {
          contentType: file.type,
        },
      });

      if (!r2Object) {
        throw new Error("Failed to upload file to R2");
      }

      // Store metadata in database
      const now = new Date();
      const fileMetadata = {
        id: crypto.randomUUID(),
        key,
        filename: key.split("/").pop() || key,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        uploadedBy: user.id,
        bucket: "nearby-connect-storage",
        etag: r2Object.etag,
        checksum: r2Object.checksums
          ? JSON.stringify(r2Object.checksums)
          : null,
        metadata: options.metadata ? JSON.stringify(options.metadata) : null,
        isPublic: options.isPublic ?? false,
        expiresAt: options.expiresAt ? new Date(options.expiresAt) : null,
        createdAt: now,
        updatedAt: now,
      };

      await this.db.insert(files).values(fileMetadata);

      // Generate public URL
      const url = options.isPublic
        ? `https://nearby-connect-storage.${c.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`
        : await this.generateSignedUrl(c, key, 3600); // 1 hour expiry for private files

      return {
        key,
        url,
        filename: fileMetadata.filename,
        size: file.size,
        mimeType: file.type,
        etag: r2Object.etag,
        checksum: r2Object.checksums,
      };
    } catch (error) {
      console.error("Error uploading file:", error);
      throw new Error("Failed to upload file");
    }
  }

  /**
   * Upload multiple files to R2
   */
  async uploadMultipleFiles(
    c: Context,
    files: File[],
    options: FileUploadOptions = {}
  ): Promise<FileUploadResult[]> {
    if (files.length > FILE_UPLOAD_CONFIG.maxFilesPerUpload) {
      throw new Error(
        `Maximum ${FILE_UPLOAD_CONFIG.maxFilesPerUpload} files allowed per upload`
      );
    }

    const results: FileUploadResult[] = [];

    for (const file of files) {
      const result = await this.uploadFile(c, file, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Get file metadata from database
   */
  async getFileMetadata(key: string): Promise<FileMetadata | null> {
    try {
      const result = await this.db
        .select()
        .from(files)
        .where(eq(files.key, key))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      const file = result[0];
      return {
        id: file.id,
        key: file.key,
        filename: file.filename,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        uploadedBy: file.uploadedBy,
        bucket: file.bucket || "nearby-connect-storage",
        etag: file.etag || undefined,
        checksum: file.checksum || undefined,
        metadata: file.metadata ? JSON.parse(file.metadata) : undefined,
        isPublic: Boolean(file.isPublic),
        downloadCount: file.downloadCount ?? 0,
        lastAccessedAt: file.lastAccessedAt
          ? new Date(file.lastAccessedAt).getTime()
          : undefined,
        expiresAt: file.expiresAt
          ? new Date(file.expiresAt).getTime()
          : undefined,
        createdAt: new Date(file.createdAt).getTime(),
        updatedAt: new Date(file.updatedAt).getTime(),
      };
    } catch (error) {
      console.error("Error fetching file metadata:", error);
      return null;
    }
  }

  /**
   * Generate signed URL for private file access
   */
  async generateSignedUrl(
    c: Context<DefaultContext>,
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      // For Cloudflare Workers, we'll use the public URL for now
      // In production, you might want to implement custom signed URL logic
      const baseUrl = `https://nearby-connect-storage.${
        c.env.CLOUDFLARE_ACCOUNT_ID || "your-account-id"
      }.r2.cloudflarestorage.com`;
      return `${baseUrl}/${key}`;
    } catch (error) {
      console.error("Error generating signed URL:", error);
      throw new Error("Failed to generate file URL");
    }
  }

  /**
   * Download file from R2
   */
  async downloadFile(key: string): Promise<ArrayBuffer | null> {
    try {
      const object = await this.r2.get(key);
      if (!object) {
        return null;
      }

      // Update access tracking
      await this.updateFileAccess(key);

      return await object.arrayBuffer();
    } catch (error) {
      console.error("Error downloading file:", error);
      return null;
    }
  }

  /**
   * Update file access tracking
   */
  private async updateFileAccess(key: string): Promise<void> {
    try {
      await this.db
        .update(files)
        .set({
          downloadCount: sql`${files.downloadCount} + 1`,
          lastAccessedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(files.key, key));
    } catch (error) {
      console.error("Error updating file access:", error);
    }
  }

  /**
   * Delete file from R2 and database
   */
  async deleteFile(c: Context<DefaultContext>, key: string): Promise<boolean> {
    const user = getCurrentUser(c);
    if (!user) {
      throw new Error("User not authenticated");
    }

    try {
      // Check if user owns the file
      const fileMetadata = await this.getFileMetadata(key);
      if (!fileMetadata) {
        throw new Error("File not found");
      }

      if (fileMetadata.uploadedBy !== user.id) {
        throw new Error("Unauthorized to delete this file");
      }

      // Delete from R2
      await this.r2.delete(key);

      // Delete metadata from database
      await this.db
        .delete(files)
        .where(and(eq(files.key, key), eq(files.uploadedBy, user.id)));

      return true;
    } catch (error) {
      console.error("Error deleting file:", error);
      throw error;
    }
  }

  /**
   * Get files uploaded by user with pagination
   */
  async getUserFiles(
    c: Context<DefaultContext>,
    limit: number = 20,
    offset: number = 0
  ): Promise<FileMetadata[]> {
    const user = getCurrentUser(c);
    if (!user) {
      throw new Error("User not authenticated");
    }

    try {
      const results = await this.db
        .select()
        .from(files)
        .where(eq(files.uploadedBy, user.id))
        .orderBy(desc(files.createdAt))
        .limit(limit)
        .offset(offset);

      return results.map((file) => ({
        id: file.id,
        key: file.key,
        filename: file.filename,
        originalName: file.originalName,
        mimeType: file.mimeType,
        size: file.size,
        uploadedBy: file.uploadedBy,
        bucket: file.bucket || "nearby-connect-storage",
        etag: file.etag || undefined,
        checksum: file.checksum || undefined,
        metadata: file.metadata ? JSON.parse(file.metadata) : undefined,
        isPublic: Boolean(file.isPublic),
        downloadCount: file.downloadCount ?? 0,
        lastAccessedAt: file.lastAccessedAt
          ? new Date(file.lastAccessedAt).getTime()
          : undefined,
        expiresAt: file.expiresAt
          ? new Date(file.expiresAt).getTime()
          : undefined,
        createdAt: new Date(file.createdAt).getTime(),
        updatedAt: new Date(file.updatedAt).getTime(),
      }));
    } catch (error) {
      console.error("Error fetching user files:", error);
      throw new Error("Failed to fetch user files");
    }
  }

  /**
   * Clean up expired files
   */
  async cleanupExpiredFiles(): Promise<number> {
    try {
      const now = Date.now();
      const expiredFiles = await this.db
        .select()
        .from(files)
        .where(
          and(
            sql`${files.expiresAt} IS NOT NULL`,
            sql`${files.expiresAt} < ${now}`
          )
        );

      let deletedCount = 0;

      for (const file of expiredFiles) {
        try {
          await this.r2.delete(file.key);
          await this.db.delete(files).where(eq(files.key, file.key));
          deletedCount++;
        } catch (error) {
          console.error(`Error deleting expired file ${file.key}:`, error);
        }
      }

      return deletedCount;
    } catch (error) {
      console.error("Error cleaning up expired files:", error);
      return 0;
    }
  }

  /**
   * Get file statistics
   */
  async getFileStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    filesByCategory: Record<string, number>;
  }> {
    try {
      const results = await this.db
        .select({
          count: sql<number>`count(*)`,
          totalSize: sql<number>`sum(${files.size})`,
        })
        .from(files);

      // This would require additional queries in a real implementation
      // For now, returning basic stats
      return {
        totalFiles: results[0]?.count || 0,
        totalSize: results[0]?.totalSize || 0,
        filesByCategory: {},
      };
    } catch (error) {
      console.error("Error fetching file stats:", error);
      throw new Error("Failed to fetch file statistics");
    }
  }
}

/**
 * Factory function to create R2 service instance
 */
export const createR2Service = (c: Context<DefaultContext>): R2Service => {
  const r2 = c.env.R2_STORAGE as R2Bucket;
  const db = c.get("db");

  if (!r2) {
    throw new Error("R2_STORAGE binding not available");
  }

  return new R2Service(r2, db);
};
