import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../../src/ui/theme-context';
import { getArticleBySlug, EducationArticle, EducationArticleSection } from '../../../src/data/education-library';

function SectionCard({
  section,
  index,
  colors,
  spacing,
  radius,
}: {
  section: EducationArticleSection;
  index: number;
  colors: any;
  spacing: any;
  radius: any;
}) {
  const getHighlightColors = (highlight?: string) => {
    switch (highlight) {
      case 'danger':
        return { bg: colors.errorBg, border: colors.error };
      case 'warning':
        return { bg: colors.warningBg, border: colors.warning };
      case 'success':
        return { bg: colors.successBg, border: colors.success };
      case 'info':
        return { bg: colors.infoBg, border: colors.info };
      default:
        return { bg: colors.surface, border: colors.border };
    }
  };

  const highlightColors = getHighlightColors(section.highlight);

  const renderContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <View key={i} style={{ height: 8 }} />;

      const isBullet = trimmed.startsWith('•');
      const isNumbered = /^\d+\./.test(trimmed);

      if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        return (
          <Text
            key={i}
            style={{
              fontSize: 14,
              fontWeight: '700',
              color: colors.textPrimary,
              marginTop: i > 0 ? 8 : 0,
              marginBottom: 4,
            }}
          >
            {trimmed.slice(2, -2)}
          </Text>
        );
      }

      const parts = trimmed.split(/(\*\*[^*]+\*\*)/g);
      const renderedParts = parts.map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <Text key={j} style={{ fontWeight: '700', color: colors.textPrimary }}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        return part;
      });

      return (
        <Text
          key={i}
          style={{
            fontSize: 14,
            lineHeight: 22,
            color: colors.textSecondary,
            marginLeft: isBullet || isNumbered ? 8 : 0,
            marginTop: isBullet || isNumbered ? 4 : 0,
          }}
        >
          {renderedParts}
        </Text>
      );
    });
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(100 + index * 80).duration(300)}
      style={{
        backgroundColor: highlightColors.bg,
        borderRadius: radius.xl,
        padding: spacing.md,
        borderLeftWidth: section.highlight ? 4 : 0,
        borderLeftColor: highlightColors.border,
        marginBottom: spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
        {section.icon && (
          <Text style={{ fontSize: 20, marginRight: spacing.sm }}>{section.icon}</Text>
        )}
        <Text
          style={{
            fontSize: 16,
            fontWeight: '700',
            color: colors.textPrimary,
            flex: 1,
          }}
        >
          {section.title}
        </Text>
      </View>
      <View>{renderContent(section.content)}</View>
    </Animated.View>
  );
}

export default function EducationArticleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, spacing, radius, shadows, withAlpha } = useTheme();

  const article = getArticleBySlug(slug || '');

  if (!article) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }}>
        <Stack.Screen options={{ title: 'Not Found' }} />
        <Text style={{ color: colors.textMuted, fontSize: 16 }}>Article not found</Text>
      </View>
    );
  }

  const getIconColor = (colorKey: string) => {
    return (colors as any)[colorKey] || colors.primary;
  };

  const getIconBgColor = (bgKey: string) => {
    return (colors as any)[bgKey] || withAlpha(colors.primary, 0.1);
  };

  const handleCTA = () => {
    if (article.ctaRoute) {
      router.push(article.ctaRoute as any);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          title: '',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
          headerBackVisible: true,
        }}
      />

      <ScrollView
        contentContainerStyle={{
          paddingBottom: article.ctaText ? 100 + insets.bottom : spacing.xl + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInDown.duration(300)}
          style={{
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.xl,
            borderBottomLeftRadius: radius.xxl,
            borderBottomRightRadius: radius.xxl,
            ...shadows.sm,
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: radius.xl,
              backgroundColor: getIconBgColor(article.iconBg),
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.md,
            }}
          >
            <Ionicons
              name={article.icon as any}
              size={32}
              color={getIconColor(article.iconColor)}
            />
          </View>

          <Text
            style={{
              fontSize: 26,
              fontWeight: '800',
              color: colors.textPrimary,
              marginBottom: spacing.xs,
            }}
          >
            {article.title}
          </Text>

          <Text
            style={{
              fontSize: 15,
              color: colors.textMuted,
              marginBottom: spacing.md,
            }}
          >
            {article.subtitle}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: withAlpha(colors.textMuted, 0.1),
                paddingHorizontal: spacing.sm,
                paddingVertical: 4,
                borderRadius: radius.md,
              }}
            >
              <Ionicons name="time-outline" size={14} color={colors.textMuted} />
              <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: '600' }}>
                {article.readTimeMinutes} min read
              </Text>
            </View>

            {article.urgencyLevel && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  backgroundColor:
                    article.urgencyLevel === 'high'
                      ? colors.errorBg
                      : article.urgencyLevel === 'medium'
                      ? colors.warningBg
                      : colors.successBg,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 4,
                  borderRadius: radius.md,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color:
                      article.urgencyLevel === 'high'
                        ? colors.error
                        : article.urgencyLevel === 'medium'
                        ? colors.warning
                        : colors.success,
                  }}
                >
                  {article.urgencyLevel === 'high'
                    ? 'Urgent'
                    : article.urgencyLevel === 'medium'
                    ? 'Important'
                    : 'Routine'}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
          {article.sections.map((section, index) => (
            <SectionCard
              key={index}
              section={section}
              index={index}
              colors={colors}
              spacing={spacing}
              radius={radius}
            />
          ))}
        </View>
      </ScrollView>

      {article.ctaText && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.md + insets.bottom,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            ...shadows.lg,
          }}
        >
          <Pressable
            onPress={handleCTA}
            style={({ pressed }) => ({
              backgroundColor: pressed ? withAlpha(colors.primary, 0.9) : colors.primary,
              paddingVertical: spacing.md,
              borderRadius: radius.xl,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: spacing.sm,
            })}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>
              {article.ctaText}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        </View>
      )}
    </View>
  );
}
