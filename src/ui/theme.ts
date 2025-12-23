export const colors = {
  bg: "#F9FAFB",
  surface: "#FFFFFF",
  surface2: "#F3F4F6",
  border: "#E5E7EB",

  textPrimary: "#111827",
  textSecondary: "#374151",
  textMuted: "#6B7280",

  accent: "#0D9488",
  textOnAccent: "#FFFFFF",

  success: "#16A34A",
  danger: "#DC2626",
};


export const spacing = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
};

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
};

export const text = {
  title: {
    fontSize: 24,
    fontWeight: "900" as const,
    color: colors.textPrimary,
  },
  section: {
    fontSize: 16,
    fontWeight: "800" as const,
    color: colors.textPrimary,
  },
  body: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: colors.textSecondary,
  },
  muted: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: colors.textMuted,
  },
  button: {
    fontSize: 15,
    fontWeight: "900" as const,
    color: colors.textOnAccent,
  },
};
