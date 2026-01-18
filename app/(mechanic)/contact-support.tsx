import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../src/ui/theme-context';
import { submitSupportRequest, uploadSupportScreenshot } from '../../src/lib/support';
import { SUPPORT_CATEGORIES } from '../../src/types/support';
import type { SupportCategory } from '../../src/types/support';
import { supabase } from '../../src/lib/supabase';

const MAX_PHOTOS = 5;

export default function ContactSupportScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { colors, text } = useTheme();
  const params = useLocalSearchParams();
  const jobId = params.jobId as string | undefined;

  const [category, setCategory] = useState<SupportCategory | ''>('');
  const [message, setMessage] = useState('');
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const selectedCategory = SUPPORT_CATEGORIES.find((c: any) => c.value === category);

  const pickImage = async () => {
    if (screenshots.length >= MAX_PHOTOS) {
      Alert.alert('Limit Reached', `You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - screenshots.length,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const newUris = result.assets.map(a => a.uri);
      setScreenshots(prev => [...prev, ...newUris].slice(0, MAX_PHOTOS));
    }
  };

  const takePhoto = async () => {
    if (screenshots.length >= MAX_PHOTOS) {
      Alert.alert('Limit Reached', `You can add up to ${MAX_PHOTOS} photos.`);
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow camera access.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setScreenshots(prev => [...prev, result.assets[0].uri].slice(0, MAX_PHOTOS));
    }
  };

  const removeScreenshot = (index: number) => {
    setScreenshots(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!category) {
      Alert.alert('Category Required', 'Please select a category for your request.');
      return;
    }

    if (!message.trim()) {
      Alert.alert('Message Required', 'Please describe your issue.');
      return;
    }

    setSubmitting(true);

    try {
      const screenshotUrls: string[] = [];
      const { data: userData } = await supabase.auth.getUser();

      if (userData.user && screenshots.length > 0) {
        for (const uri of screenshots) {
          const { url, error } = await uploadSupportScreenshot(uri, userData.user.id);
          if (!error && url) {
            screenshotUrls.push(url);
          }
        }
        if (screenshotUrls.length < screenshots.length) {
          Alert.alert('Upload Warning', 'Some photos failed to upload, but we\'ll submit your request anyway.');
        }
      }

      const role = pathname?.includes('mechanic') ? 'mechanic' : 'customer';

      const response = await submitSupportRequest({
        category,
        message: message.trim(),
        job_id: jobId,
        screenshot_url: screenshotUrls[0],
        metadata: { role, screenshot_urls: screenshotUrls },
      });

      if (response.success) {
        setSubmitted(true);
      } else {
        Alert.alert('Submission Failed', response.error || 'Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={28} color={colors.textPrimary} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Contact Support</Text>
          <View style={{ width: 28 }} />
        </View>

        <View style={styles.successContainer}>
          <View style={[styles.successIcon, { backgroundColor: colors.accent + '20' }]}>
            <Ionicons name="checkmark-circle" size={64} color={colors.accent} />
          </View>
          <Text style={[styles.successTitle, { color: colors.textPrimary }]}>
            Request Submitted!
          </Text>
          <Text style={[styles.successMessage, { color: colors.textSecondary }]}>
            We've received your support request and will respond within{' '}
            {selectedCategory?.sla || '48 hours'}.
          </Text>
          <Text style={[styles.successNote, { color: colors.textMuted }]}>
            You'll receive an email confirmation shortly. Our team will review your request and get back to you as soon as possible.
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={[styles.doneButton, { backgroundColor: colors.accent }]}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Contact Support</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Category *</Text>
        <Pressable
          onPress={() => setShowCategoryPicker(!showCategoryPicker)}
          style={[
            styles.categoryButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {selectedCategory ? (
            <View style={styles.categorySelected}>
              <Ionicons name={selectedCategory.icon as any} size={20} color={colors.accent} />
              <Text style={[styles.categorySelectedText, { color: colors.textPrimary }]}>
                {selectedCategory.label}
              </Text>
              <Text style={[styles.categorySLA, { color: colors.textMuted }]}>
                SLA: {selectedCategory.sla}
              </Text>
            </View>
          ) : (
            <Text style={[styles.categoryPlaceholder, { color: colors.textMuted }]}>
              Select a category
            </Text>
          )}
          <Ionicons
            name={showCategoryPicker ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.textMuted}
          />
        </Pressable>

        {showCategoryPicker && (
          <View style={[styles.categoryList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {SUPPORT_CATEGORIES.map((cat: any) => (
              <Pressable
                key={cat.value}
                onPress={() => {
                  setCategory(cat.value);
                  setShowCategoryPicker(false);
                }}
                style={[
                  styles.categoryItem,
                  { borderBottomColor: colors.border },
                  cat.value === category && { backgroundColor: colors.accent + '10' },
                ]}
              >
                <Ionicons name={cat.icon as any} size={22} color={colors.accent} />
                <View style={styles.categoryItemText}>
                  <Text style={[styles.categoryItemLabel, { color: colors.textPrimary }]}>
                    {cat.label}
                  </Text>
                  <Text style={[styles.categoryItemSLA, { color: colors.textMuted }]}>
                    Response time: {cat.sla}
                  </Text>
                </View>
                {cat.value === category && (
                  <Ionicons name="checkmark" size={22} color={colors.accent} />
                )}
              </Pressable>
            ))}
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: 20 }]}>
          Message *
        </Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Describe your issue in detail..."
          placeholderTextColor={colors.textMuted}
          style={[
            styles.messageInput,
            { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary },
          ]}
          multiline
          numberOfLines={8}
          textAlignVertical="top"
        />

        <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: 20 }]}>
          Photos ({screenshots.length}/{MAX_PHOTOS}) - Optional
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosRow}>
          {screenshots.map((uri, index) => (
            <View key={index} style={styles.thumbnailContainer}>
              <Image source={{ uri }} style={styles.thumbnailImage} />
              <TouchableOpacity
                onPress={() => removeScreenshot(index)}
                style={styles.removeButton}
              >
                <Ionicons name="close-circle" size={24} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}
          {screenshots.length < MAX_PHOTOS && (
            <View style={styles.addPhotoButtons}>
              <TouchableOpacity
                onPress={takePhoto}
                style={[styles.addPhotoButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Ionicons name="camera" size={24} color={colors.accent} />
                <Text style={[styles.addPhotoText, { color: colors.textMuted }]}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={pickImage}
                style={[styles.addPhotoButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Ionicons name="images" size={24} color={colors.accent} />
                <Text style={[styles.addPhotoText, { color: colors.textMuted }]}>Library</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {jobId && (
          <View style={[styles.infoBox, { backgroundColor: colors.surface }]}>
            <Ionicons name="information-circle" size={20} color={colors.accent} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              This request is linked to job #{jobId.slice(0, 8)}
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <Pressable
          onPress={handleSubmit}
          disabled={submitting || !category || !message.trim()}
          style={[
            styles.submitButton,
            { backgroundColor: colors.accent },
            (submitting || !category || !message.trim()) && styles.submitButtonDisabled,
          ]}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Submit Request</Text>
          )}
        </Pressable>
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
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  categorySelected: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categorySelectedText: {
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 10,
    flex: 1,
  },
  categorySLA: {
    fontSize: 12,
    marginRight: 8,
  },
  categoryPlaceholder: {
    fontSize: 15,
  },
  categoryList: {
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
  },
  categoryItemText: {
    flex: 1,
    marginLeft: 12,
  },
  categoryItemLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  categoryItemSLA: {
    fontSize: 12,
    marginTop: 2,
  },
  messageInput: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 15,
    minHeight: 120,
  },
  uploadButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  uploadText: {
    fontSize: 14,
    marginTop: 8,
  },
  screenshotContainer: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  screenshotImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  removeScreenshot: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 14,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  infoText: {
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  submitButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  successNote: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  doneButton: {
    paddingHorizontal: 48,
    paddingVertical: 14,
    borderRadius: 8,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  photosRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  thumbnailContainer: {
    position: 'relative',
    marginRight: 10,
  },
  thumbnailImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  addPhotoButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  addPhotoButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoText: {
    fontSize: 11,
    marginTop: 4,
  },
});
