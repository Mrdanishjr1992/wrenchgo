import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useStripe } from "@stripe/stripe-react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { supabase } from "@/src/lib/supabase";
import TermsModal from "@/components/legal/TermsModal";

export default function PaymentScreen() {
  const params = useLocalSearchParams();
  const jobId = params.jobId as string;
  const quoteId = params.quoteId as string | undefined;

  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [job, setJob] = useState<any>(null);
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showTerms, setShowTerms] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const [platformFeeCents, setPlatformFeeCents] = useState<number>(1500);

  // Scheduling (calendar + double-booking): the customer chooses a requested start time.
  // We write jobs.scheduled_at before accepting the quote so contracts/booking windows
  // are created against the correct time.
  const [scheduledAt, setScheduledAt] = useState<Date>(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2);
    d.setMinutes(0, 0, 0);
    return d;
  });
  const [showDateTimePicker, setShowDateTimePicker] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;
        if (!user) {
          router.replace("/sign-in");
          return;
        }

        const { data: jobData, error: jobError } = await supabase
          .from("jobs")
          .select("*, vehicles(*)")
          .eq("id", jobId)
          .single();

        if (jobError) throw jobError;
        setJob(jobData);

        // Grab the quote we were sent here with (preferred), otherwise fall back to the job's accepted quote.
        const quoteQuery = supabase
          .from("quotes")
          .select(`
            *,
            mechanic_profiles(
              id,
              full_name,
              rating_avg,
              rating_count
            )
          `)
          .eq("job_id", jobId);

        if (quoteId) {
          quoteQuery.eq("id", quoteId);
        } else if (jobData?.accepted_quote_id) {
          quoteQuery.eq("id", jobData.accepted_quote_id);
        }

        const { data: quoteData, error: quoteError } = await quoteQuery.single();
        if (quoteError) throw quoteError;
        setQuote(quoteData);

        // Try to compute platform fee from DB helper (falls back server-side if pricing missing)
        if (quoteData?.price_cents != null) {
          const { data: feeCents, error: feeErr } = await supabase.rpc("get_platform_fee", {
            p_quote_price_cents: quoteData.price_cents,
          });
          if (!feeErr && typeof feeCents === "number") {
            setPlatformFeeCents(feeCents);
          }
        }

        // Check acknowledgement status
        const { data: ackData, error: ackError } = await supabase
          .from("job_acknowledgements")
          .select("id")
          .eq("job_id", jobId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!ackError && ackData) {
          setAcknowledged(true);
        }
      } catch (e: any) {
        setError(e?.message ?? "Failed to load payment details");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [jobId, quoteId]);

  const subtotalCents = useMemo(() => {
    const v = quote?.price_cents;
    return typeof v === "number" ? v : 0;
  }, [quote]);

  const totalCents = useMemo(() => subtotalCents + platformFeeCents, [subtotalCents, platformFeeCents]);

  const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const handleAcknowledge = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/sign-in");
        return;
      }

      const { error: ackError } = await supabase.rpc("accept_job_acknowledgement", {
        p_job_id: jobId,
        p_role: "customer",
        p_ack_version: "2025.01",
        p_ack_text: "Customer acknowledges terms",
        p_user_agent: "mobile",
      });

      if (ackError) throw ackError;

      setAcknowledged(true);
      Alert.alert("Acknowledged", "Thanks — you can now authorize payment to book this job.");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to save acknowledgement");
    }
  };

  const handleAuthorizePayment = async () => {
    try {
      setProcessing(true);
      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/sign-in");
        return;
      }

      if (!acknowledged) {
        Alert.alert(
          "Acknowledgement required",
          "Please acknowledge the platform terms before authorizing payment.",
        );
        return;
      }

      if (!quote?.id) {
        Alert.alert("Missing quote", "We couldn't find the quote for this job.");
        return;
      }

      // Ensure payment method is set up BEFORE we accept the quote.
      // Otherwise we'd reserve the mechanic without the ability to authorize funds.
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("stripe_customer_id, payment_method_status")
        .eq("id", user.id)
        .single();

      if (profileErr) throw profileErr;
      if (!profile?.stripe_customer_id || profile?.payment_method_status !== "active") {
        Alert.alert(
          "Payment method required",
          "Please set up a payment method first. You'll only be charged when the job is complete (escrow).",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Set up payment", onPress: () => router.push("/payment-setup") },
          ],
        );
        return;
      }

      // 1) Accept the quote + create contract
      const { data: contractResult, error: contractError } = await supabase.rpc(
        "accept_quote_and_create_contract",
        {
          p_quote_id: quote.id,
          p_customer_id: user.id,
        },
      );

      if (contractError) throw contractError;
      if (!contractResult?.success) {
        throw new Error(contractResult?.message || "Failed to accept quote");
      }

      const contractId = contractResult.contract_id as string | undefined;
      if (!contractId) {
        throw new Error("Contract was not created (missing contract_id)");
      }

      // 2) Create an escrow PaymentIntent + ephemeral key for Stripe PaymentSheet
      const { data: piRes, error: piErr } = await supabase.functions.invoke("create-payment-intent", {
        body: { contract_id: contractId },
      });

      if (piErr) throw piErr;
      if (!piRes?.paymentIntent || !piRes?.ephemeralKey || !piRes?.customer) {
        throw new Error(piRes?.error || "Failed to initialize payment");
      }

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: "WrenchGo",
        customerId: piRes.customer,
        customerEphemeralKeySecret: piRes.ephemeralKey,
        paymentIntentClientSecret: piRes.paymentIntent,
        // Needed for 3DS / bank redirects on mobile.
        returnURL: "wrenchgo://stripe-redirect",
        allowsDelayedPaymentMethods: false,
      });

      if (initError) {
        throw new Error(initError.message);
      }

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        // User cancelled is not a fatal error; keep them on this screen.
        throw new Error(presentError.message);
      }

      // 3) Confirm authorization server-side (verifies Stripe status == requires_capture)
      const { data: confirmRes, error: confirmErr } = await supabase.functions.invoke(
        "confirm-contract-payment",
        { body: { contract_id: contractId } },
      );

      if (confirmErr) throw confirmErr;
      if (!confirmRes?.success) {
        throw new Error(confirmRes?.error || "Payment authorization failed");
      }

      Alert.alert(
        "Booked!",
        "Your payment is authorized (escrow) and will be captured when the job is complete.",
        [{ text: "OK", onPress: () => router.replace(`/job/${jobId}`) }],
      );
    } catch (e: any) {
      const msg = e?.message ?? "Payment authorization failed";
      setError(msg);
      Alert.alert("Payment error", msg);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Loading payment details...</Text>
      </View>
    );
  }

  if (error && !job && !quote) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle" size={48} color="#FF6B6B" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#1a1a1a", "#2d2d2d"]} style={styles.background}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Ionicons name="shield-checkmark" size={32} color="#4CAF50" />
            <Text style={styles.title}>Secure Booking (Escrow)</Text>
            <Text style={styles.subtitle}>Authorize now. Capture happens when the job is done.</Text>
          </View>

          {!!job && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Job Details</Text>
              <Text style={styles.jobTitle}>{job.title}</Text>
              <Text style={styles.jobDescription}>{job.description}</Text>
              {job.vehicles && (
                <View style={styles.vehicleInfo}>
                  <Ionicons name="car" size={16} color="#999" />
                  <Text style={styles.vehicleText}>
                    {job.vehicles.year} {job.vehicles.make} {job.vehicles.model}
                  </Text>
                </View>
              )}
            </View>
          )}

          {!!quote && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quote Summary</Text>
              <View style={styles.quoteCard}>
                <View style={styles.mechanicInfo}>
                  <Text style={styles.mechanicName}>{quote.mechanic_profiles?.full_name}</Text>
                  <View style={styles.ratingContainer}>
                    <Ionicons name="star" size={14} color="#FFD700" />
                    <Text style={styles.ratingText}>
                      {quote.mechanic_profiles?.rating_avg?.toFixed(1) || "New"} ({
                        quote.mechanic_profiles?.rating_count || 0
                      })
                    </Text>
                  </View>
                </View>

                <View style={styles.priceBreakdown}>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Labor</Text>
                    <Text style={styles.priceValue}>{formatCents(subtotalCents)}</Text>
                  </View>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Platform fee</Text>
                    <Text style={styles.priceValue}>{formatCents(platformFeeCents)}</Text>
                  </View>
                  <View style={styles.separator} />
                  <View style={styles.priceRow}>
                    <Text style={styles.totalLabel}>Total authorized</Text>
                    <Text style={styles.totalValue}>{formatCents(totalCents)}</Text>
                  </View>
                </View>

                <View style={styles.escrowNote}>
                  <Ionicons name="information-circle" size={16} color="#4CAF50" />
                  <Text style={styles.escrowNoteText}>
                    Funds are authorized now and held securely. Final charge happens only after completion.
                  </Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Required Acknowledgement</Text>
            <Text style={styles.termsText}>
              Before booking, please acknowledge the platform terms.
            </Text>

            {!acknowledged ? (
              <TouchableOpacity style={styles.ackButton} onPress={() => setShowTerms(true)}>
                <Ionicons name="document-text" size={20} color="#FFFFFF" />
                <Text style={styles.ackButtonText}>Review & Acknowledge</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.acknowledgedContainer}>
                <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                <Text style={styles.acknowledgedText}>Acknowledged</Text>
              </View>
            )}
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color="#FF6B6B" />
              <Text style={styles.errorMessage}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.payButton, (!acknowledged || processing) && styles.disabledButton]}
            onPress={handleAuthorizePayment}
            disabled={!acknowledged || processing}
          >
            {processing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="lock-closed" size={20} color="#FFFFFF" />
                <Text style={styles.payButtonText}>Authorize Payment & Book</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#999" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        </ScrollView>

        <TermsModal
          visible={showTerms}
          onClose={() => setShowTerms(false)}
          onAccept={async () => {
            setShowTerms(false);
            await handleAcknowledge();
          }}
          role="customer"
        />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
    paddingTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginTop: 10,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 15,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  jobDescription: {
    fontSize: 14,
    color: "#CCC",
    lineHeight: 20,
    marginBottom: 10,
  },
  vehicleInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  vehicleText: {
    fontSize: 14,
    color: "#999",
  },
  quoteCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  mechanicInfo: {
    marginBottom: 20,
  },
  mechanicName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 5,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  ratingText: {
    fontSize: 14,
    color: "#999",
  },
  priceBreakdown: {
    marginBottom: 15,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: "#CCC",
  },
  priceValue: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  separator: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginVertical: 10,
  },
  totalLabel: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  totalValue: {
    fontSize: 16,
    color: "#4CAF50",
    fontWeight: "700",
  },
  escrowNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(76, 175, 80, 0.1)",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(76, 175, 80, 0.2)",
  },
  escrowNoteText: {
    flex: 1,
    fontSize: 12,
    color: "#4CAF50",
    lineHeight: 16,
  },
  termsText: {
    fontSize: 14,
    color: "#CCC",
    lineHeight: 20,
    marginBottom: 15,
  },
  ackButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  ackButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  acknowledgedContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  acknowledgedText: {
    fontSize: 16,
    color: "#4CAF50",
    fontWeight: "600",
  },
  payButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#4CAF50",
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 15,
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  disabledButton: {
    opacity: 0.5,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  backButtonText: {
    fontSize: 14,
    color: "#999",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 107, 107, 0.1)",
    padding: 12,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 107, 107, 0.2)",
  },
  errorMessage: {
    flex: 1,
    fontSize: 14,
    color: "#FF6B6B",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    padding: 20,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: "#FFFFFF",
  },
  errorText: {
    marginTop: 15,
    fontSize: 16,
    color: "#FF6B6B",
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
