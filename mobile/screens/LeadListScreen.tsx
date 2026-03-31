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

interface Lead {
  id: string;
  companyName: string;
  orgNumber: string;
  segment: string;
  revenue: string;
  annualPackages: number;
  decisionMakers: Array<{ name: string; title: string; email: string }>;
}

export function LeadListScreen(): React.ReactElement {
  const navigation = useNavigation<any>();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadLeads();
    }, [])
  );

  const loadLeads = async () => {
    try {
      setLoading(true);
      // Fetch from Supabase
      const response = await fetch('https://your-supabase-url.supabase.co/rest/v1/leads', {
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      setLeads(data);
    } catch (error) {
      console.error('Error loading leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLeads();
    setRefreshing(false);
  };

  const handleLeadPress = (lead: Lead) => {
    navigation.navigate('LeadDetail', { leadId: lead.id, lead });
  };

  const handleAddLead = () => {
    navigation.navigate('AddLead');
  };

  if (loading && !refreshing) {
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
        <Text style={styles.headerTitle}>Leads</Text>
        <Text style={styles.headerSubtitle}>{leads.length} prospects</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {leads.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="briefcase-outline" size={48} color={colors.slate400} />
            <Text style={styles.emptyText}>No leads yet</Text>
            <TouchableOpacity style={styles.addButton} onPress={handleAddLead}>
              <Text style={styles.addButtonText}>+ Add First Lead</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.leadsList}>
            {leads.map((lead) => (
              <TouchableOpacity
                key={lead.id}
                style={styles.leadCard}
                onPress={() => handleLeadPress(lead)}
              >
                <View style={styles.leadHeader}>
                  <View style={styles.leadInfo}>
                    <Text style={styles.leadCompany}>{lead.companyName}</Text>
                    <Text style={styles.leadSegment}>{lead.segment}</Text>
                  </View>
                  <View style={styles.leadRevenue}>
                    <Text style={styles.leadRevenueLabel}>Revenue</Text>
                    <Text style={styles.leadRevenueValue}>{lead.revenue}</Text>
                  </View>
                </View>

                <View style={styles.leadDetails}>
                  <View style={styles.detailRow}>
                    <Ionicons name="document-text-outline" size={16} color={colors.slate500} />
                    <Text style={styles.detailText}>{lead.orgNumber}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Ionicons name="cube-outline" size={16} color={colors.slate500} />
                    <Text style={styles.detailText}>{lead.annualPackages.toLocaleString()} packages/year</Text>
                  </View>
                </View>

                <View style={styles.contactsPreview}>
                  {lead.decisionMakers?.slice(0, 2).map((contact, idx) => (
                    <View key={idx} style={styles.contactBadge}>
                      <Text style={styles.contactName}>{contact.name.split(' ')[0]}</Text>
                      <Text style={styles.contactTitle}>{contact.title}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={handleAddLead}>
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const colors = {
  indigo600: '#4f46e5',
  slate900: '#0f172a',
  slate700: '#334155',
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
  addButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.indigo600,
    borderRadius: 6,
  },
  addButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  leadsList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  leadCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  leadInfo: {
    flex: 1,
  },
  leadCompany: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.slate900,
  },
  leadSegment: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 4,
  },
  leadRevenue: {
    alignItems: 'flex-end',
  },
  leadRevenueLabel: {
    fontSize: 12,
    color: colors.slate500,
  },
  leadRevenueValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.slate900,
    marginTop: 4,
  },
  leadDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  detailText: {
    fontSize: 12,
    color: colors.slate700,
    marginLeft: 8,
  },
  contactsPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  contactBadge: {
    backgroundColor: '#e0e7ff',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginTop: 8,
  },
  contactName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.indigo600,
  },
  contactTitle: {
    fontSize: 10,
    color: colors.slate500,
    marginTop: 2,
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
