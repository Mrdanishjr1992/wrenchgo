import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { useState, useEffect } from 'react'
import { useLocalSearchParams, router } from 'expo-router'
import { useStripe } from '@stripe/stripe-react-native'
import { supabase } from '@/lib/supabase'

export default function PaymentScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>()
  const { initPaymentSheet, presentPaymentSheet } = useStripe()
  const [loading, setLoading] = useState(false)
  const [invoice, setInvoice] = useState<any>(null)

  useEffect(() => {
    loadInvoice()
  }, [])

  const loadInvoice = async () => {
    const { data, error } = await supabase
      .from('job_invoices')
      .select('*')
      .eq('job_id', jobId)
      .single()

    if (error) {
      Alert.alert('Error', 'Failed to load invoice')
      return
    }

    setInvoice(data)
  }

  const handlePayment = async () => {
    setLoading(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-payment-intent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ job_id: jobId }),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create payment')
      }

      const { client_secret, payment_id } = result

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: client_secret,
        merchantDisplayName: 'WrenchGo',
        returnURL: 'wrenchgo://payment-complete',
      })

      if (initError) {
        throw new Error(initError.message)
      }

      const { error: presentError } = await presentPaymentSheet()

      if (presentError) {
        if (presentError.code === 'Canceled') {
          Alert.alert('Payment Cancelled', 'You cancelled the payment.')
        } else {
          throw new Error(presentError.message)
        }
        return
      }

      router.push(`/jobs/${jobId}/payment-processing?paymentId=${payment_id}`)
    } catch (error: any) {
      Alert.alert('Payment Error', error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Payment</Text>

      {invoice && (
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Total Amount</Text>
          <Text style={styles.amountValue}>
            ${(invoice.total_cents / 100).toFixed(2)}
          </Text>
        </View>
      )}

      <Text style={styles.description}>
        Your payment will be processed securely through Stripe. The mechanic will receive their payment at the end of the week.
      </Text>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handlePayment}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Processing...' : 'Pay Now'}
        </Text>
      </TouchableOpacity>
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
    marginBottom: 24,
  },
  amountCard: {
    backgroundColor: '#f0f0f0',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
  },
  amountLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#000',
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
})
