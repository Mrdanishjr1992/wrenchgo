import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ui/theme-context';
import { spacing } from '../../src/ui/theme';

// =====================================================
// Filter Chip
// =====================================================

interface FilterChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function FilterChip({ label, selected, onPress }: FilterChipProps) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: 20,
        backgroundColor: selected ? colors.accent : colors.surface,
        borderWidth: 1,
        borderColor: selected ? colors.accent : colors.border,
        marginRight: spacing.sm,
      }}
    >
      <Text style={{ color: selected ? '#fff' : colors.textSecondary, fontSize: 13, fontWeight: selected ? '600' : '400' }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// =====================================================
// Search Bar
// =====================================================

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  placeholder?: string;
}

export function AdminSearchBar({ value, onChangeText, onSubmit, placeholder = 'Search...' }: SearchBarProps) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
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
        onPress={onSubmit}
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
  );
}

// =====================================================
// Hub Selector
// =====================================================

interface HubSelectorProps {
  hubs: Array<{ id: string; name: string }>;
  selectedHubId: string | null;
  onSelect: (hubId: string | null) => void;
  disabled?: boolean;
  loading?: boolean;
}

export function HubSelector({ hubs, selectedHubId, onSelect, disabled }: HubSelectorProps) {
  const { colors } = useTheme();
  const [visible, setVisible] = React.useState(false);
  
  const selectedHub = hubs.find(h => h.id === selectedHubId);
  
  return (
    <>
      <TouchableOpacity
        onPress={() => !disabled && setVisible(true)}
        disabled={disabled}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface,
          borderRadius: 8,
          padding: spacing.md,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <Ionicons name="location" size={18} color={colors.textSecondary} style={{ marginRight: spacing.sm }} />
        <Text style={{ flex: 1, color: selectedHub ? colors.textPrimary : colors.textSecondary, fontSize: 14 }}>
          {selectedHub?.name || 'All Hubs'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
      </TouchableOpacity>
      
      <Modal visible={visible} transparent animationType="fade">
        <Pressable 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.lg }}
          onPress={() => setVisible(false)}
        >
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, maxHeight: '60%' }}>
            <View style={{ padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>Select Hub</Text>
            </View>
            <ScrollView>
              <TouchableOpacity
                onPress={() => { onSelect(null); setVisible(false); }}
                style={{
                  padding: spacing.md,
                  backgroundColor: selectedHubId === null ? colors.accent + '20' : 'transparent',
                }}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: selectedHubId === null ? '600' : '400' }}>
                  All Hubs
                </Text>
              </TouchableOpacity>
              {hubs.map(hub => (
                <TouchableOpacity
                  key={hub.id}
                  onPress={() => { onSelect(hub.id); setVisible(false); }}
                  style={{
                    padding: spacing.md,
                    backgroundColor: selectedHubId === hub.id ? colors.accent + '20' : 'transparent',
                  }}
                >
                  <Text style={{ color: colors.textPrimary, fontWeight: selectedHubId === hub.id ? '600' : '400' }}>
                    {hub.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

// =====================================================
// Filter Row
// =====================================================

interface FilterOption {
  value: string | null;
  label: string;
}

interface FilterRowProps {
  options: readonly FilterOption[];
  selected: string | null;
  onSelect: (value: string | null) => void;
  label?: string;
}

export function FilterRow({ options, selected, onSelect, label }: FilterRowProps) {
  const { colors } = useTheme();
  return (
    <View>
      {label && (
        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm, paddingHorizontal: spacing.md }}>
          {label}
        </Text>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md }}>
        {options.map(opt => (
          <FilterChip
            key={opt.value ?? 'all'}
            label={opt.label}
            selected={selected === opt.value}
            onPress={() => onSelect(opt.value)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// =====================================================
// Admin Header
// =====================================================

interface AdminHeaderProps {
  title: string;
  onBack?: () => void;
  onRefresh?: () => void;
  rightAction?: React.ReactNode;
}

export function AdminHeader({ title, onBack, onRefresh, rightAction }: AdminHeaderProps) {
  const { colors } = useTheme();
  const router = require('expo-router').useRouter();

  const handleBack = onBack || (() => router.back());

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.surface,
    }}>
      <TouchableOpacity onPress={handleBack} style={{ marginRight: spacing.md }}>
        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
      </TouchableOpacity>
      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary, flex: 1 }}>{title}</Text>
      {onRefresh && (
        <TouchableOpacity onPress={onRefresh} style={{ marginRight: rightAction ? spacing.md : 0 }}>
          <Ionicons name="refresh" size={24} color={colors.accent} />
        </TouchableOpacity>
      )}
      {rightAction}
    </View>
  );
}

// =====================================================
// Loading State
// =====================================================

interface LoadingStateProps {
  message?: string;
}

export function AdminLoadingState({ message = 'Loading...' }: LoadingStateProps) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
      <View style={{ 
        width: 48, 
        height: 48, 
        borderRadius: 24, 
        borderWidth: 3, 
        borderColor: colors.border,
        borderTopColor: colors.accent,
      }} />
      <Text style={{ color: colors.textSecondary, marginTop: spacing.md }}>{message}</Text>
    </View>
  );
}

// =====================================================
// Empty State
// =====================================================

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}

export function AdminEmptyState({ icon = 'folder-open-outline', title, message, subtitle, action }: EmptyStateProps) {
  const displayMessage = message || subtitle;
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
      <Ionicons name={icon} size={64} color={colors.textSecondary} style={{ opacity: 0.5 }} />
      <Text style={{ fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' }}>
        {title}
      </Text>
      {displayMessage && (
        <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' }}>
          {displayMessage}
        </Text>
      )}
      {action && (
        <TouchableOpacity
          onPress={action.onPress}
          style={{
            marginTop: spacing.lg,
            backgroundColor: colors.accent,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// =====================================================
// Error State
// =====================================================

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function AdminErrorState({ message, onRetry }: ErrorStateProps) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
      <Ionicons name="alert-circle" size={64} color={colors.error} style={{ opacity: 0.7 }} />
      <Text style={{ fontSize: 16, color: colors.textPrimary, marginTop: spacing.md, textAlign: 'center' }}>
        {message}
      </Text>
      {onRetry && (
        <TouchableOpacity
          onPress={onRetry}
          style={{
            marginTop: spacing.lg,
            backgroundColor: colors.accent,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// =====================================================
// Pagination Controls
// =====================================================

interface PaginationProps {
  currentPage?: number;
  page?: number;
  hasMore: boolean;
  onPrevious?: () => void;
  onPrev?: () => void;
  onNext: () => void;
  loading?: boolean;
}

export function AdminPagination({ currentPage, page, hasMore, onPrevious, onPrev, onNext, loading }: PaginationProps) {
  const pageNum = currentPage ?? page ?? 0;
  const handlePrev = onPrevious ?? onPrev ?? (() => {});
  const { colors } = useTheme();
  return (
    <View style={{
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.md,
      gap: spacing.md,
    }}>
      <TouchableOpacity
        onPress={handlePrev}
        disabled={pageNum === 0 || loading}
        style={{
          padding: spacing.sm,
          borderRadius: 8,
          backgroundColor: pageNum === 0 ? colors.border : colors.accent,
          opacity: pageNum === 0 ? 0.5 : 1,
        }}
      >
        <Ionicons name="chevron-back" size={20} color={pageNum === 0 ? colors.textSecondary : '#fff'} />
      </TouchableOpacity>

      <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
        Page {pageNum + 1}
      </Text>

      <TouchableOpacity
        onPress={onNext}
        disabled={!hasMore || loading}
        style={{
          padding: spacing.sm,
          borderRadius: 8,
          backgroundColor: !hasMore ? colors.border : colors.accent,
          opacity: !hasMore ? 0.5 : 1,
        }}
      >
        <Ionicons name="chevron-forward" size={20} color={!hasMore ? colors.textSecondary : '#fff'} />
      </TouchableOpacity>
    </View>
  );
}

// =====================================================
// Status Badge
// =====================================================

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const { colors, withAlpha } = useTheme();
  
  const getColor = () => {
    const s = status.toLowerCase();
    if (s.includes('active') || s.includes('completed') || s.includes('paid') || s.includes('approved')) return colors.success;
    if (s.includes('pending') || s.includes('processing') || s.includes('open') || s.includes('new')) return colors.warning;
    if (s.includes('error') || s.includes('failed') || s.includes('rejected') || s.includes('removed')) return colors.error;
    if (s.includes('cancelled') || s.includes('closed') || s.includes('paused')) return colors.textSecondary;
    return colors.accent;
  };
  
  const color = getColor();
  const fontSize = size === 'sm' ? 10 : 12;
  const padding = size === 'sm' ? { paddingHorizontal: 6, paddingVertical: 2 } : { paddingHorizontal: 8, paddingVertical: 4 };
  
  return (
    <View style={{
      ...padding,
      borderRadius: 4,
      backgroundColor: withAlpha(color, 0.12),
    }}>
      <Text style={{ color, fontSize, fontWeight: '600', textTransform: 'uppercase' }}>
        {status.replace(/_/g, ' ')}
      </Text>
    </View>
  );
}
