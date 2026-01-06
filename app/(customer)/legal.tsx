import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/ui/theme-context";
import { createCard } from "../../src/ui/styles";
import { LegalDocumentViewer } from "../../src/components/LegalDocumentViewer";
import {
  TERMS_OF_SERVICE,
  PRIVACY_POLICY,
  REFUND_POLICY,
  PAYMENTS_DISCLOSURE,
} from "../../src/legal";

type LegalDocument = {
  id: string;
  title: string;
  content: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const legalDocuments: LegalDocument[] = [
  { id: "terms", title: "Terms of Service", content: TERMS_OF_SERVICE, icon: "document-text-outline" },
  { id: "privacy", title: "Privacy Policy", content: PRIVACY_POLICY, icon: "shield-checkmark-outline" },
  { id: "refund", title: "Refund & Cancellation Policy", content: REFUND_POLICY, icon: "cash-outline" },
  { id: "payments", title: "Payments & Fees", content: PAYMENTS_DISCLOSURE, icon: "card-outline" },
];

export default function LegalScreen() {
  const router = useRouter();
  const { colors, spacing, text, radius } = useTheme();
  const card = createCard(colors);

  const [selectedDocument, setSelectedDocument] = useState<LegalDocument | null>(null);

  return (
    <>
      {/* ✅ Proper header */}
        <Stack.Screen
          options={{
            title: "Legal",
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.textPrimary,
            headerShadowVisible: false,
            headerLargeTitle: false,
          }}
        />

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: spacing.lg }}
      >
        <Text style={[text.body, { color: colors.textMuted, marginBottom: spacing.lg }]}>
          Review our legal documents and policies
        </Text>

        {legalDocuments.map((doc) => (
          <Pressable
            key={doc.id}
            onPress={() => setSelectedDocument(doc)}
            style={({ pressed }) => [
              card,
              styles.row,
              {
                marginBottom: spacing.md,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.icon,
                {
                  backgroundColor: colors.accent + "20",
                  borderRadius: radius.md,
                },
              ]}
            >
              <Ionicons name={doc.icon} size={22} color={colors.accent} />
            </View>

            <Text style={[text.body, { flex: 1, fontWeight: "700" }]}>
              {doc.title}
            </Text>

            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}

        {/* Contact */}
        <View style={[card, styles.contact, { marginTop: spacing.lg }]}>
          <Ionicons name="mail-outline" size={22} color={colors.accent} />
          <View style={{ marginLeft: spacing.md }}>
            <Text style={[text.muted, { fontSize: 13 }]}>Questions or concerns?</Text>
            <Text style={[text.body, { fontWeight: "700" }]}>hello@wrenchgoapp.com</Text>
          </View>
        </View>

        <Text
          style={{
            marginTop: spacing.xl,
            fontSize: 12,
            color: colors.textMuted,
            textAlign: "center",
          }}
        >
          Last updated: January 2025
        </Text>
      </ScrollView>

      {/* ✅ Legal document modal */}
      <Modal
        visible={!!selectedDocument}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedDocument(null)}
      >
        {selectedDocument && (
          <LegalDocumentViewer
            title={selectedDocument.title}
            content={selectedDocument.content}
            onClose={() => setSelectedDocument(null)}
          />
        )}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 16,
  },
  icon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  contact: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
});
