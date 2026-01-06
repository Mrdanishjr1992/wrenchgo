import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { useState, useEffect } from 'react'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'

export default function PaymentProcessingScreen() {
  const { jobId, paymentId } = useLocalSearchParams<{ jobId: string; paymentId: string }>()
  const [status, setStatus] = useState<string>('processing')
  const [message, setMessage] = useState('Processing your payment...')

  useEffect(() => {
    let channel: RealtimeChannel

    const setupRealtimeSubscription = async () => {
      channel = supabase
        .channel(`payment:${paymentId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'payments',
            filter: `id=eq.${paymentId}`,
          },
          (payload) => {
            const newStatus = payload.new.status

            if (newStatus === 'succeeded') {
              setStatus('succeeded')
              setMessage('Payment successful!')
              setTimeout(() => {
                router.replace(`/jobs/${jobId}/payment-success`)
              }, 2000)
            } else if (newStatus === 'failed') {
              setStatus('failed')
              setMessage('Payment failed. Please try again.')
            } else if (newStatus === 'requires_action') {
              setStatus('requires_action')
              setMessage('Additional authentication required.')
            }
          }
        )
        .subscribe()

      const { data: payment } = await supabase
        .from('payments')
        .select('status')
        .eq('id', paymentId)
        .single()

      if (payment) {
        if (payment.status === 'succeeded') {
          setStatus('succeeded')
          setMessage('Payment successful!')
          setTimeout(() => {
            router.replace(`/jobs/${jobId}/payment-success`)
          }, 2000)
        } else if (payment.status === 'failed') {
          setStatus('failed')
          setMessage('Payment failed. Please try again.')
        }
      }
    }

    setupRealtimeSubscription()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [paymentId, jobId])

  return (
    <View style={styles.container}>
      {status === 'processing' && <ActivityIndicator size="large" color="#007AFF" />}
      {status === 'succeeded' && <Text style={styles.successIcon}>✓</Text>}
      {status === 'failed' && <Text style={styles.errorIcon}>✗</Text>}

      <Text style={styles.message}>{message}</Text>

      {status === 'processing' && (
        <Text style={styles.subMessage}>
          Please do not close this screen. This may take a few moments.
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  successIcon: {
    fontSize: 80,
    color: '#4CAF50',
    marginBottom: 24,
  },
  errorIcon: {
    fontSize: 80,
    color: '#F44336',
    marginBottom: 24,
  },
  message: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  subMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
  },
})
