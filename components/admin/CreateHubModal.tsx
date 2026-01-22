import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Modal, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/ui/theme-context';
import { spacing } from '../../src/ui/theme';
import { ThemedText } from '../../src/ui/components/ThemedText';
import { adminCreateHub, CreateHubInput, HubRecommendation } from '../../src/lib/admin';
import { supabase } from '../../src/lib/supabase';

interface GeocodeResult {
  lat: number;
  lng: number;
  city?: string;
  state?: string;
}

const zipGeocodeCache = new Map<string, GeocodeResult>();

interface CreateHubModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  prefill?: Partial<CreateHubInput> & { city?: string; state?: string };
}

export function CreateHubModal({ visible, onClose, onSuccess, prefill }: CreateHubModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CreateHubInput>({
    name: '',
    city: '',
    state: '',
    country: 'US',
    lat: 0,
    lng: 0,
    zip: '',
    active_radius_miles: 10,
    max_radius_miles: 25,
    notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [zipLoading, setZipLoading] = useState(false);
  const [zipError, setZipError] = useState<string | null>(null);
  const [coordsManuallyEdited, setCoordsManuallyEdited] = useState(false);
  const [lastGeocodedZip, setLastGeocodedZip] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const geocodeZip = useCallback(async (zip: string, country: string) => {
    const zip5 = zip.substring(0, 5);
    const cacheKey = `${zip5}-${country}`;

    if (zipGeocodeCache.has(cacheKey)) {
      return zipGeocodeCache.get(cacheKey)!;
    }

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    const { data, error } = await supabase.functions.invoke('geocode-zip', {
      body: { zip: zip5, country },
    });

    if (error) throw new Error(error.message || 'Geocode failed');
    if (data?.error) throw new Error(data.error);

    const result: GeocodeResult = {
      lat: data.lat,
      lng: data.lng,
      city: data.city,
      state: data.state,
    };

    zipGeocodeCache.set(cacheKey, result);
    return result;
  }, []);

  const handleZipChange = useCallback((zip: string) => {
    setForm(f => ({ ...f, zip }));
    setZipError(null);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const zip5 = zip.replace(/\D/g, '').substring(0, 5);
    if (zip5.length !== 5) return;

    debounceTimerRef.current = setTimeout(async () => {
      if (coordsManuallyEdited && lastGeocodedZip === zip5) return;

      setZipLoading(true);
      setZipError(null);

      try {
        const result = await geocodeZip(zip5, form.country);
        setForm(f => ({
          ...f,
          lat: result.lat,
          lng: result.lng,
          city: f.city || result.city || '',
          state: f.state || result.state || '',
        }));
        setLastGeocodedZip(zip5);
        setCoordsManuallyEdited(false);
      } catch (err: any) {
        setZipError("Couldn't find coordinates for this ZIP.");
      } finally {
        setZipLoading(false);
      }
    }, 500);
  }, [form.country, coordsManuallyEdited, lastGeocodedZip, geocodeZip]);

  const handleZipBlur = useCallback(() => {
    const zip5 = form.zip.replace(/\D/g, '').substring(0, 5);
    if (zip5.length === 5 && !zipLoading && lastGeocodedZip !== zip5) {
      handleZipChange(form.zip);
    }
  }, [form.zip, zipLoading, lastGeocodedZip, handleZipChange]);

  const handleLatChange = useCallback((v: string) => {
    setForm(f => ({ ...f, lat: parseFloat(v) || 0 }));
    setCoordsManuallyEdited(true);
  }, []);

  const handleLngChange = useCallback((v: string) => {
    setForm(f => ({ ...f, lng: parseFloat(v) || 0 }));
    setCoordsManuallyEdited(true);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (prefill && visible) {
      setForm(prev => ({
        ...prev,
        name: prefill.name || `${prefill.city || ''} Hub`.trim(),
        city: prefill.city || '',
        state: prefill.state || '',
        country: prefill.country || 'US',
        lat: prefill.lat || 0,
        lng: prefill.lng || 0,
        zip: prefill.zip || '',
        active_radius_miles: prefill.active_radius_miles || 10,
        max_radius_miles: prefill.max_radius_miles || 25,
        notes: prefill.notes || '',
      }));
      setCoordsManuallyEdited(false);
      setLastGeocodedZip(null);
      setZipError(null);
    }
  }, [prefill, visible]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) newErrors.name = 'Name is required';
    if (!form.city.trim()) newErrors.city = 'City is required';
    if (!form.state.trim()) newErrors.state = 'State is required';
    if (!form.zip.trim()) newErrors.zip = 'ZIP is required';
    if (form.lat === 0 && form.lng === 0) newErrors.coords = 'Coordinates are required';
    if (form.active_radius_miles <= 0) newErrors.active_radius = 'Must be positive';
    if (form.max_radius_miles <= 0) newErrors.max_radius = 'Must be positive';
    if (form.max_radius_miles < form.active_radius_miles) {
      newErrors.max_radius = 'Must be >= active radius';
    }
    if (form.max_radius_miles > 100) newErrors.max_radius = 'Cannot exceed 100 miles';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await adminCreateHub(form);
      Alert.alert('Success', 'Hub created successfully');
      onSuccess();
      onClose();
      setForm({
        name: '',
        city: '',
        state: '',
        country: 'US',
        lat: 0,
        lng: 0,
        zip: '',
        active_radius_miles: 10,
        max_radius_miles: 25,
        notes: '',
      });
      setCoordsManuallyEdited(false);
      setLastGeocodedZip(null);
      setZipError(null);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to create hub');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.sm,
    color: colors.text,
    fontSize: 16,
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }}>
        <View style={{ 
          flexDirection: 'row', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}>
          <TouchableOpacity onPress={onClose}>
            <ThemedText style={{ color: colors.primary }}>Cancel</ThemedText>
          </TouchableOpacity>
          <ThemedText variant="body" style={{ fontWeight: '600' }}>Create New Hub</ThemedText>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <ThemedText style={{ color: colors.primary, fontWeight: '600' }}>Save</ThemedText>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.md }}>
          <View style={{ marginBottom: spacing.md }}>
            <ThemedText variant="caption" style={{ marginBottom: 4 }}>Hub Name *</ThemedText>
            <TextInput
              style={inputStyle}
              value={form.name}
              onChangeText={(v) => setForm(f => ({ ...f, name: v }))}
              placeholder="e.g., Austin Hub"
              placeholderTextColor={colors.textSecondary}
            />
            {errors.name && <ThemedText variant="caption" style={{ color: '#EF4444', marginTop: 2 }}>{errors.name}</ThemedText>}
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
            <View style={{ flex: 2 }}>
              <ThemedText variant="caption" style={{ marginBottom: 4 }}>City *</ThemedText>
              <TextInput
                style={inputStyle}
                value={form.city}
                onChangeText={(v) => setForm(f => ({ ...f, city: v }))}
                placeholder="Austin"
                placeholderTextColor={colors.textSecondary}
              />
              {errors.city && <ThemedText variant="caption" style={{ color: '#EF4444', marginTop: 2 }}>{errors.city}</ThemedText>}
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText variant="caption" style={{ marginBottom: 4 }}>State *</ThemedText>
              <TextInput
                style={inputStyle}
                value={form.state}
                onChangeText={(v) => setForm(f => ({ ...f, state: v }))}
                placeholder="TX"
                placeholderTextColor={colors.textSecondary}
              />
              {errors.state && <ThemedText variant="caption" style={{ color: '#EF4444', marginTop: 2 }}>{errors.state}</ThemedText>}
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <ThemedText variant="caption">ZIP Code *</ThemedText>
                {zipLoading && (
                  <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: 8 }} />
                )}
              </View>
              <TextInput
                style={inputStyle}
                value={form.zip}
                onChangeText={handleZipChange}
                onBlur={handleZipBlur}
                placeholder="78701"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                maxLength={10}
              />
              {errors.zip && <ThemedText variant="caption" style={{ color: '#EF4444', marginTop: 2 }}>{errors.zip}</ThemedText>}
              {zipError && <ThemedText variant="caption" style={{ color: '#F59E0B', marginTop: 2 }}>{zipError}</ThemedText>}
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText variant="caption" style={{ marginBottom: 4 }}>Country</ThemedText>
              <TextInput
                style={inputStyle}
                value={form.country}
                onChangeText={(v) => setForm(f => ({ ...f, country: v }))}
                placeholder="US"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
            <View style={{ flex: 1 }}>
              <ThemedText variant="caption" style={{ marginBottom: 4 }}>Latitude *</ThemedText>
              <TextInput
                style={inputStyle}
                value={form.lat ? String(form.lat) : ''}
                onChangeText={handleLatChange}
                placeholder="30.2672"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText variant="caption" style={{ marginBottom: 4 }}>Longitude *</ThemedText>
              <TextInput
                style={inputStyle}
                value={form.lng ? String(form.lng) : ''}
                onChangeText={handleLngChange}
                placeholder="-97.7431"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
            <View style={{ flex: 1 }}>
              <ThemedText variant="caption" style={{ marginBottom: 4 }}>Active Radius (mi) *</ThemedText>
              <TextInput
                style={inputStyle}
                value={String(form.active_radius_miles)}
                onChangeText={(v) => setForm(f => ({ ...f, active_radius_miles: parseFloat(v) || 0 }))}
                keyboardType="decimal-pad"
              />
              {errors.active_radius && <ThemedText variant="caption" style={{ color: '#EF4444', marginTop: 2 }}>{errors.active_radius}</ThemedText>}
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText variant="caption" style={{ marginBottom: 4 }}>Max Radius (mi) *</ThemedText>
              <TextInput
                style={inputStyle}
                value={String(form.max_radius_miles)}
                onChangeText={(v) => setForm(f => ({ ...f, max_radius_miles: parseFloat(v) || 0 }))}
                keyboardType="decimal-pad"
              />
              {errors.max_radius && <ThemedText variant="caption" style={{ color: '#EF4444', marginTop: 2 }}>{errors.max_radius}</ThemedText>}
            </View>
          </View>

          <View style={{ marginBottom: spacing.md }}>
            <ThemedText variant="caption" style={{ marginBottom: 4 }}>Notes</ThemedText>
            <TextInput
              style={[inputStyle, { minHeight: 80, textAlignVertical: 'top' }]}
              value={form.notes}
              onChangeText={(v) => setForm(f => ({ ...f, notes: v }))}
              placeholder="Optional notes about this hub..."
              placeholderTextColor={colors.textSecondary}
              multiline
            />
          </View>

          <View style={{ 
            backgroundColor: colors.surface, 
            padding: spacing.md, 
            borderRadius: 8,
            marginBottom: spacing.lg,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
              <Ionicons name="information-circle" size={16} color={colors.primary} />
              <ThemedText variant="caption" style={{ marginLeft: 4, fontWeight: '600' }}>Default Settings</ThemedText>
            </View>
            <ThemedText variant="caption">
              New hubs are created as inactive and invite-only. You can change these settings after creation.
            </ThemedText>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
