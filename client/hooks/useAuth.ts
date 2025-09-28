import { useAuthContext } from '@/contexts/AuthContext';
import { useUser } from '@clerk/clerk-expo';

export const useAuth = () => {
  const { user, isLoaded, isSignedIn, signOut, getToken } = useAuthContext();
  const { user: clerkUser } = useUser();

  const requireAuth = () => {
    if (!isLoaded) return false;
    if (!isSignedIn) return false;
    return true;
  };

  const getAuthHeaders = async () => {
    const token = await getToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  return {
    user,
    clerkUser,
    isLoaded,
    isSignedIn,
    signOut,
    getToken,
    requireAuth,
    getAuthHeaders,
  };
};