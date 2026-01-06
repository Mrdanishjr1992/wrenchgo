import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { useState } from 'react'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export default function JobCompletionScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [job, setJob] = useState<any>(null)

  const loadJob = async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (error) {
      Alert.alert('Error', 'Failed to load job')
      return
    }

    setJob(data)
  }

  const handleVerifyCompletion = async () => {
    setLoading(true)

    try {
      const role = user?.id === job?.mechanic_id ? 'mechanic' : 'customer'

      const { data, error } = await supabase.rpc('verify_job_completion', {
        p_job_id: jobId,
        p_role: role,
      })

      if (error) throw error

      if (!data.success) {
        Alert.alert('Error', data.error)
        return
      }

      Alert.alert('Success', 'Job completion verified')

      if (role === 'customer') {
        router.push(`/jobs/${jobId}/invoice`)
      } else {
        router.back()
      }
    } catch (error: any) {
      Alert.alert('Error', error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify Job Completion</Text>
      <Text style={styles.description}>
        Both mechanic and customer must verify that the job is complete before payment can be processed.
      </Text>

      {job?.mechanic_verified_at && (
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>✓ Mechanic Verified</Text>
        </View>
      )}

      {job?.customer_verified_at && (
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>✓ Customer Verified</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleVerifyCompletion}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Verifying...' : 'Verify Completion'}
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
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  statusBadge: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
})
