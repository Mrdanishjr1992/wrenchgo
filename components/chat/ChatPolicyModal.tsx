import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ui/theme-context';

interface ChatPolicyModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ChatPolicyModal({ visible, onClose }: ChatPolicyModalProps) {
  const { colors, text } = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            Why Keep Communication on WrenchGo?
          </Text>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
            <Ionicons name="close" size={26} color={colors.textPrimary} />
          </Pressable>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <Section
            icon="shield-checkmark"
            iconColor="#10b981"
            title="Payment Protection"
            description="All payments are secured through WrenchGo. If you move off-platform, you lose payment protection and dispute resolution."
            colors={colors}
          />

          <Section
            icon="time"
            iconColor="#3b82f6"
            title="Complete Job History"
            description="Your entire conversation and job details are saved. This helps with warranty claims, repeat bookings, and resolving any issues."
            colors={colors}
          />

          <Section
            icon="headset"
            iconColor="#8b5cf6"
            title="24/7 Support Access"
            description="Our support team can only help with jobs that stay on the platform. Off-platform communication means we can't assist if something goes wrong."
            colors={colors}
          />

          <Section
            icon="repeat"
            iconColor="#f59e0b"
            title="Easy Rebooking"
            description="Find your favorite mechanics instantly and rebook with one tap. Your preferred mechanics get reduced commission rates for repeat business."
            colors={colors}
          />

          <Section
            icon="star"
            iconColor="#ec4899"
            title="Build Your Reputation"
            description="Reviews and ratings help mechanics grow their business. Off-platform work doesn't count toward your trust score or badges."
            colors={colors}
          />

          <View style={[styles.warningBox, { backgroundColor: '#fef2f2', borderColor: '#ef4444' }]}>
            <Ionicons name="warning" size={20} color="#ef4444" />
            <Text style={[styles.warningText, { color: '#991b1b' }]}>
              Repeated attempts to share contact information may result in account restrictions or suspension.
            </Text>
          </View>

          <View style={[styles.infoBox, { backgroundColor: colors.surface }]}>
            <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>
              Legitimate Exceptions
            </Text>
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              • Emergency contact during active jobs{'\n'}
              • Warranty work with previous mechanics{'\n'}
              • Sharing business addresses or shop locations{'\n'}
              • Part numbers, VINs, and technical specifications
            </Text>
          </View>

          <Pressable
            onPress={onClose}
            style={[styles.closeButtonBottom, { backgroundColor: colors.accent }]}
          >
            <Text style={styles.closeButtonText}>Got It</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

interface SectionProps {
  icon: any;
  iconColor: string;
  title: string;
  description: string;
  colors: any;
}

function Section({ icon, iconColor, title, description, colors }: SectionProps) {
  return (
    <View style={styles.section}>
      <View style={[styles.iconContainer, { backgroundColor: iconColor + '20' }]}>
        <Ionicons name={icon} size={24} color={iconColor} />
      </View>
      <View style={styles.sectionContent}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
          {description}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  section: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  warningBox: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 20,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 10,
    fontWeight: '500',
  },
  infoBox: {
    padding: 14,
    borderRadius: 8,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    lineHeight: 20,
  },
  closeButtonBottom: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
