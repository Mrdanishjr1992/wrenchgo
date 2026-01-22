// src/components/SafeScrollView.tsx
import React from "react";
import { ScrollView, ScrollViewProps, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface SafeScrollViewProps extends ScrollViewProps {
  edges?: ("top" | "bottom" | "left" | "right")[];
  children: React.ReactNode;
}

/**
 * SafeScrollView - ScrollView with safe area insets
 * 
 * Applies safe area padding to contentContainerStyle
 * 
 * Usage:
 * <SafeScrollView>
 *   <YourContent />
 * </SafeScrollView>
 * 
 * For screens with bottom tabs (no bottom padding):
 * <SafeScrollView edges={["top"]}>
 *   <YourContent />
 * </SafeScrollView>
 */
export const SafeScrollView: React.FC<SafeScrollViewProps> = ({
  edges = ["top", "bottom"],
  children,
  contentContainerStyle,
  ...props
}) => {
  const insets = useSafeAreaInsets();

  const safePadding: ViewStyle = {
    paddingTop: edges.includes("top") ? insets.top : 0,
    paddingBottom: edges.includes("bottom") ? insets.bottom : 0,
    paddingLeft: edges.includes("left") ? insets.left : 0,
    paddingRight: edges.includes("right") ? insets.right : 0,
  };

  return (
    <ScrollView
      {...props}
      contentContainerStyle={[
        safePadding,
        contentContainerStyle,
      ]}
    >
      {children}
    </ScrollView>
  );
};
