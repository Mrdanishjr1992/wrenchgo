import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  RefreshControl,
  Dimensions,
  FlatList,
  Animated as RNAnimated,
  Modal,
  TextInput,
  Image,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  FadeIn,
  FadeInDown,
  SlideInRight,
} from "react-native-reanimated";
import { supabase } from "../../../src/lib/supabase";
import { useTheme } from "../../../src/ui/theme-context";
import { CancelQuoteModal } from "../../../src/components/CancelQuoteModal";
import { UserProfileCard } from "../../../components/profile/UserProfileCardQuotes";
import { ProfileCardModal } from "../../../components/profile/ProfileCardModal";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { JobProgressTracker, InvoiceView, JobActions } from "../../../components/job";
import { getContractWithDetails, subscribeToJobProgress, subscribeToJobContract } from "../../../src/lib/job-contract";
import { getInvoiceByJobId, subscribeToLineItems } from "../../../src/lib/invoice";
import type { JobContract, JobProgress, Invoice } from "../../../src/types/job-lifecycle";
import { getDisplayTitle } from "../../../src/lib/format-symptom";
import { canFileComeback, customerFileComeback, getDisputeForJob, ComebackEligibility, Dispute } from "../../../src/lib/disputes";
import { DISPUTE_DEFAULTS } from "../../../src/constants/disputes";
import * as Crypto from "expo-crypto";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const QUOTE_CARD_WIDTH = SCREEN_WIDTH - 48;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type JobIntake = {
  symptom?: { key: string; label: string };
  answers?: Record<string, string>;
  context?: {
    can_move?: string;
    location_type?: string;
    location?: string;
    time_preference?: string;
    mileage?: string | null;
    additional_details?: string;
  };
  vehicle?: {
    id: string;
    year: number;
    make: string;
    model: string;
    nickname?: string | null;
  };
};

type Quote = {
  id: string;
  job_id: string;
  mechanic_id: string;
  status: "pending" | "accepted" | "declined" | "expired" | "withdrawn";
  price_cents: number | null;
  estimated_hours: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  accepted_at?: string | null;
  cancel_reason?: string | null;
  cancel_note?: string | null;
  cancellation_fee_cents?: number | null;
  mechanic?: { full_name: string | null } | null;
};

type Job = {
  id: string;
  title: string;
  description: string | null;
  preferred_time: string | null;
  status: string;
  created_at: string;
  accepted_mechanic_id: string | null;
  accepted_mechanic: { full_name: string | null } | null;
  vehicle_id: string | null;
  vehicle: { year: number; make: string; model: string } | null;
  canceled_at: string | null;
  canceled_by: string | null;
};

const parseJobIntake = (description: string | null): JobIntake | null => {
  if (!description) return null;
  try {
    return JSON.parse(description) as JobIntake;
  } catch {
    return null;
  }
};

const money = (cents: number | null) => (cents == null ? "—" : `$${(cents / 100).toFixed(0)}`);

const fmtRelative = (iso: string) => {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
};

const normalizeCanMove = (raw?: string) => {
  const s = (raw || "").trim();
  const l = s.toLowerCase();
  if (!s) return "Not sure";
  if (l === "yes") return "Yes";
  if (l === "no") return "No";
  if (l === "not sure" || l === "unsure") return "Not sure";
  return s;
};

const normalizeLocation = (raw?: string) => {
  const s = (raw || "").trim();
  const l = s.toLowerCase();
  if (!s) return "Not specified";
  if (l === "driveway") return "Driveway";
  if (l === "parking_lot" || l === "parking lot") return "Parking lot";
  if (l === "roadside") return "Roadside";
  return s;
};

export default function CustomerJobDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { colors, spacing, radius, shadows, withAlpha } = useTheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const [job, setJob] = useState<Job | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [expandedQuote, setExpandedQuote] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState<string | null>(null);
  const [showDeclineModal, setShowDeclineModal] = useState<string | null>(null);
  const [selectedMechanicId, setSelectedMechanicId] = useState<string | null>(null);
  const [questionMap, setQuestionMap] = useState<Record<string, string>>({});
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [invoiceExpanded, setInvoiceExpanded] = useState(false);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);

  const [contract, setContract] = useState<JobContract | null>(null);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  const [comebackEligibility, setComebackEligibility] = useState<ComebackEligibility | null>(null);
  const [existingDispute, setExistingDispute] = useState<Dispute | null>(null);
  const [showReportIssueModal, setShowReportIssueModal] = useState(false);
  const [issueDescription, setIssueDescription] = useState('');
  const [desiredResolution, setDesiredResolution] = useState('');
  const [submittingIssue, setSubmittingIssue] = useState(false);
  const [evidencePhotos, setEvidencePhotos] = useState<string[]>([]);

  const MAX_EVIDENCE_PHOTOS = 5;

  const scrollX = useRef(new RNAnimated.Value(0)).current;
  const detailsChevronRotation = useSharedValue(0);

  useEffect(() => {
    detailsChevronRotation.value = withTiming(detailsExpanded ? 180 : 0, { duration: 200 });
  }, [detailsExpanded]);

  const detailsChevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${detailsChevronRotation.value}deg` }],
  }));

  const statusConfig = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "searching") return { color: colors.info, icon: "search" as const, label: "Searching" };
    if (s === "quoted") return { color: colors.warning, icon: "pricetags" as const, label: "Quoted" };
    if (s === "accepted") return { color: colors.primary, icon: "checkmark-circle" as const, label: "Accepted" };
    if (s === "work_in_progress") return { color: colors.primary, icon: "construct" as const, label: "In Progress" };
    if (s === "completed") return { color: colors.success, icon: "checkmark-done-circle" as const, label: "Completed" };
    if (s === "canceled" || s.includes("canceled")) return { color: colors.error, icon: "close-circle" as const, label: "Canceled" };
    return { color: colors.textMuted, icon: "ellipse" as const, label: status };
  };

  const openChat = useCallback(() => {
    if (!id) return;
    router.push(`/(customer)/messages/${id}` as any);
  }, [id, router]);

  const load = useCallback(async () => {
    try {
      setLoading(true);

      const { data: userData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;

      const customerId = userData.user?.id;
      if (!customerId || !id) return;

      const { data: j, error: jErr } = await supabase
        .from("jobs")
        .select(`id,title,description,preferred_time,status,created_at,accepted_mechanic_id,vehicle_id,canceled_at,canceled_by,vehicle:vehicles(year, make, model)`)
        .eq("id", id)
        .eq("customer_id", customerId)
        .maybeSingle();

      if (jErr) {
        Alert.alert("Error", "Failed to load job details.");
        return;
      }

      if (!j) {
        Alert.alert("Not Found", "Job not found or you don't have access.");
        return;
      }

      setJob(j as any as Job);

      const intake = parseJobIntake(j.description);
      if (intake?.symptom?.key && intake?.answers) {
        const answerKeys = Object.keys(intake.answers);
        if (answerKeys.length > 0) {
          const { data: questions } = await supabase
            .from("symptom_questions")
            .select("question_key, question_text")
            .eq("symptom_key", intake.symptom.key)
            .in("question_key", answerKeys);

          if (questions) {
            const qMap: Record<string, string> = {};
            questions.forEach((q: any) => {
              qMap[q.question_key] = q.question_text;
            });
            setQuestionMap(qMap);
          }
        }
      }

      const { data: q, error: qErr } = await supabase
        .from("quotes")
        .select(`id,job_id,mechanic_id,status,price_cents,estimated_hours,notes,created_at,updated_at,mechanic:profiles!quotes_mechanic_id_fkey(full_name,phone)`)
        .eq("job_id", id)
        .order("created_at", { ascending: false });

      if (qErr) throw qErr;
      setQuotes((q as any as Quote[]) ?? []);

      const lifecycleData = await getContractWithDetails(id);
      setContract(lifecycleData.contract);
      setProgress(lifecycleData.progress);

      if (lifecycleData.contract) {
        const invoiceData = await getInvoiceByJobId(id);
        setInvoice(invoiceData);
      } else {
        setInvoice(null);
      }

      // Check comeback eligibility for completed jobs
      if (j.status === 'completed') {
        try {
          const eligibility = await canFileComeback(id);
          setComebackEligibility(eligibility);

          // Also check for existing dispute
          const dispute = await getDisputeForJob(id);
          setExistingDispute(dispute);
        } catch (err) {
          // Error checking comeback eligibility, continue without it
        }
      }
    } catch (e: any) {
      Alert.alert("Error", "Failed to load job details. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!id || !job?.accepted_mechanic_id) return;

    const progressChannel = subscribeToJobProgress(id, (p) => setProgress(p));
    const contractChannel = subscribeToJobContract(id, async (c) => {
      setContract(c);
      if (c) {
        const invoiceData = await getInvoiceByJobId(id);
        setInvoice(invoiceData);
      }
    });

    let lineItemsChannel: ReturnType<typeof subscribeToLineItems> | null = null;
    if (contract?.id) {
      lineItemsChannel = subscribeToLineItems(contract.id, async () => {
        const invoiceData = await getInvoiceByJobId(id);
        setInvoice(invoiceData);
      });
    }

    return () => {
      supabase.removeChannel(progressChannel);
      supabase.removeChannel(contractChannel);
      if (lineItemsChannel) supabase.removeChannel(lineItemsChannel);
    };
  }, [id, job?.accepted_mechanic_id, contract?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const acceptQuote = async (quoteId: string) => {
    try {
      setBusy(true);
      router.push(`/(customer)/payment/${id}?quoteId=${quoteId}` as any);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to accept quote.");
    } finally {
      setBusy(false);
    }
  };

  const rejectQuote = async (quoteId: string) => {
    Alert.alert("Decline Quote", "Are you sure you want to decline this quote?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Decline",
        style: "destructive",
        onPress: async () => {
          try {
            setBusy(true);
            const { error } = await supabase.from("quotes").update({ status: "declined" }).eq("id", quoteId);
            if (error) throw error;
            await load();
          } catch (e: any) {
            Alert.alert("Error", e?.message ?? "Failed to decline quote.");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const pickEvidencePhoto = async () => {
    if (evidencePhotos.length >= MAX_EVIDENCE_PHOTOS) {
      Alert.alert('Limit Reached', `You can add up to ${MAX_EVIDENCE_PHOTOS} photos.`);
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_EVIDENCE_PHOTOS - evidencePhotos.length,
      quality: 0.8,
    });
    if (!result.canceled && result.assets) {
      const newUris = result.assets.map(a => a.uri);
      setEvidencePhotos(prev => [...prev, ...newUris].slice(0, MAX_EVIDENCE_PHOTOS));
    }
  };

  const takeEvidencePhoto = async () => {
    if (evidencePhotos.length >= MAX_EVIDENCE_PHOTOS) {
      Alert.alert('Limit Reached', `You can add up to ${MAX_EVIDENCE_PHOTOS} photos.`);
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setEvidencePhotos(prev => [...prev, result.assets[0].uri].slice(0, MAX_EVIDENCE_PHOTOS));
    }
  };

  const removeEvidencePhoto = (index: number) => {
    setEvidencePhotos(prev => prev.filter((_, i) => i !== index));
  };

  const uploadEvidencePhotos = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const uri of evidencePhotos) {
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        const uuid = Crypto.randomUUID();
        const path = `${id}/customer/dispute_evidence/${uuid}.jpg`;
        const { error } = await supabase.storage.from('job-media').upload(path, blob, { contentType: 'image/jpeg' });
        if (!error) {
          const { data: urlData } = supabase.storage.from('job-media').getPublicUrl(path);
          urls.push(urlData.publicUrl);
        }
      } catch (e) {
        console.error('Failed to upload evidence photo:', e);
      }
    }
    return urls;
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <View style={{ alignItems: "center" }}>
          <View style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: withAlpha(colors.primary, 0.1),
            alignItems: "center",
            justifyContent: "center",
            marginBottom: spacing.lg,
          }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
          <Text style={{ fontSize: 16, fontWeight: "600", color: colors.textSecondary }}>Loading job details...</Text>
        </View>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: spacing.xl }}>
        <View style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: withAlpha(colors.error, 0.1),
          alignItems: "center",
          justifyContent: "center",
          marginBottom: spacing.lg,
        }}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.error} />
        </View>
        <Text style={{ fontSize: 20, fontWeight: "700", color: colors.textPrimary, marginBottom: spacing.sm }}>Job not found</Text>
        <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: "center", marginBottom: spacing.lg }}>
          This job may have been removed or you don't have access.
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => ({
            backgroundColor: colors.primary,
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.md,
            borderRadius: radius.lg,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ color: colors.buttonText, fontWeight: "700", fontSize: 15 }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const intake = parseJobIntake(job.description);
  const acceptedQuote = quotes.find((q) => q.status === "accepted" || q.mechanic_id === job.accepted_mechanic_id);
  const pendingQuotes = quotes.filter((q) => q.status === "pending");
  const effectiveStatus = job.accepted_mechanic_id ? job.status : quotes.some((q) => q.status === "pending") ? "quoted" : job.status;
  const statusInfo = statusConfig(effectiveStatus);

  const QuoteCard = ({ quote, index }: { quote: Quote; index: number }) => {
    const isAccepted = quote.status === "accepted" || quote.mechanic_id === job.accepted_mechanic_id;
    const canAccept = quote.status === "pending" && quote.price_cents != null && !job.accepted_mechanic_id;
    const needsPayment = quote.status === "accepted" && !contract && quote.price_cents != null;
    const isExpanded = expandedQuote === quote.id;

    const inputRange = [(index - 1) * (QUOTE_CARD_WIDTH + 16), index * (QUOTE_CARD_WIDTH + 16), (index + 1) * (QUOTE_CARD_WIDTH + 16)];
    const scale = scrollX.interpolate({ inputRange, outputRange: [0.95, 1, 0.95], extrapolate: "clamp" });
    const cardOpacity = scrollX.interpolate({ inputRange, outputRange: [0.7, 1, 0.7], extrapolate: "clamp" });

    const notes = quote.notes || "";
    const hasDriveFee = notes.toLowerCase().includes("drive fee");
    const hasDiagnosticFee = notes.toLowerCase().includes("diagnostic fee");
    const isRange = notes.toLowerCase().includes("range:");
    const rangeMatch = notes.match(/Range:\s*\$(\d+)\s*-\s*\$(\d+)/i);
    const rangeLow = rangeMatch ? parseInt(rangeMatch[1]) : null;
    const rangeHigh = rangeMatch ? parseInt(rangeMatch[2]) : null;
    const driveFee = hasDriveFee ? 50 : 0;
    const diagnosticFee = hasDiagnosticFee ? 80 : 0;
    const totalFees = driveFee + diagnosticFee;
    const totalCents = quote.price_cents || 0;
    const laborCents = totalCents - totalFees * 100;

    const cleanNotes = notes
      .replace(/Range:\s*\$\d+\s*-\s*\$\d+\s*/gi, "")
      .replace(/Fees included:[\s\S]*$/gi, "")
      .trim();

    return (
      <RNAnimated.View style={{ width: QUOTE_CARD_WIDTH, marginHorizontal: 8, transform: [{ scale }], opacity: cardOpacity }}>
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          overflow: "hidden",
          borderWidth: isAccepted ? 2 : 0,
          borderColor: isAccepted ? colors.primary : "transparent",
          ...shadows.md,
        }}>
          {isAccepted && (
            <View style={{
              backgroundColor: colors.primary,
              paddingVertical: 6,
              paddingHorizontal: 12,
              alignItems: "center",
            }}>
              <Text style={{ color: colors.buttonText, fontSize: 11, fontWeight: "800", letterSpacing: 0.5 }}>
                ACCEPTED
              </Text>
            </View>
          )}

          <View style={{ padding: spacing.lg }}>
            <Pressable
              onPress={() => setSelectedMechanicId(quote.mechanic_id)}
              style={{ marginBottom: spacing.md }}
            >
              <UserProfileCard
                userId={quote.mechanic_id}
                variant="mini"
                context="quote_list"
                onPressViewProfile={() => setSelectedMechanicId(quote.mechanic_id)}
              />
            </Pressable>

            <View style={{
              backgroundColor: withAlpha(colors.primary, 0.06),
              borderRadius: radius.lg,
              padding: spacing.md,
              alignItems: "center",
              marginBottom: spacing.md,
            }}>
              <Text style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4 }}>
                {isRange ? "Price Range" : "Total Price"}
              </Text>
              <Text style={{ fontSize: 36, fontWeight: "900", color: colors.primary, letterSpacing: -1 }}>
                {isRange && rangeLow && rangeHigh ? `$${rangeLow} - $${rangeHigh}` : money(quote.price_cents)}
              </Text>
              {quote.estimated_hours && (
                <View style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 6,
                  backgroundColor: withAlpha(colors.textMuted, 0.1),
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 12,
                }}>
                  <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                  <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: "600" }}>
                    Est. {quote.estimated_hours < 1 ? `${Math.round(quote.estimated_hours * 60)} min` : `${quote.estimated_hours.toFixed(1)} hrs`}
                  </Text>
                </View>
              )}
            </View>

            <Pressable
              onPress={() => setExpandedQuote(isExpanded ? null : quote.id)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: spacing.sm,
                gap: 6,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary }}>
                {isExpanded ? "Hide Breakdown" : "View Breakdown"}
              </Text>
              <Ionicons
                name={isExpanded ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.textSecondary}
              />
            </Pressable>

            {isExpanded && (
              <Animated.View entering={FadeInDown.duration(200)} style={{ marginTop: spacing.sm }}>
                <View style={{
                  backgroundColor: colors.bg,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  gap: 10,
                }}>
                  {isRange && rangeLow !== null && rangeHigh !== null ? (
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: withAlpha(colors.primary, 0.1), alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name="construct-outline" size={14} color={colors.primary} />
                        </View>
                        <Text style={{ fontSize: 14, color: colors.textSecondary }}>Labor (range)</Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: colors.textPrimary }}>${rangeLow - totalFees} - ${rangeHigh - totalFees}</Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: withAlpha(colors.primary, 0.1), alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name="construct-outline" size={14} color={colors.primary} />
                        </View>
                        <Text style={{ fontSize: 14, color: colors.textSecondary }}>Labor</Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: colors.textPrimary }}>${(laborCents / 100).toFixed(0)}</Text>
                    </View>
                  )}
                  {hasDriveFee && (
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: withAlpha(colors.info, 0.1), alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name="car-outline" size={14} color={colors.info} />
                        </View>
                        <Text style={{ fontSize: 14, color: colors.textSecondary }}>Drive fee</Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: colors.textPrimary }}>${driveFee}</Text>
                    </View>
                  )}
                  {hasDiagnosticFee && (
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: withAlpha(colors.warning, 0.1), alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name="search-outline" size={14} color={colors.warning} />
                        </View>
                        <Text style={{ fontSize: 14, color: colors.textSecondary }}>Diagnostic fee</Text>
                      </View>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: colors.textPrimary }}>${diagnosticFee}</Text>
                    </View>
                  )}
                  {(hasDriveFee || hasDiagnosticFee) && (
                    <>
                      <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={{ fontSize: 15, fontWeight: "800", color: colors.textPrimary }}>Total</Text>
                        <Text style={{ fontSize: 15, fontWeight: "800", color: colors.primary }}>
                          {isRange && rangeLow && rangeHigh ? `$${rangeLow} - $${rangeHigh}` : money(quote.price_cents)}
                        </Text>
                      </View>
                    </>
                  )}
                </View>

                {cleanNotes ? (
                  <View style={{
                    backgroundColor: colors.bg,
                    borderRadius: radius.lg,
                    padding: spacing.md,
                    marginTop: spacing.sm,
                  }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <Ionicons name="chatbubble-outline" size={12} color={colors.textMuted} />
                      <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.5 }}>MECHANIC NOTE</Text>
                    </View>
                    <Text style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 20 }}>{cleanNotes}</Text>
                  </View>
                ) : null}
              </Animated.View>
            )}

            {needsPayment ? (
              <Pressable
                onPress={() => router.push(`/(customer)/payment/${id}?quoteId=${quote.id}` as any)}
                disabled={busy}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? withAlpha(colors.primary, 0.9) : colors.primary,
                  paddingVertical: 16,
                  borderRadius: radius.lg,
                  alignItems: "center",
                  marginTop: spacing.md,
                  opacity: busy ? 0.5 : 1,
                  ...shadows.sm,
                })}
              >
                <Text style={{ fontWeight: "800", color: colors.buttonText, fontSize: 16 }}>Proceed to Payment</Text>
              </Pressable>
            ) : canAccept ? (
              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
                <Pressable
                  onPress={() => setShowDeclineModal(quote.id)}
                  disabled={busy}
                  style={({ pressed }) => ({
                    flex: 1,
                    backgroundColor: "transparent",
                    borderWidth: 1.5,
                    borderColor: colors.border,
                    paddingVertical: 14,
                    borderRadius: radius.lg,
                    alignItems: "center",
                    opacity: busy ? 0.5 : pressed ? 0.8 : 1,
                  })}
                >
                  <Text style={{ fontWeight: "700", color: colors.textSecondary, fontSize: 15 }}>Decline</Text>
                </Pressable>
                <Pressable
                  onPress={() => setShowAcceptModal(quote.id)}
                  disabled={busy}
                  style={({ pressed }) => ({
                    flex: 2,
                    backgroundColor: pressed ? withAlpha(colors.primary, 0.9) : colors.primary,
                    paddingVertical: 14,
                    borderRadius: radius.lg,
                    alignItems: "center",
                    opacity: busy ? 0.5 : 1,
                    ...shadows.sm,
                  })}
                >
                  <Text style={{ fontWeight: "800", color: colors.buttonText, fontSize: 15 }}>
                    {busy ? "Processing..." : "Accept Quote"}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <Text style={{ fontSize: 11, color: colors.textMuted, textAlign: "center", marginTop: spacing.sm }}>
              Received {fmtRelative(quote.created_at)}
            </Text>
          </View>
        </View>
      </RNAnimated.View>
    );
  };

  const context = intake?.context;
  const canMoveText = normalizeCanMove(context?.can_move);
  const locationText = normalizeLocation(context?.location_type || context?.location);
  const timeText = context?.time_preference || job.preferred_time || "Flexible";

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: spacing.xl + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{
          backgroundColor: colors.surface,
          paddingTop: insets.top,
          borderBottomLeftRadius: radius.xl,
          borderBottomRightRadius: radius.xl,
          ...shadows.sm,
        }}>
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
              <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace("/(customer)/(tabs)/jobs" as any))}
                hitSlop={12}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                <Text style={{ color: colors.textSecondary, fontWeight: "600", fontSize: 15 }}>Back</Text>
              </Pressable>
            </View>

            <Text style={{
              fontSize: 26,
              fontWeight: "800",
              color: colors.textPrimary,
              marginBottom: spacing.sm,
              letterSpacing: -0.5,
            }}>
              {getDisplayTitle(job.title)}
            </Text>

            {intake?.vehicle && (
              <View style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: spacing.md,
              }}>
                <View style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: withAlpha(colors.primary, 0.1),
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Ionicons name="car-sport" size={14} color={colors.primary} />
                </View>
                <Text style={{ color: colors.textSecondary, fontWeight: "600", fontSize: 14 }}>
                  {intake.vehicle.year} {intake.vehicle.make} {intake.vehicle.model}
                </Text>
              </View>
            )}

            <View style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: withAlpha(statusInfo.color, 0.12),
              alignSelf: "flex-start",
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 20,
            }}>
              <Ionicons name={statusInfo.icon} size={14} color={statusInfo.color} />
              <Text style={{ color: statusInfo.color, fontWeight: "700", fontSize: 12, letterSpacing: 0.3 }}>
                {statusInfo.label.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          {job.accepted_mechanic_id && (
            <Animated.View entering={FadeInDown.delay(100).duration(300)}>
              <Pressable
                onPress={openChat}
                style={({ pressed }) => ({
                  backgroundColor: colors.primary,
                  borderRadius: radius.xl,
                  padding: spacing.lg,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: spacing.md,
                  opacity: pressed ? 0.9 : 1,
                  ...shadows.md,
                })}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <View style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: withAlpha("#000", 0.15),
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <Ionicons name="chatbubbles" size={24} color={colors.buttonText} />
                  </View>
                  <View>
                    <Text style={{ fontWeight: "800", color: colors.buttonText, fontSize: 16 }}>Chat with Mechanic</Text>
                    <Text style={{ color: withAlpha(colors.buttonText, 0.8), fontSize: 13, marginTop: 2 }}>
                      Message your assigned mechanic
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={24} color={colors.buttonText} />
              </Pressable>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(150).duration(300)}>
            <Pressable
              onPress={() => setDetailsExpanded(!detailsExpanded)}
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.xl,
                padding: spacing.lg,
                marginBottom: spacing.md,
                ...shadows.sm,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: withAlpha(colors.primary, 0.1),
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: "700", color: colors.textPrimary }}>Job Details</Text>
                </View>
                <Animated.View style={detailsChevronStyle}>
                  <Ionicons name="chevron-down" size={22} color={colors.textMuted} />
                </Animated.View>
              </View>

              {!detailsExpanded && (
                <Text style={{ color: colors.textMuted, marginTop: spacing.sm, fontSize: 14 }} numberOfLines={1}>
                  {intake?.symptom?.label || "Tap to view details"}
                </Text>
              )}

              {detailsExpanded && intake && (
                <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
                  {intake.symptom?.label && (
                    <View style={{ backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.md }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <Ionicons name="warning-outline" size={12} color={colors.textMuted} />
                        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.5 }}>ISSUE</Text>
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary }}>{intake.symptom.label}</Text>
                    </View>
                  )}

                  {intake.answers && Object.keys(intake.answers).length > 0 && (
                    <View style={{ backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.md, gap: 10 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <Ionicons name="list-outline" size={12} color={colors.textMuted} />
                        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.5 }}>DETAILS</Text>
                      </View>
                      {Object.entries(intake.answers).map(([key, value]) => (
                        <View key={key} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={{ color: colors.textMuted, flex: 1, fontSize: 14 }}>{questionMap[key] || key}</Text>
                          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>{value}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {context && (
                    <View style={{ backgroundColor: colors.bg, borderRadius: radius.lg, padding: spacing.md, gap: 10 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <Ionicons name="information-circle-outline" size={12} color={colors.textMuted} />
                        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.textMuted, letterSpacing: 0.5 }}>CONTEXT</Text>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ color: colors.textMuted, fontSize: 14 }}>Can move vehicle</Text>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>{canMoveText}</Text>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ color: colors.textMuted, fontSize: 14 }}>Location</Text>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>{locationText}</Text>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ color: colors.textMuted, fontSize: 14 }}>Time preference</Text>
                        <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>{timeText}</Text>
                      </View>
                      {context.mileage && (
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                          <Text style={{ color: colors.textMuted, fontSize: 14 }}>Mileage</Text>
                          <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary }}>{context.mileage}</Text>
                        </View>
                      )}
                      {context.additional_details && (
                        <View style={{ marginTop: 4 }}>
                          <Text style={{ color: colors.textMuted, fontSize: 14 }}>Additional details</Text>
                          <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4, lineHeight: 20 }}>{context.additional_details}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              )}
            </Pressable>
          </Animated.View>

          {quotes.length > 0 && !job.accepted_mechanic_id && (
            <Animated.View entering={FadeInDown.delay(200).duration(300)} style={{ marginBottom: spacing.md }}>
              <View style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: spacing.md,
                paddingHorizontal: 4
              }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textPrimary }}>Quotes</Text>
                  <View style={{
                    backgroundColor: colors.primary,
                    borderRadius: 12,
                    paddingHorizontal: 10,
                    paddingVertical: 4
                  }}>
                    <Text style={{ color: colors.buttonText, fontSize: 12, fontWeight: "800" }}>{pendingQuotes.length}</Text>
                  </View>
                </View>
                {pendingQuotes.length > 1 && (
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                    {currentQuoteIndex + 1} of {pendingQuotes.length}
                  </Text>
                )}
              </View>

              <RNAnimated.FlatList
                data={pendingQuotes}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={QUOTE_CARD_WIDTH + 16}
                decelerationRate="fast"
                contentContainerStyle={{ paddingHorizontal: 16 }}
                onScroll={RNAnimated.event(
                  [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                  { useNativeDriver: true }
                )}
                onMomentumScrollEnd={(e) => {
                  const index = Math.round(e.nativeEvent.contentOffset.x / (QUOTE_CARD_WIDTH + 16));
                  setCurrentQuoteIndex(Math.max(0, Math.min(index, pendingQuotes.length - 1)));
                }}
                renderItem={({ item, index }) => <QuoteCard quote={item} index={index} />}
              />

              {pendingQuotes.length > 1 && (
                <View style={{ flexDirection: "row", justifyContent: "center", marginTop: spacing.md, gap: 8 }}>
                  {pendingQuotes.map((_, i) => {
                    const inputRange = [(i - 1) * (QUOTE_CARD_WIDTH + 16), i * (QUOTE_CARD_WIDTH + 16), (i + 1) * (QUOTE_CARD_WIDTH + 16)];
                    const dotWidth = scrollX.interpolate({ inputRange, outputRange: [8, 20, 8], extrapolate: "clamp" });
                    const dotOpacity = scrollX.interpolate({ inputRange, outputRange: [0.3, 1, 0.3], extrapolate: "clamp" });
                    return (
                      <RNAnimated.View
                        key={i}
                        style={{
                          width: dotWidth,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: colors.primary,
                          opacity: dotOpacity,
                        }}
                      />
                    );
                  })}
                </View>
              )}
            </Animated.View>
          )}

          {quotes.length === 0 && !job.accepted_mechanic_id && (
            <Animated.View
              entering={FadeInDown.delay(200).duration(300)}
              style={{
                backgroundColor: colors.surface,
                borderRadius: radius.xl,
                padding: spacing.xl,
                alignItems: "center",
                marginBottom: spacing.md,
                ...shadows.sm,
              }}
            >
              <View style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: withAlpha(colors.primary, 0.1),
                alignItems: "center",
                justifyContent: "center",
                marginBottom: spacing.lg
              }}>
                <Ionicons name="time-outline" size={36} color={colors.primary} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textPrimary, textAlign: "center" }}>
                Waiting for Quotes
              </Text>
              <Text style={{
                color: colors.textMuted,
                textAlign: "center",
                marginTop: spacing.sm,
                fontSize: 14,
                lineHeight: 20,
                paddingHorizontal: spacing.md,
              }}>
                Mechanics are reviewing your request. Quotes will appear here automatically.
              </Text>
            </Animated.View>
          )}

          {job.accepted_mechanic_id && acceptedQuote && (
            <>
              {!contract && (
                <View style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.xl,
                  padding: spacing.lg,
                  marginBottom: spacing.md,
                  ...shadows.sm,
                }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: spacing.md }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: withAlpha(colors.warning, 0.1), alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="card-outline" size={20} color={colors.warning} />
                    </View>
                    <Text style={{ fontSize: 17, fontWeight: "700", color: colors.textPrimary }}>Payment Required</Text>
                  </View>
                  <Text style={{ color: colors.textMuted, marginBottom: spacing.lg, fontSize: 14, lineHeight: 20 }}>
                    Complete payment to confirm your booking and notify the mechanic.
                  </Text>
                  <Pressable
                    onPress={() => router.push(`/(customer)/payment/${id}?quoteId=${acceptedQuote.id}` as any)}
                    style={({ pressed }) => ({
                      backgroundColor: pressed ? withAlpha(colors.primary, 0.9) : colors.primary,
                      paddingVertical: 14,
                      borderRadius: radius.lg,
                      alignItems: "center",
                      ...shadows.sm,
                    })}
                  >
                    <Text style={{ color: colors.buttonText, fontWeight: "700", fontSize: 16 }}>Complete Payment</Text>
                  </Pressable>
                </View>
              )}

              {contract && (
                <View style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.xl,
                  padding: spacing.lg,
                  marginBottom: spacing.md,
                  ...shadows.sm,
                }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: spacing.md }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: withAlpha(colors.primary, 0.1), alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="trending-up-outline" size={20} color={colors.primary} />
                    </View>
                    <Text style={{ fontSize: 17, fontWeight: "700", color: colors.textPrimary }}>Job Progress</Text>
                  </View>
                  <JobProgressTracker progress={progress} status={job.status} role="customer" />
                </View>
              )}

              {contract && job.status !== "completed" && job.status !== "canceled" && (
                <View style={{
                  backgroundColor: colors.surface,
                  borderRadius: radius.xl,
                  padding: spacing.lg,
                  marginBottom: spacing.md,
                  ...shadows.sm,
                }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: spacing.md }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: withAlpha(colors.warning, 0.1), alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="hand-left-outline" size={20} color={colors.warning} />
                    </View>
                    <Text style={{ fontSize: 17, fontWeight: "700", color: colors.textPrimary }}>Actions Required</Text>
                  </View>
                  <JobActions
                    jobId={id}
                    progress={progress}
                    contract={contract}
                    role="customer"
                    onRefresh={load}
                    hasPendingItems={(invoice?.pending_items.length ?? 0) > 0}
                    contractId={contract?.id}
                  />
                </View>
              )}

              {invoice && (
                <Pressable
                  onPress={() => setInvoiceExpanded(!invoiceExpanded)}
                  style={{
                    backgroundColor: colors.surface,
                    borderRadius: radius.xl,
                    padding: spacing.lg,
                    marginBottom: spacing.md,
                    ...shadows.sm,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: withAlpha(colors.success, 0.1), alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="receipt-outline" size={20} color={colors.success} />
                      </View>
                      <Text style={{ fontSize: 17, fontWeight: "700", color: colors.textPrimary }}>Invoice</Text>
                    </View>
                    <Ionicons name={invoiceExpanded ? "chevron-up" : "chevron-down"} size={22} color={colors.textMuted} />
                  </View>

                  {!invoiceExpanded && (() => {
                    const approvedTotal = invoice.approved_items
                      .filter(i => i.item_type !== 'platform_fee')
                      .reduce((sum, i) => sum + i.total_cents, 0);
                    const platformFee = invoice.approved_items.find(i => i.item_type === 'platform_fee')?.total_cents
                      ?? invoice.contract.platform_fee_cents;
                    const promoDiscount = invoice.contract.promo_discount_cents || 0;
                    const totalDue = approvedTotal + platformFee - promoDiscount;
                    const pendingTotal = invoice.pending_items.reduce((sum, i) => sum + i.total_cents, 0);

                    return (
                      <Text style={{ fontSize: 16, color: colors.primary, fontWeight: "800", marginTop: spacing.md }}>
                        Total: ${(totalDue / 100).toFixed(2)}
                        {pendingTotal > 0 && (
                          <Text style={{ color: colors.textMuted, fontWeight: "500" }}>
                            {" "}(+${(pendingTotal / 100).toFixed(2)} pending)
                          </Text>
                        )}
                      </Text>
                    );
                  })()}

                  {invoiceExpanded && (
                    <View style={{ marginTop: spacing.md }}>
                      <InvoiceView
                        invoice={invoice}
                        role="customer"
                        onRefresh={load}
                        showPendingActions={job.status !== "completed" && job.status !== "canceled"}
                        jobId={job.id}
                      />
                    </View>
                  )}
                </Pressable>
              )}

              <View style={{
                backgroundColor: colors.surface,
                borderRadius: radius.xl,
                padding: spacing.lg,
                marginBottom: spacing.md,
                ...shadows.sm,
              }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: spacing.md }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: withAlpha(colors.primary, 0.1), alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="person-outline" size={20} color={colors.primary} />
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: "700", color: colors.textPrimary }}>Your Mechanic</Text>
                </View>

                <UserProfileCard
                  userId={job.accepted_mechanic_id}
                  variant="mini"
                  context="quote_detail"
                  onPressViewProfile={() => setSelectedMechanicId(job.accepted_mechanic_id!)}
                />

                {job.status !== "completed" && job.status !== "canceled" && (
                  <Pressable
                    onPress={() => setShowCancelModal(true)}
                    style={({ pressed }) => ({
                      marginTop: spacing.md,
                      paddingVertical: 14,
                      backgroundColor: "transparent",
                      borderWidth: 1,
                      borderColor: "#EF4444",
                      borderRadius: 12,
                      alignItems: "center",
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text style={{ fontWeight: "700", color: "#EF4444" }}>Cancel Job</Text>
                  </Pressable>
                )}

                {/* Report Issue button for completed jobs */}
                {job.status === "completed" && comebackEligibility && (
                  existingDispute ? (
                    <View style={{
                      marginTop: spacing.md,
                      padding: spacing.md,
                      backgroundColor: "#F59E0B20",
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "#F59E0B",
                    }}>
                      <Text style={{ color: "#F59E0B", fontWeight: "600", marginBottom: 4 }}>
                        Issue Reported
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                        Your issue is being reviewed. We'll contact you with updates.
                      </Text>
                    </View>
                  ) : comebackEligibility.can_file ? (
                    <Pressable
                      onPress={() => setShowReportIssueModal(true)}
                      style={({ pressed }) => ({
                        marginTop: spacing.md,
                        paddingVertical: 14,
                        backgroundColor: "transparent",
                        borderWidth: 1,
                        borderColor: "#F59E0B",
                        borderRadius: 12,
                        alignItems: "center",
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Ionicons name="warning-outline" size={18} color="#F59E0B" />
                        <Text style={{ fontWeight: "700", color: "#F59E0B" }}>Report an Issue</Text>
                      </View>
                      <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                        {comebackEligibility.days_remaining} days left to report
                      </Text>
                    </Pressable>
                  ) : (
                    <View style={{
                      marginTop: spacing.md,
                      padding: spacing.md,
                      backgroundColor: colors.surface,
                      borderRadius: 12,
                    }}>
                      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                        {comebackEligibility.reason === 'Comeback window expired'
                          ? 'The window to report issues has expired.'
                          : comebackEligibility.reason}
                      </Text>
                    </View>
                  )
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {acceptedQuote && job && (
        <CancelQuoteModal
          visible={showCancelModal}
          onClose={() => setShowCancelModal(false)}
          onSuccess={() => {
            setShowCancelModal(false);
            load();
            router.replace("/(customer)/(tabs)/jobs" as any);
          }}
          quoteId={acceptedQuote.id}
          jobId={id}
          acceptedAt={acceptedQuote.accepted_at}
          jobStatus={job.status}
        />
      )}

      {selectedMechanicId && (
        <ProfileCardModal
          visible={!!selectedMechanicId}
          userId={selectedMechanicId}
          onClose={() => setSelectedMechanicId(null)}
          title="Mechanic Profile"
          showReviewsButton={true}
        />
      )}

      {/* Report Issue Modal */}
      <Modal visible={showReportIssueModal} animationType="slide" transparent>
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        }}>
          <View style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: spacing.lg,
            maxHeight: '80%',
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textPrimary }}>Report an Issue</Text>
              <Pressable onPress={() => setShowReportIssueModal(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView>
              <View style={{
                backgroundColor: '#F59E0B20',
                padding: spacing.md,
                borderRadius: 8,
                marginBottom: spacing.lg,
              }}>
                <Text style={{ color: '#F59E0B', fontWeight: '600', marginBottom: 4 }}>
                  What to expect
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  Your mechanic will have 12 hours to respond. If they don't respond, the issue will be escalated to our support team.
                </Text>
              </View>

              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSecondary, marginBottom: spacing.sm }}>
                What's the issue? *
              </Text>
              <TextInput
                value={issueDescription}
                onChangeText={setIssueDescription}
                placeholder="Describe what went wrong..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 8,
                  padding: spacing.md,
                  color: colors.textPrimary,
                  borderWidth: 1,
                  borderColor: colors.border,
                  minHeight: 100,
                  textAlignVertical: 'top',
                  marginBottom: spacing.md,
                }}
              />

              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSecondary, marginBottom: spacing.sm }}>
                What would you like to happen?
              </Text>
              <TextInput
                value={desiredResolution}
                onChangeText={setDesiredResolution}
                placeholder="e.g., Mechanic to fix the issue, partial refund..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={2}
                style={{
                  backgroundColor: colors.background,
                  borderRadius: 8,
                  padding: spacing.md,
                  color: colors.textPrimary,
                  borderWidth: 1,
                  borderColor: colors.border,
                  minHeight: 60,
                  textAlignVertical: 'top',
                  marginBottom: spacing.lg,
                }}
              />

              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSecondary, marginBottom: spacing.sm }}>
                Evidence Photos ({evidencePhotos.length}/{MAX_EVIDENCE_PHOTOS}) - Optional
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.lg }}>
                {evidencePhotos.map((uri, index) => (
                  <View key={index} style={{ position: 'relative', marginRight: 10 }}>
                    <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 8 }} />
                    <TouchableOpacity
                      onPress={() => removeEvidencePhoto(index)}
                      style={{ position: 'absolute', top: -8, right: -8, backgroundColor: '#fff', borderRadius: 12 }}
                    >
                      <Ionicons name="close-circle" size={24} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
                {evidencePhotos.length < MAX_EVIDENCE_PHOTOS && (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      onPress={takeEvidencePhoto}
                      style={{ width: 80, height: 80, borderRadius: 8, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}
                    >
                      <Ionicons name="camera" size={24} color={colors.accent} />
                      <Text style={{ fontSize: 11, marginTop: 4, color: colors.textMuted }}>Camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={pickEvidencePhoto}
                      style={{ width: 80, height: 80, borderRadius: 8, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}
                    >
                      <Ionicons name="images" size={24} color={colors.accent} />
                      <Text style={{ fontSize: 11, marginTop: 4, color: colors.textMuted }}>Library</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>

              <Pressable
                onPress={async () => {
                  if (!issueDescription.trim()) {
                    Alert.alert('Error', 'Please describe the issue');
                    return;
                  }
                  setSubmittingIssue(true);
                  try {
                    let evidenceUrls: string[] | undefined;
                    if (evidencePhotos.length > 0) {
                      evidenceUrls = await uploadEvidencePhotos();
                    }
                    const result = await customerFileComeback(
                      id!,
                      issueDescription,
                      desiredResolution || undefined,
                      evidenceUrls
                    );
                    if (result.success) {
                      Alert.alert(
                        'Issue Reported',
                        'Your issue has been submitted. The mechanic will be notified and has 12 hours to respond.',
                        [{ text: 'OK', onPress: () => {
                          setShowReportIssueModal(false);
                          setIssueDescription('');
                          setDesiredResolution('');
                          setEvidencePhotos([]);
                          load();
                        }}]
                      );
                    } else {
                      Alert.alert('Error', result.error || 'Failed to submit issue');
                    }
                  } catch (error: any) {
                    Alert.alert('Error', error.message);
                  } finally {
                    setSubmittingIssue(false);
                  }
                }}
                disabled={submittingIssue || !issueDescription.trim()}
                style={({ pressed }) => ({
                  backgroundColor: submittingIssue || !issueDescription.trim() ? colors.border : '#F59E0B',
                  padding: spacing.md,
                  borderRadius: 8,
                  alignItems: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                {submittingIssue ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Submit Report</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Accept Quote Confirmation Modal */}
      <Modal visible={!!showAcceptModal} animationType="fade" transparent>
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing.lg,
        }}>
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            padding: spacing.xl,
            width: '100%',
            maxWidth: 340,
            ...shadows.lg,
          }}>
            <View style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: withAlpha(colors.primary, 0.1),
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'center',
              marginBottom: spacing.lg,
            }}>
              <Ionicons name="checkmark-circle" size={32} color={colors.primary} />
            </View>
            <Text style={{
              fontSize: 20,
              fontWeight: '800',
              color: colors.textPrimary,
              textAlign: 'center',
              marginBottom: spacing.sm,
            }}>
              Accept This Quote?
            </Text>
            <Text style={{
              fontSize: 14,
              color: colors.textMuted,
              textAlign: 'center',
              marginBottom: spacing.xl,
              lineHeight: 20,
            }}>
              You'll proceed to payment after accepting. Other quotes will be automatically declined.
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Pressable
                onPress={() => setShowAcceptModal(null)}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: 'transparent',
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  paddingVertical: 14,
                  borderRadius: radius.lg,
                  alignItems: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ fontWeight: '700', color: colors.textSecondary, fontSize: 15 }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (showAcceptModal) {
                    acceptQuote(showAcceptModal);
                    setShowAcceptModal(null);
                  }
                }}
                disabled={busy}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: colors.primary,
                  paddingVertical: 14,
                  borderRadius: radius.lg,
                  alignItems: 'center',
                  opacity: busy ? 0.5 : pressed ? 0.9 : 1,
                  ...shadows.sm,
                })}
              >
                <Text style={{ fontWeight: '800', color: colors.buttonText, fontSize: 15 }}>
                  {busy ? 'Processing...' : 'Accept'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Decline Quote Confirmation Modal */}
      <Modal visible={!!showDeclineModal} animationType="fade" transparent>
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing.lg,
        }}>
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            padding: spacing.xl,
            width: '100%',
            maxWidth: 340,
            ...shadows.lg,
          }}>
            <View style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: withAlpha(colors.error, 0.1),
              alignItems: 'center',
              justifyContent: 'center',
              alignSelf: 'center',
              marginBottom: spacing.lg,
            }}>
              <Ionicons name="close-circle" size={32} color={colors.error} />
            </View>
            <Text style={{
              fontSize: 20,
              fontWeight: '800',
              color: colors.textPrimary,
              textAlign: 'center',
              marginBottom: spacing.sm,
            }}>
              Decline This Quote?
            </Text>
            <Text style={{
              fontSize: 14,
              color: colors.textMuted,
              textAlign: 'center',
              marginBottom: spacing.xl,
              lineHeight: 20,
            }}>
              This action cannot be undone. The mechanic will be notified that you've declined their quote.
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Pressable
                onPress={() => setShowDeclineModal(null)}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: 'transparent',
                  borderWidth: 1.5,
                  borderColor: colors.border,
                  paddingVertical: 14,
                  borderRadius: radius.lg,
                  alignItems: 'center',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ fontWeight: '700', color: colors.textSecondary, fontSize: 15 }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (showDeclineModal) {
                    rejectQuote(showDeclineModal);
                    setShowDeclineModal(null);
                  }
                }}
                disabled={busy}
                style={({ pressed }) => ({
                  flex: 1,
                  backgroundColor: colors.error,
                  paddingVertical: 14,
                  borderRadius: radius.lg,
                  alignItems: 'center',
                  opacity: busy ? 0.5 : pressed ? 0.9 : 1,
                  ...shadows.sm,
                })}
              >
                <Text style={{ fontWeight: '800', color: '#fff', fontSize: 15 }}>
                  {busy ? 'Processing...' : 'Decline'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
