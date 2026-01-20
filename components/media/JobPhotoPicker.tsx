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
import { supabase } from "../../src/lib/supabase";
import { useTheme } from "../../src/ui/theme-context";

export type MediaCategory =
  | "customer_request"
  | "mechanic_before"
  | "mechanic_after"
  | "dispute_evidence"
  | "support_evidence"
  | "parts_receipt"
  | "other";

export type JobMediaRow = {
  id: string;
  job_id: string;
  contract_id: string | null;
  uploaded_by: string;
  uploaded_by_role: string;
  media_type: string;
  media_category: string;
  bucket: string;
  path: string;
  public_url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  taken_at: string | null;
  created_at: string;
};

type Props = {
  jobId: string;
  contractId?: string;
  category: MediaCategory;
  onUploaded?: (mediaRows: JobMediaRow[]) => void;
  maxPhotos?: number;
  label?: string;
  existingMedia?: JobMediaRow[];
};

async function uriToArrayBuffer(uri: string) {
  const res = await fetch(uri);
  return await res.arrayBuffer();
}

function getExt(uri: string) {
  const m = uri.match(/\.([a-zA-Z0-9]+)(\?|$)/);
  return (m?.[1] ?? "jpg").toLowerCase();
}

function contentTypeFromExt(ext: string) {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

async function compressImage(uri: string): Promise<{ uri: string; width: number; height: number }> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1200 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result;
}

export function JobPhotoPicker({
  jobId,
  contractId,
  category,
  onUploaded,
  maxPhotos = 5,
  label = "Add Photos",
  existingMedia = [],
}: Props) {
  const { colors } = useTheme();
  const [uploading, setUploading] = useState(false);
  const [uploadedMedia, setUploadedMedia] = useState<JobMediaRow[]>(existingMedia);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);

  const uploadPhoto = useCallback(
    async (uri: string) => {
      try {
        setUploading(true);
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) {
          Alert.alert("Sign In Required", "Please sign in to upload photos.");
          return null;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .single();

        const role = profile?.role || "customer";
        const compressed = await compressImage(uri);
        const buffer = await uriToArrayBuffer(compressed.uri);
        const ext = getExt(compressed.uri);
        const fileId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const path = `${jobId}/${role}/${category}/${fileId}.${ext}`;
        const contentType = contentTypeFromExt(ext);

        const { error: uploadError } = await supabase.storage
          .from("job-media")
          .upload(path, buffer, { contentType, upsert: false });

        if (uploadError) throw uploadError;

        const { data: rpcResult, error: rpcError } = await supabase.rpc(
          "create_job_media_record",
          {
            p_job_id: jobId,
            p_media_category: category,
            p_path: path,
            p_mime_type: contentType,
            p_file_size_bytes: buffer.byteLength,
            p_contract_id: contractId || null,
            p_caption: null,
            p_taken_at: new Date().toISOString(),
          }
        );

        if (rpcError) throw rpcError;

        const { data: urlData } = supabase.storage.from("job-media").getPublicUrl(path);
        const mediaRow: JobMediaRow = {
          ...rpcResult,
          public_url: urlData.publicUrl,
        };

        return mediaRow;
      } catch (e: any) {
        Alert.alert("Upload Failed", "Unable to upload photo. Please try again.");
        return null;
      } finally {
        setUploading(false);
      }
    },
    [jobId, contractId, category]
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
        const mediaRow = await uploadPhoto(result.assets[0].uri);
        if (mediaRow) {
          const newMedia = [...uploadedMedia, mediaRow];
          setUploadedMedia(newMedia);
          onUploaded?.(newMedia);
        }
      }
    } catch (e: any) {
      Alert.alert("Camera Error", "Unable to capture photo. Please try again.");
    }
  }, [uploadPhoto, uploadedMedia, onUploaded]);

  const handleLibraryPick = useCallback(async () => {
    setShowOptions(false);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission Needed", "Please allow photo library access.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: true,
        selectionLimit: maxPhotos - uploadedMedia.length,
        quality: 0.9,
        mediaTypes: ['images'],
      });

      if (!result.canceled && result.assets) {
        const newRows: JobMediaRow[] = [];
        for (const asset of result.assets) {
          if (uploadedMedia.length + newRows.length >= maxPhotos) break;
          const mediaRow = await uploadPhoto(asset.uri);
          if (mediaRow) newRows.push(mediaRow);
        }
        if (newRows.length > 0) {
          const allMedia = [...uploadedMedia, ...newRows];
          setUploadedMedia(allMedia);
          onUploaded?.(allMedia);
        }
      }
    } catch (e: any) {
      Alert.alert("Selection Failed", "Unable to select photos. Please try again.");
    }
  }, [uploadPhoto, uploadedMedia, onUploaded, maxPhotos]);

  const canAddMore = uploadedMedia.length < maxPhotos;

  return (
    <View style={{ marginVertical: 8 }}>
      <Text style={{ fontSize: 14, fontWeight: "600", color: colors.textPrimary, marginBottom: 8 }}>
        {label} ({uploadedMedia.length}/{maxPhotos})
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {uploadedMedia.map((media, idx) => (
          <TouchableOpacity
            key={media.id || idx}
            onPress={() => setSelectedImage(media.public_url || media.path)}
            style={[styles.thumbnail, { borderColor: colors.border }]}
          >
            <Image
              source={{ uri: media.public_url || `${'https://rbwbmxucypmwadwfjqvl.supabase.co/storage/v1'}/object/public/job-media/${media.path}` }}
              style={styles.thumbnailImage}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))}

        {canAddMore && (
          <TouchableOpacity
            onPress={() => setShowOptions(true)}
            disabled={uploading}
            style={[styles.addButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            {uploading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Ionicons name="camera" size={24} color={colors.primary} />
                <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>Add</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      <Modal visible={showOptions} transparent animationType="fade" onRequestClose={() => setShowOptions(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowOptions(false)}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Add Photo</Text>
            <TouchableOpacity style={[styles.modalOption, { borderColor: colors.border }]} onPress={handleCameraCapture}>
              <Ionicons name="camera" size={24} color={colors.primary} />
              <Text style={[styles.modalOptionText, { color: colors.textPrimary }]}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalOption, { borderColor: colors.border }]} onPress={handleLibraryPick}>
              <Ionicons name="images" size={24} color={colors.primary} />
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

export function JobMediaGallery({
  media,
  groupByCategory = false,
}: {
  media: JobMediaRow[];
  groupByCategory?: boolean;
}) {
  const { colors } = useTheme();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const categoryLabels: Record<string, string> = {
    customer_request: "Customer Photos",
    mechanic_before: "Before Work",
    mechanic_after: "After Work",
    dispute_evidence: "Dispute Evidence",
    support_evidence: "Support Evidence",
    parts_receipt: "Parts/Receipts",
    other: "Other",
  };

  const grouped = groupByCategory
    ? media.reduce((acc, m) => {
        const cat = m.media_category || "other";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(m);
        return acc;
      }, {} as Record<string, JobMediaRow[]>)
    : { all: media };

  if (media.length === 0) {
    return (
      <Text style={{ color: colors.textMuted, fontSize: 14, fontStyle: "italic" }}>
        No photos uploaded
      </Text>
    );
  }

  return (
    <View>
      {Object.entries(grouped).map(([cat, items]) => (
        <View key={cat} style={{ marginBottom: 12 }}>
          {groupByCategory && (
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textPrimary, marginBottom: 6 }}>
              {categoryLabels[cat] || cat} ({items.length})
            </Text>
          )}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {items.map((m) => (
              <TouchableOpacity
                key={m.id}
                onPress={() => setSelectedImage(m.public_url || m.path)}
                style={[styles.thumbnail, { borderColor: colors.border }]}
              >
                <Image
                  source={{ uri: m.public_url || `${'https://rbwbmxucypmwadwfjqvl.supabase.co/storage/v1'}/object/public/job-media/${m.path}` }}
                  style={styles.thumbnailImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ))}

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
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
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
