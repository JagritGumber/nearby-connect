import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useProfile, useUpdateProfile, useUpdateStatus } from '@/hooks/useProfileService';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const [refreshing, setRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    bio: '',
    interests: [] as string[],
  });

  const { data: profile, isLoading, error, refetch } = useProfile();
  const updateProfile = useUpdateProfile();
  const updateStatus = useUpdateStatus();

  useEffect(() => {
    if (profile) {
      setEditForm({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        username: profile.username || '',
        bio: profile.bio || '',
        interests: profile.interests || [],
      });
    }
  }, [profile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleSaveProfile = async () => {
    try {
      await updateProfile.mutateAsync(editForm);
      setIsEditing(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleToggleOnlineStatus = async () => {
    if (!profile) return;

    try {
      await updateStatus.mutateAsync({ isOnline: !profile.isOnline });
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const formatLastSeen = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (isLoading && !profile) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
        <Text style={[styles.loadingText, { color: Colors[colorScheme ?? 'light'].text }]}>
          Loading profile...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={[styles.errorText, { color: Colors[colorScheme ?? 'light'].text }]}>
          Failed to load profile
        </Text>
        <Text style={[styles.errorSubtext, { color: Colors[colorScheme ?? 'light'].text }]}>
          {error.message}
        </Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={[styles.errorText, { color: Colors[colorScheme ?? 'light'].text }]}>
          Profile not found
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Profile Header */}
      <View style={[styles.profileHeader, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}>
        <View style={styles.avatarContainer}>
          {profile.avatar ? (
            <Image source={{ uri: profile.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: Colors[colorScheme ?? 'light'].background }]}>
              <IconSymbol name="person.circle" size={60} color={Colors[colorScheme ?? 'light'].text} />
            </View>
          )}
        </View>

        <Text style={styles.profileName}>
          {profile.firstName || profile.lastName
            ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim()
            : profile.username || 'Anonymous'}
        </Text>

        {profile.username && (
          <Text style={styles.profileUsername}>@{profile.username}</Text>
        )}

        <TouchableOpacity
          style={styles.statusButton}
          onPress={handleToggleOnlineStatus}
        >
          <View
            style={[
              styles.statusDot,
              { backgroundColor: profile.isOnline ? '#4CAF50' : '#FFC107' }
            ]}
          />
          <Text style={styles.statusText}>
            {profile.isOnline ? 'Online' : `Last seen ${formatLastSeen(profile.lastSeen)}`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Profile Content */}
      <View style={styles.profileContent}>
        {/* Edit/Save Button */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => isEditing ? handleSaveProfile() : setIsEditing(true)}
          >
            {updateProfile.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <IconSymbol name={isEditing ? "checkmark" : "pencil"} size={16} color="#fff" />
                <Text style={styles.editButtonText}>
                  {isEditing ? 'Save' : 'Edit Profile'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
            Basic Information
          </Text>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>Email</Text>
            <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}>
              {profile.email}
            </Text>
          </View>

          {isEditing ? (
            <>
              <View style={styles.inputRow}>
                <Text style={[styles.inputLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                  First Name
                </Text>
                <TextInput
                  style={[styles.textInput, { color: Colors[colorScheme ?? 'light'].text }]}
                  value={editForm.firstName}
                  onChangeText={(text) => setEditForm(prev => ({ ...prev, firstName: text }))}
                  placeholder="Enter first name"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
                />
              </View>

              <View style={styles.inputRow}>
                <Text style={[styles.inputLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                  Last Name
                </Text>
                <TextInput
                  style={[styles.textInput, { color: Colors[colorScheme ?? 'light'].text }]}
                  value={editForm.lastName}
                  onChangeText={(text) => setEditForm(prev => ({ ...prev, lastName: text }))}
                  placeholder="Enter last name"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
                />
              </View>

              <View style={styles.inputRow}>
                <Text style={[styles.inputLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                  Username
                </Text>
                <TextInput
                  style={[styles.textInput, { color: Colors[colorScheme ?? 'light'].text }]}
                  value={editForm.username}
                  onChangeText={(text) => setEditForm(prev => ({ ...prev, username: text }))}
                  placeholder="Enter username"
                  placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
                />
              </View>
            </>
          ) : (
            <>
              {profile.firstName && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                    First Name
                  </Text>
                  <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                    {profile.firstName}
                  </Text>
                </View>
              )}

              {profile.lastName && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                    Last Name
                  </Text>
                  <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                    {profile.lastName}
                  </Text>
                </View>
              )}

              {profile.username && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
                    Username
                  </Text>
                  <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}>
                    @{profile.username}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Bio Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
            About
          </Text>

          {isEditing ? (
            <TextInput
              style={[
                styles.bioInput,
                { color: Colors[colorScheme ?? 'light'].text, backgroundColor: Colors[colorScheme ?? 'light'].background }
              ]}
              value={editForm.bio}
              onChangeText={(text) => setEditForm(prev => ({ ...prev, bio: text }))}
              placeholder="Tell us about yourself..."
              placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          ) : (
            <Text style={[styles.bio, { color: Colors[colorScheme ?? 'light'].text }]}>
              {profile.bio || 'No bio added yet'}
            </Text>
          )}
        </View>

        {/* Interests Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
            Interests
          </Text>

          {isEditing ? (
            <TextInput
              style={[
                styles.textInput,
                { color: Colors[colorScheme ?? 'light'].text, backgroundColor: Colors[colorScheme ?? 'light'].background }
              ]}
              value={editForm.interests.join(', ')}
              onChangeText={(text) => setEditForm(prev => ({
                ...prev,
                interests: text.split(',').map(i => i.trim()).filter(i => i.length > 0)
              }))}
              placeholder="e.g. hiking, reading, gaming"
              placeholderTextColor={Colors[colorScheme ?? 'light'].text + '60'}
            />
          ) : (
            <View style={styles.interestsContainer}>
              {profile.interests && profile.interests.length > 0 ? (
                profile.interests.map((interest, index) => (
                  <View key={index} style={[styles.interestTag, { backgroundColor: Colors[colorScheme ?? 'light'].tint + '20' }]}>
                    <Text style={[styles.interestText, { color: Colors[colorScheme ?? 'light'].tint }]}>
                      {interest}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.noInterests, { color: Colors[colorScheme ?? 'light'].text + '60' }]}>
                  No interests added yet
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Account Info */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors[colorScheme ?? 'light'].text }]}>
            Account Information
          </Text>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
              Member since
            </Text>
            <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}>
              {new Date(profile.createdAt).toLocaleDateString()}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: Colors[colorScheme ?? 'light'].text }]}>
              Last updated
            </Text>
            <Text style={[styles.infoValue, { color: Colors[colorScheme ?? 'light'].text }]}>
              {new Date(profile.updatedAt).toLocaleDateString()}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  profileHeader: {
    alignItems: 'center',
    padding: 24,
    paddingTop: 60,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  profileUsername: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 12,
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  profileContent: {
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
  },
  editButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editButtonText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '600',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
  },
  inputRow: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  bioInput: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
  },
  bio: {
    fontSize: 16,
    lineHeight: 24,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  interestTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  interestText: {
    fontSize: 14,
    fontWeight: '500',
  },
  noInterests: {
    fontSize: 16,
    fontStyle: 'italic',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
});