import { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { createCard } from "../../../src/ui/styles";
import React from "react";

type QuoteType = "diagnostic_only" | "range" | "fixed" | "inspection_required";

type Quote = {
  id: string;
  price_cents: number | null;
  estimated_hours: number | null;
  notes: string | null;
  status: "pending" | "accepted" | "declined" | "withdrawn" | "expired";
  created_at: string;
};

type Job = {
  id: string;
  title: string;
  customer_id: string;
  vehicle: {
    year: number;
    make: string;
    model: string;
  } | null;
  customer: {
    full_name: string | null;
    phone: string | null;
  } | null;
};

export default function QuoteSent() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { colors, text, spacing, radius } = useTheme();
  const card = useMemo(() => createCard(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [job, setJob] = useState<Job | null>(null);

  useEffect(() => {
    loadQuoteAndJob();
  }, [params.id]);

  const loadQuoteAndJob = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: quoteData, error: quoteError } = await supabase
        .from("quotes")
        .select("*")
        .eq("job_id", params.id)
        .eq("mechanic_id", userData.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (quoteError) throw quoteError;
      setQuote(quoteData);

      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select(
          `
          id,
          title,
          customer_id,
          vehicle:vehicles(year, make, model),
          customer:profiles!jobs_customer_id_fkey(full_name, phone)
        `
        )
        .eq("id", params.id)
        .single();

      if (jobError) throw jobError;
      setJob(jobData);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to load quote");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const getPriceDisplay = () => {
    if (!quote) return "";
    if (quote.price_cents) {
      return `$${(quote.price_cents / 100).toFixed(0)}`;
    }
    return "Price TBD";
  };

  const handleCall = () => {
    if (job?.customer?.phone) {
      Linking.openURL(`tel:${job.customer.phone}`);
    } else {
      Alert.alert("No phone number", "Customer phone number not available");
    }
  };

  const handleBackToJobs = () => {
    router.replace("/(mechanic)/(tabs)/leads" as any);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!quote || !job) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={text.body}>Quote not found</Text>
      </View>
    );
  }

  const vehicleText = job.vehicle
    ? `${job.vehicle.year} ${job.vehicle.make} ${job.vehicle.model}`
    : "Vehicle";
  const customerName = job.customer?.full_name || "Customer";
  const isAccepted = quote.status === "accepted";

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          title: isAccepted ? "Quote Accepted" : "Quote Sent",
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
          headerShadowVisible: false,
          headerBackVisible: true,
          headerRight: () => (
            <Pressable
              onPress={() => router.push("/(mechanic)/(tabs)/leads" as any)}
              style={{ marginRight: 4 }}
            >
              <Text style={{ ...text.body, fontSize: 15, color: colors.textPrimary }}>
                Close
              </Text>
            </Pressable>
          ),
        }}
      />

      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        {isAccepted ? (
          <View
            style={[
              card,
              {
                padding: spacing.lg,
                backgroundColor: "#10b981" + "15",
                borderLeftWidth: 4,
                borderLeftColor: "#10b981",
              },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
                marginBottom: spacing.xs,
              }}
            >
              <Ionicons name="checkmark-circle" size={24} color="#10b981" />
              <Text style={{ ...text.body, fontWeight: "700", fontSize: 18, color: "#10b981" }}>
                Quote Accepted!
              </Text>
            </View>
            <Text style={{ ...text.body, fontSize: 14 }}>
              The customer has accepted your quote. Contact them to coordinate arrival.
            </Text>
          </View>
        ) : (
          <View
            style={[
              card,
              {
                padding: spacing.lg,
                backgroundColor: colors.accent + "15",
                borderLeftWidth: 4,
                borderLeftColor: colors.accent,
              },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
                marginBottom: spacing.xs,
              }}
            >
              <Ionicons name="checkmark-circle" size={24} color={colors.accent} />
              <Text style={{ ...text.body, fontWeight: "700", fontSize: 18 }}>Quote sent to customer</Text>
            </View>
            <Text style={{ ...text.body, fontSize: 14 }}>
              You'll be notified if they accept your quote
            </Text>
          </View>
        )}

        <View style={[card, { padding: spacing.lg, gap: spacing.md }]}>
          <Text style={{ ...text.body, fontWeight: "700", fontSize: 18 }}>Your Quote</Text>

          <View style={{ gap: spacing.sm }}>
            <View>
              <Text style={{ ...text.muted, fontSize: 13 }}>Vehicle</Text>
              <Text style={{ ...text.body, fontSize: 15, marginTop: 2 }}>
                {vehicleText} • {job.title}
              </Text>
            </View>

            <View>
              <Text style={{ ...text.muted, fontSize: 13 }}>Price</Text>
              <Text style={{ ...text.body, fontSize: 20, fontWeight: "700", marginTop: 2 }}>
                {getPriceDisplay()}
              </Text>
            </View>

            {quote.estimated_hours && (
              <View>
                <Text style={{ ...text.muted, fontSize: 13 }}>Estimated time</Text>
                <Text style={{ ...text.body, fontSize: 15, marginTop: 2 }}>
                  {quote.estimated_hours} hours
                </Text>
              </View>
            )}

            {quote.notes && (
              <View>
                <Text style={{ ...text.muted, fontSize: 13 }}>Notes</Text>
                <Text style={{ ...text.body, fontSize: 15, marginTop: 2 }}>
                  {quote.notes}
                </Text>
              </View>
            )}

            <View>
              <Text style={{ ...text.muted, fontSize: 13 }}>Status</Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 4,
                }}
              >
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 4,
                    backgroundColor: isAccepted ? "#10b981" + "20" : colors.accent + "20",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: isAccepted ? "#10b981" : colors.accent,
                    }}
                  >
                    {quote.status.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {!isAccepted && (
          <View style={[card, { padding: spacing.lg, gap: spacing.sm }]}>
            <Text style={{ ...text.body, fontWeight: "700", fontSize: 16 }}>What happens next</Text>

            <View style={{ gap: spacing.xs }}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.xs }}>
                <Text style={{ ...text.body, fontSize: 14 }}>•</Text>
                <Text style={{ ...text.body, fontSize: 14, flex: 1 }}>
                  Customer is reviewing quotes now
                </Text>
              </View>

              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.xs }}>
                <Text style={{ ...text.body, fontSize: 14 }}>•</Text>
                <Text style={{ ...text.body, fontSize: 14, flex: 1 }}>
                  You'll get a notification if accepted
                </Text>
              </View>

              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.xs }}>
                <Text style={{ ...text.body, fontSize: 14 }}>•</Text>
                <Text style={{ ...text.body, fontSize: 14, flex: 1 }}>
                  Quote expires in 24 hours if no response
                </Text>
              </View>
            </View>
          </View>
        )}

        {isAccepted && (
          <View style={[card, { padding: spacing.lg, gap: spacing.md }]}>
            <Text style={{ ...text.body, fontWeight: "700", fontSize: 18 }}>Customer</Text>

            <View style={{ gap: spacing.sm }}>
              <View>
                <Text style={{ ...text.muted, fontSize: 13 }}>Name</Text>
                <Text style={{ ...text.body, fontSize: 16, marginTop: 2 }}>{customerName}</Text>
              </View>

              {job.customer?.phone && (
                <View>
                  <Text style={{ ...text.muted, fontSize: 13 }}>Phone</Text>
                  <Text style={{ ...text.body, fontSize: 16, marginTop: 2 }}>{job.customer.phone}</Text>
                </View>
              )}
            </View>

            <Pressable
              onPress={handleCall}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 12,
                borderRadius: radius.md,
                backgroundColor: colors.accent,
                marginTop: spacing.xs,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Ionicons name="call" size={18} color="#000" />
              <Text style={{ fontWeight: "700", fontSize: 15, color: "#000" }}>Call Customer</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={handleBackToJobs}
          style={({ pressed }) => ({
            backgroundColor: colors.accent,
            paddingVertical: 18,
            borderRadius: radius.lg,
            alignItems: "center",
            marginTop: spacing.md,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ fontWeight: "900", fontSize: 17, color: "#000", letterSpacing: 0.5 }}>
            Back to Jobs
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
