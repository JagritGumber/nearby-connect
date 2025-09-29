import { ClerkProvider, ClerkLoaded } from '@clerk/clerk-expo';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { tokenCache } from '@/utils/token-cache';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY || '';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
    },
  },
});

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
          <ClerkLoaded>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
                <Stack.Screen
                  name="sign-in"
                  options={{
                    presentation: 'modal',
                    title: 'Sign In',
                    headerShown: false,
                  }}
                />
                <Stack.Screen
                  name="sign-up"
                  options={{
                    presentation: 'modal',
                    title: 'Sign Up',
                    headerShown: false,
                  }}
                />
              </Stack>
              <StatusBar style="auto" />
            </ThemeProvider>
          </ClerkLoaded>
        </ClerkProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
