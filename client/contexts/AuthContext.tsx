import React, { createContext, useContext, useEffect, useState } from 'react';
import { useUser, useAuth } from '@clerk/clerk-expo';

interface AuthContextType {
  user: any;
  isLoaded: boolean;
  isSignedIn: boolean;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut, getToken } = useAuth();
  const [authState, setAuthState] = useState({
    user,
    isLoaded,
    isSignedIn,
  });

  useEffect(() => {
    setAuthState({
      user,
      isLoaded,
      isSignedIn,
    });
  }, [user, isLoaded, isSignedIn]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const handleGetToken = async () => {
    try {
      return await getToken();
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  };

  const value: AuthContextType = {
    user: authState.user,
    isLoaded: authState.isLoaded,
    isSignedIn: authState.isSignedIn ?? false,
    signOut: handleSignOut,
    getToken: handleGetToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};