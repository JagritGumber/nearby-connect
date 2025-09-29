import { Context } from "hono";
import { DefaultContext } from "../types/context";

/**
 * File validation and security utilities
 */

// Enhanced file type detection
export const FILE_TYPE_CATEGORIES = {
  IMAGE: "image",
  DOCUMENT: "document",
  AUDIO: "audio",
  VIDEO: "video",
  ARCHIVE: "archive",
  TEXT: "text",
  OTHER: "other",
} as const;

export type FileTypeCategory =
  (typeof FILE_TYPE_CATEGORIES)[keyof typeof FILE_TYPE_CATEGORIES];

// MIME type to category mapping
export const MIME_TYPE_CATEGORIES: Record<string, FileTypeCategory> = {
  // Images
  "image/jpeg": FILE_TYPE_CATEGORIES.IMAGE,
  "image/jpg": FILE_TYPE_CATEGORIES.IMAGE,
  "image/png": FILE_TYPE_CATEGORIES.IMAGE,
  "image/gif": FILE_TYPE_CATEGORIES.IMAGE,
  "image/webp": FILE_TYPE_CATEGORIES.IMAGE,
  "image/avif": FILE_TYPE_CATEGORIES.IMAGE,
  "image/svg+xml": FILE_TYPE_CATEGORIES.IMAGE,
  "image/bmp": FILE_TYPE_CATEGORIES.IMAGE,
  "image/tiff": FILE_TYPE_CATEGORIES.IMAGE,

  // Documents
  "application/pdf": FILE_TYPE_CATEGORIES.DOCUMENT,
  "application/msword": FILE_TYPE_CATEGORIES.DOCUMENT,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    FILE_TYPE_CATEGORIES.DOCUMENT,
  "application/vnd.ms-excel": FILE_TYPE_CATEGORIES.DOCUMENT,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    FILE_TYPE_CATEGORIES.DOCUMENT,
  "application/vnd.ms-powerpoint": FILE_TYPE_CATEGORIES.DOCUMENT,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    FILE_TYPE_CATEGORIES.DOCUMENT,
  "text/plain": FILE_TYPE_CATEGORIES.DOCUMENT,
  "text/csv": FILE_TYPE_CATEGORIES.DOCUMENT,
  "text/html": FILE_TYPE_CATEGORIES.DOCUMENT,
  "text/xml": FILE_TYPE_CATEGORIES.DOCUMENT,
  "application/json": FILE_TYPE_CATEGORIES.DOCUMENT,
  "application/xml": FILE_TYPE_CATEGORIES.DOCUMENT,

  // Audio
  "audio/mpeg": FILE_TYPE_CATEGORIES.AUDIO,
  "audio/wav": FILE_TYPE_CATEGORIES.AUDIO,
  "audio/ogg": FILE_TYPE_CATEGORIES.AUDIO,
  "audio/mp4": FILE_TYPE_CATEGORIES.AUDIO,
  "audio/aac": FILE_TYPE_CATEGORIES.AUDIO,
  "audio/flac": FILE_TYPE_CATEGORIES.AUDIO,
  "audio/webm": FILE_TYPE_CATEGORIES.AUDIO,

  // Video
  "video/mp4": FILE_TYPE_CATEGORIES.VIDEO,
  "video/mpeg": FILE_TYPE_CATEGORIES.VIDEO,
  "video/quicktime": FILE_TYPE_CATEGORIES.VIDEO,
  "video/x-msvideo": FILE_TYPE_CATEGORIES.VIDEO,
  "video/webm": FILE_TYPE_CATEGORIES.VIDEO,
  "video/ogg": FILE_TYPE_CATEGORIES.VIDEO,
  "video/x-matroska": FILE_TYPE_CATEGORIES.VIDEO,

  // Archives
  "application/zip": FILE_TYPE_CATEGORIES.ARCHIVE,
  "application/x-zip-compressed": FILE_TYPE_CATEGORIES.ARCHIVE,
  "application/x-rar-compressed": FILE_TYPE_CATEGORIES.ARCHIVE,
  "application/x-7z-compressed": FILE_TYPE_CATEGORIES.ARCHIVE,
  "application/gzip": FILE_TYPE_CATEGORIES.ARCHIVE,
  "application/x-tar": FILE_TYPE_CATEGORIES.ARCHIVE,
};

// Dangerous file signatures (magic bytes) to detect
export const DANGEROUS_FILE_SIGNATURES = [
  // Executable files
  { signature: [0x4d, 0x5a], description: "Windows executable" }, // MZ header
  { signature: [0x7f, 0x45, 0x4c, 0x46], description: "ELF executable" }, // ELF header
  { signature: [0xfe, 0xed, 0xfa], description: "Mach-O executable" }, // Mach-O header

  // Script files that could be dangerous
  { signature: [0x23, 0x21], description: "Shell script" }, // #!
  { signature: [0x3c, 0x3f, 0x70, 0x68, 0x70], description: "PHP script" }, // <?php
  {
    signature: [0x3c, 0x73, 0x63, 0x72, 0x69, 0x70, 0x74],
    description: "JavaScript",
  }, // <script

  // Other potentially dangerous files
  {
    signature: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
    description: "Microsoft Office document",
  },
];

// File size limits by category (in bytes)
export const FILE_SIZE_LIMITS: Record<FileTypeCategory, number> = {
  [FILE_TYPE_CATEGORIES.IMAGE]: 10 * 1024 * 1024, // 10MB
  [FILE_TYPE_CATEGORIES.DOCUMENT]: 25 * 1024 * 1024, // 25MB
  [FILE_TYPE_CATEGORIES.AUDIO]: 50 * 1024 * 1024, // 50MB
  [FILE_TYPE_CATEGORIES.VIDEO]: 100 * 1024 * 1024, // 100MB
  [FILE_TYPE_CATEGORIES.ARCHIVE]: 50 * 1024 * 1024, // 50MB
  [FILE_TYPE_CATEGORIES.TEXT]: 5 * 1024 * 1024, // 5MB
  [FILE_TYPE_CATEGORIES.OTHER]: 10 * 1024 * 1024, // 10MB
};

// Image dimensions limits
export const IMAGE_DIMENSION_LIMITS = {
  maxWidth: 4096,
  maxHeight: 4096,
  minWidth: 1,
  minHeight: 1,
};

/**
 * Get file category from MIME type
 */
export function getFileCategory(mimeType: string): FileTypeCategory {
  return MIME_TYPE_CATEGORIES[mimeType] || FILE_TYPE_CATEGORIES.OTHER;
}

/**
 * Check if file type is allowed
 */
export function isAllowedFileType(mimeType: string): boolean {
  return mimeType in MIME_TYPE_CATEGORIES;
}

/**
 * Get file size limit for category
 */
export function getFileSizeLimit(mimeType: string): number {
  const category = getFileCategory(mimeType);
  return FILE_SIZE_LIMITS[category];
}

/**
 * Validate file size against category limits
 */
export function validateFileSize(fileSize: number, mimeType: string): boolean {
  const limit = getFileSizeLimit(mimeType);
  return fileSize <= limit;
}

/**
 * Read file signature (magic bytes) to detect file type
 */
export async function readFileSignature(file: File): Promise<Uint8Array> {
  const start = 0;
  const end = Math.min(16, file.size); // Read first 16 bytes
  const slice = file.slice(start, end);
  const arrayBuffer = await slice.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Check if file signature indicates a potentially dangerous file
 */
export function isDangerousFileSignature(signature: Uint8Array): boolean {
  return DANGEROUS_FILE_SIGNATURES.some((dangerous) => {
    if (signature.length < dangerous.signature.length) {
      return false;
    }

    for (let i = 0; i < dangerous.signature.length; i++) {
      if (signature[i] !== dangerous.signature[i]) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Comprehensive file validation
 */
export async function validateFile(file: File): Promise<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic file checks
  if (!file.name) {
    errors.push("File must have a name");
  }

  if (file.size === 0) {
    errors.push("File cannot be empty");
  }

  // MIME type validation
  if (!file.type) {
    warnings.push("File type could not be determined");
  } else if (!isAllowedFileType(file.type)) {
    errors.push(`File type '${file.type}' is not allowed`);
  }

  // File size validation
  if (file.type && !validateFileSize(file.size, file.type)) {
    const category = getFileCategory(file.type);
    const limit = FILE_SIZE_LIMITS[category];
    const limitMB = (limit / (1024 * 1024)).toFixed(1);
    errors.push(`File size exceeds ${category} limit of ${limitMB}MB`);
  }

  // Security check - read file signature
  if (file.size > 0) {
    try {
      const signature = await readFileSignature(file);
      if (isDangerousFileSignature(signature)) {
        errors.push(
          "File appears to be an executable or potentially dangerous file"
        );
      }
    } catch (error) {
      warnings.push("Could not read file signature for security check");
    }
  }

  // Filename validation
  if (file.name) {
    // Check for suspicious characters
    const suspiciousChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (suspiciousChars.test(file.name)) {
      errors.push("Filename contains invalid characters");
    }

    // Check for hidden files
    if (file.name.startsWith(".")) {
      warnings.push("Hidden files may not display properly");
    }

    // Check for very long filenames
    if (file.name.length > 255) {
      errors.push("Filename is too long (maximum 255 characters)");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Sanitize filename for safe storage
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_") // Replace invalid chars
    .replace(/\s+/g, "_") // Replace spaces with underscores
    .replace(/_{2,}/g, "_") // Replace multiple underscores with single
    .replace(/^_+|_+$/g, "") // Remove leading/trailing underscores
    .substring(0, 100); // Limit length
}

/**
 * Generate a secure filename with timestamp and random suffix
 */
export function generateSecureFilename(
  originalFilename: string,
  category?: string
): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const sanitizedBase = sanitizeFilename(
    originalFilename.replace(/\.[^/.]+$/, "") // Remove extension
  );
  const extension = originalFilename.split(".").pop() || "";

  const categoryPrefix = category ? `${category}_` : "";
  const sanitizedExtension = extension.replace(/[^a-zA-Z0-9]/g, "");

  return `${categoryPrefix}${sanitizedBase}_${timestamp}_${randomSuffix}.${sanitizedExtension}`;
}

/**
 * Check if file extension matches MIME type
 */
export function validateFileExtension(
  filename: string,
  mimeType: string
): boolean {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (!extension) return false;

  // Basic extension to MIME type mapping
  const extensionMap: Record<string, string[]> = {
    jpg: ["image/jpeg"],
    jpeg: ["image/jpeg"],
    png: ["image/png"],
    gif: ["image/gif"],
    webp: ["image/webp"],
    avif: ["image/avif"],
    pdf: ["application/pdf"],
    txt: ["text/plain"],
    csv: ["text/csv"],
    doc: ["application/msword"],
    docx: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    xls: ["application/vnd.ms-excel"],
    xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    mp3: ["audio/mpeg"],
    wav: ["audio/wav"],
    ogg: ["audio/ogg"],
    mp4: ["video/mp4", "audio/mp4"],
    avi: ["video/x-msvideo"],
    mov: ["video/quicktime"],
    webm: ["video/webm"],
    zip: ["application/zip"],
    rar: ["application/x-rar-compressed"],
  };

  const expectedMimeTypes = extensionMap[extension];
  return expectedMimeTypes ? expectedMimeTypes.includes(mimeType) : true; // Allow if no mapping exists
}

/**
 * Extract image dimensions (for validation)
 */
export async function getImageDimensions(file: File): Promise<{
  width: number;
  height: number;
} | null> {
  if (!file.type.startsWith("image/")) {
    return null;
  }

  // In Cloudflare Workers, Image constructor may not be available
  // For now, return null to skip dimension validation
  // In a production environment, you might want to:
  // 1. Use a different image processing library
  // 2. Skip dimension validation in worker environment
  // 3. Validate dimensions on the client side
  return Promise.resolve(null);
}

/**
 * Validate image dimensions
 */
export async function validateImageDimensions(file: File): Promise<{
  isValid: boolean;
  errors: string[];
  dimensions?: { width: number; height: number };
}> {
  const errors: string[] = [];

  if (!file.type.startsWith("image/")) {
    return { isValid: true, errors: [] };
  }

  const dimensions = await getImageDimensions(file);

  if (!dimensions) {
    errors.push("Could not read image dimensions");
    return { isValid: false, errors };
  }

  if (dimensions.width > IMAGE_DIMENSION_LIMITS.maxWidth) {
    errors.push(
      `Image width (${dimensions.width}px) exceeds maximum allowed (${IMAGE_DIMENSION_LIMITS.maxWidth}px)`
    );
  }

  if (dimensions.height > IMAGE_DIMENSION_LIMITS.maxHeight) {
    errors.push(
      `Image height (${dimensions.height}px) exceeds maximum allowed (${IMAGE_DIMENSION_LIMITS.maxHeight}px)`
    );
  }

  if (dimensions.width < IMAGE_DIMENSION_LIMITS.minWidth) {
    errors.push(
      `Image width (${dimensions.width}px) is below minimum allowed (${IMAGE_DIMENSION_LIMITS.minWidth}px)`
    );
  }

  if (dimensions.height < IMAGE_DIMENSION_LIMITS.minHeight) {
    errors.push(
      `Image height (${dimensions.height}px) is below minimum allowed (${IMAGE_DIMENSION_LIMITS.minHeight}px)`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    dimensions,
  };
}

/**
 * Rate limiting for file uploads (per user)
 */
const uploadTracker = new Map<string, { count: number; resetTime: number }>();

export function checkUploadRateLimit(
  userId: string,
  maxUploads: number = 10,
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  const userUploads = uploadTracker.get(userId);

  if (!userUploads || now > userUploads.resetTime) {
    // Reset or initialize counter
    uploadTracker.set(userId, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (userUploads.count >= maxUploads) {
    return false;
  }

  userUploads.count++;
  return true;
}

/**
 * Clean up expired upload tracking data
 */
export function cleanupUploadTracker(): void {
  const now = Date.now();
  for (const [userId, data] of uploadTracker.entries()) {
    if (now > data.resetTime) {
      uploadTracker.delete(userId);
    }
  }
}

/**
 * File access permission checker
 */
export function checkFileAccess(
  fileOwnerId: string,
  requestingUserId: string,
  isPublic: boolean,
  context?: Context<DefaultContext>
): { allowed: boolean; reason?: string } {
  // File owner always has access
  if (fileOwnerId === requestingUserId) {
    return { allowed: true };
  }

  // Public files are accessible to everyone
  if (isPublic) {
    return { allowed: true };
  }

  // For private files, check if there's a relationship
  // This could be extended to check friendships, group memberships, etc.
  // For now, only allow owners
  return {
    allowed: false,
    reason: "File is private and you do not have permission to access it",
  };
}

/**
 * Generate file checksum for integrity verification
 */
export async function generateFileChecksum(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verify file integrity
 */
export async function verifyFileIntegrity(
  file: File,
  expectedChecksum: string
): Promise<boolean> {
  const actualChecksum = await generateFileChecksum(file);
  return actualChecksum === expectedChecksum;
}
