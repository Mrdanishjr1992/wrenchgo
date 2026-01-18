import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/ui/theme-context';

type Props = {
  title?: string;
  urls: string[];
  emptyMessage?: string;
};

export function AdminEvidenceGallery({ title = 'Evidence Photos', urls, emptyMessage = 'No photos' }: Props) {
  const { colors } = useTheme();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [loadingImages, setLoadingImages] = useState<Record<number, boolean>>({});

  if (!urls || urls.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.header}>
          <Ionicons name="images-outline" size={20} color={colors.textMuted} />
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        </View>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Ionicons name="images" size={20} color={colors.accent} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.count, { color: colors.textMuted }]}>({urls.length})</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollView}>
        {urls.map((url, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => setSelectedImage(url)}
            style={[styles.thumbnail, { borderColor: colors.border }]}
          >
            {loadingImages[index] && (
              <ActivityIndicator size="small" color={colors.accent} style={styles.loader} />
            )}
            <Image
              source={{ uri: url }}
              style={styles.thumbnailImage}
              resizeMode="cover"
              onLoadStart={() => setLoadingImages(prev => ({ ...prev, [index]: true }))}
              onLoadEnd={() => setLoadingImages(prev => ({ ...prev, [index]: false }))}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Modal visible={!!selectedImage} transparent animationType="fade" onRequestClose={() => setSelectedImage(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedImage(null)}>
          <View style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#fff" />
          </View>
          {selectedImage && (
            <Image source={{ uri: selectedImage }} style={styles.previewImage} resizeMode="contain" />
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  count: {
    fontSize: 13,
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  scrollView: {
    flexDirection: 'row',
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 10,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  loader: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -10,
    marginTop: -10,
    zIndex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  previewImage: {
    width: '95%',
    height: '80%',
  },
});
