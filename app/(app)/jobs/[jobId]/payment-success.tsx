import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import React from 'react'

export default function PaymentSuccessScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>()

  return (
    <View style={styles.container}>
      <Text style={styles.successIcon}>✓</Text>
      <Text style={styles.title}>Payment Successful!</Text>
      <Text style={styles.message}>
        Your payment has been processed successfully. Both you and the mechanic have been notified.
      </Text>
      <Text style={styles.subMessage}>
        The mechanic will receive their payment at the end of the week.
      </Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push(`/jobs/${jobId}`)}
      >
        <Text style={styles.buttonText}>View Job Details</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.push('/jobs')}
      >
        <Text style={styles.secondaryButtonText}>Back to Jobs</Text>
      </TouchableOpacity>
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
    fontSize: 100,
    color: '#4CAF50',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 26,
  },
  subMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 18,
    fontWeight: '600',
  },
})
