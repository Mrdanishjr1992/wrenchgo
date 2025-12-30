// Example: app/(customer)/some-screen.tsx
import React from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeScreen } from "../../src/components/SafeScreen";
import { useTheme } from "../../src/ui/theme-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SomeScreen() {
  const { colors } = useTheme();

  return (
    <SafeScreen backgroundColor={colors.bg}>
      <View style={{ flex: 1, padding: 20 }}>
        <Text>Your content here</Text>
        {/* Content will never be hidden by navigation bar */}
      </View>
    </SafeScreen>
  );
}

// Alternative: Using useSafeAreaInsets directly
export default function SomeScreenAlt() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
    >
      <View style={{ flex: 1, padding: 20 }}>
        <Text>Your content here</Text>
      </View>
    </View>
  );
}

// ============================================
// SCROLLVIEW EXAMPLES
// ============================================

// Example 1: Using SafeScrollView component
import { SafeScrollView } from "../../src/components/SafeScrollView";

export default function ScrollableScreen() {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeScrollView>
        <View style={{ padding: 20 }}>
          <Text>Scrollable content</Text>
          {/* Add lots of content here */}
          {Array.from({ length: 50 }).map((_, i) => (
            <Text key={i} style={{ marginVertical: 10 }}>
              Item {i + 1}
            </Text>
          ))}
        </View>
      </SafeScrollView>
    </View>
  );
}

// Example 2: Manual ScrollView with safe areas
export default function ScrollableScreenManual() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
          padding: 20,
        }}
      >
        <Text>Scrollable content</Text>
        {/* Content here */}
      </ScrollView>
    </View>
  );
}

// Example 3: ScrollView with header (only bottom safe area)
export default function ScrollableWithHeader() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Fixed header with top safe area */}
      <View
        style={{
          paddingTop: insets.top,
          paddingHorizontal: 20,
          paddingBottom: 10,
          backgroundColor: colors.surface,
        }}
      >
        <Text style={{ fontSize: 24, fontWeight: "bold" }}>Header</Text>
      </View>

      {/* Scrollable content with only bottom safe area */}
      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom,
          padding: 20,
        }}
      >
        <Text>Scrollable content</Text>
        {/* Content here */}
      </ScrollView>
    </View>
  );
}
