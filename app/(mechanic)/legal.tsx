import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, StyleSheet, Modal } from "react-native";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/ui/theme-context";
import { createCard } from "../../src/ui/styles";
import { LegalDocumentViewer } from "../../src/components/LegalDocumentViewer";
import {
  TERMS_OF_SERVICE,
  PRIVACY_POLICY,
  REFUND_POLICY,
  CONTRACTOR_DISCLAIMER,
  PAYMENTS_DISCLOSURE,
} from "../../src/legal";

type LegalDocument = {
  id: string;
  title: string;
  content: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const legalDocuments: LegalDocument[] = [
  {
    id: "terms",
    title: "Terms of Service",
    content: TERMS_OF_SERVICE,
    icon: "document-text",
  },
  {
    id: "privacy",
    title: "Privacy Policy",
    content: PRIVACY_POLICY,
    icon: "shield-checkmark",
  },
  {
    id: "refund",
    title: "Refund & Cancellation Policy",
    content: REFUND_POLICY,
    icon: "cash",
  },
  {
    id: "payments",
    title: "Payments & Fees",
    content: PAYMENTS_DISCLOSURE,
    icon: "card",
  },
  {
    id: "contractor",
    title: "Independent Contractor Terms",
    content: CONTRACTOR_DISCLAIMER,
    icon: "briefcase",
  },
];

export default function LegalScreen() {
  const { colors, spacing, text, radius } = useTheme();
  const card = createCard(colors);
  const [selectedDocument, setSelectedDocument] = useState<LegalDocument | null>(null);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Legal",
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
        }}
      />

      <ScrollView
        style={[styles.container, { backgroundColor: colors.bg }]}
        contentContainerStyle={{ padding: spacing.lg }}
      >
        <Text
          style={[
            text.body,
            { color: colors.textSecondary, marginBottom: spacing.lg },
          ]}
        >
          Review our legal documents and policies
        </Text>

        {legalDocuments.map((doc) => (
          <Pressable
            key={doc.id}
            onPress={() => setSelectedDocument(doc)}
            style={({ pressed }) => [
              card.container,
              styles.documentCard,
              {
                marginBottom: spacing.md,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: colors.accent + "20",
                  borderRadius: radius.md,
                },
              ]}
            >
              <Ionicons name={doc.icon} size={24} color={colors.accent} />
            </View>
            <View style={styles.textContainer}>
              <Text style={[text.body, { color: colors.textPrimary, fontWeight: "600" }]}>
                {doc.title}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </Pressable>
        ))}

        <View style={[styles.contactCard, card.container, { marginTop: spacing.lg }]}>
          <Ionicons name="mail" size={24} color={colors.accent} />
          <View style={{ marginLeft: spacing.md, flex: 1 }}>
            <Text style={[text.body, { color: colors.textSecondary, fontSize: 13 }]}>
              Questions or concerns?
            </Text>
            <Text style={[text.body, { color: colors.textPrimary, fontWeight: "600" }]}>
              hello@wrenchgoapp.com
            </Text>
          </View>
        </View>

        <Text
          style={[
            text.body,
            {
              fontSize: 13,
              color: colors.textSecondary,
              textAlign: "center",
              marginTop: spacing.xl,
            },
          ]}
        >
          Last Updated: January 2025
        </Text>
      </ScrollView>

      <Modal
        visible={selectedDocument !== null}
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
  container: {
    flex: 1,
  },
  documentCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
    marginLeft: 16,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
});
