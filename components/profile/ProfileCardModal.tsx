import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/ui/theme-context';
import { UserProfileCard } from './UserProfileCardQuotes';
import { router } from 'expo-router';

interface ProfileCardModalProps {
  visible: boolean;
  userId: string;
  onClose: () => void;
  showReviewsButton?: boolean;
  title?: string;
}

export function ProfileCardModal({
  visible,
  userId,
  onClose,
  showReviewsButton = true,
  title,
}: ProfileCardModalProps) {
  const { colors, spacing } = useTheme();

  const handleViewReviews = () => {
    onClose();
    router.push(`/profile/${userId}`);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.modalBackground, { backgroundColor: colors.background }]}>
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background, margin: spacing.lg }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerLeft}>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                {title || 'Profile'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={28} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            <UserProfileCard
              userId={userId}
              variant="full"
              context="quote_detail"
              showActions={showReviewsButton}
              onPressReviews={handleViewReviews}
            />
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
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
});
