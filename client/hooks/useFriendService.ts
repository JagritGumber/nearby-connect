import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from './useApi';

export interface FriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
  updatedAt: number;
  sender?: {
    id: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    avatar?: string;
  };
}

export interface Friend {
  id: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  avatar?: string;
  isOnline: boolean;
  lastSeen: number;
}

// Send friend request
export const useSendFriendRequest = () => {
  const { apiCall } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (receiverId: string): Promise<FriendRequest> => {
      const response = await apiCall<FriendRequest>('/api/friend-requests', {
        method: 'POST',
        body: JSON.stringify({ receiverId }),
      });
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to send friend request');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    },
  });
};

// Update friend request (accept/reject)
export const useUpdateFriendRequest = () => {
  const { apiCall } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      requestId,
      status,
    }: {
      requestId: string;
      status: 'accepted' | 'rejected';
    }): Promise<FriendRequest> => {
      const response = await apiCall<FriendRequest>(`/api/friend-requests/${requestId}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to update friend request');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    },
  });
};

// Get pending friend requests
export const useFriendRequests = () => {
  const { apiCall } = useApi();
  return useQuery({
    queryKey: ['friend-requests'],
    queryFn: async (): Promise<FriendRequest[]> => {
      const response = await apiCall<FriendRequest[]>('/api/friend-requests');
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to get friend requests');
      }
      return response.data;
    },
  });
};

// Get friends list
export const useFriendsList = () => {
  const { apiCall } = useApi();
  return useQuery({
    queryKey: ['friends'],
    queryFn: async (): Promise<Friend[]> => {
      const response = await apiCall<Friend[]>('/api/friends');
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to get friends list');
      }
      return response.data;
    },
  });
};