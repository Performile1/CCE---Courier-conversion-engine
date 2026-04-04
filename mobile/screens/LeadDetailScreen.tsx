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
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

interface LeadData {
  id: string;
  companyName: string;
  orgNumber: string;
  revenue: string;
  annualPackages: number;
  segment: string;
  ecommercePlatform?: string;
  marketCount?: number;
  activeMarkets?: string[];
}

export function LeadDetailScreen(): React.ReactElement {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { lead } = route.params;

  const [editMode, setEditMode] = useState(false);
  const [editedLead, setEditedLead] = useState<LeadData>(lead);
  const [saving, setSaving] = useState(false);

  const displayValue = (value?: string | number | null) => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'string' && value.trim() === '') return '—';
    return String(value);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      // Update in Supabase
      const response = await fetch(
        `https://your-supabase-url.supabase.co/rest/v1/leads?id=eq.${editedLead.id}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(editedLead),
        }
      );

      if (response.ok) {
        setEditMode(false);
        Alert.alert('Success', 'Lead updated successfully');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to save lead');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Lead', 'Are you sure you want to delete this lead?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await fetch(
              `https://your-supabase-url.supabase.co/rest/v1/leads?id=eq.${lead.id}`,
              {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
                },
              }
            );
            navigation.goBack();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete lead');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.indigo600} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lead Details</Text>
        <TouchableOpacity onPress={() => setEditMode(!editMode)}>
          <Ionicons name={editMode ? 'close' : 'pencil'} size={24} color={colors.indigo600} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Company Information</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Company Name</Text>
            {editMode ? (
              <TextInput
                style={styles.input}
                value={editedLead.companyName}
                onChangeText={(text) => setEditedLead({ ...editedLead, companyName: text })}
                editable={editMode}
              />
            ) : (
              <Text style={styles.fieldValue}>{editedLead.companyName}</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Organization Number</Text>
            {editMode ? (
              <TextInput
                style={styles.input}
                value={editedLead.orgNumber}
                onChangeText={(text) => setEditedLead({ ...editedLead, orgNumber: text })}
                editable={editMode}
              />
            ) : (
              <Text style={styles.fieldValue}>{editedLead.orgNumber}</Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Revenue</Text>
            <Text style={styles.fieldValue}>{editedLead.revenue}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Segment</Text>
            <Text style={styles.fieldValue}>{editedLead.segment}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business Metrics</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Annual Packages</Text>
            <Text style={styles.fieldValue}>{editedLead.annualPackages ? editedLead.annualPackages.toLocaleString() : '—'}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>E-commerce Platform</Text>
            <Text style={styles.fieldValue}>{displayValue(editedLead.ecommercePlatform)}</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Markets</Text>
            <Text style={styles.fieldValue}>
              {editedLead.activeMarkets?.length ? editedLead.activeMarkets.join(', ') : '—'}
            </Text>
          </View>
        </View>

        {editMode && (
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={handleSave}
              disabled={saving}
            >
              <Ionicons name="checkmark" size={20} color="white" />
              <Text style={styles.buttonText}>Save Changes</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.dangerButton]}
              onPress={handleDelete}
            >
              <Ionicons name="trash" size={20} color="white" />
              <Text style={styles.buttonText}>Delete Lead</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const colors = {
  indigo600: '#4f46e5',
  slate900: '#0f172a',
  slate700: '#334155',
  slate500: '#64748b',
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
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    color: colors.slate500,
    fontWeight: '500',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 14,
    color: colors.slate900,
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
  buttonGroup: {
    marginBottom: 32,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginVertical: 8,
  },
  primaryButton: {
    backgroundColor: colors.indigo600,
  },
  dangerButton: {
    backgroundColor: colors.red600,
  },
  buttonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 8,
  },
});
