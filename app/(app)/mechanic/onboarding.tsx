import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking } from 'react-native'
import { useState, useEffect } from 'react'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export default function MechanicOnboardingScreen() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [account, setAccount] = useState<any>(null)

  useEffect(() => {
    loadAccount()
  }, [])

  const loadAccount = async () => {
    const { data, error } = await supabase
      .from('mechanic_stripe_accounts')
      .select('*')
      .eq('mechanic_id', user?.id)
      .single()

    if (data) {
      setAccount(data)
    }
  }

  const handleStartOnboarding = async () => {
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const returnUrl = 'wrenchgo://onboarding-complete'
      const refreshUrl = 'wrenchgo://onboarding-refresh'

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-stripe-connect-account-link`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            return_url: returnUrl,
            refresh_url: refreshUrl,
          }),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create onboarding link')
      }

      await Linking.openURL(result.url)
    } catch (error: any) {
      Alert.alert('Error', error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Stripe Connect Onboarding</Text>

      {!account?.onboarding_completed ? (
        <>
          <Text style={styles.description}>
            To receive payments, you need to complete Stripe Connect onboarding. This will allow us to securely transfer your earnings to your bank account.
          </Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>What you'll need:</Text>
            <Text style={styles.infoItem}>• Government-issued ID</Text>
            <Text style={styles.infoItem}>• Bank account details</Text>
            <Text style={styles.infoItem}>• Business information (if applicable)</Text>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleStartOnboarding}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Loading...' : 'Start Onboarding'}
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <View style={styles.successBadge}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successText}>Onboarding Complete</Text>
          </View>

          <View style={styles.statusCard}>
            <StatusRow label="Charges Enabled" value={account.charges_enabled} />
            <StatusRow label="Payouts Enabled" value={account.payouts_enabled} />
            <StatusRow label="Details Submitted" value={account.details_submitted} />
          </View>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.back()}
          >
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  )
}

function StatusRow({ label, value }: { label: string; value: boolean }) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={[styles.statusValue, value ? styles.statusEnabled : styles.statusDisabled]}>
        {value ? '✓ Enabled' : '✗ Disabled'}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    lineHeight: 24,
  },
  infoBox: {
    backgroundColor: '#f0f0f0',
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  infoItem: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  successBadge: {
    backgroundColor: '#4CAF50',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  successIcon: {
    fontSize: 48,
    color: '#fff',
    marginBottom: 8,
  },
  successText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statusCard: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statusLabel: {
    fontSize: 16,
    color: '#333',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusEnabled: {
    color: '#4CAF50',
  },
  statusDisabled: {
    color: '#F44336',
  },
  secondaryButton: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 18,
    fontWeight: '600',
  },
})
