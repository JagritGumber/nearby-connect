import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from './useApi';

export interface FileUploadResult {
  key: string;
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  isPublic: boolean;
  expiresAt?: number;
}

export interface FileMetadata {
  key: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
  isPublic: boolean;
  expiresAt?: number;
  uploadedAt: number;
}

export const useFileService = () => {
  const { apiCall } = useApi();
  const queryClient = useQueryClient();

  // Upload single file
  const useUploadFile = () => {
    return useMutation({
      mutationFn: async ({
        file,
        category = 'OTHER',
        isPublic = false,
        expiresAt,
      }: {
        file: File;
        category?: string;
        isPublic?: boolean;
        expiresAt?: number;
      }): Promise<FileUploadResult> => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', category);
        formData.append('isPublic', isPublic.toString());
        if (expiresAt) {
          formData.append('expiresAt', expiresAt.toString());
        }

        const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8787'}/api/upload`, {
          method: 'POST',
          headers: {
            ...(await getAuthHeaders()),
          },
          body: formData,
        });

        const data = await response.json();
        if (!response.ok || !data.success || !data.data) {
          throw new Error(data.error || 'Failed to upload file');
        }
        return data.data;
      },
    });
  };

  // Upload multiple files
  const useUploadMultipleFiles = () => {
    return useMutation({
      mutationFn: async ({
        files,
        category = 'OTHER',
        isPublic = false,
        expiresAt,
      }: {
        files: File[];
        category?: string;
        isPublic?: boolean;
        expiresAt?: number;
      }): Promise<FileUploadResult[]> => {
        const formData = new FormData();
        files.forEach((file) => {
          formData.append('files', file);
        });
        formData.append('category', category);
        formData.append('isPublic', isPublic.toString());
        if (expiresAt) {
          formData.append('expiresAt', expiresAt.toString());
        }

        const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8787'}/api/upload/multiple`, {
          method: 'POST',
          headers: {
            ...(await getAuthHeaders()),
          },
          body: formData,
        });

        const data = await response.json();
        if (!response.ok || !data.success || !data.data) {
          throw new Error(data.error || 'Failed to upload files');
        }
        return data.data;
      },
    });
  };

  // Get file metadata
  const useFileMetadata = (key: string) => {
    return useQuery({
      queryKey: ['file-metadata', key],
      queryFn: async (): Promise<FileMetadata> => {
        const response = await apiCall<FileMetadata>(`/api/files/${key}/metadata`);
        if (!response.success || !response.data) {
          throw new Error(response.error || 'Failed to get file metadata');
        }
        return response.data;
      },
      enabled: !!key,
    });
  };

  // Get user's files
  const useUserFiles = (limit = 20, offset = 0) => {
    return useQuery({
      queryKey: ['user-files', limit, offset],
      queryFn: async (): Promise<FileMetadata[]> => {
        const params = new URLSearchParams();
        params.append('limit', limit.toString());
        params.append('offset', offset.toString());

        const response = await apiCall<FileMetadata[]>(`/api/files?${params}`);
        if (!response.success || !response.data) {
          throw new Error(response.error || 'Failed to get user files');
        }
        return response.data;
      },
    });
  };

  // Delete file
  const useDeleteFile = () => {
    return useMutation({
      mutationFn: async (key: string): Promise<void> => {
        const response = await apiCall(`/api/files/${key}`, {
          method: 'DELETE',
        });
        if (!response.success) {
          throw new Error(response.error || 'Failed to delete file');
        }
      },
      onSuccess: (_, key) => {
        queryClient.invalidateQueries({ queryKey: ['file-metadata', key] });
        queryClient.invalidateQueries({ queryKey: ['user-files'] });
      },
    });
  };

  return {
    useUploadFile,
    useUploadMultipleFiles,
    useFileMetadata,
    useUserFiles,
    useDeleteFile,
  };
};

// Helper function to get auth headers (assuming this exists in useAuth)
async function getAuthHeaders() {
  // This would need to be implemented based on your auth setup
  // For now, return empty headers
  return {};
}