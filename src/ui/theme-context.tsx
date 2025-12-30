// src/ui/theme-context.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { lightColors, darkColors, spacing, radius, createText } from "./theme";

type ThemeMode = "light" | "dark";

type ThemeContextType = {
  mode: ThemeMode;
  colors: typeof lightColors;
  text: ReturnType<typeof createText>;
  spacing: typeof spacing;
  radius: typeof radius;
  toggle: () => void;
  setMode: (m: ThemeMode) => void; // optional but useful
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = Appearance.getColorScheme();
  const [mode, setMode] = useState<ThemeMode>(system === "dark" ? "dark" : "light");

  useEffect(() => {
    AsyncStorage.getItem("theme").then((stored) => {
      if (stored === "dark" || stored === "light") setMode(stored);
    });
  }, []);

  const toggle = async () => {
    const next: ThemeMode = mode === "dark" ? "light" : "dark";
    setMode(next);
    await AsyncStorage.setItem("theme", next);
  };

  const colors = mode === "dark" ? darkColors : lightColors;

  const value = useMemo<ThemeContextType>(
    () => ({
      mode,
      colors,
      text: createText(colors),
      spacing,
      radius,
      toggle,
      setMode: async (m: ThemeMode) => {
        setMode(m);
        await AsyncStorage.setItem("theme", m);
      },
    }),
    [mode, colors]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
