import React, { useState } from "react";
import { View, Text, StyleSheet, Alert, ScrollView } from "react-native";
import { supabase } from "@/src/lib/supabase";
import { useTheme } from "@/src/ui/theme-context";
import { AppButton } from "@/src/ui/components/AppButton";

export default function TestVerification() {
  const { colors, text, spacing } = useTheme();
  const [output, setOutput] = useState<string[]>([]);

  const log = (message: string) => {
    console.log(message);
    setOutput(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testGetUser = async () => {
    try {
      log("Testing getUser...");
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        log(`Error: ${error.message}`);
      } else {
        log(`User ID: ${data.user?.id}`);
        log(`User email: ${data.user?.email}`);
      }
    } catch (error: any) {
      log(`Exception: ${error.message}`);
    }
  };

  const testGetProfile = async () => {
    try {
      log("Testing getProfile...");
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        log("No user logged in");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, auth_id, full_name, id_verified, id_verified_at")
        .eq("auth_id", userData.user.id)
        .single();

      if (error) {
        log(`Error: ${JSON.stringify(error)}`);
      } else {
        log(`Profile: ${JSON.stringify(data, null, 2)}`);
      }
    } catch (error: any) {
      log(`Exception: ${error.message}`);
    }
  };

  const testMarkVerified = async () => {
    try {
      log("Testing mark_id_verified RPC...");
      const { data, error } = await supabase.rpc("mark_id_verified");
      if (error) {
        log(`Error: ${JSON.stringify(error)}`);
      } else {
        log(`Success! Data: ${JSON.stringify(data)}`);
      }
    } catch (error: any) {
      log(`Exception: ${error.message}`);
    }
  };

  const clearOutput = () => {
    setOutput([]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[text.title, { marginBottom: spacing.lg }]}>Test ID Verification</Text>
      
      <View style={{ gap: spacing.md, marginBottom: spacing.lg }}>
        <AppButton title="Test Get User" onPress={testGetUser} />
        <AppButton title="Test Get Profile" onPress={testGetProfile} />
        <AppButton title="Test Mark Verified" onPress={testMarkVerified} />
        <AppButton title="Clear Output" onPress={clearOutput} variant="secondary" />
      </View>

      <ScrollView style={styles.output}>
        {output.map((line, index) => (
          <Text key={index} style={[text.body, { color: colors.textMuted, fontSize: 12, marginBottom: 4 }]}>
            {line}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  output: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
  },
});
