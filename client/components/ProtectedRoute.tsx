import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { Redirect } from 'expo-router';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallbackPath?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  fallbackPath = '/sign-in',
}) => {
  const { isLoaded, isSignedIn, requireAuth } = useAuth();

  // Show loading spinner while Clerk is loading
  if (!isLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Redirect to sign-in if not authenticated
  if (!isSignedIn) {
    return <Redirect href={fallbackPath} />;
  }

  // Render children if authenticated
  return <>{children}</>;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});