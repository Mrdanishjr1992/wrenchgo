# Complete Android Safe Area + Orientation Solution

## Problem Explanation

### Why Content Overlaps on Android

Your app has `"edgeToEdgeEnabled": true` in `app.json`, which enables **immersive mode**:
- App draws **behind** system UI (status bar + navigation bar)
- Creates modern edge-to-edge experience
- **BUT** requires manual safe area handling

### Different Android Navigation Modes

| Navigation Mode | Bottom Inset | Visual |
|----------------|--------------|--------|
| **Gesture Navigation** | ~16-24dp | Small gesture bar |
| **3-Button Navigation** | ~48-56dp | Large button bar (Back/Home/Recent) |
| **No Navigation Bar** | 0dp | Some devices/modes |

**Without `react-native-safe-area-context`, your app doesn't know these insets exist.**

---

## Complete Solution

### 1. Package Installation

```bash
npx expo install react-native-safe-area-context expo-screen-orientation
```

**Already installed** ✅ (comes with expo-router)

---

### 2. App Configuration (app.json)

```json
{
  "expo": {
    "orientation": "default",
    "ios": {
      "supportsTablet": true,
      "requireFullScreen": false
    },
    "android": {
      "edgeToEdgeEnabled": true,
      "softwareKeyboardLayoutMode": "pan",
      "screenOrientation": "sensorPortrait"
    }
  }
}
```

**Key Settings:**

- `"orientation": "default"` - Global setting (allows rotation)
- `"screenOrientation": "sensorPortrait"` - Android-specific
  - Allows **portrait rotation** (normal ↔ upside down)
  - **Prevents landscape** (no left/right rotation)
  - Responds to device orientation sensor
- `"edgeToEdgeEnabled": true` - Immersive mode (requires safe area handling)
- `"softwareKeyboardLayoutMode": "pan"` - Better keyboard behavior

---

### 3. Root Layout (app/_layout.tsx)

```typescript
// app/_layout.tsx
import { Stack } from "expo-router";
import { useEffect } from "react";
import { Platform, StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as ScreenOrientation from "expo-screen-orientation";
import { ThemeProvider } from "../src/ui/theme-context";
import React from "react";

export default function RootLayout() {
  useEffect(() => {
    // Lock to portrait (allows normal + upside down, prevents landscape)
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);

    // Android: Transparent status bar for edge-to-edge
    if (Platform.OS === "android") {
      StatusBar.setTranslucent(true);
      StatusBar.setBackgroundColor("transparent");
    }
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
```

**Critical Points:**

1. **`SafeAreaProvider`** - Must wrap entire app (provides safe area context)
2. **`ScreenOrientation.OrientationLock.PORTRAIT`** - Allows portrait rotation, blocks landscape
3. **`StatusBar.setTranslucent(true)`** - Android edge-to-edge (status bar)
4. **`contentStyle: { backgroundColor: "transparent" }`** - Prevents white flashes

---

### 4. Bottom Tab Layout (Correct Implementation)

```typescript
// app/(customer)/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../../src/ui/theme-context";
import React from "react";

export default function CustomerLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarHideOnKeyboard: true,
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        
        // ✅ CORRECT: Dynamic safe area handling
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 60 + insets.bottom,           // Dynamic height
          paddingTop: 10,
          paddingBottom: insets.bottom || 12,   // Dynamic padding
        },
        
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "800" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="explore" options={{ title: "Explore" }} />
      <Tabs.Screen name="jobs" options={{ title: "Jobs" }} />
    </Tabs>
  );
}
```

**Why This Works:**

```typescript
// On device with gesture navigation:
insets.bottom = 16  // Small gesture bar
height = 60 + 16 = 76
paddingBottom = 16

// On device with 3-button navigation:
insets.bottom = 48  // Large button bar
height = 60 + 48 = 108
paddingBottom = 48

// On device with no navigation bar:
insets.bottom = 0
height = 60 + 0 = 60
paddingBottom = 12  // Fallback
```

**❌ WRONG (Hardcoded):**

```typescript
// DON'T DO THIS:
tabBarStyle: {
  height: 72,  // ❌ Fixed height
  paddingBottom: Platform.OS === "ios" ? 18 : 12,  // ❌ Hardcoded
}
```

---

### 5. ScrollView Screens (Safe Area Handling)

```typescript
// app/(customer)/education.tsx
import { ScrollView, View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../src/ui/theme-context";
import React from "react";

export default function EducationPage() {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: spacing.lg + insets.bottom,  // ✅ Add safe area
          gap: spacing.md,
        }}
      >
        <Text>Your content here</Text>
        {/* Last item will be visible above navigation bar */}
      </ScrollView>
    </View>
  );
}
```

**Why `paddingBottom: spacing.lg + insets.bottom`:**
- Adds extra padding at bottom of scrollable content
- Ensures last item is visible above navigation bar
- Works on all devices (gesture, 3-button, no nav bar)

---

### 6. Reusable Safe Area Components

#### SafeScreen Component

```typescript
// src/components/SafeScreen.tsx
import React from "react";
import { View, ViewStyle } from "react-native";
import { useSafeAreaInsets, Edge } from "react-native-safe-area-context";

interface SafeScreenProps {
  children: React.ReactNode;
  edges?: Edge[];
  backgroundColor?: string;
  style?: ViewStyle;
}

export const SafeScreen: React.FC<SafeScreenProps> = ({
  children,
  edges = ["top", "bottom", "left", "right"],
  backgroundColor = "#fff",
  style,
}) => {
  const insets = useSafeAreaInsets();

  const paddingStyle = {
    paddingTop: edges.includes("top") ? insets.top : 0,
    paddingBottom: edges.includes("bottom") ? insets.bottom : 0,
    paddingLeft: edges.includes("left") ? insets.left : 0,
    paddingRight: edges.includes("right") ? insets.right : 0,
  };

  return (
    <View style={[{ flex: 1, backgroundColor }, paddingStyle, style]}>
      {children}
    </View>
  );
};
```

**Usage:**

```typescript
// Full screen (all safe areas)
<SafeScreen backgroundColor={colors.bg}>
  <YourContent />
</SafeScreen>

// Screen with bottom tabs (no bottom padding)
<SafeScreen edges={["top"]} backgroundColor={colors.bg}>
  <YourContent />
</SafeScreen>
```

#### SafeScrollView Component

```typescript
// src/components/SafeScrollView.tsx
import React from "react";
import { ScrollView, ScrollViewProps } from "react-native";
import { useSafeAreaInsets, Edge } from "react-native-safe-area-context";

interface SafeScrollViewProps extends ScrollViewProps {
  edges?: Edge[];
}

export const SafeScrollView: React.FC<SafeScrollViewProps> = ({
  children,
  edges = ["top", "bottom"],
  contentContainerStyle,
  ...props
}) => {
  const insets = useSafeAreaInsets();

  const paddingStyle = {
    paddingTop: edges.includes("top") ? insets.top : 0,
    paddingBottom: edges.includes("bottom") ? insets.bottom : 0,
    paddingLeft: edges.includes("left") ? insets.left : 0,
    paddingRight: edges.includes("right") ? insets.right : 0,
  };

  return (
    <ScrollView
      contentContainerStyle={[paddingStyle, contentContainerStyle]}
      {...props}
    >
      {children}
    </ScrollView>
  );
};
```

**Usage:**

```typescript
// Scrollable content with safe areas
<SafeScrollView edges={["bottom"]}>
  <View style={{ padding: 20 }}>
    <Text>Scrollable content</Text>
  </View>
</SafeScrollView>
```

---

## Orientation Lock Options

### Available Orientation Locks

```typescript
import * as ScreenOrientation from "expo-screen-orientation";

// Portrait only (no rotation)
ScreenOrientation.OrientationLock.PORTRAIT_UP

// Portrait with rotation (normal ↔ upside down)
ScreenOrientation.OrientationLock.PORTRAIT  // ✅ Recommended

// Landscape only (no rotation)
ScreenOrientation.OrientationLock.LANDSCAPE_LEFT

// Landscape with rotation (left ↔ right)
ScreenOrientation.OrientationLock.LANDSCAPE

// All orientations (full rotation)
ScreenOrientation.OrientationLock.ALL

// Default (system decides)
ScreenOrientation.OrientationLock.DEFAULT
```

### Your Current Setup (Portrait with Rotation)

```typescript
// app/_layout.tsx
ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
```

**Result:**
- ✅ Allows portrait rotation (normal ↔ upside down)
- ✅ Prevents landscape (no left/right rotation)
- ✅ Responds to device orientation sensor
- ✅ User can flip phone upside down and UI rotates

---

## Testing Checklist

### Devices to Test

- [ ] **Small phone with 3-button nav** (e.g., Pixel 3a, Galaxy A series)
- [ ] **Large phone with gesture nav** (e.g., Pixel 7+, Galaxy S series)
- [ ] **Tablet** (e.g., Samsung Galaxy Tab)
- [ ] **Different manufacturers** (Samsung, Xiaomi, OnePlus - different insets)

### Scenarios to Test

- [ ] Bottom tabs visible and clickable
- [ ] Last item in ScrollView fully visible
- [ ] Content doesn't overlap navigation buttons
- [ ] Keyboard doesn't cover input fields
- [ ] Portrait rotation works (flip phone upside down)
- [ ] Landscape rotation blocked (phone stays portrait)
- [ ] Status bar is translucent
- [ ] No white bars at top/bottom

### How to Test Navigation Modes

**On Android device:**
1. Go to **Settings → System → Gestures → System navigation**
2. Switch between **Gesture navigation** and **3-button navigation**
3. Test your app in both modes
4. Verify tab bar is always above navigation buttons

---

## Common Issues & Solutions

### Issue 1: Content Still Hidden Behind Nav Bar

**Cause:** Not using safe area insets

**Solution:**
```typescript
import { useSafeAreaInsets } from "react-native-safe-area-context";

const insets = useSafeAreaInsets();

<View style={{ paddingBottom: insets.bottom }}>
  {/* Content */}
</View>
```

### Issue 2: Tab Bar Too Tall

**Cause:** Adding `insets.bottom` twice

**Solution:**
```typescript
// ❌ WRONG:
tabBarStyle: {
  height: 72 + insets.bottom,
  paddingBottom: 12 + insets.bottom,  // Double padding!
}

// ✅ CORRECT:
tabBarStyle: {
  height: 60 + insets.bottom,
  paddingBottom: insets.bottom || 12,  // Single padding
}
```

### Issue 3: White Bar at Bottom

**Cause:** Background color not set

**Solution:**
```typescript
<View style={{ flex: 1, backgroundColor: colors.bg }}>
  {/* Content */}
</View>
```

### Issue 4: Landscape Still Allowed

**Cause:** Orientation lock not applied

**Solution:**
```typescript
// app/_layout.tsx
useEffect(() => {
  ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
}, []);
```

### Issue 5: Portrait Rotation Not Working

**Cause:** Using `PORTRAIT_UP` instead of `PORTRAIT`

**Solution:**
```typescript
// ❌ WRONG (no rotation):
ScreenOrientation.OrientationLock.PORTRAIT_UP

// ✅ CORRECT (allows portrait rotation):
ScreenOrientation.OrientationLock.PORTRAIT
```

---

## Summary

### What Was Fixed

1. **Safe Area Handling**
   - ✅ `SafeAreaProvider` wraps entire app
   - ✅ Tab bars use `useSafeAreaInsets()` for dynamic height
   - ✅ ScrollViews add bottom padding with insets
   - ✅ Works on all Android devices (gesture + 3-button nav)

2. **Orientation Control**
   - ✅ Portrait rotation enabled (normal ↔ upside down)
   - ✅ Landscape rotation blocked
   - ✅ Sensor-based rotation works
   - ✅ Configured in both `app.json` and runtime

3. **Edge-to-Edge Experience**
   - ✅ Translucent status bar
   - ✅ Content draws behind system UI
   - ✅ No content hidden behind navigation bar
   - ✅ Production-ready, no hacks

### Key Takeaways

- **Always use `useSafeAreaInsets()`** for dynamic safe areas
- **Never hardcode padding** for tab bars or bottom content
- **Test on real devices** with different navigation modes
- **Use `PORTRAIT` lock** for portrait rotation, not `PORTRAIT_UP`
- **Wrap app with `SafeAreaProvider`** at root level

---

## Quick Reference

```typescript
// Import
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Get insets
const insets = useSafeAreaInsets();

// Apply to tab bar
tabBarStyle: {
  height: 60 + insets.bottom,
  paddingBottom: insets.bottom || 12,
}

// Apply to ScrollView
<ScrollView
  contentContainerStyle={{
    paddingBottom: insets.bottom,
  }}
>

// Lock orientation
ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
```

---

**Your app now properly handles Android safe areas and orientation! 🎉**
