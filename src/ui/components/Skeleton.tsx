import React from 'react';
import { View, ViewStyle, Animated, DimensionValue } from 'react-native';
import { useTheme } from '../theme-context';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius,
  style,
}: SkeletonProps) {
  const { colors, radius } = useTheme();
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width: width as DimensionValue,
          height,
          borderRadius: borderRadius ?? radius.sm,
          backgroundColor: colors.border,
          opacity,
        },
        style,
      ]}
    />
  );
}

interface SkeletonTextProps {
  lines?: number;
  lastLineWidth?: DimensionValue;
  lineHeight?: number;
  gap?: number;
  style?: ViewStyle;
}

export function SkeletonText({
  lines = 3,
  lastLineWidth = '60%',
  lineHeight = 14,
  gap = 8,
  style,
}: SkeletonTextProps) {
  return (
    <View style={[{ gap }, style]}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          height={lineHeight}
          width={index === lines - 1 ? lastLineWidth : '100%'}
        />
      ))}
    </View>
  );
}

interface SkeletonAvatarProps {
  size?: number;
  style?: ViewStyle;
}

export function SkeletonAvatar({ size = 48, style }: SkeletonAvatarProps) {
  return <Skeleton width={size} height={size} borderRadius={size / 2} style={style} />;
}

interface SkeletonCardProps {
  height?: number;
  style?: ViewStyle;
}

export function SkeletonCard({ height = 120, style }: SkeletonCardProps) {
  const { radius } = useTheme();

  return (
    <Skeleton
      width="100%"
      height={height}
      borderRadius={radius.lg}
      style={style}
    />
  );
}

export default Skeleton;