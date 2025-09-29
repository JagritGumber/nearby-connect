import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from './useApi';

export interface MarketplaceListing {
  id: string;
  title: string;
  description: string;
  price: number;
  condition: 'new' | 'like-new' | 'good' | 'fair' | 'poor';
  category: string;
  images: string[];
  location?: {
    latitude: number;
    longitude: number;
  };
  userId: string;
  username?: string;
  userAvatar?: string;
  status: 'active' | 'sold' | 'deleted';
  createdAt: number;
  updatedAt: number;
  distance?: number;
}

export interface MarketplaceFilters {
  category?: string;
  condition?: string;
  minPrice?: number;
  maxPrice?: number;
  latitude?: number;
  longitude?: number;
  radius?: number;
  status?: 'active' | 'sold';
  limit?: number;
  offset?: number;
}

export interface CreateListingData {
  title: string;
  description: string;
  price: number;
  condition: 'new' | 'like-new' | 'good' | 'fair' | 'poor';
  category: string;
  images?: string[];
  latitude?: number;
  longitude?: number;
}

// Get marketplace listings
export const useListings = (filters: MarketplaceFilters = {}) => {
  const { apiCall } = useApi();
  return useQuery({
    queryKey: ['marketplace', filters],
    queryFn: async (): Promise<MarketplaceListing[]> => {
      const params = new URLSearchParams();
      if (filters.category) params.append('category', filters.category);
      if (filters.condition) params.append('condition', filters.condition);
      if (filters.minPrice) params.append('minPrice', filters.minPrice.toString());
      if (filters.maxPrice) params.append('maxPrice', filters.maxPrice.toString());
      if (filters.latitude) params.append('latitude', filters.latitude.toString());
      if (filters.longitude) params.append('longitude', filters.longitude.toString());
      if (filters.radius) params.append('radius', filters.radius.toString());
      if (filters.status) params.append('status', filters.status);
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.offset) params.append('offset', filters.offset.toString());

      const response = await apiCall<MarketplaceListing[]>(`/api/marketplace?${params}`);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to get listings');
      }
      return response.data;
    },
  });
};

// Get specific listing
export const useListing = (listingId: string) => {
  const { apiCall } = useApi();
  return useQuery({
    queryKey: ['listing', listingId],
    queryFn: async (): Promise<MarketplaceListing> => {
      const response = await apiCall<MarketplaceListing>(`/api/marketplace/${listingId}`);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to get listing');
      }
      return response.data;
    },
    enabled: !!listingId,
  });
};

// Create new listing
export const useCreateListing = () => {
  const { apiCall } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateListingData): Promise<MarketplaceListing> => {
      const response = await apiCall<MarketplaceListing>('/api/marketplace', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to create listing');
      }
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace'] });
    },
  });
};

// Update listing
export const useUpdateListing = () => {
  const { apiCall } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      listingId,
      data,
    }: {
      listingId: string;
      data: Partial<CreateListingData>;
    }): Promise<MarketplaceListing> => {
      const response = await apiCall<MarketplaceListing>(`/api/marketplace/${listingId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to update listing');
      }
      return response.data;
    },
    onSuccess: (_, { listingId }) => {
      queryClient.invalidateQueries({ queryKey: ['listing', listingId] });
      queryClient.invalidateQueries({ queryKey: ['marketplace'] });
    },
  });
};

// Delete listing
export const useDeleteListing = () => {
  const { apiCall } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (listingId: string): Promise<void> => {
      const response = await apiCall(`/api/marketplace/${listingId}`, {
        method: 'DELETE',
      });
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete listing');
      }
    },
    onSuccess: (_, listingId) => {
      queryClient.invalidateQueries({ queryKey: ['listing', listingId] });
      queryClient.invalidateQueries({ queryKey: ['marketplace'] });
    },
  });
};

// Search listings
export const useSearchListings = (query: string, limit = 20) => {
  const { apiCall } = useApi();
  return useQuery({
    queryKey: ['marketplace-search', query, limit],
    queryFn: async (): Promise<MarketplaceListing[]> => {
      const params = new URLSearchParams();
      params.append('q', query);
      params.append('limit', limit.toString());

      const response = await apiCall<MarketplaceListing[]>(`/api/marketplace/search?${params}`);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to search listings');
      }
      return response.data;
    },
    enabled: !!query,
  });
};