import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/src/ui/theme-context';
import { joinWaitlist } from '@/src/lib/service-area';

interface Props {
  zip: string;
  distanceMiles: number | null;
  nearestHub: string | null;
  boundaryStatus: 'inside' | 'near_boundary' | 'outside';
  userType?: 'customer' | 'mechanic';
  onRetry?: () => void;
}

export function OutOfServiceArea({
  zip,
  distanceMiles,
  nearestHub,
  boundaryStatus,
  userType = 'customer',
  onRetry,
}: Props) {
  const { colors, spacing, text, radius } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleJoinWaitlist = async () => {
    if (!email.includes('@')) return;
    setLoading(true);
    const res = await joinWaitlist({ email, zip, userType });
    setResult(res);
    setLoading(false);
  };

  // Near boundary - show warning but allow continue
  if (boundaryStatus === 'near_boundary') {
    return (
      <View style={{
        backgroundColor: colors.warningBg,
        padding: spacing.md,
        borderRadius: radius.md,
        marginHorizontal: spacing.md,
        marginBottom: spacing.md,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="warning" size={20} color={colors.warning} />
          <Text style={{ color: colors.warning, fontWeight: '600', flex: 1 }}>
            Near Service Area Boundary
          </Text>
        </View>
        <Text style={{ color: colors.warning, marginTop: 4, fontSize: 13 }}>
          You're close to the edge of our {nearestHub} area. Some services may have limited availability.
        </Text>
      </View>
    );
  }

  // Outside service area
  return (
    <View style={{ flex: 1, padding: spacing.xl, justifyContent: 'center' }}>
      <Ionicons
        name="location-outline"
        size={64}
        color={colors.accent}
        style={{ alignSelf: 'center' }}
      />

      <Text style={[text.title, { textAlign: 'center', marginTop: spacing.lg }]}>
        We're Not There Yet
      </Text>

      <Text style={[text.body, { textAlign: 'center', marginTop: spacing.md, color: colors.textMuted }]}>
        {distanceMiles && nearestHub
          ? `You're ${distanceMiles} miles from our ${nearestHub} service area.`
          : 'Your location is outside our current service area.'}
      </Text>

      <Text style={[text.body, { textAlign: 'center', marginTop: spacing.xs, color: colors.textMuted }]}>
        We're expanding soon!
      </Text>

      {!result ? (
        <View style={{ marginTop: spacing.xl }}>
          <Text style={[text.body, { textAlign: 'center', marginBottom: spacing.md }]}>
            Join the waitlist to be notified:
          </Text>

          <TextInput
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              padding: spacing.md,
              backgroundColor: colors.surface,
              color: colors.textPrimary,
            }}
            placeholder="your@email.com"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Pressable
            onPress={handleJoinWaitlist}
            disabled={loading || !email.includes('@')}
            style={{
              backgroundColor: email.includes('@') ? colors.accent : colors.border,
              padding: spacing.md,
              borderRadius: radius.md,
              marginTop: spacing.md,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color={colors.buttonText} />
            ) : (
              <Text style={{ color: colors.buttonText, fontWeight: '600', textAlign: 'center' }}>
                Notify Me
              </Text>
            )}
          </Pressable>
        </View>
      ) : (
        <View style={{
          backgroundColor: result.success ? colors.successBg : colors.errorBg,
          padding: spacing.lg,
          borderRadius: radius.lg,
          marginTop: spacing.xl,
        }}>
          <Ionicons
            name={result.success ? 'checkmark-circle' : 'alert-circle'}
            size={32}
            color={result.success ? colors.success : colors.error}
            style={{ alignSelf: 'center' }}
          />
          <Text style={[text.body, { textAlign: 'center', marginTop: spacing.sm }]}>
            {result.message}
          </Text>
        </View>
      )}

      {onRetry && (
        <Pressable onPress={onRetry} style={{ marginTop: spacing.lg }}>
          <Text style={{ color: colors.accent, textAlign: 'center' }}>
            Try a different location
          </Text>
        </Pressable>
      )}
    </View>
  );
}
