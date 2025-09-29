import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { useApi } from '@/hooks/useApi';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface NotificationPreferences {
  newMessages: boolean;
  newMessagesSound: boolean;
  newMessagesVibration: boolean;
  friendRequests: boolean;
  friendRequestsSound: boolean;
  friendRequestsVibration: boolean;
  marketplaceInquiries: boolean;
  marketplaceInquiriesSound: boolean;
  marketplaceInquiriesVibration: boolean;
  groupInvitations: boolean;
  groupInvitationsSound: boolean;
  groupInvitationsVibration: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone: string;
}

export const NotificationSettings: React.FC = () => {
  const { user } = useAuth();
  const api = useApi();
  const { sendTestNotification } = usePushNotifications();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    newMessages: true,
    newMessagesSound: true,
    newMessagesVibration: true,
    friendRequests: true,
    friendRequestsSound: true,
    friendRequestsVibration: true,
    marketplaceInquiries: true,
    marketplaceInquiriesSound: true,
    marketplaceInquiriesVibration: true,
    groupInvitations: true,
    groupInvitationsSound: true,
    groupInvitationsVibration: true,
    timezone: 'UTC',
  });
  const [isLoading, setIsLoading] = useState(false);

  // Load current preferences
  useEffect(() => {
    loadPreferences();
  }, [user]);

  const loadPreferences = async () => {
    if (!user) return;

    try {
      // For now, we'll use default preferences
      // In a real app, you'd fetch these from the backend
      setPreferences(prev => ({
        ...prev,
        // These would come from the API
      }));
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    }
  };

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean | string) => {
    if (!user) return;

    try {
      setIsLoading(true);

      // Update local state immediately for better UX
      setPreferences(prev => ({ ...prev, [key]: value }));

      // Send update to backend
      await api.apiCall('/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [key]: value }),
      });

    } catch (error) {
      console.error('Error updating notification preference:', error);
      // Revert the change if the API call failed
      setPreferences(prev => ({ ...prev, [key]: !value }));
      Alert.alert('Error', 'Failed to update notification preferences');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendTestNotification = async () => {
    try {
      await sendTestNotification(
        'Test Notification',
        'This is a test notification to verify your settings are working correctly.'
      );
      Alert.alert('Success', 'Test notification sent!');
    } catch (error) {
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  const renderSection = (
    title: string,
    settings: Array<{
      key: keyof NotificationPreferences;
      label: string;
      value: boolean;
      type?: 'toggle' | 'sound' | 'vibration';
    }>
  ) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {settings.map((setting) => (
        <View key={setting.key} style={styles.settingRow}>
          <Text style={styles.settingLabel}>{setting.label}</Text>
          <Switch
            value={preferences[setting.key] as boolean}
            onValueChange={(value) => updatePreference(setting.key, value)}
            disabled={isLoading}
          />
        </View>
      ))}
    </View>
  );

  if (!user) {
    return (
      <View style={styles.container}>
        <Text>Please log in to manage notification settings</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Notification Settings</Text>

      {renderSection('Messages', [
        { key: 'newMessages', label: 'New Messages', value: preferences.newMessages },
        { key: 'newMessagesSound', label: 'Sound', value: preferences.newMessagesSound },
        { key: 'newMessagesVibration', label: 'Vibration', value: preferences.newMessagesVibration },
      ])}

      {renderSection('Friend Requests', [
        { key: 'friendRequests', label: 'Friend Requests', value: preferences.friendRequests },
        { key: 'friendRequestsSound', label: 'Sound', value: preferences.friendRequestsSound },
        { key: 'friendRequestsVibration', label: 'Vibration', value: preferences.friendRequestsVibration },
      ])}

      {renderSection('Marketplace', [
        { key: 'marketplaceInquiries', label: 'Marketplace Inquiries', value: preferences.marketplaceInquiries },
        { key: 'marketplaceInquiriesSound', label: 'Sound', value: preferences.marketplaceInquiriesSound },
        { key: 'marketplaceInquiriesVibration', label: 'Vibration', value: preferences.marketplaceInquiriesVibration },
      ])}

      {renderSection('Groups', [
        { key: 'groupInvitations', label: 'Group Invitations', value: preferences.groupInvitations },
        { key: 'groupInvitationsSound', label: 'Sound', value: preferences.groupInvitationsSound },
        { key: 'groupInvitationsVibration', label: 'Vibration', value: preferences.groupInvitationsVibration },
      ])}

      <View style={styles.testSection}>
        <Text style={styles.sectionTitle}>Test Notifications</Text>
        <TouchableOpacity
          style={styles.testButton}
          onPress={handleSendTestNotification}
        >
          <Text style={styles.testButtonText}>Send Test Notification</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    padding: 20,
    paddingBottom: 10,
  },
  section: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
  },
  testSection: {
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  testButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});