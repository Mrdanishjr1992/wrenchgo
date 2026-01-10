import React, { useCallback, useState, useEffect } from "react";
import { View, Text, ScrollView, ActivityIndicator, Alert, TextInput, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useStripe } from "@stripe/stripe-react-native";
import { supabase } from "@/src/lib/supabase";
import { useTheme } from "@/src/ui/theme-context";
import { createCard } from "@/src/ui/styles";
import { AppButton } from "@/src/ui/components/AppButton";
import { acceptQuoteAndCreateContract } from "@/src/lib/job-contract";
import { notifyUser } from "@/src/lib/notify";
import { getDisplayTitle } from "@/src/lib/format-symptom";
import { previewPromoDiscount, getPromoDiscountDescription, acceptInvitation } from "@/src/lib/promos";
import { validatePromotion } from "@/src/lib/payments";
import type { PromoDiscountPreview } from "@/src/types/promos";

const PLATFORM_FEE_CENTS = 1500;

type Job = {
  id: string;
  customer_id: string;
  title: string;
  status: string;
};

type Quote = {
  id: string;
  job_id: string;
  mechanic_id: string;
  price_cents: number;
  status: string;
  accepted_at: string | null;
};

type AppliedPromo = {
  code: string;
  discountCents: number;
  discountType: string;
  promoId: string;
};

export default function JobPayment() {
  const { jobId, quoteId } = useLocalSearchParams<{ jobId: string; quoteId?: string }>();
  const router = useRouter();
  const { colors, text, spacing } = useTheme();
  const card = createCard(colors);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState<Job | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [processing, setProcessing] = useState(false);
  const [promoPreview, setPromoPreview] = useState<PromoDiscountPreview | null>(null);

  const [promoCode, setPromoCode] = useState("");
  const [promoValidating, setPromoValidating] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);

  const loadPaymentInfo = useCallback(async () => {
    if (!jobId) return;

    try {
      setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      if (!userId) {
        router.replace("/(auth)/sign-in");
        return;
      }

      const { data: existingContract } = await supabase
        .from("job_contracts")
        .select("id")
        .eq("job_id", jobId)
        .maybeSingle();

      if (existingContract) {
        Alert.alert("Already Paid", "Payment has already been completed for this job.");
        router.replace(`/(customer)/job/${jobId}` as any);
        return;
      }

      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select("id, customer_id, title, status")
        .eq("id", jobId)
        .eq("customer_id", userId)
        .maybeSingle();

      if (jobError || !jobData) {
        console.error("Error loading job:", jobError);
        Alert.alert("Error", "Failed to load job details.");
        router.back();
        return;
      }

      setJob(jobData);

      let quoteQuery = supabase
        .from("quotes")
        .select("id, job_id, mechanic_id, price_cents, status, created_at")
        .eq("job_id", jobId);

      if (quoteId) {
        quoteQuery = quoteQuery.eq("id", quoteId);
      } else {
        quoteQuery = quoteQuery
          .in("status", ["accepted", "pending"])
          .not("price_cents", "is", null)
          .order("status", { ascending: false })
          .order("created_at", { ascending: false });
      }

      const { data: quoteData, error: quoteError } = await quoteQuery.limit(1).maybeSingle();

      if (quoteError) {
        console.error("Error loading quote:", quoteError);
      }

      if (!quoteData || quoteData.price_cents == null) {
        Alert.alert("No Quote Available", "There is no quote ready for payment.");
        router.back();
        return;
      }

      setQuote(quoteData as any);

      const preview = await previewPromoDiscount(PLATFORM_FEE_CENTS);
      setPromoPreview(preview);
    } catch (error: any) {
      console.error("Payment info load error:", error);
      Alert.alert("Error", error?.message ?? "Failed to load payment information.");
    } finally {
      setLoading(false);
    }
  }, [jobId, quoteId, router]);

  useFocusEffect(
    useCallback(() => {
      loadPaymentInfo();
    }, [loadPaymentInfo])
  );

  const handleApplyPromo = useCallback(async () => {
    if (!promoCode.trim() || !quote) return;

    setPromoValidating(true);
    setPromoError(null);

    const code = promoCode.trim().toUpperCase();

    try {
      // First try the promotions table
      const result = await validatePromotion(code, quote.price_cents + PLATFORM_FEE_CENTS);

      if (result.valid) {
        setAppliedPromo({
          code,
          discountCents: result.discountCents || 0,
          discountType: result.promotion?.type || "fixed_discount",
          promoId: result.promotion?.code || "",
        });
        setPromoError(null);
        return;
      }

      // If not a promo code, try as an invite code
      const inviteResult = await acceptInvitation(code);

      if (inviteResult.success) {
        // Refresh promo preview to show the new credit
        const newPreview = await previewPromoDiscount(PLATFORM_FEE_CENTS);
        setPromoPreview(newPreview);
        setPromoCode("");
        setPromoError(null);
        Alert.alert(
          "Invite Code Applied!",
          "Referral credit has been added to your account and will be applied to this payment."
        );
        return;
      }

      // Neither worked
      setPromoError(result.reason || inviteResult.error || "Invalid code");
      setAppliedPromo(null);
    } catch (error: any) {
      console.error("Promo validation error:", error);
      setPromoError(error?.message || "Failed to validate code");
      setAppliedPromo(null);
    } finally {
      setPromoValidating(false);
    }
  }, [promoCode, quote]);

  const handleRemovePromo = useCallback(() => {
    setAppliedPromo(null);
    setPromoCode("");
    setPromoError(null);
  }, []);

  const handlePayment = useCallback(async () => {
    if (!quote || !job) return;

    try {
      setProcessing(true);

      const contractResult = await acceptQuoteAndCreateContract(quote.id);

      if (!contractResult.success) {
        throw new Error(contractResult.error || "Failed to create contract");
      }

      notifyUser({
        userId: quote.mechanic_id,
        title: "Payment Secured",
        body: `Customer has committed payment for "${job.title}". You're cleared to depart.`,
        type: "payment_secured",
        entityType: "job",
        entityId: jobId as any,
      }).catch(() => {});

      Alert.alert(
        "Payment Complete",
        "Your booking is confirmed! The mechanic has been notified.",
        [
          {
            text: "View Job",
            onPress: () => router.replace(`/(customer)/job/${jobId}` as any),
          },
        ]
      );
    } catch (error: any) {
      console.error("Payment error:", error);
      Alert.alert("Payment Error", error?.message ?? "Failed to process payment.");
    } finally {
      setProcessing(false);
    }
  }, [quote, job, jobId, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!job) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg }}>
        <Text style={text.title}>Job not found</Text>
        <AppButton title="Go Back" variant="outline" onPress={() => router.back()} style={{ marginTop: spacing.lg }} />
      </View>
    );
  }

  if (!quote) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg }}>
        <View style={[card, { padding: spacing.lg, alignItems: "center" }]}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
          <Text style={[text.title, { marginTop: spacing.md, textAlign: "center" }]}>No Accepted Quote</Text>
          <Text style={[text.body, { marginTop: spacing.sm, textAlign: "center" }]}>
            You need to accept a quote before making a payment.
          </Text>
        </View>
        <AppButton title="Go Back" variant="outline" onPress={() => router.back()} style={{ marginTop: spacing.lg }} />
      </View>
    );
  }

  const platformFeeCents = PLATFORM_FEE_CENTS;
  const referralDiscountCents = promoPreview?.has_discount ? promoPreview.discount_cents : 0;
  const promoDiscountCents = appliedPromo?.discountCents || 0;
  const totalDiscountCents = referralDiscountCents + promoDiscountCents;
  const finalPlatformFeeCents = Math.max(0, platformFeeCents - totalDiscountCents);
  const totalCents = quote.price_cents + finalPlatformFeeCents;
  const totalDollars = (totalCents / 100).toFixed(2);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={[card, { padding: spacing.lg, marginBottom: spacing.lg }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
            <Ionicons name="card" size={32} color={colors.accent} />
            <Text style={[text.title, { marginLeft: spacing.md }]}>Complete Payment</Text>
          </View>

          <View style={{ marginBottom: spacing.lg }}>
            <Text style={[text.muted, { marginBottom: spacing.xs }]}>Job:</Text>
            <Text style={text.body}>{getDisplayTitle(job.title)}</Text>
          </View>

          <View style={{ marginBottom: spacing.lg }}>
            <Text style={[text.muted, { marginBottom: spacing.sm, fontWeight: "600" }]}>Promo Code</Text>
            {appliedPromo ? (
              <View style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#10B98115",
                borderRadius: 8,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: "#10B98140",
              }}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={[text.body, { flex: 1, marginLeft: spacing.sm, color: "#10B981", fontWeight: "600" }]}>
                  {appliedPromo.code} applied (-${(appliedPromo.discountCents / 100).toFixed(2)})
                </Text>
                <Pressable onPress={handleRemovePromo} hitSlop={8}>
                  <Ionicons name="close-circle" size={24} color={colors.textMuted} />
                </Pressable>
              </View>
            ) : (
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <TextInput
                  style={{
                    flex: 1,
                    backgroundColor: colors.surface,
                    borderRadius: 8,
                    padding: spacing.md,
                    borderWidth: 1,
                    borderColor: promoError ? "#EF4444" : colors.border,
                    color: colors.textPrimary,
                    fontSize: 16,
                  }}
                  placeholder="Enter promo code"
                  placeholderTextColor={colors.textMuted}
                  value={promoCode}
                  onChangeText={setPromoCode}
                  autoCapitalize="characters"
                  editable={!promoValidating}
                />
                <Pressable
                  onPress={handleApplyPromo}
                  disabled={promoValidating || !promoCode.trim()}
                  style={({ pressed }) => ({
                    backgroundColor: promoValidating || !promoCode.trim() ? colors.border : colors.accent,
                    borderRadius: 8,
                    paddingHorizontal: spacing.lg,
                    justifyContent: "center",
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  {promoValidating ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={{ fontWeight: "700", color: "#000" }}>Apply</Text>
                  )}
                </Pressable>
              </View>
            )}
            {promoError && (
              <Text style={{ color: "#EF4444", fontSize: 12, marginTop: spacing.xs }}>{promoError}</Text>
            )}
          </View>

          <View style={{ 
            padding: spacing.lg, 
            backgroundColor: colors.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: spacing.lg,
            gap: spacing.sm,
          }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={text.body}>Service</Text>
              <Text style={text.body}>${(quote.price_cents / 100).toFixed(2)}</Text>
            </View>
            
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={text.body}>Platform Fee</Text>
              <Text style={text.body}>${(platformFeeCents / 100).toFixed(2)}</Text>
            </View>

            {promoPreview?.has_discount && referralDiscountCents > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <Text style={[text.body, { color: "#10B981" }]}>
                    {getPromoDiscountDescription(promoPreview.credit_type!)}
                  </Text>
                </View>
                <Text style={[text.body, { color: "#10B981" }]}>
                  -${(referralDiscountCents / 100).toFixed(2)}
                </Text>
              </View>
            )}

            {appliedPromo && promoDiscountCents > 0 && (
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={[text.body, { color: "#10B981" }]}>
                  Promo: {appliedPromo.code}
                </Text>
                <Text style={[text.body, { color: "#10B981" }]}>
                  -${(promoDiscountCents / 100).toFixed(2)}
                </Text>
              </View>
            )}

            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.xs }} />

            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={[text.body, { fontWeight: "700" }]}>Total</Text>
              <Text style={[text.title, { color: colors.accent }]}>${totalDollars}</Text>
            </View>
          </View>

          {(promoPreview?.has_discount || appliedPromo) && (
            <View style={{
              padding: spacing.md,
              backgroundColor: "#10B98115",
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "#10B98140",
              marginBottom: spacing.lg,
              flexDirection: "row",
              alignItems: "center",
            }}>
              <Ionicons name="gift" size={20} color="#10B981" style={{ marginRight: spacing.sm }} />
              <Text style={[text.body, { color: "#10B981", flex: 1 }]}>
                You're saving ${(totalDiscountCents / 100).toFixed(2)}!
              </Text>
            </View>
          )}

          <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={text.muted}>Quote Status:</Text>
              <Text style={[text.body, { color: quote.status === "accepted" ? "#10B981" : colors.accent }]}>
                {quote.status === "accepted" ? "Accepted" : "Ready to Accept"}
              </Text>
            </View>
          </View>
        </View>

        <View style={[card, { padding: spacing.lg, marginBottom: spacing.lg }]}>
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <Ionicons name="shield-checkmark" size={24} color={colors.accent} style={{ marginRight: spacing.sm }} />
            <Text style={[text.body, { flex: 1, color: colors.textSecondary }]}>
              Your payment is processed securely through Stripe. The mechanic will be notified immediately after payment.
            </Text>
          </View>
        </View>

        <AppButton
          title={processing ? "Processing..." : `Pay $${totalDollars}`}
          variant="primary"
          onPress={handlePayment}
          disabled={processing}
          style={{ marginBottom: spacing.md }}
        />

        <AppButton title="Go Back" variant="outline" onPress={() => router.back()} />
      </ScrollView>
    </View>
  );
}
