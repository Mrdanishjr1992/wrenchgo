// src/ui/theme-context.tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { 
  lightColors, 
  darkColors, 
  spacing, 
  radius, 
  shadows,
  fontSize,
  fontWeight,
  lineHeight,
  animation,
  hitSlop,
  createText,
  withAlpha,
  normalize,
  palette,
  type Colors,
} from "./theme";

type ThemeMode = "light" | "dark";

type ThemeContextType = {
  mode: ThemeMode;
  isDark: boolean;
  colors: Colors;
  text: ReturnType<typeof createText>;
  spacing: typeof spacing;
  radius: typeof radius;
  shadows: typeof shadows;
  fontSize: typeof fontSize;
  fontWeight: typeof fontWeight;
  lineHeight: typeof lineHeight;
  animation: typeof animation;
  hitSlop: typeof hitSlop;
  palette: typeof palette;
  withAlpha: typeof withAlpha;
  normalize: typeof normalize;
  toggle: () => Promise<void>;
  setMode: (m: ThemeMode) => Promise<void>;
  loadUserTheme: (userId: string) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

const isThemeMode = (v: unknown): v is ThemeMode => v === "light" || v === "dark";

const storageKey = (userId: string) => `theme:${userId}`;

const getSystemMode = (): ThemeMode => (Appearance.getColorScheme() === "dark" ? "dark" : "light");

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(getSystemMode());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  const applyMode = useCallback(
    async (newMode: ThemeMode, userId?: string | null) => {
      setModeState(newMode);

      const uid = userId ?? currentUserId;
      if (!uid) return;

      try {
        await AsyncStorage.setItem(storageKey(uid), newMode);
      } catch (err) {
        console.warn("Failed to save theme to AsyncStorage:", err);
      }

      try {
        await supabase.from("profiles").update({ theme_preference: newMode }).eq("id", uid);
      } catch (err) {
        console.warn("Failed to save theme to Supabase:", err);
      }
    },
    [currentUserId]
  );

  const loadUserTheme = useCallback(async (userId: string) => {
    if (!userId) {
      setCurrentUserId(null);
      setModeState(getSystemMode());
      return;
    }

    setCurrentUserId(userId);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("theme_preference")
        .eq("id", userId)
        .single();

      const pref = data?.theme_preference;
      if (!error && isThemeMode(pref)) {
        setModeState(pref);
        try {
          await AsyncStorage.setItem(storageKey(userId), pref);
        } catch {}
        return;
      }
    } catch (err) {
      console.warn("Failed to load theme from Supabase:", err);
    }

    try {
      const stored = await AsyncStorage.getItem(storageKey(userId));
      if (isThemeMode(stored)) {
        setModeState(stored);
        return;
      }
    } catch (err) {
      console.warn("Failed to load theme from AsyncStorage:", err);
    }

    setModeState(getSystemMode());
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error?.message?.includes("Refresh Token")) {
          await supabase.auth.signOut();
          if (mounted) {
            setCurrentUserId(null);
            setModeState(getSystemMode());
          }
          return;
        }

        if (!mounted) return;

        const uid = session?.user?.id ?? null;
        if (uid) {
          await loadUserTheme(uid);
        } else {
          setCurrentUserId(null);
          setModeState(getSystemMode());
        }
      } catch (err) {
        console.warn("Failed to initialize theme:", err);
        setCurrentUserId(null);
        setModeState(getSystemMode());
      } finally {
        if (mounted) setIsInitialized(true);
      }
    };

    init();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      const uid = session?.user?.id ?? null;

      if (event === "SIGNED_IN" && uid) {
        await loadUserTheme(uid);
        return;
      }

      if (event === "SIGNED_OUT") {
        setCurrentUserId(null);
        setModeState(getSystemMode());
      }
    });

    return () => {
      mounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, [loadUserTheme]);

  const toggle = useCallback(async () => {
    const next: ThemeMode = mode === "dark" ? "light" : "dark";
    await applyMode(next);
  }, [mode, applyMode]);

  const setMode = useCallback(
    async (m: ThemeMode) => {
      await applyMode(m);
    },
    [applyMode]
  );

  const colors = mode === "dark" ? darkColors : lightColors;
  const isDark = mode === "dark";

  const value = useMemo<ThemeContextType>(
    () => ({
      mode,
      isDark,
      colors,
      text: createText(colors),
      spacing,
      radius,
      shadows,
      fontSize,
      fontWeight,
      lineHeight,
      animation,
      hitSlop,
      palette,
      withAlpha,
      normalize,
      toggle,
      setMode,
      loadUserTheme,
    }),
    [mode, isDark, colors, toggle, setMode, loadUserTheme]
  );

  if (!isInitialized) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export { lightColors, darkColors, spacing, radius, shadows, fontSize, fontWeight, animation, palette };
