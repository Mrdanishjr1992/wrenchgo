// src/ui/theme-context.tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { lightColors, darkColors, spacing, radius, createText } from "./theme";

type ThemeMode = "light" | "dark";

type ThemeContextType = {
  mode: ThemeMode;
  colors: typeof lightColors;
  text: ReturnType<typeof createText>;
  spacing: typeof spacing;
  radius: typeof radius;
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

  /**
   * Apply mode to local state immediately, then persist best-effort.
   */
  const applyMode = useCallback(
    async (newMode: ThemeMode, userId?: string | null) => {
      setModeState(newMode);

      const uid = userId ?? currentUserId;
      if (!uid) return;

      // Persist locally (best effort)
      try {
        await AsyncStorage.setItem(storageKey(uid), newMode);
      } catch (err) {
        console.warn("Failed to save theme to AsyncStorage:", err);
      }

      // Persist remotely (best effort)
      try {
        await supabase.from("profiles").update({ theme_preference: newMode }).eq("id", uid);
      } catch (err) {
        console.warn("Failed to save theme to Supabase:", err);
      }
    },
    [currentUserId]
  );

  /**
   * Load theme for a given user:
   * 1) Supabase profiles.theme_preference
   * 2) AsyncStorage theme:<userId>
   * 3) System theme
   * 4) light
   */
  const loadUserTheme = useCallback(async (userId: string) => {
    if (!userId) {
      setCurrentUserId(null);
      setModeState(getSystemMode());
      return;
    }

    setCurrentUserId(userId);

    // 1) Supabase
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("theme_preference")
        .eq("id", userId)
        .single();

      const pref = data?.theme_preference;
      if (!error && isThemeMode(pref)) {
        setModeState(pref);
        // cache for next boot
        try {
          await AsyncStorage.setItem(storageKey(userId), pref);
        } catch {}
        return;
      }
    } catch (err) {
      console.warn("Failed to load theme from Supabase:", err);
    }

    // 2) AsyncStorage
    try {
      const stored = await AsyncStorage.getItem(storageKey(userId));
      if (isThemeMode(stored)) {
        setModeState(stored);
        return;
      }
    } catch (err) {
      console.warn("Failed to load theme from AsyncStorage:", err);
    }

    // 3) System fallback
    setModeState(getSystemMode());
  }, []);

  /**
   * Init: load from current session. Also listen to auth changes.
   */
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

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

  if (!isInitialized) return null;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
