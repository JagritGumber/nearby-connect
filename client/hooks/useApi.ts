import { useState } from 'react';
import { useAuth } from './useAuth';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8787';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

export const useApi = () => {
  const { getAuthHeaders } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiCall = async <T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> => {
    setLoading(true);
    setError(null);

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          ...authHeaders,
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
        timestamp: Date.now(),
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    apiCall,
    loading,
    error,
  };
};