import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import { UserProfileComponent } from "@/components/UserProfile";

export default function HomeScreen() {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <UserProfileComponent />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  contentContainer: {
    paddingBottom: 20,
  },
});
