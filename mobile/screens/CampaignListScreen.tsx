import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

interface Campaign {
  id: string;
  name: string;
  subject: string;
  recipients: number;
  status: 'draft' | 'scheduled' | 'sent';
  sentAt?: string;
  openRate?: number;
  clickRate?: number;
}

export function CampaignListScreen(): React.ReactElement {
  const navigation = useNavigation<any>();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadCampaigns();
    }, [])
  );

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        'https://your-supabase-url.supabase.co/rest/v1/campaigns',
        {
          headers: {
            'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const data = await response.json();
      setCampaigns(data);
    } catch (error) {
      console.error('Error loading campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCampaigns();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return '#22c55e';
      case 'scheduled':
        return '#3b82f6';
      case 'draft':
        return '#64748b';
      default:
        return '#64748b';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Campaigns</Text>
        <Text style={styles.headerSubtitle}>{campaigns.length} campaigns</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading && !refreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.indigo600} />
          </View>
        ) : campaigns.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="mail-outline" size={48} color={colors.slate400} />
            <Text style={styles.emptyText}>No campaigns yet</Text>
          </View>
        ) : (
          <View style={styles.campaignsList}>
            {campaigns.map((campaign) => (
              <TouchableOpacity
                key={campaign.id}
                style={styles.campaignCard}
                onPress={() => navigation.navigate('CampaignDetail', { campaignId: campaign.id })}
              >
                <View style={styles.campaignHeader}>
                  <View style={styles.campaignInfo}>
                    <Text style={styles.campaignName}>{campaign.name}</Text>
                    <Text style={styles.campaignSubject}>{campaign.subject}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(campaign.status) + '20' },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: getStatusColor(campaign.status) }]}>
                      {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                    </Text>
                  </View>
                </View>

                <View style={styles.campaignStats}>
                  <View style={styles.statItem}>
                    <Ionicons name="mail" size={14} color={colors.slate500} />
                    <Text style={styles.statText}>{campaign.recipients} recipients</Text>
                  </View>

                  {campaign.status === 'sent' && campaign.openRate !== undefined && (
                    <>
                      <View style={styles.statItem}>
                        <Ionicons name="eye" size={14} color={colors.slate500} />
                        <Text style={styles.statText}>{campaign.openRate}% opened</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Ionicons name="hand-left" size={14} color={colors.slate500} />
                        <Text style={styles.statText}>{campaign.clickRate}% clicked</Text>
                      </View>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateCampaign')}
      >
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>
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
  headerSubtitle: {
    fontSize: 14,
    color: colors.slate500,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: colors.slate500,
    marginTop: 16,
  },
  campaignsList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  campaignCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  campaignHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  campaignInfo: {
    flex: 1,
  },
  campaignName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.slate900,
  },
  campaignSubject: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  campaignStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginTop: 8,
  },
  statText: {
    fontSize: 12,
    color: colors.slate500,
    marginLeft: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.indigo600,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
