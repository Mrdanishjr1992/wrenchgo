import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { Stack, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/src/lib/supabase";
import { useTheme } from "@/src/ui/theme-context";
import { AppButton } from "@/src/ui/components/AppButton";

const VERIFICATION_DURATION_MS = 30000;
const STORAGE_KEY = "id_verification_start_time";

export default function VerifyIdentityScreen() {
  const { colors, text, spacing } = useTheme();
  const router = useRouter();
  const [verifying, setVerifying] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(30);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [completing, setCompleting] = useState(false);
  const [alreadyVerified, setAlreadyVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkVerificationStatus = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          console.log("No user found");
          setLoading(false);
          return;
        }

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("id_verified, id_verified_at")
          .eq("auth_id", userData.user.id)
          .single();

        console.log("Profile verification status:", profile);

        if (error) {
          console.error("Error checking verification status:", error);
        } else if (profile?.id_verified) {
          console.log("User is already verified");
          setAlreadyVerified(true);
        }
      } catch (error) {
        console.error("Error in checkVerificationStatus:", error);
      } finally {
        setLoading(false);
      }
    };

    checkVerificationStatus();
  }, []);

  useEffect(() => {
    const loadStartTime = async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedTime = parseInt(stored, 10);
        const elapsed = Date.now() - parsedTime;
        if (elapsed < VERIFICATION_DURATION_MS) {
          setStartTime(parsedTime);
          setVerifying(true);
          setTimeRemaining(Math.ceil((VERIFICATION_DURATION_MS - elapsed) / 1000));
        } else {
          await AsyncStorage.removeItem(STORAGE_KEY);
        }
      }
    };
    loadStartTime();
  }, []);

  useEffect(() => {
    if (!verifying || !startTime) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.ceil((VERIFICATION_DURATION_MS - elapsed) / 1000);

      if (remaining <= 0) {
        clearInterval(interval);
        completeVerification();
      } else {
        setTimeRemaining(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [verifying, startTime, completeVerification]);

  const startVerification = useCallback(async () => {
    console.log("Starting verification...");
    const now = Date.now();
    await AsyncStorage.setItem(STORAGE_KEY, now.toString());
    setStartTime(now);
    setVerifying(true);
    setTimeRemaining(30);
    console.log("Verification started, timer set to 30 seconds");
  }, []);

  const completeVerification = useCallback(async () => {
    console.log("Completing verification...");
    setCompleting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      console.log("Current user:", userData.user?.id);

      const { data, error } = await supabase.rpc("mark_id_verified");
      console.log("RPC response:", { data, error });

      if (error) throw error;

      await AsyncStorage.removeItem(STORAGE_KEY);
      Alert.alert("Success", "Identity verified successfully", [
        {
          text: "OK",
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      console.error("Verification error:", error);
      Alert.alert("Error", error.message || "Failed to complete verification");
      setVerifying(false);
      setStartTime(null);
      await AsyncStorage.removeItem(STORAGE_KEY);
    } finally {
      setCompleting(false);
    }
  }, [router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Stack.Screen
        options={{
          title: "Verify Identity",
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.textPrimary,
        }}
      />

      <View style={[styles.content, { padding: spacing.lg }]}>
        <Text style={[text.title, styles.title]}>Identity Verification</Text>
        <Text style={[text.body, styles.description, { color: colors.textMuted }]}>
          To request quotes and accept services, we need to verify your identity.
        </Text>

        {loading ? (
          <Text style={[text.body, { marginTop: spacing.lg, color: colors.textMuted }]}>
            Loading...
          </Text>
        ) : alreadyVerified ? (
          <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
            <Text style={[text.title, { color: "#10b981", marginBottom: spacing.md }]}>✓ Already Verified</Text>
            <Text style={[text.body, { color: colors.textMuted, textAlign: 'center' }]}>
              Your identity has already been verified.
            </Text>
            <AppButton
              title="Back to Account"
              onPress={() => router.back()}
              style={{ marginTop: spacing.xl }}
            />
          </View>
        ) : !verifying ? (
          <>
            <Text style={[text.body, { marginTop: spacing.lg, color: colors.textMuted }]}>
              This is a simplified verification process that takes 30 seconds.
            </Text>
            <AppButton
              title="Start Verification"
              onPress={startVerification}
              style={{ marginTop: spacing.xl }}
            />
          </>
        ) : (
          <View style={styles.timerContainer}>
            {completing ? (
              <View style={{ alignItems: 'center' }}>
                <Text style={[text.title, { color: "#10b981" }]}>✓ Verified</Text>
                <Text style={[text.body, { marginTop: spacing.md, color: colors.textMuted }]}>
                  Your identity has been verified successfully.
                </Text>
                <AppButton
                  title="Back to Account"
                  onPress={() => router.back()}
                  style={{ marginTop: spacing.xl }}
                />
              </View>
            ) : (
              <>
                <View style={[styles.timerCircle, { borderColor: colors.accent }]}>
                  <Text style={[text.title, { fontSize: 48, color: colors.accent }]}>
                    {timeRemaining}
                  </Text>
                </View>
                <Text style={[text.body, { marginTop: spacing.lg, color: colors.textMuted }]}>
                  Verifying your identity...
                </Text>
                <Text style={[text.body, { marginTop: spacing.sm, color: colors.textMuted, fontSize: 14 }]}>
                  Please wait {timeRemaining} seconds
                </Text>
              </>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
  },
  description: {
    marginTop: 16,
    textAlign: "center",
    lineHeight: 22,
  },
  timerContainer: {
    marginTop: 40,
    alignItems: "center",
  },
  timerCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 4,
    justifyContent: "center",
    alignItems: "center",
  },
});
