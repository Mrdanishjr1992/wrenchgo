// src/components/SafeScreen.tsx
import React from "react";
import { View, ViewStyle, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface SafeScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: ("top" | "bottom" | "left" | "right")[];
  backgroundColor?: string;
}

/**
 * SafeScreen - Wraps content with safe area insets
 * 
 * @param edges - Which edges to apply insets to. Default: ["top", "bottom"]
 * @param backgroundColor - Background color for the safe area
 * 
 * Usage:
 * <SafeScreen>
 *   <YourContent />
 * </SafeScreen>
 * 
 * For screens with custom bottom tabs:
 * <SafeScreen edges={["top"]}>
 *   <YourContent />
 * </SafeScreen>
 */
export const SafeScreen: React.FC<SafeScreenProps> = ({
  children,
  style,
  edges = ["top", "bottom"],
  backgroundColor,
}) => {
  const insets = useSafeAreaInsets();

  const paddingStyle: ViewStyle = {
    paddingTop: edges.includes("top") ? insets.top : 0,
    paddingBottom: edges.includes("bottom") ? insets.bottom : 0,
    paddingLeft: edges.includes("left") ? insets.left : 0,
    paddingRight: edges.includes("right") ? insets.right : 0,
  };

  return (
    <View
      style={[
        styles.container,
        paddingStyle,
        backgroundColor && { backgroundColor },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
