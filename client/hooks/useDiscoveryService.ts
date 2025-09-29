import { useQuery } from "@tanstack/react-query";
import { useApi } from "./useApi";

export interface DiscoveryUser {
  id: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  bio?: string;
  avatar?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  interests?: string[];
  isOnline: boolean;
  lastSeen: number;
  distance?: number;
  mutualFriends?: number;
  mutualInterests?: string[];
}

export interface DiscoveryFilters {
  latitude?: number;
  longitude?: number;
  radius?: number;
  limit?: number;
  offset?: number;
  interests?: string[];
}

// Discover users with location-based filtering
export const useDiscoverUsers = (filters: DiscoveryFilters) => {
  const { apiCall } = useApi();
  return useQuery({
    queryKey: ["discover", filters],
    queryFn: async (): Promise<DiscoveryUser[]> => {
      const params = new URLSearchParams();
      if (filters.latitude)
        params.append("latitude", filters.latitude.toString());
      if (filters.longitude)
        params.append("longitude", filters.longitude.toString());
      if (filters.radius) params.append("radius", filters.radius.toString());
      if (filters.limit) params.append("limit", filters.limit.toString());
      if (filters.offset) params.append("offset", filters.offset.toString());
      if (filters.interests?.length) {
        params.append("interests", filters.interests.join(","));
      }

      const response = await apiCall<DiscoveryUser[]>(
        `/api/discover?${params}`
      );
      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to discover users");
      }
      return response.data;
    },
    enabled: !!(filters.latitude && filters.longitude),
  });
};

// Get specific user profile
export const useUserProfile = (userId: string) => {
  const { apiCall } = useApi();
  return useQuery({
    queryKey: ["user", userId],
    queryFn: async (): Promise<DiscoveryUser> => {
      const response = await apiCall<DiscoveryUser>(`/api/users/${userId}`);
      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to get user profile");
      }
      return response.data;
    },
    enabled: !!userId,
  });
};
