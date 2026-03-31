import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, Text, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

export function CampaignDetailScreen(): React.ReactElement {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { campaignId } = route.params;

  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCampaign();
  }, [campaignId]);

  const loadCampaign = async () => {
    try {
      const response = await fetch(
        `https://your-supabase-url.supabase.co/rest/v1/campaigns?id=eq.${campaignId}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
          },
        }
      );
      const data = await response.json();
      setCampaign(data[0]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.indigo600} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.indigo600} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Campaign Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {campaign && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{campaign.name}</Text>
              <Text style={styles.subject}>{campaign.subject}</Text>
            </View>

            <View style={styles.section}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Status</Text>
                <Text style={styles.statValue}>{campaign.status}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Recipients</Text>
                <Text style={styles.statValue}>{campaign.recipients}</Text>
              </View>

              {campaign.status === 'sent' && (
                <>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>Open Rate</Text>
                    <Text style={styles.statValue}>{campaign.open_rate || 0}%</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statLabel}>Click Rate</Text>
                    <Text style={styles.statValue}>{campaign.click_rate || 0}%</Text>
                  </View>
                </>
              )}
            </View>

            {campaign.body && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Email Content</Text>
                <Text style={styles.body}>{campaign.body}</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const colors = {
  indigo600: '#4f46e5',
  slate900: '#0f172a',
  slate500: '#64748b',
  slate100: '#f1f5f9',
  white: '#ffffff',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.slate100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.slate900,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.slate900,
    marginBottom: 8,
  },
  subject: {
    fontSize: 14,
    color: colors.slate500,
  },
  stat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  statLabel: {
    fontSize: 12,
    color: colors.slate500,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.slate900,
  },
  body: {
    fontSize: 14,
    color: colors.slate500,
    lineHeight: 20,
  },
});
