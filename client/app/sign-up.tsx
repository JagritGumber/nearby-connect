import React from 'react';
import { View, StyleSheet, Text, Alert, TouchableOpacity } from 'react-native';
import { useSignUp } from '@clerk/clerk-expo';
import { Stack, useRouter } from 'expo-router';
import { useUserService } from '@/hooks/useUserService';

export default function SignUpScreen() {
  const router = useRouter();
  const { isLoaded, signUp, setActive } = useSignUp();
  const { fetchProfile } = useUserService();

  const handleSignUp = async () => {
    try {
      if (!signUp) {
        Alert.alert('Error', 'Sign up not available');
        return;
      }

      // This will open the Clerk sign-up modal
      const result = await signUp.create({
        emailAddress: '',
        password: '',
      });

      if (result.status === 'complete') {
        await setActive?.({ session: result.createdSessionId });
        await handleSignUpSuccess();
      }
    } catch (error) {
      console.error('Error during sign up:', error);
      Alert.alert('Error', 'Failed to sign up');
    }
  };

  const handleSignUpSuccess = async () => {
    try {
      // Fetch or create user profile
      await fetchProfile();
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error after sign up:', error);
      Alert.alert('Error', 'Failed to complete sign up process');
    }
  };

  if (!isLoaded) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Sign Up' }} />

      <View style={styles.content}>
        <Text style={styles.title}>Join NearbyConnect</Text>
        <Text style={styles.subtitle}>Create your account to get started</Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.signUpButton} onPress={handleSignUp}>
            <Text style={styles.signUpButtonText}>Sign Up</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Already have an account?{' '}
            <Text
              style={styles.linkText}
              onPress={() => router.push('/sign-in')}
            >
              Sign In
            </Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    color: '#666',
  },
  buttonContainer: {
    marginBottom: 20,
  },
  signUpButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
  },
  signUpButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
  },
  linkText: {
    color: '#007AFF',
    fontWeight: '600',
  },
});