 awit// Example: Using Project B in your React Native components
// app/examples/ProjectBExample.tsx

import { useEffect, useState } from 'react'
import { View, Text, Button } from 'react-native'
import { getProjectBUsers, createProjectBRecord, callProjectBRPC } from '@/utils/projectBClient'

export default function ProjectBExample() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Example 1: Fetch data from Project B
  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    
    const { data, error } = await getProjectBUsers()
    
    if (error) {
      setError(error.message)
    } else {
      setUsers(data || [])
    }
    
    setLoading(false)
  }

  // Example 2: Create record in Project B
  const createRecord = async () => {
    const { data, error } = await createProjectBRecord('logs', {
      action: 'test_from_project_a',
      timestamp: new Date().toISOString()
    })

    if (error) {
      console.error('Failed to create record:', error)
    } else {
      console.log('Created record:', data)
    }
  }

  // Example 3: Call RPC function in Project B
  const callCustomFunction = async () => {
    const { data, error } = await callProjectBRPC('get_statistics', {
      start_date: '2025-01-01',
      end_date: '2025-01-31'
    })

    if (error) {
      console.error('RPC failed:', error)
    } else {
      console.log('Statistics:', data)
    }
  }

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 20, marginBottom: 10 }}>Project B Integration</Text>
      
      <Button title="Fetch Users from Project B" onPress={fetchUsers} />
      <Button title="Create Log in Project B" onPress={createRecord} />
      <Button title="Call RPC in Project B" onPress={callCustomFunction} />

      {loading && <Text>Loading...</Text>}
      {error && <Text style={{ color: 'red' }}>Error: {error}</Text>}
      
      {users.length > 0 && (
        <View style={{ marginTop: 20 }}>
          <Text style={{ fontWeight: 'bold' }}>Users from Project B:</Text>
          {users.map((user) => (
            <Text key={user.id}>{user.email}</Text>
          ))}
        </View>
      )}
    </View>
  )
}
