import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

import { RootNavigator } from './mobile/navigation/RootNavigator';
import { pushNotificationService } from './mobile/services/pushNotificationService';
import { offlineSyncService } from './mobile/services/offlineSyncService';

// Keep splash screen visible until we finish initializing
SplashScreen.preventAutoHideAsync().catch(() => {
  /* reloading the app might have already hidden the splash screen */
});

export default function App() {
  const appIsReady = useRef(false);
  const unsubscribeFunctions = useRef<Array<() => void>>([]);

  useEffect(() => {
    async function prepare() {
      try {
        // Initialize push notification service
        console.log('Initializing push notification service...');
        await pushNotificationService.initialize();

        // Set up push notification listeners
        const unsubscribeNotification = pushNotificationService.listenToNotifications(
          (notification) => {
            console.log('Foreground notification received:', notification);
            // Handle foreground notification
          }
        );
        unsubscribeFunctions.current.push(unsubscribeNotification);

        const unsubscribeResponse = pushNotificationService.listenToNotificationResponses(
          (response) => {
            console.log('Notification tapped:', response);
            // Handle notification tap - navigate to relevant screen
          }
        );
        unsubscribeFunctions.current.push(unsubscribeResponse);

        // Initialize offline sync service
        console.log('Initializing offline sync service...');
        const unsubscribeSync = offlineSyncService.registerSyncListener((status) => {
          console.log('Sync status changed:', status);
        });
        unsubscribeFunctions.current.push(unsubscribeSync);

        // Enable auto-sync every 30 seconds
        const unsubscribeAutoSync = offlineSyncService.enableAutoSync(30000);
        unsubscribeFunctions.current.push(unsubscribeAutoSync);

        // Check for sync on app startup
        await offlineSyncService.syncQueue();

        appIsReady.current = true;
      } catch (e) {
        console.warn('Error during app initialization:', e);
        appIsReady.current = true;
      } finally {
        await SplashScreen.hideAsync();
      }
    }

    prepare();

    // Cleanup on unmount
    return () => {
      unsubscribeFunctions.current.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  if (!appIsReady.current) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <RootNavigator />
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
    </SafeAreaProvider>
  );
}
