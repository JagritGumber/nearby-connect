import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useDiscoverUsers } from "@/hooks/useDiscoveryService";
import { useSendFriendRequest } from "@/hooks/useFriendService";
import { useProfile } from "@/hooks/useProfileService";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { IconSymbol } from "@/components/ui/icon-symbol";
import * as Location from "expo-location";

interface UserCardProps {
  user: any;
  onSendRequest: (userId: string) => void;
  isLoading?: boolean;
}

const UserCard: React.FC<UserCardProps> = ({
  user,
  onSendRequest,
  isLoading = false,
}) => {
  const colorScheme = useColorScheme();

  return (
    <View
      style={[
        styles.userCard,
        { backgroundColor: Colors[colorScheme ?? "light"].background },
      ]}
    >
      <View style={styles.userHeader}>
        <View style={styles.userInfo}>
          <Text
            style={[
              styles.username,
              { color: Colors[colorScheme ?? "light"].text },
            ]}
          >
            {user.username ||
              `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
              "Anonymous"}
          </Text>
          {user.distance && (
            <Text
              style={[
                styles.distance,
                { color: Colors[colorScheme ?? "light"].text + "80" },
              ]}
            >
              {Math.round(user.distance)}km away
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.addButton, isLoading && styles.disabledButton]}
          onPress={() => onSendRequest(user.id)}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <IconSymbol name="plus" size={16} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      {user.bio && (
        <Text
          style={[styles.bio, { color: Colors[colorScheme ?? "light"].text }]}
        >
          {user.bio}
        </Text>
      )}

      {user.interests && user.interests.length > 0 && (
        <View style={styles.interests}>
          {user.interests.slice(0, 3).map((interest: string, index: number) => (
            <View
              key={index}
              style={[
                styles.interestTag,
                { backgroundColor: Colors[colorScheme ?? "light"].tint + "20" },
              ]}
            >
              <Text
                style={[
                  styles.interestText,
                  { color: Colors[colorScheme ?? "light"].tint },
                ]}
              >
                {interest}
              </Text>
            </View>
          ))}
        </View>
      )}

      {user.mutualFriends !== undefined && user.mutualFriends > 0 && (
        <Text
          style={[
            styles.mutualFriends,
            { color: Colors[colorScheme ?? "light"].text + "80" },
          ]}
        >
          {user.mutualFriends} mutual friend
          {user.mutualFriends !== 1 ? "s" : ""}
        </Text>
      )}
    </View>
  );
};

export default function DiscoverScreen() {
  const colorScheme = useColorScheme();
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const { data: profile } = useProfile();
  const sendFriendRequest = useSendFriendRequest();

  // Get current location
  React.useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({});
        setLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    })();
  }, []);

  const {
    data: users,
    isLoading,
    error,
    refetch,
  } = useDiscoverUsers({
    latitude: location?.latitude,
    longitude: location?.longitude,
    radius: 50,
    limit: 20,
  });

  const filteredUsers = users?.filter(
    (user) =>
      user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.bio?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onRefresh = async () => {
    setRefreshing(true);
    if (location) {
      await refetch();
    }
    setRefreshing(false);
  };

  const handleSendFriendRequest = async (userId: string) => {
    try {
      await sendFriendRequest.mutateAsync(userId);
    } catch (error) {
      console.error("Failed to send friend request:", error);
    }
  };

  if (!location) {
    return (
      <View style={[styles.container, styles.centered]}>
        <IconSymbol
          name="location"
          size={48}
          color={Colors[colorScheme ?? "light"].text + "40"}
        />
        <Text
          style={[
            styles.permissionText,
            { color: Colors[colorScheme ?? "light"].text },
          ]}
        >
          Location access needed to discover nearby users
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={() => Location.requestForegroundPermissionsAsync()}
        >
          <Text style={styles.permissionButtonText}>Grant Location Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading && !users) {
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
          Discovering users nearby...
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
          Failed to discover users
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
    <View
      style={[
        styles.container,
        { backgroundColor: Colors[colorScheme ?? "light"].background },
      ]}
    >
      <View style={styles.searchContainer}>
        <IconSymbol
          name="magnifyingglass"
          size={20}
          color={Colors[colorScheme ?? "light"].text + "60"}
        />
        <TextInput
          style={[
            styles.searchInput,
            { color: Colors[colorScheme ?? "light"].text },
          ]}
          placeholder="Search users..."
          placeholderTextColor={Colors[colorScheme ?? "light"].text + "60"}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filteredUsers}
        renderItem={({ item }) => (
          <UserCard
            user={item}
            onSendRequest={handleSendFriendRequest}
            isLoading={sendFriendRequest.isPending}
          />
        )}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={[styles.emptyContainer, styles.centered]}>
            <IconSymbol
              name="person.2"
              size={48}
              color={Colors[colorScheme ?? "light"].text + "40"}
            />
            <Text
              style={[
                styles.emptyText,
                { color: Colors[colorScheme ?? "light"].text },
              ]}
            >
              No users found nearby
            </Text>
            <Text
              style={[
                styles.emptySubtext,
                { color: Colors[colorScheme ?? "light"].text },
              ]}
            >
              Try adjusting your search or location
            </Text>
          </View>
        }
        contentContainerStyle={
          filteredUsers?.length === 0 ? styles.centered : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    paddingVertical: 8,
  },
  userCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  distance: {
    fontSize: 14,
  },
  addButton: {
    backgroundColor: "#007AFF",
    padding: 8,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 36,
    minHeight: 36,
  },
  disabledButton: {
    opacity: 0.6,
  },
  bio: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  interests: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  interestTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  interestText: {
    fontSize: 12,
    fontWeight: "500",
  },
  mutualFriends: {
    fontSize: 12,
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
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: "center",
    opacity: 0.7,
  },
  permissionText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 24,
    paddingHorizontal: 32,
  },
  permissionButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
