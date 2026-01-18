import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, TextInput } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ui/theme-context';
import { spacing } from '../../src/ui/theme';
import { adminListCustomers, AdminCustomer, formatCents, formatDateTime } from '../../src/lib/admin';

export default function AdminCustomersScreen() {
  const { colors } = useTheme();
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const fetchCustomers = useCallback(async () => {
    try {
      const data = await adminListCustomers(50, 0, searchQuery || undefined);
      setCustomers(data);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery]);

  useFocusEffect(useCallback(() => { fetchCustomers(); }, [fetchCustomers]));

  const onRefresh = () => { setRefreshing(true); fetchCustomers(); };

  const handleSearch = () => {
    setSearchQuery(searchInput);
    setLoading(true);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: spacing.md }}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary, flex: 1 }}>Customers</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', padding: spacing.md, gap: spacing.sm }}>
        <TextInput
          placeholder="Search by name, email, or phone..."
          placeholderTextColor={colors.textSecondary}
          value={searchInput}
          onChangeText={setSearchInput}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          style={{
            flex: 1,
            backgroundColor: colors.surface,
            borderRadius: 8,
            padding: spacing.md,
            color: colors.textPrimary,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        />
        <TouchableOpacity 
          onPress={handleSearch}
          style={{
            backgroundColor: colors.accent,
            borderRadius: 8,
            padding: spacing.md,
            justifyContent: 'center',
          }}
        >
          <Ionicons name="search" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ padding: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {customers.length === 0 ? (
          <Text style={{ textAlign: 'center', color: colors.textSecondary, marginTop: spacing.xl }}>No customers found</Text>
        ) : (
          customers.map(customer => (
            <TouchableOpacity
              key={customer.customer_id}
              onPress={() => router.push(`/(admin)/customers/${customer.customer_id}`)}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: spacing.md,
                marginBottom: spacing.md,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>{customer.full_name}</Text>
                  {customer.email && (
                    <Text style={{ fontSize: 13, color: colors.accent, marginTop: 2 }}>{customer.email}</Text>
                  )}
                  {customer.phone && (
                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{customer.phone}</Text>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </View>
              
              <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: spacing.lg }}>
                <View>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>JOBS</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>{customer.total_jobs}</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>COMPLETED</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#10B981' }}>{customer.completed_jobs}</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>SPENT</Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>{formatCents(customer.total_spent_cents)}</Text>
                </View>
              </View>

              {(customer.city || customer.state) && (
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm }}>
                  {[customer.city, customer.state].filter(Boolean).join(', ')}
                </Text>
              )}
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: spacing.sm }}>
                Joined {formatDateTime(customer.created_at)}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}