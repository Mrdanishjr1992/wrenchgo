import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTheme } from '../../../src/ui/theme-context';
import { EDUCATION_ARTICLES, EducationArticle } from '../../../src/data/education-library';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function ArticleCard({
  article,
  index,
  onPress,
}: {
  article: EducationArticle;
  index: number;
  onPress: () => void;
}) {
  const { colors, spacing, radius, shadows, withAlpha } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const getIconColor = (colorKey: string) => {
    return (colors as any)[colorKey] || colors.primary;
  };

  const getIconBgColor = (bgKey: string) => {
    return (colors as any)[bgKey] || withAlpha(colors.primary, 0.1);
  };

  return (
    <Animated.View entering={FadeInDown.delay(100 + index * 80).duration(300)}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.98, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        style={[animatedStyle, {
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          padding: spacing.md,
          marginBottom: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          ...shadows.sm,
        }]}
      >
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: radius.lg,
            backgroundColor: getIconBgColor(article.iconBg),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name={article.icon as any}
            size={26}
            color={getIconColor(article.iconColor)}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '700',
              color: colors.textPrimary,
              marginBottom: 2,
            }}
          >
            {article.title}
          </Text>
          <Text
            style={{
              fontSize: 13,
              color: colors.textMuted,
              marginBottom: 4,
            }}
            numberOfLines={1}
          >
            {article.subtitle}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Ionicons name="time-outline" size={12} color={colors.textMuted} />
              <Text style={{ fontSize: 11, color: colors.textMuted }}>
                {article.readTimeMinutes} min
              </Text>
            </View>
            {article.urgencyLevel && (
              <View
                style={{
                  backgroundColor:
                    article.urgencyLevel === 'high'
                      ? colors.errorBg
                      : article.urgencyLevel === 'medium'
                      ? colors.warningBg
                      : colors.successBg,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: radius.sm,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
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
                    ? 'URGENT'
                    : article.urgencyLevel === 'medium'
                    ? 'IMPORTANT'
                    : 'ROUTINE'}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: colors.surface2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function EducationLibraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, spacing, radius, withAlpha } = useTheme();

  const handleArticlePress = (article: EducationArticle) => {
    router.push({
      pathname: '/(customer)/education/[slug]',
      params: { slug: article.slug },
    } as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          title: 'Car Care Library',
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
          headerBackVisible: true,
        }}
      />

      <ScrollView
        contentContainerStyle={{
          paddingTop: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.xl + insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInDown.duration(300)}
          style={{
            backgroundColor: withAlpha(colors.info, 0.1),
            borderRadius: radius.xl,
            padding: spacing.md,
            marginBottom: spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          <Ionicons name="information-circle" size={24} color={colors.info} />
          <Text style={{ flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
            Learn about common car issues before booking. Understanding your car helps you make better decisions.
          </Text>
        </Animated.View>

        {EDUCATION_ARTICLES.map((article, index) => (
          <ArticleCard
            key={article.id}
            article={article}
            index={index}
            onPress={() => handleArticlePress(article)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
