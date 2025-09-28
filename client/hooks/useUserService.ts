import { useState, useEffect } from 'react';
import { useApi } from './useApi';
import { useAuth } from './useAuth';

export interface UserProfile {
  id: string;
  clerkId: string;
  email: string;
  username: string | null;
  displayName: string | null;
  avatar: string | null;
  bio: string | null;
  latitude: number | null;
  longitude: number | null;
  locationUpdatedAt: number | null;
  isOnline: boolean;
  lastSeenAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export const useUserService = () => {
  const { apiCall } = useApi();
  const { user, isSignedIn } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch user profile
  const fetchProfile = async () => {
    if (!isSignedIn) return null;

    setLoading(true);
    try {
      const response = await apiCall<UserProfile>('/api/profile');
      if (response.success && response.data) {
        setProfile(response.data);
        return response.data;
      }
      return null;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Update user profile
  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!isSignedIn) throw new Error('User not authenticated');

    setLoading(true);
    try {
      const response = await apiCall<UserProfile>('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(updates),
      });

      if (response.success && response.data) {
        setProfile(response.data);
        return response.data;
      }
      throw new Error(response.error || 'Failed to update profile');
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Update user location
  const updateLocation = async (latitude: number, longitude: number) => {
    if (!isSignedIn) throw new Error('User not authenticated');

    setLoading(true);
    try {
      const response = await apiCall<UserProfile>('/api/location', {
        method: 'PUT',
        body: JSON.stringify({ latitude, longitude }),
      });

      if (response.success && response.data) {
        setProfile(response.data);
        return response.data;
      }
      throw new Error(response.error || 'Failed to update location');
    } catch (error) {
      console.error('Error updating location:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Update online status
  const updateOnlineStatus = async (isOnline: boolean) => {
    if (!isSignedIn) throw new Error('User not authenticated');

    setLoading(true);
    try {
      const response = await apiCall<UserProfile>('/api/status', {
        method: 'PUT',
        body: JSON.stringify({ isOnline }),
      });

      if (response.success && response.data) {
        setProfile(response.data);
        return response.data;
      }
      throw new Error(response.error || 'Failed to update status');
    } catch (error) {
      console.error('Error updating status:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Load profile on auth state change
  useEffect(() => {
    if (isSignedIn && user) {
      fetchProfile();
    } else {
      setProfile(null);
    }
  }, [isSignedIn, user]);

  return {
    profile,
    loading,
    fetchProfile,
    updateProfile,
    updateLocation,
    updateOnlineStatus,
    isAuthenticated: isSignedIn,
  };
};