import { supabase } from '@/lib/supabase'

export async function createStripeConnectAccountLink(returnUrl: string, refreshUrl: string) {
  const { data: { session } } = await supabase.auth.getSession()

  const response = await fetch(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-stripe-connect-account-link`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ return_url: returnUrl, refresh_url: refreshUrl }),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create account link')
  }

  return response.json()
}

export async function lockInvoice(jobId: string) {
  const { data: { session } } = await supabase.auth.getSession()

  const response = await fetch(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/lock-invoice`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ job_id: jobId }),
    }
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to lock invoice')
  }

  return response.json()
}

export async function createPaymentIntent(jobId: string) {
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

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create payment intent')
  }

  return response.json()
}
