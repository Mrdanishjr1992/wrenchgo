import React, { useEffect, useState } from "react";
import { View, Text, Dimensions, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { VideoView, useVideoPlayer } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { AppButton } from "../src/ui/components/AppButton";
import { useTheme } from "../src/ui/theme-context";
import { getMediaUrl, initializeMediaAssets, MEDIA_KEYS } from "../src/lib/mediaAssets";

function VideoPlayer({ url, height, showControls }: { url: string; height: number; showControls: boolean }) {
  const { width } = Dimensions.get("window");
  const { colors, radius } = useTheme();
  
  const player = useVideoPlayer(url, (p) => {
    p.muted = !showControls;
    p.loop = false;
    p.play();
  });

  return (
    <View style={{
      width: width - 48,
      height,
      borderRadius: radius.lg,
      overflow: "hidden",
      backgroundColor: colors.surface,
    }}>
      <VideoView
        player={player}
        style={{ width: "100%", height: "100%" }}
        nativeControls={showControls}
        contentFit="cover"
      />
    </View>
  );
}

export default function InfoPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, text, spacing, radius } = useTheme();
  const [logoVideoUrl, setLogoVideoUrl] = useState<string | null>(null);
  const [adVideoUrl, setAdVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadVideos = async () => {
      await initializeMediaAssets();
      const logoUrl = await getMediaUrl(MEDIA_KEYS.LOGO_VIDEO);
      const adUrl = await getMediaUrl(MEDIA_KEYS.WRENCHGO_AD_1);
      setLogoVideoUrl(logoUrl);
      setAdVideoUrl(adUrl);
    };
    loadVideos();
  }, []);

  if (!logoVideoUrl || !adVideoUrl) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[text.muted, { marginTop: spacing.md }]}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ 
        paddingTop: insets.top + spacing.lg,
        paddingBottom: insets.bottom + spacing.xl,
        paddingHorizontal: spacing.lg,
        alignItems: "center",
      }}
    >
      <View style={{ width: "100%", marginBottom: spacing.lg }}>
        <AppButton
          onPress={() => router.back()}
          title="Back"
          variant="ghost"
          leftIcon={<Ionicons name="arrow-back" size={20} color={colors.primary} />}
        />
      </View>

      <View style={{ marginBottom: spacing.xl }}>
        <VideoPlayer url={logoVideoUrl} height={120} showControls={false} />
      </View>

      <View style={{ 
        width: "100%", 
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        marginBottom: spacing.xl,
      }}>
        <Text style={[text.title, { 
          marginBottom: spacing.sm,
          textAlign: "center",
          fontSize: 22,
        }]}>
          Why WrenchGo Exists
        </Text>

        <View style={{ 
          height: 3, 
          width: 60, 
          backgroundColor: colors.primary,
          alignSelf: "center",
          marginBottom: spacing.lg,
          borderRadius: 2,
        }} />

        <Text style={[text.body, { marginBottom: spacing.md, lineHeight: 22 }]}>
          I'm a mechanic with over 15 years of hands-on experience in the industry.
          I've seen both sides of the problem — the struggles mechanics face trying to
          find consistent, honest work, and the frustration customers feel when they
          don't know who to trust.
        </Text>

        <Text style={[text.body, { marginBottom: spacing.md, lineHeight: 22 }]}>
          Over the years, trust between mechanics and customers has slowly eroded.
          Many customers fear being taken advantage of, while many mechanics feel
          misunderstood and unfairly judged.
        </Text>

        <Text style={[text.body, { marginBottom: spacing.md, lineHeight: 22 }]}>
          The truth is, most mechanics are hardworking people trying to make a living
          in a challenging and often overlooked industry. At the same time, customers
          deserve transparency, clarity, and peace of mind.
        </Text>

        <View style={{ 
          backgroundColor: `${colors.primary}15`,
          padding: spacing.md,
          borderRadius: radius.md,
          borderLeftWidth: 4,
          borderLeftColor: colors.primary,
          marginVertical: spacing.md,
        }}>
          <Text style={[text.body, { fontWeight: "700", fontSize: 15 }]}>
            WrenchGo was built to break that cycle.
          </Text>
        </View>

        <Text style={[text.body, { marginBottom: spacing.md, lineHeight: 22 }]}>
          This platform exists to rebuild trust by creating a space where customers
          can confidently connect with mechanics, and mechanics can find steady,
          honest work without pressure or shortcuts.
        </Text>

        <Text style={[text.body, { marginBottom: spacing.md, lineHeight: 22 }]}>
          WrenchGo is for both sides. It's for mechanics who want consistent work
          without compromising their integrity. And it's for customers who want
          their cars fixed without fear or uncertainty.
        </Text>

        <View style={{ 
          backgroundColor: `${colors.primary}10`,
          padding: spacing.md,
          borderRadius: radius.md,
          marginTop: spacing.sm,
        }}>
          <Text style={[text.body, { fontWeight: "600", textAlign: "center", fontSize: 14 }]}>
            There's no risk — only the chance to help build something better for everyone.
          </Text>
        </View>
      </View>

      <View style={{ marginBottom: spacing.lg }}>
        <VideoPlayer url={adVideoUrl} height={200} showControls={true} />
      </View>
    </ScrollView>
  );
}
