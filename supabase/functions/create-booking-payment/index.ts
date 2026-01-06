import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { job_id, quote_id } = await req.json()

    if (!job_id || !quote_id) {
      return new Response(JSON.stringify({ error: 'Missing job_id or quote_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', job_id)
      .single()

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (job.customer_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Only customer can initiate payment' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', quote_id)
      .eq('job_id', job_id)
      .single()

    if (quoteError || !quote) {
      return new Response(JSON.stringify({
        error: 'Quote not found',
        quote_id,
        job_id,
        db_error: quoteError?.message
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: mechanicAccount } = await supabase
      .from('mechanic_stripe_accounts')
      .select('*')
      .eq('mechanic_id', quote.mechanic_id)
      .single()

    const idempotencyKey = `booking_${job_id}_${quote_id}_${Date.now()}`

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: quote.price_cents,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: {
          job_id,
          quote_id,
          customer_id: job.customer_id,
          mechanic_id: quote.mechanic_id,
          type: 'booking_payment',
          mechanic_stripe_account_id: mechanicAccount?.stripe_account_id || '',
        },
        description: `WrenchGo Booking: ${job.title}`,
      },
      { idempotencyKey }
    )

    await supabase
      .from('payments')
      .insert({
        job_id,
        customer_id: job.customer_id,
        mechanic_id: quote.mechanic_id,
        stripe_payment_intent_id: paymentIntent.id,
        amount_cents: quote.price_cents,
        status: 'pending',
        client_secret: paymentIntent.client_secret,
        metadata: {
          quote_id,
          type: 'booking_payment',
          mechanic_stripe_account_id: mechanicAccount?.stripe_account_id || null,
        },
      })

    return new Response(
      JSON.stringify({
        success: true,
        client_secret: paymentIntent.client_secret,
        amount_cents: quote.price_cents,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error: any) {
    console.error('Create booking payment error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
