import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "./useApi";

interface UserProfile {
  id: string;
  clerkId: string;
  email: string;
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
  createdAt: number;
  updatedAt: number;
}

interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  username?: string;
  bio?: string;
  interests?: string[];
}

interface UpdateLocationData {
  latitude: number;
  longitude: number;
}

interface UpdateStatusData {
  isOnline: boolean;
}

// Get current user profile
export const useProfile = () => {
  const { apiCall } = useApi();
  return useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<UserProfile> => {
      const response = await apiCall<UserProfile>("/api/profile");
      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to fetch profile");
      }
      return response.data;
    },
  });
};

// Update user profile
export const useUpdateProfile = () => {
  const { apiCall } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateProfileData): Promise<UserProfile> => {
      const response = await apiCall<UserProfile>("/api/profile", {
        method: "PUT",
        body: JSON.stringify(data),
      });
      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to update profile");
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
};

// Update user location
export const useUpdateLocation = () => {
  const queryClient = useQueryClient();
  const { apiCall } = useApi();
  return useMutation({
    mutationFn: async (data: UpdateLocationData): Promise<UserProfile> => {
      const response = await apiCall<UserProfile>("/api/location", {
        method: "PUT",
        body: JSON.stringify(data),
      });
      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to update location");
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
};

// Update online status
export const useUpdateStatus = () => {
  const { apiCall } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UpdateStatusData): Promise<UserProfile> => {
      const response = await apiCall<UserProfile>("/api/status", {
        method: "PUT",
        body: JSON.stringify(data),
      });
      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to update status");
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
};
