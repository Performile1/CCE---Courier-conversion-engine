import React, { useState, useEffect } from 'react';
import { View, ScrollView, Text, StyleSheet, SafeAreaView, ActivityIndicator, Dimensions } from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';

export function AnalyticsScreen(): React.ReactElement {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      // Simulated analytics data
      const data = {
        totalLeads: 245,
        totalCampaigns: 12,
        averageOpenRate: 34,
        averageClickRate: 8,
        roi: 245,
        monthlyTrends: [10, 15, 12, 22, 18, 25, 30],
      };
      setAnalytics(data);
    } finally {
      setLoading(false);
    }
  };

  const screenWidth = Dimensions.get('window').width;

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
        <Text style={styles.headerTitle}>Analytics</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Total Leads</Text>
            <Text style={styles.metricValue}>{analytics?.totalLeads}</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Campaigns</Text>
            <Text style={styles.metricValue}>{analytics?.totalCampaigns}</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Avg Open Rate</Text>
            <Text style={styles.metricValue}>{analytics?.averageOpenRate}%</Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Avg Click Rate</Text>
            <Text style={styles.metricValue}>{analytics?.averageClickRate}%</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ROI</Text>
          <View style={styles.roiBox}>
            <Text style={styles.roiValue}>{analytics?.roi}%</Text>
            <Text style={styles.roiLabel}>Return on Investment</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Monthly Trend</Text>
          <LineChart
            data={{
              labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7'],
              datasets: [{ data: analytics?.monthlyTrends }],
            }}
            width={screenWidth - 32}
            height={220}
            chartConfig={{
              backgroundColor: colors.white,
              backgroundGradientFrom: colors.white,
              backgroundGradientTo: colors.white,
              color: () => colors.indigo600,
              strokeWidth: 2,
              propsForDots: { r: '6' },
            }}
            style={styles.chart}
          />
        </View>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricCard: {
    width: '48%',
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  metricLabel: {
    fontSize: 12,
    color: colors.slate500,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.slate900,
    marginTop: 4,
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
    fontSize: 16,
    fontWeight: '600',
    color: colors.slate900,
    marginBottom: 12,
  },
  roiBox: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  roiValue: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.indigo600,
  },
  roiLabel: {
    fontSize: 12,
    color: colors.slate500,
    marginTop: 4,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 8,
  },
});
