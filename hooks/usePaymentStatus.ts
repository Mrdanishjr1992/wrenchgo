import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { RealtimeChannel } from '@supabase/supabase-js'

interface Payment {
  id: string
  status: string
  amount_cents: number
  error_message?: string
}

export function usePaymentStatus(paymentId: string | undefined) {
  const [payment, setPayment] = useState<Payment | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!paymentId) return

    let channel: RealtimeChannel

    const fetchPayment = async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single()

      if (data) {
        setPayment(data)
      }
      setLoading(false)
    }

    const setupRealtimeSubscription = () => {
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
            setPayment(payload.new as Payment)
          }
        )
        .subscribe()
    }

    fetchPayment()
    setupRealtimeSubscription()

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [paymentId])

  return { payment, loading }
}
