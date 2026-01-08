import React, { useCallback, useState, useEffect } from "react";
import { View, Text, ScrollView, ActivityIndicator, Share, Pressable, RefreshControl } from "react-native";
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
  formatPromoCredits,
} from "@/src/lib/promos";
import type { PromoCreditsBalance, MyInvitation } from "@/src/types/promos";

export default function InviteScreen() {
  const router = useRouter();
  const { colors, text, spacing } = useTheme();
  const card = createCard(colors);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [credits, setCredits] = useState<PromoCreditsBalance | null>(null);
  const [invitations, setInvitations] = useState<MyInvitation[]>([]);
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [code, balance, invites] = await Promise.all([
        getOrCreateInviteCode(),
        getPromoCreditsBalance(),
        getMyInvitations(),
      ]);
      setInviteCode(code);
      setCredits(balance);
      setInvitations(invites);
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
        message: `Join WrenchGo and get mobile mechanic service! Use my invite code: ${inviteCode}\n\nDownload the app: https://wrenchgoapp.com`,
      });
    } catch (error) {
      console.error("Error sharing:", error);
    }
  }, [inviteCode]);

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
                      {credits.feeless_credits} Free Platform Fee{credits.feeless_credits > 1 ? "s" : ""}
                    </Text>
                    <Text style={text.muted}>Waives entire $15 platform fee</Text>
                  </View>
                </View>
              )}
              {credits.feeoff5_credits > 0 && (
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
                      {credits.feeoff5_credits} x $5 Off Credits
                    </Text>
                    <Text style={text.muted}>$5 off platform fee each</Text>
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
                <Text style={[text.body, { fontWeight: "700" }]}>They sign up & book</Text>
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
                  Invite a customer: 1 free platform fee{"\n"}
                  Invite a mechanic: 5 x $5 off credits
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