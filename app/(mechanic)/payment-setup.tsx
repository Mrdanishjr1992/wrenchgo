import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useStripe } from "@stripe/stripe-react-native";
import { supabase } from "../../src/lib/supabase";
import { useTheme } from "../../src/ui/theme-context";
import { spacing } from "../../src/ui/theme";

export default function MechanicPaymentSetup() {
  const { colors } = useTheme();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  
  const [loading, setLoading] = useState(false);
  const [hasPaymentMethod, setHasPaymentMethod] = useState<boolean | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<any>(null);

  const text = {
    h2: { fontSize: 22, fontWeight: "900" as const, color: colors.textPrimary },
    h3: { fontSize: 18, fontWeight: "800" as const, color: colors.textPrimary },
    body: { fontSize: 16, fontWeight: "600" as const, color: colors.textPrimary },
    muted: { fontSize: 14, fontWeight: "500" as const, color: colors.textMuted },
  };

  useEffect(() => {
    checkPaymentStatus();
  }, []);

  const checkPaymentStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/(auth)/sign-in");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("payment_method_status")
        .eq("id", session.user.id)
        .single();

      setHasPaymentMethod(profile?.payment_method_status === 'active');

      if (profile?.payment_method_status === 'active') {
        const { data: pm } = await supabase
          .from("customer_payment_methods")
          .select("card_brand, card_last4, card_exp_month, card_exp_year")
          .eq("customer_id", session.user.id)
          .eq("is_default", true)
          .maybeSingle();
        setPaymentMethod(pm);
      }
    } catch (e) {
      console.error("Error checking payment status:", e);
    }
  };

  const setupPaymentMethod = useCallback(async () => {
    try {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert("Error", "Please sign in to add a payment method");
        return;
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/customer-setup-payment-method`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to setup payment method");
      }

      const { error: initError } = await initPaymentSheet({
        setupIntentClientSecret: data.clientSecret,
        merchantDisplayName: "WrenchGo",
        customerId: data.customerId,
        returnURL: "wrenchgo://mechanic/payment-setup",
      });

      if (initError) {
        throw new Error(initError.message);
      }

      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code !== "Canceled") {
          throw new Error(presentError.message);
        }
        return;
      }

      const setupIntentId = data.clientSecret.split('_secret_')[0];
      await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/customer-save-payment-method`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "",
          },
          body: JSON.stringify({ setupIntentId }),
        }
      );

      Alert.alert("Success", "Payment method added successfully", [
        {
          text: "OK",
          onPress: () => {
            if (params.returnTo) {
              router.replace(params.returnTo as any);
            } else {
              router.back();
            }
          },
        },
      ]);
    } catch (error: any) {
      console.error("Payment setup error:", error);
      Alert.alert("Error", error.message || "Failed to setup payment method");
    } finally {
      setLoading(false);
    }
  }, [initPaymentSheet, presentPaymentSheet, params.returnTo]);

  const handleLearnMore = () => {
    router.push("/app-info");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: spacing.lg,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: spacing.md }}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ ...text.h3, flex: 1 }}>Payment Method</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: spacing.xl,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: colors.accent + "20",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: spacing.lg,
            }}
          >
            <Ionicons name="card-outline" size={40} color={colors.accent} />
          </View>

          {hasPaymentMethod && paymentMethod ? (
            <>
              <Text style={{ ...text.h2, textAlign: "center", marginBottom: spacing.sm }}>
                Payment Method Active
              </Text>
              <Text style={{ ...text.muted, textAlign: "center", marginBottom: spacing.lg }}>
                {paymentMethod.card_brand?.toUpperCase()} •••• {paymentMethod.card_last4}
              </Text>
              <Text style={{ ...text.muted, textAlign: "center" }}>
                Expires {paymentMethod.card_exp_month}/{paymentMethod.card_exp_year}
              </Text>
            </>
          ) : (
            <>
              <Text style={{ ...text.h2, textAlign: "center", marginBottom: spacing.sm }}>
                Payment Method Required
              </Text>
              <Text style={{ ...text.muted, textAlign: "center", marginBottom: spacing.lg, lineHeight: 22 }}>
                To accept jobs and send quotes on WrenchGo, please add a payment method. This ensures smooth transactions for platform fees.
              </Text>
            </>
          )}
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <TouchableOpacity
            onPress={setupPaymentMethod}
            disabled={loading}
            style={{
              backgroundColor: colors.accent,
              padding: spacing.lg,
              borderRadius: 12,
              alignItems: "center",
              marginBottom: spacing.md,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={{ color: "#000", fontSize: 16, fontWeight: "900" }}>
                {hasPaymentMethod ? "Update Payment Method" : "Add Payment Method"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLearnMore}
            style={{
              padding: spacing.lg,
              borderRadius: 12,
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>
              Learn more about WrenchGo
            </Text>
          </TouchableOpacity>

          {!hasPaymentMethod && (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                padding: spacing.lg,
                alignItems: "center",
                marginTop: spacing.sm,
              }}
            >
              <Text style={{ color: colors.textMuted, fontSize: 14, fontWeight: "600" }}>
                Not now
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ marginTop: spacing.xl, padding: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.sm }}>
            <Ionicons name="shield-checkmark" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
            <Text style={{ ...text.body, flex: 1 }}>Secure payments via Stripe</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.sm }}>
            <Ionicons name="lock-closed" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
            <Text style={{ ...text.body, flex: 1 }}>Your card details are encrypted</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="checkmark-circle" size={20} color={colors.accent} style={{ marginRight: spacing.sm }} />
            <Text style={{ ...text.body, flex: 1 }}>Platform fees deducted automatically</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}