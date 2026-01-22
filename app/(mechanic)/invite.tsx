import React, { useCallback, useState, useEffect } from "react";
import { View, Text, ScrollView, ActivityIndicator, Share, Pressable, RefreshControl, TextInput, Alert } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { setStringAsync } from "expo-clipboard";
import { useTheme } from "@/src/ui/theme-context";
import { createCard } from "@/src/ui/styles";
import { AppButton } from "@/src/ui/components/AppButton";
import {
  getOrCreateInviteCode,
  getPromoCreditsBalance,
  getMyInvitations,
  acceptInvitation,
  hasUsedReferral,
} from "@/src/lib/promos";
import type { PromoCreditsBalance, MyInvitation } from "@/src/types/promos";

export default function MechanicInviteScreen() {
  const router = useRouter();
  const { colors, text, spacing } = useTheme();
  const card = createCard(colors);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [credits, setCredits] = useState<PromoCreditsBalance | null>(null);
  const [invitations, setInvitations] = useState<MyInvitation[]>([]);
  const [copied, setCopied] = useState(false);
  const [referralInput, setReferralInput] = useState("");
  const [applyingReferral, setApplyingReferral] = useState(false);
  const [hasUsedReferralCode, setHasUsedReferralCode] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [code, balance, invites, referralUsed] = await Promise.all([
        getOrCreateInviteCode(),
        getPromoCreditsBalance(),
        getMyInvitations(),
        hasUsedReferral(),
      ]);
      setInviteCode(code);
      setCredits(balance);
      setInvitations(invites);
      setHasUsedReferralCode(referralUsed);
    } catch (error) {
      console.error("Error loading invite data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleCopyCode = useCallback(async () => {
    if (!inviteCode) return;
    await setStringAsync(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [inviteCode]);

  const handleShare = useCallback(async () => {
    if (!inviteCode) return;
    try {
      await Share.share({
        message: `Join WrenchGo as a mobile mechanic or customer! Use my invite code: ${inviteCode}\n\nDownload the app: https://wrenchgoapp.com`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  }, [inviteCode]);

  const handleApplyReferral = useCallback(async () => {
    if (!referralInput.trim() || hasUsedReferralCode) return;
    setApplyingReferral(true);
    try {
      const result = await acceptInvitation(referralInput.trim().toUpperCase());
      if (result.success) {
        Alert.alert("Success!", "Referral code applied! The person who invited you has been rewarded.");
        setReferralInput("");
        setHasUsedReferralCode(true);
      } else {
        Alert.alert("Error", result.error || "Failed to apply referral code");
      }
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to apply referral code");
    } finally {
      setApplyingReferral(false);
    }
  }, [referralInput, hasUsedReferralCode]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          title: "Invite & Earn",
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
        }}
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <View style={[card, { padding: spacing.lg }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
            <Ionicons name="gift" size={28} color={colors.accent} />
            <Text style={[text.title, { marginLeft: spacing.sm }]}>Your Referral Credits</Text>
          </View>

          {credits && credits.total_credits > 0 ? (
            <View style={{ gap: spacing.sm }}>
              {credits.feeless_credits > 0 && (
                <View style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: spacing.md,
                  backgroundColor: "#10B98115",
                  borderRadius: 8,
                }}>
                  <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                  <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                    <Text style={[text.body, { fontWeight: "700" }]}>
                      {credits.feeless_credits} Free Commission{credits.feeless_credits > 1 ? "s" : ""}
                    </Text>
                    <Text style={text.muted}>Waives commission on next job</Text>
                  </View>
                </View>
              )}
              {credits.feeless3_credits > 0 && (
                <View style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: spacing.md,
                  backgroundColor: colors.accent + "15",
                  borderRadius: 8,
                }}>
                  <Ionicons name="pricetag" size={24} color={colors.accent} />
                  <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                    <Text style={[text.body, { fontWeight: "700" }]}>
                      {credits.feeless3_credits} x $3 Off Credits
                    </Text>
                    <Text style={text.muted}>$3 off commission each</Text>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <View style={{ alignItems: "center", padding: spacing.lg }}>
              <Ionicons name="gift-outline" size={48} color={colors.textMuted} />
              <Text style={[text.body, { color: colors.textMuted, marginTop: spacing.sm, textAlign: "center" }]}>
                No credits yet. Invite friends to earn rewards!
              </Text>
            </View>
          )}
        </View>

        <View style={[card, { padding: spacing.lg }]}>
          <Text style={[text.title, { marginBottom: spacing.sm }]}>Your Invite Code</Text>
          <Text style={[text.muted, { marginBottom: spacing.md }]}>
            Share this code with friends. When they complete their first paid job, you earn credits!
          </Text>

          {inviteCode ? (
            <>
              <Pressable
                onPress={handleCopyCode}
                style={({ pressed }) => [
                  {
                    padding: spacing.lg,
                    backgroundColor: colors.surface,
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: colors.accent,
                    borderStyle: "dashed",
                    alignItems: "center",
                    marginBottom: spacing.md,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={{ fontSize: 28, fontWeight: "900", letterSpacing: 4, color: colors.accent }}>
                  {inviteCode}
                </Text>
                <Text style={[text.muted, { marginTop: spacing.xs }]}>
                  {copied ? "Copied!" : "Tap to copy"}
                </Text>
              </Pressable>

              <AppButton
                title="Share Invite Link"
                variant="primary"
                onPress={handleShare}
              />
            </>
          ) : (
            <Text style={text.muted}>Unable to generate invite code</Text>
          )}
        </View>

        {!hasUsedReferralCode && (
          <View style={[card, { padding: spacing.lg }]}>
            <Text style={[text.title, { marginBottom: spacing.sm }]}>Enter Referral Code (One-Time Only)</Text>
            <Text style={[text.muted, { marginBottom: spacing.md }]}>
              Have a friend's code? Enter it below. This cannot be changed later.
            </Text>

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <TextInput
                style={{
                  flex: 1,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 8,
                  padding: spacing.md,
                  color: colors.textPrimary,
                  fontSize: 16,
                  fontWeight: "600",
                  letterSpacing: 2,
                  textTransform: "uppercase",
                }}
                placeholder="Enter code"
                placeholderTextColor={colors.textMuted}
                value={referralInput}
                onChangeText={setReferralInput}
                autoCapitalize="characters"
                maxLength={8}
              />
              <AppButton
                title={applyingReferral ? "..." : "Apply"}
                variant="primary"
                onPress={handleApplyReferral}
                disabled={!referralInput.trim() || applyingReferral}
                style={{ paddingHorizontal: spacing.lg }}
              />
            </View>
          </View>
        )}

        <View style={[card, { padding: spacing.lg }]}>
          <Text style={[text.title, { marginBottom: spacing.sm }]}>How It Works</Text>
          
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              <View style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: colors.accent,
                alignItems: "center",
                justifyContent: "center",
                marginRight: spacing.sm,
              }}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>1</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[text.body, { fontWeight: "700" }]}>Share your code</Text>
                <Text style={text.muted}>Send your invite code to friends</Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              <View style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: colors.accent,
                alignItems: "center",
                justifyContent: "center",
                marginRight: spacing.sm,
              }}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>2</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[text.body, { fontWeight: "700" }]}>They sign up & complete a job</Text>
                <Text style={text.muted}>Your friend joins and completes their first paid job</Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
              <View style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: colors.accent,
                alignItems: "center",
                justifyContent: "center",
                marginRight: spacing.sm,
              }}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>3</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[text.body, { fontWeight: "700" }]}>You earn credits</Text>
                <Text style={text.muted}>
                  Invite a customer: 1 job fee waived{"\n"}
                  Invite a mechanic: 3 job fees waived
                </Text>
              </View>
            </View>
          </View>
        </View>

        {invitations.length > 0 && (
          <View style={[card, { padding: spacing.lg }]}>
            <Text style={[text.title, { marginBottom: spacing.md }]}>Your Invites ({invitations.length})</Text>
            
            <View style={{ gap: spacing.sm }}>
              {invitations.map((invite) => (
                <View
                  key={invite.invited_id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: spacing.md,
                    backgroundColor: colors.surface,
                    borderRadius: 8,
                  }}
                >
                  <View style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: colors.accent + "20",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: spacing.sm,
                  }}>
                    <Ionicons
                      name={invite.invited_role === "mechanic" ? "construct" : "person"}
                      size={20}
                      color={colors.accent}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[text.body, { fontWeight: "600" }]}>{invite.invited_name}</Text>
                    <Text style={text.muted}>
                      {invite.invited_role === "mechanic" ? "Mechanic" : "Customer"}
                    </Text>
                  </View>
                  {invite.award_granted ? (
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                      <Text style={[text.muted, { marginLeft: 4, color: "#10B981" }]}>Earned</Text>
                    </View>
                  ) : (
                    <Text style={text.muted}>Pending</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}