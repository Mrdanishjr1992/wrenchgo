import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { supabase } from '@/src/lib/supabase';
import { useTheme } from '@/src/ui/theme-context';

type JobRow = {
  id: string;
  title: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  location_address: string | null;
  vehicle?: {
    year: number | null;
    make: string | null;
    model: string | null;
  } | null;
};

type NoteRow = {
  id: string;
  note: string;
  created_at: string;
};

export default function CustomerHistoryScreen() {
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const { colors } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customer, setCustomer] = useState<any | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);

  const [newNote, setNewNote] = useState('');

  const title = useMemo(() => {
    const name = customer?.full_name || customer?.email || 'Customer';
    return `${name} · History`;
  }, [customer]);

  const refresh = useCallback(async () => {
    if (!customerId) return;
    setLoading(true);
    setError(null);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const me = sessionData?.session?.user?.id;
      if (!me) {
        router.replace('/(auth)/sign-in');
        return;
      }

      const [{ data: customerData, error: customerError }, { data: jobsData, error: jobsError }, { data: notesData, error: notesError }] =
        await Promise.all([
          supabase
            .from('profiles')
            .select('id, full_name, email, phone, role, created_at')
            .eq('id', customerId)
            .maybeSingle(),
          supabase
            .from('jobs')
            .select('id, title, status, created_at, completed_at, location_address, vehicle:vehicles(year, make, model)')
            .eq('customer_id', customerId)
            .eq('accepted_mechanic_id', me)
            .order('created_at', { ascending: false }),
          supabase
            .from('mechanic_customer_notes')
            .select('id, note, created_at')
            .eq('customer_id', customerId)
            .eq('mechanic_id', me)
            .is('deleted_at', null)
            .order('created_at', { ascending: false }),
        ]);

      if (customerError) throw customerError;
      if (jobsError) throw jobsError;
      if (notesError) throw notesError;

      setCustomer(customerData || null);
      setJobs((jobsData as any[]) || []);
      setNotes((notesData as any[]) || []);
    } catch (e: any) {
      console.error('Customer history load error', e);
      setError(e?.message || 'Failed to load customer history');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAddNote = useCallback(async () => {
    const note = newNote.trim();
    if (!note) return;
    if (!customerId) return;

    try {
      setSaving(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const me = sessionData?.session?.user?.id;
      if (!me) {
        router.replace('/(auth)/sign-in');
        return;
      }

      const { error: insertError } = await supabase
        .from('mechanic_customer_notes')
        .insert({ mechanic_id: me, customer_id: customerId, note });

      if (insertError) throw insertError;
      setNewNote('');
      await refresh();
    } catch (e: any) {
      console.error('Add note error', e);
      Alert.alert('Error', e?.message || 'Failed to add note');
    } finally {
      setSaving(false);
    }
  }, [customerId, newNote, refresh]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}> 
        <ActivityIndicator />
        <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Loading…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 16 }]}> 
        <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 8 }}>Could not load history</Text>
        <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>{error}</Text>
        <Pressable
          onPress={refresh}
          style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: 16 }]}
        >
          <Text style={{ color: colors.primaryText, fontWeight: '700' }}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 16 }}>
      <View style={{ marginBottom: 12 }}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>{title}</Text>
        {customer?.created_at ? (
          <Text style={{ color: colors.textSecondary, marginTop: 4 }}>Joined {new Date(customer.created_at).toLocaleDateString()}</Text>
        ) : null}
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Notes</Text>

        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <TextInput
            value={newNote}
            onChangeText={setNewNote}
            placeholder="Add a private note (visible only to you + admins)…"
            placeholderTextColor={colors.textSecondary}
            multiline
            style={[
              styles.input,
              {
                borderColor: colors.border,
                color: colors.text,
                backgroundColor: colors.background,
                flex: 1,
              },
            ]}
          />
          <Pressable
            onPress={handleAddNote}
            disabled={saving || !newNote.trim()}
            style={[
              styles.primaryBtn,
              {
                backgroundColor: colors.primary,
                opacity: saving || !newNote.trim() ? 0.6 : 1,
                marginLeft: 10,
              },
            ]}
          >
            <Text style={{ color: colors.primaryText, fontWeight: '800' }}>{saving ? '…' : 'Add'}</Text>
          </Pressable>
        </View>

        {notes.length === 0 ? (
          <Text style={{ color: colors.textSecondary, marginTop: 10 }}>No notes yet.</Text>
        ) : (
          <View style={{ marginTop: 12 }}>
            {notes.map((n) => (
              <View key={n.id} style={[styles.noteRow, { borderColor: colors.border }]}>
                <Text style={{ color: colors.text, marginBottom: 4 }}>{n.note}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {new Date(n.created_at).toLocaleString()}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Past jobs with you</Text>
        {jobs.length === 0 ? (
          <Text style={{ color: colors.textSecondary, marginTop: 8 }}>No past jobs found for this customer.</Text>
        ) : (
          <View style={{ marginTop: 10 }}>
            {jobs.map((j) => {
              const vehicleLabel = j.vehicle
                ? [j.vehicle.year, j.vehicle.make, j.vehicle.model].filter(Boolean).join(' ')
                : null;

              return (
                <Pressable
                  key={j.id}
                  onPress={() => router.push(`/(mechanic)/job-details/${j.id}`)}
                  style={[styles.jobRow, { borderColor: colors.border }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: '800' }}>{j.title || 'Job'}</Text>
                    <Text style={{ color: colors.textSecondary, marginTop: 2 }}>
                      {j.status} · {new Date(j.created_at).toLocaleDateString()}
                    </Text>
                    {vehicleLabel ? (
                      <Text style={{ color: colors.textSecondary, marginTop: 2 }}>{vehicleLabel}</Text>
                    ) : null}
                    {j.location_address ? (
                      <Text style={{ color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
                        {j.location_address}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={{ color: colors.primary, fontWeight: '900' }}>›</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    minHeight: 44,
  },
  primaryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteRow: {
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 10,
  },
  jobRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
