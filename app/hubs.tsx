import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import MapView, { Circle, Marker } from "react-native-maps";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/src/ui/theme-context";
import { getHubPublicStats, type HubPublicStats } from "@/src/lib/hubs-public";
import { supabase } from "@/src/lib/supabase";

const METERS_PER_MILE = 1609.34;

export default function HubsScreen() {
  const router = useRouter();
  const { colors, spacing, text, radius, withAlpha } = useTheme();

  const [loading, setLoading] = useState(true);
  const [hubs, setHubs] = useState<HubPublicStats[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [myHubId, setMyHubId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [hubStats, userRes] = await Promise.all([getHubPublicStats(), supabase.auth.getUser()]);

        if (!mounted) return;

        setHubs(hubStats);

        const userId = userRes.data.user?.id;
        if (userId) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("hub_id")
            .eq("id", userId)
            .maybeSingle();

          if (!mounted) return;

          setMyHubId((profile as any)?.hub_id ?? null);
        }
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message ?? "Unable to load hubs");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const initialRegion = useMemo(() => {
    if (!hubs.length) {
      return {
        latitude: 37.7749,
        longitude: -122.4194,
        latitudeDelta: 0.5,
        longitudeDelta: 0.5,
      };
    }

    const lats = hubs.map((h) => h.lat).filter((n) => Number.isFinite(n));
    const lngs = hubs.map((h) => h.lng).filter((n) => Number.isFinite(n));

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latitude = (minLat + maxLat) / 2;
    const longitude = (minLng + maxLng) / 2;

    // Add padding so pins/circles aren't tight.
    const latitudeDelta = Math.max(0.15, (maxLat - minLat) * 1.4);
    const longitudeDelta = Math.max(0.15, (maxLng - minLng) * 1.4);

    return { latitude, longitude, latitudeDelta, longitudeDelta };
  }, [hubs]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          title: "Hubs",
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={{ padding: spacing.sm }}>
              <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            </Pressable>
          ),
        }}
      />

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : error ? (
        <View style={{ padding: spacing.xl, gap: spacing.md }}>
          <View
            style={{
              backgroundColor: colors.errorBg,
              borderRadius: radius.md,
              padding: spacing.md,
              gap: spacing.sm,
            }}
          >
            <Text style={{ color: colors.error, fontWeight: "700" }}>Couldn’t load hubs</Text>
            <Text style={{ color: colors.error }}>{error}</Text>
          </View>

          <Pressable
            onPress={() => router.replace("/hubs")}
            style={{
              borderRadius: radius.md,
              padding: spacing.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ textAlign: "center", color: colors.textPrimary, fontWeight: "600" }}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={{ height: 320, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <MapView
              style={{ flex: 1 }}
              initialRegion={initialRegion}
              showsUserLocation={false}
              showsMyLocationButton={false}
            >
              {hubs.map((hub) => (
                <React.Fragment key={hub.id}>
                  <Circle
                    center={{ latitude: hub.lat, longitude: hub.lng }}
                    radius={hub.active_radius_miles * METERS_PER_MILE}
                    strokeWidth={1}
                    fillColor={withAlpha(colors.accent, 0.10)}
                    strokeColor={colors.accent}
                  />

                  {/* Max radius as faint outline (optional) */}
                  {hub.max_radius_miles > hub.active_radius_miles ? (
                    <Circle
                      center={{ latitude: hub.lat, longitude: hub.lng }}
                      radius={hub.max_radius_miles * METERS_PER_MILE}
                      strokeWidth={1}
                      fillColor={"transparent"}
                      strokeColor={colors.border}
                    />
                  ) : null}

                  <Marker
                    coordinate={{ latitude: hub.lat, longitude: hub.lng }}
                    title={hub.name}
                    description={`${hub.mechanic_count} mechanics • ${hub.customer_count} customers`}
                  />
                </React.Fragment>
              ))}
            </MapView>
          </View>

          <View style={{ padding: spacing.lg, gap: spacing.sm }}>
            <Text style={text.title}>Coverage & hub stats</Text>
            <Text style={[text.body, { color: colors.textMuted }]}
            >
              Circles show hub coverage (active radius). Counts show registered mechanics/customers in the hub, not exact locations.
            </Text>
          </View>

          <FlatList
            data={hubs}
            keyExtractor={(h) => h.id}
            contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md }}
            renderItem={({ item }) => {
              const isMine = myHubId && item.id === myHubId;
              return (
                <View
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: radius.lg,
                    padding: spacing.lg,
                    borderWidth: 1,
                    borderColor: isMine ? colors.accent : colors.border,
                    gap: spacing.xs,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: "800", fontSize: 16, flex: 1 }} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {isMine ? (
                      <View
                        style={{
                          paddingHorizontal: spacing.sm,
                          paddingVertical: 4,
                          borderRadius: 999,
                          backgroundColor: colors.accent,
                        }}
                      >
                        <Text style={{ color: colors.buttonText, fontWeight: "700", fontSize: 12 }}>Your hub</Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={{ color: colors.textMuted }}>{item.zip}</Text>

                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm }}>
                    <Text style={{ color: colors.textPrimary }}>Active radius: {item.active_radius_miles} mi</Text>
                    <Text style={{ color: colors.textMuted }}>|</Text>
                    <Text style={{ color: colors.textPrimary }}>Mechanics: {item.mechanic_count}</Text>
                    <Text style={{ color: colors.textMuted }}>|</Text>
                    <Text style={{ color: colors.textPrimary }}>Customers: {item.customer_count}</Text>
                  </View>

                  {item.invite_only ? (
                    <Text style={{ marginTop: spacing.sm, color: colors.textMuted }}>Invite-only hub</Text>
                  ) : null}
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={{ padding: spacing.xl, alignItems: "center" }}>
                <Text style={{ color: colors.textMuted }}>No hubs found.</Text>
              </View>
            }
          />
        </View>
      )}
    </View>
  );
}
