import React from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../ui/theme-context";
import { createCard } from "../ui/styles";
import Markdown from "react-native-markdown-display";

interface LegalDocumentViewerProps {
  title: string;
  content: string;
  onClose?: () => void;
  showCloseButton?: boolean;
}

export function LegalDocumentViewer({
  title,
  content,
  onClose,
  showCloseButton = true,
}: LegalDocumentViewerProps) {
  const { colors, spacing, text } = useTheme();

  const markdownStyles = StyleSheet.create({
    body: {
      color: colors.textPrimary,
      fontSize: 15,
      lineHeight: 24,
    },
    heading1: {
      color: colors.textPrimary,
      fontSize: 24,
      fontWeight: "700",
      marginTop: spacing.lg,
      marginBottom: spacing.md,
    },
    heading2: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "600",
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    heading3: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: "600",
      marginTop: spacing.md,
      marginBottom: spacing.xs,
    },
    paragraph: {
      marginBottom: spacing.md,
      color: colors.textPrimary,
      fontSize: 15,
      lineHeight: 24,
    },
    strong: {
      fontWeight: "700",
      color: colors.textPrimary,
    },
    em: {
      fontStyle: "italic",
    },
    list_item: {
      marginBottom: spacing.xs,
      color: colors.textPrimary,
    },
    bullet_list: {
      marginBottom: spacing.md,
    },
    ordered_list: {
      marginBottom: spacing.md,
    },
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
            paddingTop: spacing.lg,
            paddingBottom: spacing.md,
            paddingHorizontal: spacing.lg,
          },
        ]}
      >
        <Text style={[text.title, { color: colors.textPrimary, flex: 1 }]}>{title}</Text>
        {showCloseButton && onClose && (
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.closeButton,
              {
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Ionicons name="close" size={28} color={colors.textPrimary} />
          </Pressable>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
        ]}
      >
        <Markdown style={markdownStyles}>{content}</Markdown>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
});
