# Responsive Design Implementation Guide

## Overview
The app now includes comprehensive responsive utilities to ensure proper display on all Android and iOS screen sizes.

## Key Changes Made

### 1. Theme System (`src/ui/theme.ts`)
- Added `normalize()` function for responsive sizing
- Added `screenSizes` object for device detection
- Added `responsiveSize()` helper for conditional sizing
- All spacing and radius values now use `normalize()`
- All text styles now use responsive font sizes

### 2. Safe Area Support (`app/_layout.tsx`)
- Added `SafeAreaProvider` wrapper
- Ensures proper handling of notches, status bars, and navigation bars
- Works on all iOS and Android devices

### 3. App Configuration (`app.json`)
- Added `requireFullScreen: false` for iOS (supports all screen sizes)
- Added `softwareKeyboardLayoutMode: "pan"` for Android (better keyboard handling)
- Enabled tablet support

### 4. New Utilities

#### useResponsive Hook (`src/hooks/useResponsive.ts`)
```typescript
const { 
  width, 
  height, 
  isSmallDevice, 
  isTablet, 
  normalize, 
  wp, 
  hp 
} = useResponsive();
```

#### KeyboardAvoidingWrapper Component (`src/components/KeyboardAvoidingWrapper.tsx`)
```typescript
<KeyboardAvoidingWrapper>
  {/* Your content */}
</KeyboardAvoidingWrapper>
```

## Usage Guidelines

### Font Sizes
Always use `normalize()` for font sizes:
```typescript
// ❌ Bad
fontSize: 16

// ✅ Good
fontSize: normalize(16)
```

### Spacing
Use theme spacing values (already normalized):
```typescript
import { spacing } from "../../src/ui/theme";

// ✅ Good
padding: spacing.md
marginTop: spacing.lg
```

### Fixed Dimensions
Avoid fixed widths/heights. Use flex or percentages:
```typescript
// ❌ Bad
width: 300

// ✅ Good
width: "100%"
flex: 1
maxWidth: wp(90) // 90% of screen width
```

### Text Wrapping
Always add numberOfLines for text that might overflow:
```typescript
<Text numberOfLines={2} style={{ flex: 1 }}>
  {longText}
</Text>
```

### Images
Use aspectRatio instead of fixed dimensions:
```typescript
// ✅ Good
<Image 
  style={{ 
    width: "100%", 
    aspectRatio: 16/9 
  }} 
/>
```

## Screen Size Breakpoints
- Small: < 375px (iPhone SE, small Android phones)
- Medium: 375-414px (iPhone 12/13/14, most Android phones)
- Large: 414-768px (iPhone Pro Max, large Android phones)
- Tablet: >= 768px (iPads, Android tablets)

## Testing Checklist
- [ ] Test on iPhone SE (smallest iOS device)
- [ ] Test on iPhone 14 Pro Max (largest iPhone)
- [ ] Test on iPad
- [ ] Test on small Android phone (< 375px)
- [ ] Test on large Android phone (> 414px)
- [ ] Test on Android tablet
- [ ] Test landscape orientation
- [ ] Test with keyboard open
- [ ] Test with different font sizes (accessibility)

## Common Issues Fixed
1. ✅ Text overflow in cards
2. ✅ Fixed width elements breaking on small screens
3. ✅ Keyboard covering input fields
4. ✅ Safe area insets (notches, status bars)
5. ✅ Inconsistent spacing across devices
6. ✅ Font sizes too large/small on different screens
