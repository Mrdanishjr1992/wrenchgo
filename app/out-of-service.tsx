import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "@/src/lib/supabase";
import { validateLocationByZip, type ServiceAreaStatus } from "@/src/lib/service-area";
import OutOfServiceArea from "@/src/components/OutOfServiceArea";
import { useTheme } from "@/src/ui/theme-context";

type UserType = "customer" | "mechanic";

export default function OutOfServiceScreen() {
  const router = useRouter();
  const { colors, spacing, radius, text } = useTheme();

  const [loading, setLoading] = useState(true);
  const [zip, setZip] = useState<string | null>(null);
  const [userType, setUserType] = useState<UserType>("customer");
  const [status, setStatus] = useState<ServiceAreaStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const boundaryStatus = useMemo<"inside" | "near_boundary" | "outside">(() => {
    const b = status?.boundaryStatus;
    if (b === "inside" || b === "near_boundary" || b === "outside") return b;
    // Treat future rings as outside for UI purposes.
    return "outside";
  }, [status?.boundaryStatus]);

  const refresh = useCallback(async () => {
    setError(null);
    setLoading(true);

    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (authErr) {
      setError(authErr.message);
      setLoading(false);
      return;
    }

    if (!authData.user) {
      router.replace("/sign-in");
      return;
    }

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("service_zip, role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileErr) {
      setError(profileErr.message);
      setLoading(false);
      return;
    }

    const role = (profile?.role as string | null) ?? "customer";
    setUserType(role === "mechanic" ? "mechanic" : "customer");

    const serviceZip = profile?.service_zip ?? null;
    setZip(serviceZip);

    if (serviceZip) {
      const s = await validateLocationByZip(serviceZip);
      setStatus(s);
    } else {
      setStatus(null);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: "Service Area" }} />

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={{ marginTop: spacing.md, color: colors.textSecondary }}>Loading…</Text>
        </View>
      ) : (
        <View style={{ flex: 1, padding: spacing.lg }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md }}>
            <Ionicons name="alert-circle" size={22} color={colors.accent} />
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>You're not in an active hub yet</Text>
          </View>

          {error ? (
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: radius.md,
                padding: spacing.md,
                marginBottom: spacing.md,
              }}
            >
              <Text style={{ color: colors.error, fontWeight: "600" }}>Error</Text>
              <Text style={{ color: colors.textSecondary, marginTop: 4 }}>{error}</Text>
            </View>
          ) : null}

          {!zip ? (
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: radius.md,
                padding: spacing.lg,
                gap: spacing.md,
              }}
            >
              <Text style={{ color: colors.textSecondary }}>
                Please set a ZIP code so we can assign you to the nearest service hub (or add you to the waitlist if we're
                not live in your area yet).
              </Text>

              <Pressable
                onPress={() => router.replace("/service-area")}
                style={{
                  backgroundColor: colors.accent,
                  borderRadius: radius.md,
                  paddingVertical: spacing.md,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "white", fontWeight: "700" }}>Set Service Area</Text>
              </Pressable>

              <Pressable
                onPress={refresh}
                style={{
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  paddingVertical: spacing.md,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>Retry</Text>
              </Pressable>
            </View>
          ) : status && status.allowed ? (
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: radius.md,
                padding: spacing.lg,
                gap: spacing.md,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>Good news — you're in range.</Text>
              <Text style={{ color: colors.textSecondary }}>{status.message}</Text>

              <Pressable
                onPress={() => router.replace("/")}
                style={{
                  backgroundColor: colors.accent,
                  borderRadius: radius.md,
                  paddingVertical: spacing.md,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "white", fontWeight: "700" }}>Continue</Text>
              </Pressable>

              <Pressable
                onPress={() => router.replace("/service-area")}
                style={{
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  paddingVertical: spacing.md,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>Change ZIP</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: spacing.lg }}>
              {status?.boundaryStatus === "future_ring" ? (
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: radius.md,
                    padding: spacing.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700" }}>We’re expanding soon</Text>
                  <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
                    Your ZIP is near a future expansion ring. Join the waitlist and we’ll notify you as soon as your hub is
                    live.
                  </Text>
                </View>
              ) : null}

              <OutOfServiceArea
                zip={zip}
                distanceMiles={status?.distanceMiles ?? null}
                nearestHub={status?.hubName ?? null}
                boundaryStatus={boundaryStatus}
                userType={userType}
                onRetry={() => router.replace("/service-area")}
              />

              <Pressable
                onPress={() => router.push("/hubs")}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>View hubs & coverage map</Text>
                  <Text style={{ color: colors.textSecondary, marginTop: 2 }}>See each hub’s service radius and counts.</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </Pressable>

              <Pressable
                onPress={refresh}
                style={{
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  paddingVertical: spacing.md,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>Refresh</Text>
              </Pressable>
            </View>
          )}

          <Text style={{ marginTop: spacing.lg, color: colors.textSecondary, fontSize: 12, lineHeight: 16 }}>
            Tip: If you just changed your ZIP, hit “Refresh” after updating to ensure your hub assignment is updated.
          </Text>
        </View>
      )}
    </View>
  );
}
