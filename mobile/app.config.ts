import { ExpoConfig, getDefaultConfig } from 'expo/config';

const config: ExpoConfig = {
  ...getDefaultConfig(__dirname),
  name: 'CCE Mobile',
  slug: 'cce-mobile',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'ccemobile',
  platforms: ['ios', 'android', 'web'],
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTabletMode: true,
    bundleIdentifier: 'com.performile.cce.mobile',
    buildNumber: '1',
    infoPlist: {
      NSLocationWhenInUseUsageDescription: 'Allow CCE to access your location',
      NSPhotoLibraryUsageDescription: 'Allow CCE to access your photos',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#4f46e5',
    },
    package: 'com.performile.cce.mobile',
    versionCode: 1,
  },
  web: {
    bundler: 'metro',
    favicon: './assets/favicon.png',
  },
  plugins: [
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#4f46e5',
        sounds: [
          './assets/sounds/notification.wav',
        ],
        modes: ['production'],
      },
    ],
  ],
  extra: {
    eas: {
      projectId: 'YOUR_EAS_PROJECT_ID', // Replace with actual EAS project ID
    },
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
};

export default config;
