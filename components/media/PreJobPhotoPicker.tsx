import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
  Pressable,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useTheme } from "../../src/ui/theme-context";

export type PendingPhoto = {
  id: string;
  uri: string;
  width: number;
  height: number;
};

type Props = {
  onPhotosChanged?: (photos: PendingPhoto[]) => void;
  maxPhotos?: number;
  label?: string;
};

async function compressImage(uri: string): Promise<{ uri: string; width: number; height: number }> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1200 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result;
}

export function PreJobPhotoPicker({
  onPhotosChanged,
  maxPhotos = 5,
  label = "Add Photos (optional)",
}: Props) {
  const { colors } = useTheme();
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [processing, setProcessing] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);

  const addPhoto = useCallback(
    async (uri: string) => {
      try {
        setProcessing(true);
        const compressed = await compressImage(uri);
        const newPhoto: PendingPhoto = {
          id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          uri: compressed.uri,
          width: compressed.width,
          height: compressed.height,
        };
        const updated = [...photos, newPhoto];
        setPhotos(updated);
        onPhotosChanged?.(updated);
      } catch (e: any) {
        Alert.alert("Error", "Failed to process photo");
      } finally {
        setProcessing(false);
      }
    },
    [photos, onPhotosChanged]
  );

  const removePhoto = useCallback(
    (id: string) => {
      const updated = photos.filter((p) => p.id !== id);
      setPhotos(updated);
      onPhotosChanged?.(updated);
    },
    [photos, onPhotosChanged]
  );

  const handleCameraCapture = useCallback(async () => {
    setShowOptions(false);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission Needed", "Please allow camera access.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.9,
        mediaTypes: ['images'],
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        await addPhoto(result.assets[0].uri);
      }
    } catch (e: any) {
      Alert.alert("Camera Error", e?.message || "Failed to capture photo");
    }
  }, [addPhoto]);

  const handleLibraryPick = useCallback(async () => {
    setShowOptions(false);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission Needed", "Please allow photo library access.");
        return;
      }

      const remaining = maxPhotos - photos.length;
      if (remaining <= 0) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.9,
        mediaTypes: ['images'],
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setProcessing(true);
        try {
          const newPhotos: PendingPhoto[] = [];
          for (const asset of result.assets) {
            if (newPhotos.length >= remaining) break;
            const compressed = await compressImage(asset.uri);
            newPhotos.push({
              id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              uri: compressed.uri,
              width: compressed.width,
              height: compressed.height,
            });
          }
          if (newPhotos.length > 0) {
            setPhotos(prev => {
              const updated = [...prev, ...newPhotos];
              onPhotosChanged?.(updated);
              return updated;
            });
          }
        } finally {
          setProcessing(false);
        }
      }
    } catch (e: any) {
      Alert.alert("Library Error", e?.message || "Failed to select photos");
    }
  }, [maxPhotos, photos.length, onPhotosChanged]);

  const canAddMore = photos.length < maxPhotos;

  return (
    <View style={{ marginVertical: 8 }}>
      <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary, marginBottom: 8 }}>
        {label}
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {photos.map((photo) => (
          <View key={photo.id} style={[styles.thumbnail, { borderColor: colors.border }]}>
            <TouchableOpacity onPress={() => setSelectedImage(photo.uri)} style={{ flex: 1 }}>
              <Image source={{ uri: photo.uri }} style={styles.thumbnailImage} resizeMode="cover" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => removePhoto(photo.id)}
              style={[styles.removeButton, { backgroundColor: colors.error || "#f44" }]}
            >
              <Ionicons name="close" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}

        {canAddMore && (
          <TouchableOpacity
            onPress={() => setShowOptions(true)}
            disabled={processing}
            style={[styles.addButton, { borderColor: colors.border, backgroundColor: colors.surface || colors.surface }]}
          >
            {processing ? (
              <ActivityIndicator color={colors.primary || colors.accent} />
            ) : (
              <>
                <Ionicons name="camera" size={24} color={colors.primary || colors.accent} />
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>Add</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal visible={showOptions} transparent animationType="fade" onRequestClose={() => setShowOptions(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowOptions(false)}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface || colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Add Photo</Text>
            <TouchableOpacity style={[styles.modalOption, { borderColor: colors.border }]} onPress={handleCameraCapture}>
              <Ionicons name="camera" size={24} color={colors.primary || colors.accent} />
              <Text style={[styles.modalOptionText, { color: colors.textPrimary }]}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalOption, { borderColor: colors.border }]} onPress={handleLibraryPick}>
              <Ionicons name="images" size={24} color={colors.primary || colors.accent} />
              <Text style={[styles.modalOptionText, { color: colors.textPrimary }]}>Choose from Library</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setShowOptions(false)}>
              <Text style={{ color: colors.textMuted, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={!!selectedImage} transparent animationType="fade" onRequestClose={() => setSelectedImage(null)}>
        <Pressable style={styles.imagePreviewOverlay} onPress={() => setSelectedImage(null)}>
          {selectedImage && (
            <Image source={{ uri: selectedImage }} style={styles.previewImage} resizeMode="contain" />
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  thumbnail: {
    width: 70,
    height: 70,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  removeButton: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  addButton: {
    width: 70,
    height: 70,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 20,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  modalOptionText: {
    fontSize: 16,
    marginLeft: 12,
  },
  modalCancel: {
    alignItems: "center",
    padding: 16,
  },
  imagePreviewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  previewImage: {
    width: "95%",
    height: "80%",
  },
});
