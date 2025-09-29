import { relations } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  foreignKey,
} from "drizzle-orm/sqlite-core";

// Users table with Clerk integration
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  clerkId: text("clerk_id").unique().notNull(),
  email: text("email").notNull(),
  username: text("username").unique(),
  displayName: text("display_name"),
  avatar: text("avatar"),
  bio: text("bio"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  locationUpdatedAt: integer("location_updated_at", { mode: "timestamp" }),
  isOnline: integer("is_online", { mode: "boolean" }).default(false),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Friend requests table
export const friendRequests = sqliteTable("friend_requests", {
  id: text("id").primaryKey(),
  senderId: text("sender_id")
    .references(() => users.id)
    .notNull(),
  receiverId: text("receiver_id")
    .references(() => users.id)
    .notNull(),
  status: text("status", { enum: ["pending", "accepted", "rejected"] }).default(
    "pending"
  ),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Marketplace listings table
export const marketplaceListings = sqliteTable("marketplace_listings", {
  id: text("id").primaryKey(),
  sellerId: text("seller_id")
    .references(() => users.id)
    .notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  price: real("price").notNull(),
  category: text("category"),
  condition: text("condition", {
    enum: ["new", "like_new", "good", "fair", "poor"],
  }),
  imageUrls: text("image_urls"), // JSON array of image URLs
  latitude: real("latitude"),
  longitude: real("longitude"),
  address: text("address"),
  status: text("status", { enum: ["active", "sold", "deleted"] }).default(
    "active"
  ),
  viewCount: integer("view_count").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Chats table
export const chats = sqliteTable("chats", {
  id: text("id").primaryKey(),
  type: text("type", { enum: ["direct", "group"] }).notNull(),
  name: text("name"), // For group chats
  description: text("description"),
  avatar: text("avatar"),
  lastMessageAt: integer("last_message_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Messages table
export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    chatId: text("chat_id")
      .references(() => chats.id)
      .notNull(),
    senderId: text("sender_id")
      .references(() => users.id)
      .notNull(),
    content: text("content").notNull(),
    type: text("type", { enum: ["text", "image", "file", "location"] }).default(
      "text"
    ),
    metadata: text("metadata"), // JSON for additional data
    replyToId: text("reply_to_id"),
    isEdited: integer("is_edited", { mode: "boolean" }).default(false),
    editedAt: integer("edited_at", { mode: "timestamp" }),
    status: text("status", {
      enum: ["sending", "sent", "delivered", "read"],
    }).default("sent"),
    sentAt: integer("sent_at", { mode: "timestamp" }),
    deliveredAt: integer("delivered_at", { mode: "timestamp" }),
    readAt: integer("read_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.replyToId],
      foreignColumns: [table.id],
    }),
  ]
);

// Message reactions table
export const messageReactions = sqliteTable("message_reactions", {
  id: text("id").primaryKey(),
  messageId: text("message_id")
    .references(() => messages.id)
    .notNull(),
  userId: text("user_id")
    .references(() => users.id)
    .notNull(),
  reaction: text("reaction").notNull(), // emoji or reaction type
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Typing indicators table
export const typingIndicators = sqliteTable("typing_indicators", {
  id: text("id").primaryKey(),
  chatId: text("chat_id")
    .references(() => chats.id)
    .notNull(),
  userId: text("user_id")
    .references(() => users.id)
    .notNull(),
  isTyping: integer("is_typing", { mode: "boolean" }).default(true),
  lastTypedAt: integer("last_typed_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// User presence table
export const userPresence = sqliteTable("user_presence", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .references(() => users.id)
    .notNull(),
  status: text("status", { enum: ["online", "away", "offline"] }).default(
    "offline"
  ),
  lastSeenAt: integer("last_seen_at", { mode: "timestamp" }).notNull(),
  deviceInfo: text("device_info"), // JSON with device/browser info
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Message delivery receipts table
export const messageReceipts = sqliteTable("message_receipts", {
  id: text("id").primaryKey(),
  messageId: text("message_id")
    .references(() => messages.id)
    .notNull(),
  userId: text("user_id")
    .references(() => users.id)
    .notNull(),
  status: text("status", { enum: ["sent", "delivered", "read"] }).notNull(),
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Chat participants table (for group chats)
export const chatParticipants = sqliteTable("chat_participants", {
  id: text("id").primaryKey(),
  chatId: text("chat_id")
    .references(() => chats.id)
    .notNull(),
  userId: text("user_id")
    .references(() => users.id)
    .notNull(),
  role: text("role", { enum: ["admin", "member"] }).default("member"),
  joinedAt: integer("joined_at", { mode: "timestamp" }).notNull(),
  leftAt: integer("left_at", { mode: "timestamp" }),
});

// Posts table
export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(),
  authorId: text("author_id")
    .references(() => users.id)
    .notNull(),
  content: text("content").notNull(),
  imageUrls: text("image_urls"), // JSON array of image URLs
  latitude: real("latitude"),
  longitude: real("longitude"),
  address: text("address"),
  likeCount: integer("like_count").default(0),
  commentCount: integer("comment_count").default(0),
  shareCount: integer("share_count").default(0),
  isPublic: integer("is_public", { mode: "boolean" }).default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Post likes table
export const postLikes = sqliteTable("post_likes", {
  id: text("id").primaryKey(),
  postId: text("post_id")
    .references(() => posts.id)
    .notNull(),
  userId: text("user_id")
    .references(() => users.id)
    .notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

// Post comments table
export const postComments = sqliteTable("post_comments", {
  id: text("id").primaryKey(),
  postId: text("post_id")
    .references(() => posts.id)
    .notNull(),
  authorId: text("author_id")
    .references(() => users.id)
    .notNull(),
  content: text("content").notNull(),
  replyToId: text("reply_to_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const postCommentsRelations = relations(postComments, ({ one }) => ({
  replyToPost: one(postComments, {
    fields: [postComments.replyToId],
    references: [postComments.id],
  }),
}));

// Groups table (social groups/communities)
export const groups = sqliteTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  avatar: text("avatar"),
  coverImage: text("cover_image"),
  category: text("category"),
  isPrivate: integer("is_private", { mode: "boolean" }).default(false),
  memberCount: integer("member_count").default(0),
  createdBy: text("created_by")
    .references(() => users.id)
    .notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
  address: text("address"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Group members table
export const groupMembers = sqliteTable("group_members", {
  id: text("id").primaryKey(),
  groupId: text("group_id")
    .references(() => groups.id)
    .notNull(),
  userId: text("user_id")
    .references(() => users.id)
    .notNull(),
  role: text("role", { enum: ["admin", "moderator", "member"] }).default(
    "member"
  ),
  joinedAt: integer("joined_at", { mode: "timestamp" }).notNull(),
  leftAt: integer("left_at", { mode: "timestamp" }),
});

// Group posts table (posts within groups)
export const groupPosts = sqliteTable("group_posts", {
  id: text("id").primaryKey(),
  groupId: text("group_id")
    .references(() => groups.id)
    .notNull(),
  authorId: text("author_id")
    .references(() => users.id)
    .notNull(),
  content: text("content").notNull(),
  imageUrls: text("image_urls"), // JSON array of image URLs
  likeCount: integer("like_count").default(0),
  commentCount: integer("comment_count").default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Files table for R2 storage metadata
export const files = sqliteTable("files", {
  id: text("id").primaryKey(),
  key: text("key").unique().notNull(), // R2 object key
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(), // File size in bytes
  uploadedBy: text("uploaded_by")
    .references(() => users.id)
    .notNull(),
  bucket: text("bucket").default("nearby-connect-storage"),
  etag: text("etag"),
  checksum: text("checksum"), // For integrity verification
  metadata: text("metadata"), // JSON for additional file metadata
  isPublic: integer("is_public", { mode: "boolean" }).default(false),
  downloadCount: integer("download_count").default(0),
  lastAccessedAt: integer("last_accessed_at", { mode: "timestamp" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }), // For temporary files
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Export all tables
export const tables = {
  users,
  friendRequests,
  marketplaceListings,
  chats,
  messages,
  chatParticipants,
  posts,
  postLikes,
  postComments,
  groups,
  groupMembers,
  groupPosts,
  files,
  messageReactions,
  typingIndicators,
  userPresence,
  messageReceipts,
};
