import React, { useEffect } from "react";
import { View, ViewStyle, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme-context";

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  width = "100%",
  height = 16,
  borderRadius,
  style,
}: SkeletonProps) {
  const { colors, radius, animation } = useTheme();
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(shimmer.value, [0, 1], [-200, 200]);
    return {
      transform: [{ translateX }],
    };
  });

  return (
    <View
      style={[
        {
          width: width as any,
          height,
          borderRadius: borderRadius ?? radius.sm,
          backgroundColor: colors.skeleton,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
        <LinearGradient
          colors={[colors.skeleton, colors.skeletonHighlight, colors.skeleton]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

interface SkeletonTextProps {
  lines?: number;
  lineHeight?: number;
  lastLineWidth?: string;
  style?: ViewStyle;
}

export function SkeletonText({
  lines = 3,
  lineHeight = 14,
  lastLineWidth = "60%",
  style,
}: SkeletonTextProps) {
  const { spacing } = useTheme();

  return (
    <View style={style}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          width={index === lines - 1 ? lastLineWidth : "100%"}
          height={lineHeight}
          style={{ marginBottom: index < lines - 1 ? spacing.sm : 0 }}
        />
      ))}
    </View>
  );
}

interface SkeletonCardProps {
  style?: ViewStyle;
}

export function SkeletonCard({ style }: SkeletonCardProps) {
  const { colors, radius, spacing, shadows } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: colors.cardBg,
          borderRadius: radius.lg,
          padding: spacing.lg,
          ...shadows.sm,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
        <Skeleton width={48} height={48} borderRadius={24} />
        <View style={{ marginLeft: spacing.md, flex: 1 }}>
          <Skeleton width="70%" height={16} style={{ marginBottom: spacing.xs }} />
          <Skeleton width="40%" height={12} />
        </View>
      </View>
      <SkeletonText lines={2} />
    </View>
  );
}

interface SkeletonListProps {
  count?: number;
  itemHeight?: number;
  style?: ViewStyle;
}

export function SkeletonList({ count = 5, itemHeight = 72, style }: SkeletonListProps) {
  const { spacing } = useTheme();

  return (
    <View style={style}>
      {Array.from({ length: count }).map((_, index) => (
        <View
          key={index}
          style={{
            flexDirection: "row",
            alignItems: "center",
            height: itemHeight,
            marginBottom: spacing.sm,
          }}
        >
          <Skeleton width={48} height={48} borderRadius={24} />
          <View style={{ marginLeft: spacing.md, flex: 1 }}>
            <Skeleton width="60%" height={16} style={{ marginBottom: spacing.xs }} />
            <Skeleton width="40%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

export default Skeleton;
