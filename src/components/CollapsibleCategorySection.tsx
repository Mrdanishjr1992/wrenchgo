import React from 'react';
import { View, Text, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../ui/theme-context';
import { getCategoryIconComponent } from '../utils/categoryIcons';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type CollapsibleCategorySectionProps = {
  category: string;
  symptomCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

export function CollapsibleCategorySection({
  category,
  symptomCount,
  isExpanded,
  onToggle,
  children,
}: CollapsibleCategorySectionProps) {
  const { colors, spacing } = useTheme();

  const handleToggle = () => {
    // Configure smooth animation
    LayoutAnimation.configureNext(
      LayoutAnimation.create(
        250,
        LayoutAnimation.Types.easeInEaseOut,
        LayoutAnimation.Properties.opacity
      )
    );
    onToggle();
  };

  return (
    <View
      style={{
        borderRadius: 12,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {/* Header */}
      <Pressable
        onPress={handleToggle}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing.md,
          gap: spacing.md,
          backgroundColor: pressed ? colors.bg : colors.surface,
        })}
      >
        {/* Category Icon */}
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: colors.accent + '15',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {getCategoryIconComponent(category, 24, colors.accent)}
        </View>

        {/* Category Name & Count */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '800',
              color: colors.textPrimary,
              marginBottom: 2,
            }}
          >
            {category}
          </Text>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: colors.textMuted,
            }}
          >
            {symptomCount} {symptomCount === 1 ? 'symptom' : 'symptoms'}
          </Text>
        </View>

        {/* Expand/Collapse Icon */}
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={24}
          color={colors.accent}
          style={{
            transform: [{ rotate: isExpanded ? '0deg' : '0deg' }],
          }}
        />
      </Pressable>

      {/* Content */}
      {isExpanded && (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.bg,
          }}
        >
          {children}
        </View>
      )}
    </View>
  );
}
