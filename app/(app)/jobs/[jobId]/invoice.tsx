import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native'
import { useState, useEffect } from 'react'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase } from '@/lib/supabase'

export default function InvoiceScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>()
  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [lockingInvoice, setLockingInvoice] = useState(false)

  useEffect(() => {
    loadInvoice()
  }, [])

  const loadInvoice = async () => {
    const { data, error } = await supabase
      .from('job_invoices')
      .select('*')
      .eq('job_id', jobId)
      .single()

    if (error && error.code !== 'PGRST116') {
      Alert.alert('Error', 'Failed to load invoice')
    }

    setInvoice(data)
    setLoading(false)
  }

  const handleLockInvoice = async () => {
    setLockingInvoice(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/lock-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ job_id: jobId }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to lock invoice')
      }

      setInvoice(result)
      Alert.alert('Success', 'Invoice locked and ready for payment')
    } catch (error: any) {
      Alert.alert('Error', error.message)
    } finally {
      setLockingInvoice(false)
    }
  }

  const handleProceedToPayment = () => {
    router.push(`/jobs/${jobId}/payment`)
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Loading invoice...</Text>
      </View>
    )
  }

  if (!invoice) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Invoice Not Ready</Text>
        <Text style={styles.description}>
          The invoice needs to be finalized before payment.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={handleLockInvoice}
          disabled={lockingInvoice}
        >
          <Text style={styles.buttonText}>
            {lockingInvoice ? 'Finalizing...' : 'Finalize Invoice'}
          </Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Invoice</Text>
      <Text style={styles.subtitle}>Final Receipt</Text>

      <View style={styles.card}>
        {invoice.line_items.map((item: any, index: number) => (
          <View key={index} style={styles.lineItem}>
            <Text style={styles.lineItemDescription}>{item.description}</Text>
            <Text style={styles.lineItemAmount}>
              ${(item.amount_cents / 100).toFixed(2)}
            </Text>
          </View>
        ))}

        <View style={styles.divider} />

        <View style={styles.lineItem}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>
            ${(invoice.total_cents / 100).toFixed(2)}
          </Text>
        </View>
      </View>

      {invoice.status === 'locked' && (
        <TouchableOpacity
          style={styles.payButton}
          onPress={handleProceedToPayment}
        >
          <Text style={styles.payButtonText}>Proceed to Payment</Text>
        </TouchableOpacity>
      )}

      {invoice.status === 'paid' && (
        <View style={styles.paidBadge}>
          <Text style={styles.paidText}>✓ Paid</Text>
        </View>
      )}
    </ScrollView>
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  lineItemDescription: {
    fontSize: 16,
    color: '#333',
  },
  lineItemAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  payButton: {
    backgroundColor: '#4CAF50',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  payButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  paidBadge: {
    backgroundColor: '#4CAF50',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  paidText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
})
