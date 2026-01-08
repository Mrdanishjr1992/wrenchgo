import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { useState, useEffect, useCallback } from 'react'
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router'
import { useStripe } from '@stripe/stripe-react-native'
import { supabase } from '@/lib/supabase'

export default function PaymentScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>()
  const { initPaymentSheet, presentPaymentSheet } = useStripe()
  const [loading, setLoading] = useState(false)
  const [invoice, setInvoice] = useState<any>(null)
  const [hasPaymentMethod, setHasPaymentMethod] = useState<boolean>(false)
  const [checkingPayment, setCheckingPayment] = useState(true)

  useFocusEffect(
    useCallback(() => {
      loadInvoice()
      checkPaymentMethod()
    }, [])
  )

  const checkPaymentMethod = async () => {
    try {
      setCheckingPayment(true)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/(auth)/sign-in')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('payment_method_status')
        .eq('id', session.user.id)
        .single()

      const hasMethod = profile?.payment_method_status === 'active'
      setHasPaymentMethod(hasMethod)

      if (!hasMethod) {
        Alert.alert(
          'Payment Method Required',
          'Please add a payment method to continue with payment.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => router.back()
            },
            {
              text: 'Add Payment Method',
              onPress: () => {
                router.push({
                  pathname: '/(customer)/payment-setup',
                  params: { returnTo: `/jobs/${jobId}/payment` }
                } as any)
              }
            }
          ]
        )
      }
    } catch (error) {
      console.error('Error checking payment method:', error)
    } finally {
      setCheckingPayment(false)
    }
  }

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
    if (!hasPaymentMethod) {
      Alert.alert(
        'Payment Method Required',
        'Please add a payment method first.',
        [
          {
            text: 'Add Payment Method',
            onPress: () => {
              router.push({
                pathname: '/(customer)/payment-setup',
                params: { returnTo: `/jobs/${jobId}/payment` }
              } as any)
            }
          }
        ]
      )
      return
    }

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

  if (checkingPayment) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Loading...</Text>
      </View>
    )
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

      {!hasPaymentMethod && (
        <View style={styles.warningCard}>
          <Text style={styles.warningText}>
            ⚠️ Payment method required. Please add a payment method to continue.
          </Text>
          <TouchableOpacity
            style={styles.addPaymentButton}
            onPress={() => {
              router.push({
                pathname: '/(customer)/payment-setup',
                params: { returnTo: `/jobs/${jobId}/payment` }
              } as any)
            }}
          >
            <Text style={styles.addPaymentButtonText}>Add Payment Method</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, (loading || !hasPaymentMethod) && styles.buttonDisabled]}
        onPress={handlePayment}
        disabled={loading || !hasPaymentMethod}
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
  warningCard: {
    backgroundColor: '#fff3cd',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ffc107',
    marginBottom: 24,
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    marginBottom: 12,
    lineHeight: 20,
  },
  addPaymentButton: {
    backgroundColor: '#ffc107',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addPaymentButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
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