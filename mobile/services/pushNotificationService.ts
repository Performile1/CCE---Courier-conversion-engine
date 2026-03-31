import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string;
}

export interface NotificationResponse {
  request: Notifications.NotificationRequest;
  actionIdentifier: string;
}

class PushNotificationService {
  private isInitialized = false;

  /**
   * Initialize push notification service
   * Must be called once during app startup
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('Push notification service already initialized');
      return;
    }

    try {
      // Check if device is physical
      if (!Device.isDevice) {
        console.warn('Push notifications only work on physical devices');
        return;
      }

      // Request notification permission
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('Failed to get push notification permission');
        return;
      }

      // Set notification handler
      Notifications.setNotificationHandler({
        handleNotification: async (notification) => {
          return {
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          };
        },
      });

      // Get native push token
      const token = await this.registerForPushNotifications();

      if (token) {
        console.log('Push notification token:', token);
        // Store token in backend for later use
        await this.savePushTokenToBackend(token);
      }

      this.isInitialized = true;
      console.log('Push notification service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
    }
  }

  /**
   * Register device for push notifications
   */
  private async registerForPushNotifications(): Promise<string | null> {
    try {
      if (Constants.expoConfig?.extra?.eas?.projectId) {
        const token = (
          await Notifications.getExpoPushTokenAsync({
            projectId: Constants.expoConfig.extra.eas.projectId,
          })
        ).data;

        return token;
      } else {
        console.warn('Expo project ID not configured');
        return null;
      }
    } catch (error) {
      console.error('Failed to register for push notifications:', error);
      return null;
    }
  }

  /**
   * Save push token to backend
   */
  private async savePushTokenToBackend(token: string): Promise<void> {
    try {
      // TODO: Save token to Supabase or backend service
      // This allows the server to send targeted push notifications
      const response = await fetch('YOUR_BACKEND_URL/api/push-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          platform: Platform.OS,
          deviceId: Device.deviceName,
        }),
      });

      if (!response.ok) {
        console.warn('Failed to save push token to backend');
      }
    } catch (error) {
      console.error('Error saving push token to backend:', error);
    }
  }

  /**
   * Send local notification (for testing or local alerts)
   */
  async sendLocalNotification(payload: PushNotificationPayload): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: payload.title,
          body: payload.body,
          sound: payload.sound || 'default',
          data: payload.data || {},
          badge: 1,
        },
        trigger: {
          seconds: 1,
        },
      });
    } catch (error) {
      console.error('Failed to send local notification:', error);
    }
  }

  /**
   * Cancel all pending notifications
   */
  async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('All notifications cancelled');
    } catch (error) {
      console.error('Failed to cancel notifications:', error);
    }
  }

  /**
   * Listen to incoming notifications
   */
  listenToNotifications(callback: (notification: Notifications.Notification) => void): void {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log('Notification received:', notification);
      callback(notification);
    });

    // Return unsubscribe function for cleanup
    return () => subscription.remove();
  }

  /**
   * Listen to notification responses (when user taps notification)
   */
  listenToNotificationResponses(callback: (response: NotificationResponse) => void): void {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Notification response:', response);
      callback(response as NotificationResponse);
    });

    // Return unsubscribe function for cleanup
    return () => subscription.remove();
  }

  /**
   * Get last notification (used on app startup)
   */
  async getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
    try {
      return await Notifications.getLastNotificationResponseAsync();
    } catch (error) {
      console.error('Failed to get last notification:', error);
      return null;
    }
  }

  /**
   * Schedule daily notification
   */
  async scheduleDailyNotification(
    title: string,
    body: string,
    hour: number,
    minute: number
  ): Promise<void> {
    try {
      const trigger = new Date();
      trigger.setHours(hour, minute, 0);

      // Schedule for daily recurrence
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: 'default',
          badge: 1,
        },
        trigger: {
          hour,
          minute,
          repeats: true,
        },
      });

      console.log(`Daily notification scheduled for ${hour}:${minute}`);
    } catch (error) {
      console.error('Failed to schedule daily notification:', error);
    }
  }

  /**
   * Handle notification when app launches from background
   */
  async handleAppLaunchNotification(
    callback: (notification: Notifications.NotificationResponse | null) => void
  ): Promise<void> {
    try {
      const response = await this.getLastNotificationResponse();
      if (response) {
        console.log('App launched from notification:', response);
        callback(response);
      }
    } catch (error) {
      console.error('Failed to handle app launch notification:', error);
    }
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();
