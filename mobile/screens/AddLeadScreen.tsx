import React, { useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
  TextInput,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

export function AddLeadScreen(): React.ReactElement {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '',
    orgNumber: '',
    revenue: '',
    annualPackages: '',
    segment: 'FS',
    ecommercePlatform: '',
  });

  const handleAddLead = async () => {
    if (!formData.companyName || !formData.orgNumber) {
      Alert.alert('Error', 'Company name and org number are required');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        'https://your-supabase-url.supabase.co/rest/v1/leads',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...formData,
            annualPackages: parseInt(formData.annualPackages) || 0,
          }),
        }
      );

      if (response.ok) {
        Alert.alert('Success', 'Lead added successfully');
        navigation.goBack();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to add lead');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.indigo600} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add New Lead</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Company Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter company name"
              value={formData.companyName}
              onChangeText={(text) => setFormData({ ...formData, companyName: text })}
              placeholderTextColor={colors.slate400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Organization Number *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 556000-0001"
              value={formData.orgNumber}
              onChangeText={(text) => setFormData({ ...formData, orgNumber: text })}
              placeholderTextColor={colors.slate400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Annual Revenue</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 45 000 tkr"
              value={formData.revenue}
              onChangeText={(text) => setFormData({ ...formData, revenue: text })}
              placeholderTextColor={colors.slate400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Annual Packages</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 12500"
              keyboardType="numeric"
              value={formData.annualPackages}
              onChangeText={(text) => setFormData({ ...formData, annualPackages: text })}
              placeholderTextColor={colors.slate400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>E-commerce Platform</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Shopify"
              value={formData.ecommercePlatform}
              onChangeText={(text) => setFormData({ ...formData, ecommercePlatform: text })}
              placeholderTextColor={colors.slate400}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleAddLead}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Adding...' : 'Add Lead'}
            </Text>
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
  section: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    color: colors.slate500,
    fontWeight: '500',
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.slate100,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    fontSize: 14,
    color: colors.slate900,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: colors.indigo600,
  },
  buttonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
});
