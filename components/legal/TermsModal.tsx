
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useTerms, PlatformTerms } from '../../src/hooks/useTerms';

interface TermsModalProps {
  visible: boolean;
  role: 'customer' | 'mechanic';
  onAccepted: () => void;
  onClose?: () => void;
  dismissable?: boolean;
}

export function TermsModal({
  visible,
  role,
  onAccepted,
  onClose,
  dismissable = false,
}: TermsModalProps) {
  const { terms, loading, accepting, fetchActiveTerms, acceptTerms } = useTerms(role);
  const [showFullText, setShowFullText] = useState(false);

  useEffect(() => {
    if (visible && !terms) {
      fetchActiveTerms();
    }
  }, [visible, terms, fetchActiveTerms]);

  const handleAccept = async () => {
    if (!terms) return;
    const success = await acceptTerms(terms.version);
    if (success) {
      onAccepted();
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={dismissable ? onClose : undefined}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0a7ea4" />
              <Text style={styles.loadingText}>Loading terms...</Text>
            </View>
          ) : terms ? (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>{terms.title}</Text>
                <Text style={styles.version}>Version {terms.version}</Text>
              </View>

              <ScrollView
                style={styles.content}
                contentContainerStyle={{ paddingBottom: 20 }}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                <Text style={styles.summary}>{terms.summary}</Text>

                <TouchableOpacity
                  style={styles.expandButton}
                  onPress={() => setShowFullText(!showFullText)}
                >
                  <Text style={styles.expandButtonText}>
                    {showFullText ? 'Hide full terms' : 'View full terms'}
                  </Text>
                </TouchableOpacity>

                {showFullText && (
                  <Text style={styles.fullText}>{terms.full_text}</Text>
                )}
              </ScrollView>

              <View style={styles.footer}>
                <Text style={styles.agreementText}>
                  By tapping "I Accept", you agree to be bound by these terms.
                </Text>
                
                <TouchableOpacity
                  style={[styles.acceptButton, accepting && styles.acceptButtonDisabled]}
                  onPress={handleAccept}
                  disabled={accepting}
                >
                  {accepting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.acceptButtonText}>I Accept</Text>
                  )}
                </TouchableOpacity>

                {dismissable && onClose && (
                  <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          ) : (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>Unable to load terms. Please try again.</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => fetchActiveTerms()}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    maxHeight: '90%',
    width: '100%',
    maxWidth: 500,
    flex: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#11181C',
    marginBottom: 4,
  },
  version: {
    fontSize: 12,
    color: '#687076',
  },
  content: {
    padding: 20,
    flexGrow: 1,
    flexShrink: 1,
  },
  summary: {
    fontSize: 15,
    lineHeight: 22,
    color: '#11181C',
    marginBottom: 16,
  },
  expandButton: {
    paddingVertical: 8,
  },
  expandButtonText: {
    fontSize: 14,
    color: '#0a7ea4',
    fontWeight: '600',
  },
  fullText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#687076',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  agreementText: {
    fontSize: 12,
    color: '#687076',
    textAlign: 'center',
    marginBottom: 16,
  },
  acceptButton: {
    backgroundColor: '#0a7ea4',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  acceptButtonDisabled: {
    opacity: 0.6,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#687076',
    fontSize: 14,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#687076',
    fontSize: 14,
  },
  errorContainer: {
    padding: 40,
    alignItems: 'center',
  },
  errorText: {
    color: '#e53935',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#0a7ea4',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
