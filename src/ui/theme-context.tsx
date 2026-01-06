// src/ui/theme-context.tsx
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { lightColors, darkColors, spacing, radius, createText } from "./theme";
import { supabase } from "../lib/supabase";

type ThemeMode = "light" | "dark";

type ThemeContextType = {
  mode: ThemeMode;
  colors: typeof lightColors;
  text: ReturnType<typeof createText>;
  spacing: typeof spacing;
  radius: typeof radius;
  toggle: () => void;
  setMode: (m: ThemeMode) => void;
  loadUserTheme: (userId: string) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = Appearance.getColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(system === "dark" ? "dark" : "light");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const loadUserTheme = useCallback(async (userId: string) => {
    if (!userId) {
      setModeState("light");
      setCurrentUserId(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("theme_preference")
        .eq("id", userId)
        .single();

      if (!error && data?.theme_preference) {
        const themeMode = data.theme_preference as ThemeMode;
        setModeState(themeMode);
        setCurrentUserId(userId);
        await AsyncStorage.setItem(`theme:${userId}`, themeMode);
        return;
      }
    } catch (err) {
      console.warn("Failed to load theme from Supabase, trying AsyncStorage:", err);
    }

    try {
      const stored = await AsyncStorage.getItem(`theme:${userId}`);
      if (stored === "dark" || stored === "light") {
        setModeState(stored);
        setCurrentUserId(userId);
      } else {
        setModeState("light");
        setCurrentUserId(userId);
      }
    } catch (err) {
      console.warn("Failed to load theme from AsyncStorage:", err);
      setModeState("light");
      setCurrentUserId(userId);
    }
  }, []);

  useEffect(() => {
    const initTheme = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.id) {
          await loadUserTheme(session.user.id);
        } else {
          setModeState("light");
          setCurrentUserId(null);
        }
      } catch (err) {
        console.warn("Failed to initialize theme:", err);
        setModeState("light");
      } finally {
        setIsInitialized(true);
      }
    };

    initTheme();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user?.id) {
        await loadUserTheme(session.user.id);
      } else if (event === "SIGNED_OUT") {
        setModeState("light");
        setCurrentUserId(null);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [loadUserTheme]);

  const saveTheme = useCallback(async (newMode: ThemeMode) => {
    setModeState(newMode);

    if (!currentUserId) {
      return;
    }

    try {
      await AsyncStorage.setItem(`theme:${currentUserId}`, newMode);
    } catch (err) {
      console.warn("Failed to save theme to AsyncStorage:", err);
    }

    try {
      await supabase
        .from("profiles")
        .update({ theme_preference: newMode })
        .eq("id", currentUserId);
    } catch (err) {
      console.warn("Failed to save theme to Supabase:", err);
    }
  }, [currentUserId]);

  const toggle = useCallback(async () => {
    const next: ThemeMode = mode === "dark" ? "light" : "dark";
    await saveTheme(next);
  }, [mode, saveTheme]);

  const setMode = useCallback(async (m: ThemeMode) => {
    await saveTheme(m);
  }, [saveTheme]);

  const colors = mode === "dark" ? darkColors : lightColors;

  const value = useMemo<ThemeContextType>(
    () => ({
      mode,
      colors,
      text: createText(colors),
      spacing,
      radius,
      toggle,
      setMode,
      loadUserTheme,
    }),
    [mode, colors, toggle, setMode, loadUserTheme]
  );

  if (!isInitialized) {
    return null;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
