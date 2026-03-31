import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Text, StyleSheet, Switch, SafeAreaView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

export function SettingsScreen(): React.ReactElement {
  const navigation = useNavigation<any>();
  const [settings, setSettings] = useState({
    notifications: true,
    pushNotifications: true,
    emailDigest: false,
    darkMode: false,
    offlineSync: true,
  });

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => {
          navigation.replace('Login');
        },
      },
    ]);
  };

  const toggleSetting = (key: string) => {
    setSettings({ ...settings, [key]: !settings[key as keyof typeof settings] });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingLabel}>
              <Ionicons name="notifications-outline" size={20} color={colors.indigo600} />
              <View style={styles.labelText}>
                <Text style={styles.settingTitle}>Push Notifications</Text>
                <Text style={styles.settingDescription}>Get alerts on leads and campaigns</Text>
              </View>
            </View>
            <Switch
              value={settings.pushNotifications}
              onValueChange={() => toggleSetting('pushNotifications')}
              trackColor={{ false: '#cbd5e1', true: '#a5b4fc' }}
              thumbColor={settings.pushNotifications ? colors.indigo600 : '#f1f5f9'}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLabel}>
              <Ionicons name="mail-outline" size={20} color={colors.indigo600} />
              <View style={styles.labelText}>
                <Text style={styles.settingTitle}>Email Digest</Text>
                <Text style={styles.settingDescription}>Daily summary emails</Text>
              </View>
            </View>
            <Switch
              value={settings.emailDigest}
              onValueChange={() => toggleSetting('emailDigest')}
              trackColor={{ false: '#cbd5e1', true: '#a5b4fc' }}
              thumbColor={settings.emailDigest ? colors.indigo600 : '#f1f5f9'}
            />
          </View>
        </View>

        {/* Sync Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sync & Storage</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingLabel}>
              <Ionicons name="sync-outline" size={20} color={colors.indigo600} />
              <View style={styles.labelText}>
                <Text style={styles.settingTitle}>Offline Sync</Text>
                <Text style={styles.settingDescription}>Auto-sync when online</Text>
              </View>
            </View>
            <Switch
              value={settings.offlineSync}
              onValueChange={() => toggleSetting('offlineSync')}
              trackColor={{ false: '#cbd5e1', true: '#a5b4fc' }}
              thumbColor={settings.offlineSync ? colors.indigo600 : '#f1f5f9'}
            />
          </View>
        </View>

        {/* App Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingLabel}>
              <Ionicons name="help-circle-outline" size={20} color={colors.indigo600} />
              <View style={styles.labelText}>
                <Text style={styles.settingTitle}>About</Text>
                <Text style={styles.settingDescription}>Version 1.0.0</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.slate400} />
          </View>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.settingRow} onPress={() => Alert.alert('Privacy Policy', 'Privacy policy content goes here')}>
            <View style={styles.settingLabel}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.indigo600} />
              <View style={styles.labelText}>
                <Text style={styles.settingTitle}>Privacy Policy</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.slate400} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.settingRow} onPress={() => Alert.alert('Terms of Service', 'Terms and conditions go here')}>
            <View style={styles.settingLabel}>
              <Ionicons name="document-text-outline" size={20} color={colors.indigo600} />
              <View style={styles.labelText}>
                <Text style={styles.settingTitle}>Terms of Service</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.slate400} />
          </TouchableOpacity>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color={colors.red600} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const colors = {
  indigo600: '#4f46e5',
  slate900: '#0f172a',
  slate500: '#64748b',
  slate400: '#cbd5e1',
  slate100: '#f1f5f9',
  white: '#ffffff',
  red600: '#dc2626',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate100,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.slate900,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: colors.white,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.slate500,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  settingLabel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  labelText: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.slate900,
  },
  settingDescription: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.red600,
    marginLeft: 12,
  },
});
