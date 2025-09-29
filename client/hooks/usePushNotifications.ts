import { useEffect, useRef, useState } from "react";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./useAuth";
import { useApi } from "./useApi";

interface PushNotificationState {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  isLoading: boolean;
  error: string | null;
}

export const usePushNotifications = () => {
  const [state, setState] = useState<PushNotificationState>({
    expoPushToken: null,
    notification: null,
    isLoading: true,
    error: null,
  });

  const { user } = useAuth();
  const api = useApi();
  const notificationListener = useRef<Notifications.EventSubscription>(null);
  const responseListener = useRef<Notifications.EventSubscription>(null);

  // Configure notification handler
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    // Listen for incoming notifications
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        setState((prev) => ({ ...prev, notification }));
      });

    // Listen for notification responses (when user taps notification)
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log("Notification tapped:", response);
        // Handle navigation based on notification data
        handleNotificationNavigation(
          response.notification.request.content.data
        );
      });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  // Check notification permissions status
  const checkNotificationPermissions = async (): Promise<{
    status: 'granted' | 'denied' | 'undetermined';
    canAskAgain: boolean;
  }> => {
    try {
      const { status, canAskAgain } = await Notifications.getPermissionsAsync();

      if (status === 'granted') {
        return { status: 'granted', canAskAgain: true };
      } else if (status === 'denied') {
        return { status: 'denied', canAskAgain: canAskAgain };
      } else {
        return { status: 'undetermined', canAskAgain: true };
      }
    } catch (error) {
      console.error('Error checking notification permissions:', error);
      return { status: 'undetermined', canAskAgain: true };
    }
  };

  // Request notification permissions
  const requestNotificationPermissions = async (): Promise<boolean> => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();

      if (status === 'granted') {
        setState((prev) => ({ ...prev, error: null }));
        return true;
      } else {
        setState((prev) => ({
          ...prev,
          error: "Notification permissions are required for push notifications",
        }));
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      setState((prev) => ({
        ...prev,
        error: "Failed to request notification permissions",
      }));
      return false;
    }
  };

  // Register for push notifications
  const registerForPushNotifications = async (): Promise<string | null> => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Check current permissions status
      const permissions = await checkNotificationPermissions();

      if (permissions.status === 'denied' && !permissions.canAskAgain) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Notification permissions denied. Please enable notifications in your device settings to receive push notifications.",
        }));
        return null;
      }

      if (permissions.status !== 'granted') {
        const granted = await requestNotificationPermissions();
        if (!granted) {
          setState((prev) => ({ ...prev, isLoading: false }));
          return null;
        }
      }

      // Get the push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
      });

      const token = tokenData.data;
      setState((prev) => ({ ...prev, expoPushToken: token }));

      // Store token locally for quick access
      await AsyncStorage.setItem("expoPushToken", token);

      return token;
    } catch (error) {
      console.error("Error registering for push notifications:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: "Failed to register for push notifications",
      }));
      return null;
    }
  };

  // Register push token with backend
  const registerTokenWithBackend = async (token?: string) => {
    if (!user) {
      console.log("No user logged in, skipping token registration");
      return;
    }

    const pushToken = token || state.expoPushToken;
    if (!pushToken) {
      console.log("No push token available");
      return;
    }

    try {
      await api.apiCall("/notifications/register-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: pushToken,
          platform: Platform.OS,
          deviceId: await getDeviceId(),
          appVersion: "1.0.0", // You might want to get this from expo-constants
        }),
      });

      console.log("Push token registered with backend successfully");
    } catch (error) {
      console.error("Error registering push token with backend:", error);
      setState((prev) => ({
        ...prev,
        error: "Failed to register push token with server",
      }));
    }
  };

  // Get stored device ID or generate new one
  const getDeviceId = async (): Promise<string> => {
    try {
      let deviceId = await AsyncStorage.getItem("deviceId");
      if (!deviceId) {
        deviceId = `device_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;
        await AsyncStorage.setItem("deviceId", deviceId);
      }
      return deviceId;
    } catch (error) {
      console.error("Error getting device ID:", error);
      return `device_${Date.now()}`;
    }
  };

  // Handle notification navigation
  const handleNotificationNavigation = (data: Record<string, unknown>) => {
    // Handle navigation based on notification type and data
    if (data?.type === "friend_request" && data?.requestId) {
      // For now, navigate to discover tab where friend requests might be shown
      // In the future, this could navigate to a dedicated friends/requests screen
      console.log("Friend request notification - would navigate to friend requests screen");
      // TODO: Implement proper navigation to friend requests screen
    } else if (data?.type === "marketplace_inquiry" && data?.listingId) {
      // Navigate to marketplace tab and potentially to specific listing
      console.log("Marketplace inquiry notification - would navigate to marketplace listing:", data.listingId);
      // TODO: Implement navigation to specific marketplace listing
    } else if (data?.type === "new_message" && data?.chatId) {
      // Navigate to chat/messaging
      console.log("New message notification - would navigate to chat:", data.chatId);
      // TODO: Implement navigation to chat screen
    } else if (data?.type === "group_invitation" && data?.groupId) {
      // Navigate to groups or discover
      console.log("Group invitation notification - would navigate to group:", data.groupId);
      // TODO: Implement navigation to group screen
    }
  };

  // Send test notification
  const sendTestNotification = async (title: string, message: string) => {
    if (!user) {
      throw new Error("User must be logged in to send test notification");
    }

    try {
      await api.apiCall("/notifications/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          message,
        }),
      });

      return { success: true };
    } catch (error) {
      console.error("Error sending test notification:", error);
      throw error;
    }
  };

  // Initialize push notifications on app start
  useEffect(() => {
    const initializeNotifications = async () => {
      const token = await registerForPushNotifications();
      if (token && user) {
        await registerTokenWithBackend(token);
      }
      setState((prev) => ({ ...prev, isLoading: false }));
    };

    initializeNotifications();
  }, [user]);

  // Register token when user logs in
  useEffect(() => {
    if (user && state.expoPushToken) {
      registerTokenWithBackend();
    }
  }, [user, state.expoPushToken]);

  return {
    ...state,
    registerForPushNotifications,
    registerTokenWithBackend,
    sendTestNotification,
    handleNotificationNavigation,
    checkNotificationPermissions,
    requestNotificationPermissions,
  };
};
