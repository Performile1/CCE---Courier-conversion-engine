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

export function CreateCampaignScreen(): React.ReactElement {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    recipients: '',
    body: '',
  });

  const handleCreateCampaign = async () => {
    if (!formData.name || !formData.subject) {
      Alert.alert('Error', 'Campaign name and subject are required');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        'https://your-supabase-url.supabase.co/rest/v1/campaigns',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...formData,
            status: 'draft',
            recipients: parseInt(formData.recipients) || 0,
          }),
        }
      );

      if (response.ok) {
        Alert.alert('Success', 'Campaign created successfully');
        navigation.goBack();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to create campaign');
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
        <Text style={styles.headerTitle}>Create Campaign</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Campaign Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., April Newsletter"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholderTextColor={colors.slate400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Email Subject *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter email subject"
              value={formData.subject}
              onChangeText={(text) => setFormData({ ...formData, subject: text })}
              placeholderTextColor={colors.slate400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Recipient Count</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 500"
              keyboardType="numeric"
              value={formData.recipients}
              onChangeText={(text) => setFormData({ ...formData, recipients: text })}
              placeholderTextColor={colors.slate400}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Email Body</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Write your email content..."
              value={formData.body}
              onChangeText={(text) => setFormData({ ...formData, body: text })}
              placeholderTextColor={colors.slate400}
              multiline={true}
              numberOfLines={6}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleCreateCampaign}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Creating...' : 'Create Campaign'}
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
  textArea: {
    textAlignVertical: 'top',
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
