// src/ui/theme.ts
import { Dimensions, PixelRatio, Platform } from "react-native";

/**
 * Base guideline width (iPhone X / 11 Pro)
 */
const BASE_WIDTH = 375;

/**
 * Get current screen dimensions
 */
export const getScreen = () => {
  const { width, height } = Dimensions.get("window");

  return {
    width,
    height,
    isSmallDevice: width < 375,
    isMediumDevice: width >= 375 && width < 414,
    isLargeDevice: width >= 414 && width < 768,
    isTablet: width >= 768,
  };
};

export const screenSizes = getScreen();

const scale = screenSizes.width / BASE_WIDTH;

/**
 * Normalize sizes (fonts, spacing, icons)
 */
export const normalize = (size: number): number => {
  const scaledSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(scaledSize));
};

/**
 * Responsive size helper
 */
export const responsiveSize = (
  small: number,
  medium: number,
  large: number,
  tablet?: number
): number => {
  if (screenSizes.isTablet && tablet !== undefined) return tablet;
  if (screenSizes.isSmallDevice) return small;
  if (screenSizes.isMediumDevice) return medium;
  return large;
};

// ============================================
// PALETTE - Raw color values (logo-based)
// ============================================
export const palette = {
  // Primary Teal (from logo)
  teal50: "#F0FDFA",
  teal100: "#CCFBF1",
  teal200: "#99F6E4",
  teal300: "#5EEAD4",
  teal400: "#2DD4BF",
  teal500: "#14B8A6",
  teal600: "#0D9488",
  teal700: "#0F766E",
  teal800: "#115E59",
  teal900: "#134E4A",

  // Neutrals
  gray50: "#F8FAFC",
  gray100: "#F1F5F9",
  gray200: "#E2E8F0",
  gray300: "#CBD5E1",
  gray400: "#94A3B8",
  gray500: "#64748B",
  gray600: "#475569",
  gray700: "#334155",
  gray800: "#1E293B",
  gray900: "#0F172A",
  gray950: "#020617",

  // Status colors
  red50: "#FEF2F2",
  red100: "#FEE2E2",
  red400: "#F87171",
  red500: "#EF4444",
  red600: "#DC2626",

  amber50: "#FFFBEB",
  amber100: "#FEF3C7",
  amber400: "#FBBF24",
  amber500: "#F59E0B",
  amber600: "#D97706",

  green50: "#F0FDF4",
  green100: "#DCFCE7",
  green400: "#4ADE80",
  green500: "#22C55E",
  green600: "#16A34A",

  blue50: "#EFF6FF",
  blue100: "#DBEAFE",
  blue400: "#60A5FA",
  blue500: "#3B82F6",
  blue600: "#2563EB",

  // Pure
  white: "#FFFFFF",
  black: "#000000",
  transparent: "transparent",
};

// ============================================
// SEMANTIC COLORS - Light Mode
// ============================================
export const lightColors = {
  // Backgrounds
  background: "#F6FAFA",
  bg: "#F6FAFA",
  surface: palette.white,
  surface2: "#EEF6F6",
  surface3: palette.gray100,
  surfaceElevated: palette.white,

  // Text
  textPrimary: palette.gray900,
  textSecondary: palette.gray700,
  textMuted: palette.gray500,
  textInverse: palette.white,
  text: palette.gray900,
  muted: palette.gray500,

  // Borders & dividers
  border: "#D6E4E5",
  borderSubtle: "#E2F0F0",
  divider: "#E2F0F0",

  // Brand / Primary
  primary: palette.teal400,
  primaryMuted: palette.teal200,
  primaryLight: palette.teal200,
  primaryBg: palette.teal50,
  primaryDark: palette.teal600,
  accent: palette.teal500,

  // Secondary
  secondary: palette.gray600,
  secondaryMuted: palette.gray400,
  secondaryBg: palette.gray100,

  // Utility colors (aliased to primary for consistency)
  blue: palette.teal400,
  blueBg: palette.teal50,
  green: palette.teal400,
  greenBg: palette.teal50,
  gray: palette.gray200,

  // Status
  success: "#10B981",
  successMuted: "#6EE7B7",
  successBg: "#10B98115",
  successText: "#065F46",

  warning: palette.amber500,
  warningMuted: palette.amber400,
  warningBg: "#F59E0B15",
  warningText: "#92400E",

  error: palette.red500,
  errorMuted: palette.red400,
  errorBg: "#EF444415",
  errorText: "#991B1B",

  danger: palette.red500,
  dangerMuted: palette.red400,
  dangerBg: "#EF444415",

  info: palette.blue500,
  infoMuted: palette.blue400,
  infoBg: "#3B82F615",
  infoText: "#1E40AF",

  // Interactive states
  pressed: "rgba(0, 0, 0, 0.05)",
  focused: palette.teal200,
  disabled: palette.gray300,
  disabledText: palette.gray400,

  // Misc
  overlay: "rgba(0, 0, 0, 0.45)",
  overlayLight: "rgba(0, 0, 0, 0.25)",
  overlayDark: "rgba(0, 0, 0, 0.65)",
  black: palette.black,
  white: palette.white,
  buttonText: "#001312",
  highlight: "#FFD60A",
  skeleton: palette.gray200,
  skeletonHighlight: palette.gray100,

  // Card specific
  cardBg: palette.white,
  cardBorder: "#E2F0F0",

  // Input specific
  inputBg: palette.white,
  inputBorder: "#D6E4E5",
  inputBorderFocused: palette.teal400,
  inputPlaceholder: palette.gray400,

  // Tab bar
  tabBarBg: palette.white,
  tabBarBorder: "#E2F0F0",
  tabIconDefault: palette.gray500,
  tabIconSelected: palette.teal500,
};

export type Colors = typeof lightColors;

// ============================================
// SEMANTIC COLORS - Dark Mode
// ============================================
export const darkColors: Colors = {
  // Backgrounds
  background: "#0B1220",
  bg: "#0B1220",
  surface: "#101826",
  surface2: "#162032",
  surface3: "#1C2A3D",
  surfaceElevated: "#182030",

  // Text
  textPrimary: "#E6FDFC",
  textSecondary: "#B3E6E3",
  textMuted: "#7CCFC9",
  textInverse: palette.gray900,
  text: "#E6FDFC",
  muted: "#7CCFC9",

  // Borders & dividers
  border: "#1F2F3A",
  borderSubtle: "#182635",
  divider: "#182635",

  // Brand / Primary
  primary: palette.teal300,
  primaryMuted: palette.teal700,
  primaryLight: palette.teal200,
  primaryBg: "#123C3A",
  primaryDark: palette.teal400,
  accent: palette.teal300,

  // Secondary
  secondary: palette.gray400,
  secondaryMuted: palette.gray600,
  secondaryBg: "#1C2A3D",

  // Utility colors
  blue: palette.teal300,
  blueBg: "#0F4A47",
  green: palette.teal300,
  greenBg: "#123C3A",
  gray: "#1F2937",

  // Status
  success: "#10B981",
  successMuted: "#065F46",
  successBg: "#10B98120",
  successText: "#6EE7B7",

  warning: palette.amber400,
  warningMuted: palette.amber600,
  warningBg: "#FBBF2420",
  warningText: "#FDE68A",

  error: palette.red400,
  errorMuted: palette.red600,
  errorBg: "#F8717120",
  errorText: "#FCA5A5",

  danger: palette.red400,
  dangerMuted: palette.red600,
  dangerBg: "#F8717120",

  info: palette.blue400,
  infoMuted: palette.blue600,
  infoBg: "#60A5FA20",
  infoText: "#93C5FD",

  // Interactive states
  pressed: "rgba(255, 255, 255, 0.08)",
  focused: palette.teal700,
  disabled: "#2D3748",
  disabledText: palette.gray600,

  // Misc
  overlay: "rgba(0, 0, 0, 0.7)",
  overlayLight: "rgba(0, 0, 0, 0.5)",
  overlayDark: "rgba(0, 0, 0, 0.85)",
  black: palette.black,
  white: palette.white,
  buttonText: "#001312",
  highlight: "#FFD60A",
  skeleton: "#1C2A3D",
  skeletonHighlight: "#243447",

  // Card specific
  cardBg: "#101826",
  cardBorder: "#1F2F3A",

  // Input specific
  inputBg: "#162032",
  inputBorder: "#1F2F3A",
  inputBorderFocused: palette.teal400,
  inputPlaceholder: "#7CCFC9",

  // Tab bar
  tabBarBg: "#101826",
  tabBarBorder: "#1F2F3A",
  tabIconDefault: "#7CCFC9",
  tabIconSelected: palette.teal300,
};

// ============================================
// SPACING SCALE
// ============================================
export const spacing = {
  none: 0,
  xxs: normalize(2),
  xs: normalize(4),
  sm: normalize(8),
  md: normalize(12),
  lg: normalize(16),
  xl: normalize(20),
  xxl: normalize(24),
  xxxl: normalize(32),
  huge: normalize(48),
  massive: normalize(64),
} as const;

// ============================================
// RADIUS SCALE
// ============================================
export const radius = {
  none: 0,
  xs: normalize(4),
  sm: normalize(8),
  md: normalize(12),
  lg: normalize(16),
  xl: normalize(20),
  xxl: normalize(24),
  full: 9999,
} as const;

// ============================================
// TYPOGRAPHY SCALE
// ============================================
export const fontSize = {
  xs: normalize(11),
  sm: normalize(13),
  base: normalize(14),
  md: normalize(15),
  lg: normalize(17),
  xl: normalize(20),
  xxl: normalize(24),
  xxxl: normalize(30),
  display: normalize(36),
} as const;

export const fontWeight = {
  normal: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
  extrabold: "800" as const,
  black: "900" as const,
} as const;

export const lineHeight = {
  tight: 1.1,
  snug: 1.25,
  normal: 1.4,
  relaxed: 1.5,
  loose: 1.75,
} as const;

// ============================================
// SHADOWS / ELEVATION
// ============================================
export const shadows = {
  none: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  xs: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  xl: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
} as const;

// ============================================
// ANIMATION TOKENS
// ============================================
export const animation = {
  fast: 150,
  normal: 250,
  slow: 350,
  spring: {
    damping: 15,
    stiffness: 150,
    mass: 1,
  },
  pressScale: 0.97,
  pressOpacity: 0.85,
} as const;

// ============================================
// HIT SLOP
// ============================================
export const hitSlop = {
  sm: { top: 8, bottom: 8, left: 8, right: 8 },
  md: { top: 12, bottom: 12, left: 12, right: 12 },
  lg: { top: 16, bottom: 16, left: 16, right: 16 },
} as const;

// ============================================
// HELPER FUNCTIONS
// ============================================
export const withAlpha = (color: string, alpha: number): string => {
  if (color.startsWith("rgba")) return color;

  if (color.startsWith("#")) {
    const hex = color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return color;
};

// ============================================
// TEXT STYLES FACTORY
// ============================================
export const createText = (colors: Colors) => ({
  // Display
  display: {
    fontSize: fontSize.display,
    fontWeight: fontWeight.black,
    color: colors.textPrimary,
    lineHeight: fontSize.display * lineHeight.tight,
  },
  // Headings
  h1: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.black,
    color: colors.textPrimary,
    lineHeight: fontSize.xxxl * lineHeight.tight,
  },
  h2: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.extrabold,
    color: colors.textPrimary,
    lineHeight: fontSize.xxl * lineHeight.snug,
  },
  h3: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    lineHeight: fontSize.xl * lineHeight.snug,
  },
  // Legacy aliases
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.black,
    color: colors.textPrimary,
    lineHeight: fontSize.xxl * lineHeight.snug,
  },
  section: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.extrabold,
    color: colors.textPrimary,
    lineHeight: fontSize.md * lineHeight.normal,
  },
  subtitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    lineHeight: fontSize.lg * lineHeight.normal,
  },
  // Body
  body: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    lineHeight: fontSize.base * lineHeight.normal,
  },
  bodySecondary: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    lineHeight: fontSize.base * lineHeight.normal,
  },
  bodySmall: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
    lineHeight: fontSize.sm * lineHeight.normal,
  },
  // Utility
  muted: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
    lineHeight: fontSize.sm * lineHeight.normal,
  },
  caption: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
    lineHeight: fontSize.xs * lineHeight.normal,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    lineHeight: fontSize.sm * lineHeight.normal,
  },
  // Button
  button: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.black,
    color: colors.textPrimary,
    lineHeight: fontSize.md * lineHeight.tight,
  },
  buttonSmall: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    lineHeight: fontSize.sm * lineHeight.tight,
  },
  // Legacy size aliases
  xs: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textMuted,
    lineHeight: fontSize.xs * lineHeight.normal,
  },
  sm: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    lineHeight: fontSize.sm * lineHeight.normal,
  },
  base: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    lineHeight: fontSize.base * lineHeight.normal,
  },
  lg: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    lineHeight: fontSize.lg * lineHeight.normal,
  },
  // Link
  link: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
    lineHeight: fontSize.base * lineHeight.normal,
  },
});

// ============================================
// THEME TYPE EXPORT
// ============================================
export type ThemeColors = typeof lightColors;
export type ThemeSpacing = typeof spacing;
export type ThemeRadius = typeof radius;
export type ThemeShadows = typeof shadows;
export type ThemeAnimation = typeof animation;
export type ThemeFontSize = typeof fontSize;
export type ThemeFontWeight = typeof fontWeight;
