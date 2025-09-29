import { useQuery } from '@tanstack/react-query';
import { useApi } from './useApi';

export interface FeedItem {
  id: string;
  type: 'post' | 'group' | 'friend';
  userId: string;
  username?: string;
  userAvatar?: string;
  content?: string;
  groupId?: string;
  groupName?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface FeedFilters {
  limit?: number;
  offset?: number;
  includeFriends?: boolean;
  includeGroups?: boolean;
  includeRecent?: boolean;
}

export const useFeedService = () => {
  const { apiCall } = useApi();

  // Get user feed with 3:3:2 ratio
  const useFeed = (filters: FeedFilters = {}) => {
    return useQuery({
      queryKey: ['feed', filters],
      queryFn: async (): Promise<FeedItem[]> => {
        const params = new URLSearchParams();
        if (filters.limit) params.append('limit', filters.limit.toString());
        if (filters.offset) params.append('offset', filters.offset.toString());
        if (filters.includeFriends !== undefined) {
          params.append('includeFriends', filters.includeFriends.toString());
        }
        if (filters.includeGroups !== undefined) {
          params.append('includeGroups', filters.includeGroups.toString());
        }
        if (filters.includeRecent !== undefined) {
          params.append('includeRecent', filters.includeRecent.toString());
        }

        const response = await apiCall<FeedItem[]>(`/api/feed?${params}`);
        if (!response.success || !response.data) {
          throw new Error(response.error || 'Failed to get feed');
        }
        return response.data;
      },
    });
  };

  // Get posts from specific user
  const useUserPosts = (userId: string, limit = 10) => {
    return useQuery({
      queryKey: ['user-posts', userId, limit],
      queryFn: async (): Promise<FeedItem[]> => {
        const params = new URLSearchParams();
        params.append('limit', limit.toString());

        const response = await apiCall<FeedItem[]>(`/api/users/${userId}/posts?${params}`);
        if (!response.success || !response.data) {
          throw new Error(response.error || 'Failed to get user posts');
        }
        return response.data;
      },
      enabled: !!userId,
    });
  };

  return {
    useFeed,
    useUserPosts,
  };
};