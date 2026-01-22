import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useTheme } from '../ui/theme-context';
import { SUPPORT_FAQ } from '../types/support';
import { useOnboarding } from '../onboarding';
import { useRatingPromptContext } from './RatingPromptProvider';

interface HelpSupportSectionProps {
  variant?: 'card' | 'inline';
}

export function HelpSupportSection({ variant = 'card' }: HelpSupportSectionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { colors, spacing, radius } = useTheme();
  const { startWalkthrough } = useOnboarding();
  const { handleRateApp, promptState } = useRatingPromptContext();
  const [showFAQ, setShowFAQ] = useState(false);
  const [showSLA, setShowSLA] = useState(false);

  const isMechanic = pathname?.includes('mechanic');
  const supportRoute = isMechanic ? '/(mechanic)/contact-support' : '/(customer)/contact-support';

  const handleReplayTour = () => {
    const role = isMechanic ? 'mechanic' : 'customer';
    startWalkthrough(role);
  };

  const cardStyle = variant === 'card' ? {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.md,
  } : {};

  return (
    <>
      <View style={cardStyle}>
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: colors.accent + '20', borderColor: colors.accent + '30', borderRadius: radius.md }]}>
            <Ionicons name="help-circle-outline" size={22} color={colors.accent} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Help & Support</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              FAQs, app tour, contact us
            </Text>
          </View>
        </View>

        <Pressable
          onPress={handleReplayTour}
          accessibilityRole="button"
          accessibilityLabel="Replay app tour"
          style={({ pressed }) => [
            styles.menuItem,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="map-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.menuText, { color: colors.textPrimary }]}>Replay App Tour</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        {!promptState?.reason?.includes('already_rated') && (
          <Pressable
            onPress={handleRateApp}
            accessibilityRole="button"
            accessibilityLabel="Rate WrenchGo"
            style={({ pressed }) => [
              styles.menuItem,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name="star-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.menuText, { color: colors.textPrimary }]}>Rate WrenchGo</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        )}

        <Pressable
          onPress={() => setShowFAQ(true)}
          style={({ pressed }) => [
            styles.menuItem,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="list-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.menuText, { color: colors.textPrimary }]}>Frequently Asked Questions</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => setShowSLA(true)}
          style={({ pressed }) => [
            styles.menuItem,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
          <Text style={[styles.menuText, { color: colors.textPrimary }]}>Response Times (SLA)</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => router.push(supportRoute as any)}
          style={({ pressed }) => [
            styles.contactButton,
            { backgroundColor: colors.accent, borderRadius: radius.md, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Ionicons name="mail-outline" size={20} color={colors.black} />
          <Text style={[styles.contactButtonText, { color: colors.black }]}>Contact Support</Text>
        </Pressable>
      </View>

      <Modal
        visible={showFAQ}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFAQ(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.bg }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Frequently Asked Questions
            </Text>
            <Pressable onPress={() => setShowFAQ(false)} hitSlop={12}>
              <Ionicons name="close" size={28} color={colors.textPrimary} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentContainer}>
            {SUPPORT_FAQ.map((faq, index) => (
              <View key={index} style={[styles.faqItem, { backgroundColor: colors.surface, borderRadius: radius.md }]}>
                <Text style={[styles.faqQuestion, { color: colors.textPrimary }]}>
                  {faq.question}
                </Text>
                <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>
                  {faq.answer}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={showSLA}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSLA(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.bg }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Response Times (SLA)
            </Text>
            <Pressable onPress={() => setShowSLA(false)} hitSlop={12}>
              <Ionicons name="close" size={28} color={colors.textPrimary} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentContainer}>
            <View style={[styles.slaItem, { backgroundColor: colors.surface, borderRadius: radius.md }]}>
              <View style={[styles.slaIcon, { backgroundColor: colors.errorBg }]}>
                <Ionicons name="flash" size={24} color={colors.error} />
              </View>
              <View style={styles.slaText}>
                <Text style={[styles.slaTitle, { color: colors.textPrimary }]}>
                  Payments & Safety Issues
                </Text>
                <Text style={[styles.slaTime, { color: colors.accent }]}>12-24 hours</Text>
                <Text style={[styles.slaDescription, { color: colors.textMuted }]}>
                  High priority issues affecting payments or safety
                </Text>
              </View>
            </View>

            <View style={[styles.slaItem, { backgroundColor: colors.surface, borderRadius: radius.md }]}>
              <View style={[styles.slaIcon, { backgroundColor: colors.warningBg }]}>
                <Ionicons name="construct" size={24} color={colors.warning} />
              </View>
              <View style={styles.slaText}>
                <Text style={[styles.slaTitle, { color: colors.textPrimary }]}>
                  Job Issues
                </Text>
                <Text style={[styles.slaTime, { color: colors.accent }]}>24 hours</Text>
                <Text style={[styles.slaDescription, { color: colors.textMuted }]}>
                  Problems with active or completed jobs
                </Text>
              </View>
            </View>

            <View style={[styles.slaItem, { backgroundColor: colors.surface, borderRadius: radius.md }]}>
              <View style={[styles.slaIcon, { backgroundColor: colors.infoBg }]}>
                <Ionicons name="bug" size={24} color={colors.info} />
              </View>
              <View style={styles.slaText}>
                <Text style={[styles.slaTitle, { color: colors.textPrimary }]}>
                  Bugs & General Questions
                </Text>
                <Text style={[styles.slaTime, { color: colors.accent }]}>48 hours</Text>
                <Text style={[styles.slaDescription, { color: colors.textMuted }]}>
                  App problems, account questions, and general inquiries
                </Text>
              </View>
            </View>

            <View style={[styles.infoBox, { backgroundColor: colors.accent + '10', borderColor: colors.accent + '30', borderRadius: radius.md }]}>
              <Ionicons name="information-circle" size={20} color={colors.accent} />
              <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                Response times are estimates. We strive to respond as quickly as possible, often faster than the stated SLA.
              </Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 8,
  },
  contactButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: 16,
  },
  faqItem: {
    padding: 16,
    marginBottom: 12,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    lineHeight: 20,
  },
  slaItem: {
    flexDirection: 'row',
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  slaIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slaText: {
    flex: 1,
  },
  slaTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  slaTime: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  slaDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  infoBox: {
    flexDirection: 'row',
    padding: 12,
    gap: 10,
    marginTop: 8,
    borderWidth: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
