import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ui/theme-context';
import type { LineItemType } from '../../src/types/job-lifecycle';
import { addLineItem } from '../../src/lib/invoice';

interface AddLineItemFormProps {
  jobId: string;
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const LINE_ITEM_TYPES: { type: LineItemType; label: string; icon: string }[] = [
  { type: 'additional_labor', label: 'Additional Labor', icon: 'construct-outline' },
  { type: 'parts', label: 'Parts / Materials', icon: 'cog-outline' },
  { type: 'diagnostic', label: 'Diagnostic Fee', icon: 'search-outline' },
];

export function AddLineItemForm({ jobId, visible, onClose, onSuccess }: AddLineItemFormProps) {
  const { colors, text, spacing } = useTheme();
  const [loading, setLoading] = useState(false);
  const [itemType, setItemType] = useState<LineItemType>('additional_labor');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [price, setPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [partSource, setPartSource] = useState('');

  const resetForm = () => {
    setItemType('additional_labor');
    setDescription('');
    setQuantity('1');
    setPrice('');
    setNotes('');
    setPartNumber('');
    setPartSource('');
  };

  const handleSubmit = async () => {
    // Validation
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue <= 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }

    const unitPriceCents = Math.round(priceValue * 100);

    setLoading(true);
    try {
      const result = await addLineItem(jobId, {
        itemType,
        description: description.trim(),
        quantity: qty,
        unitPriceCents,
        notes: notes.trim() || undefined,
        partNumber: partNumber.trim() || undefined,
        partSource: partSource.trim() || undefined,
      });

      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to add item');
        return;
      }

      Alert.alert(
        'Item Added',
        'The item has been added and is awaiting customer approval.',
        [{ text: 'OK', onPress: () => {
          resetForm();
          onSuccess();
          onClose();
        }}]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const totalCents = Math.round((parseFloat(quantity) || 0) * (parseFloat(price) || 0) * 100);
  const totalDisplay = isNaN(totalCents) ? '$0.00' : `$${(totalCents / 100).toFixed(2)}`;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Add Line Item</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Item Type Selection */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>Type</Text>
            <View style={styles.typeButtons}>
              {LINE_ITEM_TYPES.map(({ type, label, icon }) => (
                <Pressable
                  key={type}
                  style={[
                    styles.typeButton,
                    {
                      backgroundColor: itemType === type ? colors.accent : colors.surface,
                      borderColor: itemType === type ? colors.accent : colors.border,
                    },
                  ]}
                  onPress={() => setItemType(type)}
                >
                  <Ionicons
                    name={icon as any}
                    size={20}
                    color={itemType === type ? '#fff' : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.typeButtonText,
                      { color: itemType === type ? '#fff' : colors.textPrimary },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>Description *</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary },
              ]}
              value={description}
              onChangeText={setDescription}
              placeholder="e.g., Replace serpentine belt"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {/* Quantity and Price */}
          <View style={styles.row}>
            <View style={[styles.section, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>Quantity</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary },
                ]}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="decimal-pad"
                placeholder="1"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={[styles.section, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>Unit Price ($)</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary },
                ]}
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          {/* Parts-specific fields */}
          {itemType === 'parts' && (
            <>
              <View style={styles.section}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>Part Number</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary },
                  ]}
                  value={partNumber}
                  onChangeText={setPartNumber}
                  placeholder="Optional"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={styles.section}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>Part Source</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary },
                  ]}
                  value={partSource}
                  onChangeText={setPartSource}
                  placeholder="e.g., AutoZone, Customer provided"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </>
          )}

          {/* Notes */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>Notes for Customer</Text>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary },
              ]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Explain why this is needed..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Total Preview */}
          <View style={[styles.totalPreview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Item Total</Text>
            <Text style={[styles.totalValue, { color: colors.accent }]}>{totalDisplay}</Text>
          </View>

          {/* Info */}
          <View style={[styles.infoBox, { backgroundColor: `${colors.accent}10` }]}>
            <Ionicons name="information-circle" size={20} color={colors.accent} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              The customer will be notified and must approve this addition before it's added to the invoice.
            </Text>
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Pressable
            style={[styles.submitButton, { backgroundColor: colors.accent }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Request Approval</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  typeButtonText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  totalPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 14,
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  infoBox: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 10,
    gap: 10,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  submitButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default AddLineItemForm;
