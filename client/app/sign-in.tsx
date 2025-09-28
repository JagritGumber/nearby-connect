import React from "react";
import { View, StyleSheet, Text, Alert, TouchableOpacity } from "react-native";
import { useSignIn } from "@clerk/clerk-expo";
import { Stack, useRouter } from "expo-router";
import { useUserService } from "@/hooks/useUserService";

export default function SignInScreen() {
  const router = useRouter();
  const { isLoaded, signIn, setActive } = useSignIn();
  const { fetchProfile } = useUserService();

  const handleSignIn = async () => {
    try {
      if (!signIn) {
        Alert.alert("Error", "Sign in not available");
        return;
      }

      // This will open the Clerk sign-in modal
      const result = await signIn.create({
        identifier: "", // This will be handled by Clerk's modal
        password: "",
      });

      if (result.status === "complete") {
        await setActive?.({ session: result.createdSessionId });
        await handleSignInSuccess();
      }
    } catch (error) {
      console.error("Error during sign in:", error);
      Alert.alert("Error", "Failed to sign in");
    }
  };

  const handleSignInSuccess = async () => {
    try {
      // Fetch or create user profile
      await fetchProfile();
      router.replace("/(tabs)");
    } catch (error) {
      console.error("Error after sign in:", error);
      Alert.alert("Error", "Failed to complete sign in process");
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
      <Stack.Screen options={{ title: "Sign In" }} />

      <View style={styles.content}>
        <Text style={styles.title}>Welcome to NearbyConnect</Text>
        <Text style={styles.subtitle}>
          Sign in to connect with people nearby
        </Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.signInButton} onPress={handleSignIn}>
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {"Don't"} have an account?{" "}
            <Text
              style={styles.linkText}
              onPress={() => router.push("/sign-up")}
            >
              Sign Up
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
    backgroundColor: "#fff",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  loadingText: {
    textAlign: "center",
    fontSize: 16,
    color: "#666",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
    color: "#333",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 40,
    color: "#666",
  },
  buttonContainer: {
    marginBottom: 20,
  },
  signInButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: "center",
  },
  signInButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    alignItems: "center",
  },
  footerText: {
    fontSize: 14,
    color: "#666",
  },
  linkText: {
    color: "#007AFF",
    fontWeight: "600",
  },
});
