import { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import {
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
} from '../db/schema';

// Base types for database operations
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type FriendRequest = InferSelectModel<typeof friendRequests>;
export type NewFriendRequest = InferInsertModel<typeof friendRequests>;

export type MarketplaceListing = InferSelectModel<typeof marketplaceListings>;
export type NewMarketplaceListing = InferInsertModel<typeof marketplaceListings>;

export type Chat = InferSelectModel<typeof chats>;
export type NewChat = InferInsertModel<typeof chats>;

export type Message = InferSelectModel<typeof messages>;
export type NewMessage = InferInsertModel<typeof messages>;

export type ChatParticipant = InferSelectModel<typeof chatParticipants>;
export type NewChatParticipant = InferInsertModel<typeof chatParticipants>;

export type Post = InferSelectModel<typeof posts>;
export type NewPost = InferInsertModel<typeof posts>;

export type PostLike = InferSelectModel<typeof postLikes>;
export type NewPostLike = InferInsertModel<typeof postLikes>;

export type PostComment = InferSelectModel<typeof postComments>;
export type NewPostComment = InferInsertModel<typeof postComments>;

export type Group = InferSelectModel<typeof groups>;
export type NewGroup = InferInsertModel<typeof groups>;

export type GroupMember = InferSelectModel<typeof groupMembers>;
export type NewGroupMember = InferInsertModel<typeof groupMembers>;

export type GroupPost = InferSelectModel<typeof groupPosts>;
export type NewGroupPost = InferInsertModel<typeof groupPosts>;

// Extended types with relations
export interface UserWithRelations extends User {
  sentFriendRequests?: FriendRequest[];
  receivedFriendRequests?: FriendRequest[];
  marketplaceListings?: MarketplaceListing[];
  chats?: Chat[];
  messages?: Message[];
  chatParticipants?: ChatParticipant[];
  posts?: Post[];
  postLikes?: PostLike[];
  postComments?: PostComment[];
  groups?: Group[];
  groupMemberships?: GroupMember[];
  groupPosts?: GroupPost[];
}

export interface ChatWithDetails extends Chat {
  participants?: (ChatParticipant & { user: User })[];
  messages?: Message[];
  lastMessage?: Message & { sender: User };
}

export interface PostWithDetails extends Post {
  author: User;
  likes?: (PostLike & { user: User })[];
  comments?: (PostComment & { author: User; replies?: PostComment[] })[];
  likeCount: number;
  commentCount: number;
  isLiked?: boolean;
}

export interface GroupWithDetails extends Group {
  createdByUser: User;
  members?: (GroupMember & { user: User })[];
  posts?: GroupPost[];
  memberCount: number;
  isMember?: boolean;
  userRole?: 'admin' | 'moderator' | 'member';
}

// Query result types
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface LocationQuery {
  latitude: number;
  longitude: number;
  radius?: number; // in kilometers
}

export interface SearchFilters {
  query?: string;
  category?: string;
  location?: LocationQuery;
  dateFrom?: Date;
  dateTo?: Date;
  status?: string;
  limit?: number;
  offset?: number;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: number;
}

export interface DatabaseOperationResult {
  success: boolean;
  rowsAffected?: number;
  lastInsertId?: string;
  error?: string;
}

// Enums and constants
export const UserStatus = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  AWAY: 'away',
} as const;

export const FriendRequestStatus = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
} as const;

export const ListingStatus = {
  ACTIVE: 'active',
  SOLD: 'sold',
  DELETED: 'deleted',
} as const;

export const ListingCondition = {
  NEW: 'new',
  LIKE_NEW: 'like_new',
  GOOD: 'good',
  FAIR: 'fair',
  POOR: 'poor',
} as const;

export const ChatType = {
  DIRECT: 'direct',
  GROUP: 'group',
} as const;

export const MessageType = {
  TEXT: 'text',
  IMAGE: 'image',
  FILE: 'file',
  LOCATION: 'location',
} as const;

export const GroupRole = {
  ADMIN: 'admin',
  MODERATOR: 'moderator',
  MEMBER: 'member',
} as const;

export const PostVisibility = {
  PUBLIC: 'public',
  PRIVATE: 'private',
  FRIENDS: 'friends',
} as const;

// Type guards
export function isValidUserStatus(status: string): status is typeof UserStatus[keyof typeof UserStatus] {
  return Object.values(UserStatus).includes(status as any);
}

export function isValidFriendRequestStatus(status: string): status is typeof FriendRequestStatus[keyof typeof FriendRequestStatus] {
  return Object.values(FriendRequestStatus).includes(status as any);
}

export function isValidListingStatus(status: string): status is typeof ListingStatus[keyof typeof ListingStatus] {
  return Object.values(ListingStatus).includes(status as any);
}

export function isValidChatType(type: string): type is typeof ChatType[keyof typeof ChatType] {
  return Object.values(ChatType).includes(type as any);
}

export function isValidMessageType(type: string): type is typeof MessageType[keyof typeof MessageType] {
  return Object.values(MessageType).includes(type as any);
}

export function isValidGroupRole(role: string): role is typeof GroupRole[keyof typeof GroupRole] {
  return Object.values(GroupRole).includes(role as any);
}

// Utility types for database operations
export type TableName = keyof typeof tables;

export type SelectModel<T extends TableName> = InferSelectModel<typeof tables[T]>;
export type InsertModel<T extends TableName> = InferInsertModel<typeof tables[T]>;

// Import the tables object for the utility types
import { tables } from '../db/schema';