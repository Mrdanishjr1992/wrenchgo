import { View, Text, Dimensions, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { AppButton } from "../src/ui/components/AppButton";
import { useTheme } from "../src/ui/theme-context";
import React from "react";

export default function InfoPage() {
  const router = useRouter();
  const { width } = Dimensions.get("window");
  const { colors, text, spacing, radius } = useTheme();

  const playerMuted = useVideoPlayer(
    require("../assets/logovideo.mp4"),
    (player) => {
      player.muted = true;
      player.loop = false;
      player.play();
    }
  );

  const playerSound = useVideoPlayer(
    require("../assets/wrenchGoAd.mp4"),
    (player) => {
      player.muted = true;
      player.loop = false;
      player.play();
    }
  );

  return (
    <FlatList
      removeClippedSubviews={false}
      style={{ flex: 1, backgroundColor: colors.bg }}
      data={[]}
      keyExtractor={() => "x"}
      renderItem={null}
      contentContainerStyle={{ 
        padding: spacing.xl, 
        alignItems: "center",
        paddingBottom: spacing.xl, 
      }}
      ListHeaderComponent={
        <>
          <AppButton
            style={{ alignSelf: "flex-start", marginBottom: spacing.md }}
            onPress={() => router.replace("/")}
            title="← Back"
            variant="link"
          />

          <VideoView
            player={playerMuted}
            style={{ 
              width: width * 0.9, 
              height: 120, 
              borderRadius: radius.lg, 
              backgroundColor: colors.bg,
              borderColor: "transparent",
              marginBottom: spacing.xl,
              elevation: 5
            }}
            nativeControls={false}
            fullscreenOptions={{ enable: false }}
          />

          <View style={{ 
            width: "100%", 
            backgroundColor: colors.bg,
            borderRadius: radius.lg,
            padding: spacing.lg,
            marginBottom: spacing.xl,
            borderColor: "transparent",
            elevation: 2
          }}>
            <Text style={[text.section, { 
              marginBottom: spacing.md,
              textAlign: "center",
              fontSize: 24,
              fontWeight: "700"
            }]}>
              Why WrenchGo Exists
            </Text>

            <View style={{ 
              height: 3, 
              width: 60, 
              backgroundColor: colors.accent,
              alignSelf: "center",
              marginBottom: spacing.lg,
              borderRadius: radius.sm
            }} />

            <Text style={[text.body, { 
              marginBottom: spacing.md,
              lineHeight: 24
            }]}>
              I&apos;m a mechanic with over 15 years of hands‑on experience in the industry.
              I&apos;ve seen both sides of the problem — the struggles mechanics face trying to
              find consistent, honest work, and the frustration customers feel when they
              don&apos;t know who to trust.
            </Text>

            <Text style={[text.body, { 
              marginBottom: spacing.md,
              lineHeight: 24
            }]}>
              Over the years, trust between mechanics and customers has slowly eroded.
              Many customers fear being taken advantage of, while many mechanics feel
              misunderstood and unfairly judged. This gap creates tension, confusion,
              and bad experiences for everyone involved.
            </Text>

            <Text style={[text.body, { 
              marginBottom: spacing.md,
              lineHeight: 24
            }]}>
              The truth is, most mechanics are hardworking people trying to make a living
              in a challenging and often overlooked industry. At the same time, customers
              deserve transparency, clarity, and peace of mind when fixing their vehicles.
            </Text>

            <View style={{ 
              backgroundColor: `${colors.accent}15`,
              padding: spacing.md,
              borderRadius: radius.md,
              borderLeftWidth: 4,
              borderLeftColor: colors.accent,
              marginVertical: spacing.md
            }}>
              <Text style={[text.body, { 
                fontWeight: "700",
                fontSize: 16,
                lineHeight: 24
              }]}>
                WrenchGo was built to break that cycle.
              </Text>
            </View>

            <Text style={[text.body, { 
              marginBottom: spacing.md,
              lineHeight: 24
            }]}>
              This platform exists to rebuild trust — by creating a space where customers
              can confidently connect with mechanics, and mechanics can find steady,
              honest work without pressure or shortcuts.
            </Text>

            <Text style={[text.body, { 
              marginBottom: spacing.md,
              lineHeight: 24
            }]}>
              WrenchGo is for both sides. It&apos;s for mechanics who want consistent work
              without compromising their integrity. And it&apos;s for customers who want
              their cars fixed without fear or uncertainty.
            </Text>

            <Text style={[text.body, { 
              marginBottom: spacing.md,
              lineHeight: 24
            }]}>
              This app is just the beginning. We're asking for your patience, your support,
              and your trust. Simply using the app, checking in on our progress, and
              spreading the word helps more than you know.
            </Text>

            <View style={{ 
              backgroundColor: `${colors.accent}15`,
              padding: spacing.md,
              borderRadius: radius.md,
              marginTop: spacing.md
            }}>
              <Text style={[text.body, { 
                fontWeight: "700",
                fontSize: 16,
                textAlign: "center",
                lineHeight: 24
              }]}>
                There&apos;s no risk — only the chance to help build something better for everyone.
              </Text>
            </View>
          </View>

          <VideoView
            player={playerSound}
            style={{
              width: width * 0.9,
              height: 220,
              borderRadius: radius.lg,
              marginBottom: spacing.lg,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 5
            }}
            nativeControls={true}
            fullscreenOptions={{ enable: true }}
          />
        </>
      }
    />
  );
}
