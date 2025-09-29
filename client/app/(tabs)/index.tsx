import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  RefreshControl,
  View,
  Text,
  ActivityIndicator,
} from "react-native";
import { useFeed } from "@/hooks/useFeedService";
import { useProfile } from "@/hooks/useProfileService";
import { FeedItem } from "@/components/FeedItem";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const [refreshing, setRefreshing] = useState(false);
  const { data: profile } = useProfile();
  const {
    data: feed,
    isLoading,
    error,
    refetch,
  } = useFeed({
    limit: 20,
    includeFriends: true,
    includeGroups: true,
    includeRecent: true,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading && !feed) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator
          size="large"
          color={Colors[colorScheme ?? "light"].tint}
        />
        <Text
          style={[
            styles.loadingText,
            { color: Colors[colorScheme ?? "light"].text },
          ]}
        >
          Loading your feed...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text
          style={[
            styles.errorText,
            { color: Colors[colorScheme ?? "light"].text },
          ]}
        >
          Failed to load feed
        </Text>
        <Text
          style={[
            styles.errorSubtext,
            { color: Colors[colorScheme ?? "light"].text },
          ]}
        >
          {error.message}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {feed && feed.length > 0 ? (
        feed.map((item) => <FeedItem key={item.id} item={item} />)
      ) : (
        <View style={[styles.emptyContainer, styles.centered]}>
          <Text
            style={[
              styles.emptyText,
              { color: Colors[colorScheme ?? "light"].text },
            ]}
          >
            Your feed is empty
          </Text>
          <Text
            style={[
              styles.emptySubtext,
              { color: Colors[colorScheme ?? "light"].text },
            ]}
          >
            Follow friends and join groups to see content here
          </Text>
        </View>
      )}
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
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: "center",
  },
  errorText: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    textAlign: "center",
    opacity: 0.7,
  },
  emptyContainer: {
    flex: 1,
    padding: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
    opacity: 0.7,
  },
});
