import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const { job_id } = await req.json()

    if (!job_id) {
      return new Response(JSON.stringify({ error: 'Missing job_id' }), { status: 400 })
    }

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', job_id)
      .single()

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404 })
    }

    if (job.customer_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Only customer can initiate payment' }), { status: 403 })
    }

    if (job.status !== 'completed') {
      return new Response(JSON.stringify({ error: 'Job not completed yet' }), { status: 400 })
    }

    if (!job.mechanic_verified_at || !job.customer_verified_at) {
      return new Response(JSON.stringify({ error: 'Both parties must verify completion' }), { status: 400 })
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from('job_invoices')
      .select('*')
      .eq('job_id', job_id)
      .single()

    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ error: 'Invoice not found or not locked' }), { status: 404 })
    }

    if (invoice.status !== 'locked') {
      return new Response(JSON.stringify({ error: 'Invoice not locked' }), { status: 400 })
    }

    const { data: existingPayment } = await supabase
      .from('payments')
      .select('*')
      .eq('job_id', job_id)
      .in('status', ['pending', 'processing', 'requires_action', 'succeeded'])
      .single()

    if (existingPayment) {
      return new Response(
        JSON.stringify({
          success: true,
          payment_id: existingPayment.id,
          client_secret: existingPayment.client_secret,
          status: existingPayment.status,
          already_exists: true,
        }),
        { status: 200 }
      )
    }

    const { data: mechanicAccount, error: mechanicAccountError } = await supabase
      .from('mechanic_stripe_accounts')
      .select('*')
      .eq('mechanic_id', job.mechanic_id)
      .single()

    if (mechanicAccountError || !mechanicAccount || !mechanicAccount.onboarding_completed) {
      return new Response(JSON.stringify({ error: 'Mechanic not onboarded' }), { status: 400 })
    }

    const idempotencyKey = `payment_${job_id}_${Date.now()}`

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: invoice.total_cents,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: {
          job_id,
          invoice_id: invoice.id,
          customer_id: job.customer_id,
          mechanic_id: job.mechanic_id,
          mechanic_stripe_account_id: mechanicAccount.stripe_account_id,
          mechanic_net_cents: invoice.mechanic_net_cents.toString(),
          platform_fee_cents: invoice.platform_fee_cents.toString(),
        },
        description: `WrenchGo Job: ${job.title}`,
      },
      { idempotencyKey }
    )

    const { data: payment, error: paymentInsertError } = await supabase
      .from('payments')
      .insert({
        job_id,
        invoice_id: invoice.id,
        customer_id: job.customer_id,
        mechanic_id: job.mechanic_id,
        stripe_payment_intent_id: paymentIntent.id,
        amount_cents: invoice.total_cents,
        status: 'pending',
        client_secret: paymentIntent.client_secret,
        metadata: {
          mechanic_stripe_account_id: mechanicAccount.stripe_account_id,
          mechanic_net_cents: invoice.mechanic_net_cents,
          platform_fee_cents: invoice.platform_fee_cents,
        },
      })
      .select()
      .single()

    if (paymentInsertError) {
      throw paymentInsertError
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: payment.id,
        client_secret: paymentIntent.client_secret,
        amount_cents: invoice.total_cents,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error creating payment intent:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
