import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useUserService, UserProfile } from '@/hooks/useUserService';
import { useAuth } from '@/hooks/useAuth';

interface UserProfileProps {
  onUpdate?: (profile: UserProfile) => void;
}

export const UserProfileComponent: React.FC<UserProfileProps> = ({ onUpdate }) => {
  const { profile, loading, updateProfile, updateLocation, updateOnlineStatus } = useUserService();
  const { user, signOut } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    displayName: '',
    username: '',
    bio: '',
  });

  const handleEdit = () => {
    if (profile) {
      setEditForm({
        displayName: profile.displayName || '',
        username: profile.username || '',
        bio: profile.bio || '',
      });
    }
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      const updates: Partial<UserProfile> = {};

      if (editForm.displayName !== (profile?.displayName || '')) {
        updates.displayName = editForm.displayName;
      }
      if (editForm.username !== (profile?.username || '')) {
        updates.username = editForm.username;
      }
      if (editForm.bio !== (profile?.bio || '')) {
        updates.bio = editForm.bio;
      }

      if (Object.keys(updates).length > 0) {
        const updatedProfile = await updateProfile(updates);
        onUpdate?.(updatedProfile);
        Alert.alert('Success', 'Profile updated successfully');
      }

      setIsEditing(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditForm({
      displayName: profile?.displayName || '',
      username: profile?.username || '',
      bio: profile?.bio || '',
    });
  };

  const handleGoOnline = () => {
    updateOnlineStatus(true);
  };

  const handleGoOffline = () => {
    updateOnlineStatus(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  if (loading && !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Profile not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Image
          source={{ uri: profile.avatar || 'https://via.placeholder.com/100' }}
          style={styles.avatar}
        />
        <Text style={styles.email}>{profile.email}</Text>
        <Text style={styles.userId}>ID: {profile.id}</Text>
      </View>

      {isEditing ? (
        <View style={styles.editForm}>
          <TextInput
            style={styles.input}
            placeholder="Display Name"
            value={editForm.displayName}
            onChangeText={(text) => setEditForm({ ...editForm, displayName: text })}
          />
          <TextInput
            style={styles.input}
            placeholder="Username"
            value={editForm.username}
            onChangeText={(text) => setEditForm({ ...editForm, username: text })}
          />
          <TextInput
            style={styles.input}
            placeholder="Bio"
            value={editForm.bio}
            onChangeText={(text) => setEditForm({ ...editForm, bio: text })}
            multiline
          />
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.profileInfo}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Display Name:</Text>
            <Text style={styles.value}>{profile.displayName || 'Not set'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Username:</Text>
            <Text style={styles.value}>{profile.username || 'Not set'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Bio:</Text>
            <Text style={styles.value}>{profile.bio || 'Not set'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Status:</Text>
            <Text style={[styles.value, { color: profile.isOnline ? '#4CAF50' : '#F44336' }]}>
              {profile.isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Last Seen:</Text>
            <Text style={styles.value}>
              {profile.lastSeenAt ? new Date(profile.lastSeenAt).toLocaleString() : 'Never'}
            </Text>
          </View>

          <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>

          <View style={styles.statusButtons}>
            {profile.isOnline ? (
              <TouchableOpacity style={styles.offlineButton} onPress={handleGoOffline}>
                <Text style={styles.offlineButtonText}>Go Offline</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.onlineButton} onPress={handleGoOnline}>
                <Text style={styles.onlineButtonText}>Go Online</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 15,
  },
  email: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  userId: {
    fontSize: 14,
    color: '#666',
  },
  profileInfo: {
    flex: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  value: {
    fontSize: 16,
    color: '#666',
  },
  editButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusButtons: {
    marginTop: 20,
  },
  onlineButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  onlineButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  offlineButton: {
    backgroundColor: '#F44336',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  offlineButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    backgroundColor: '#666',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  signOutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  editForm: {
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: '#666',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    flex: 1,
    marginLeft: 10,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});