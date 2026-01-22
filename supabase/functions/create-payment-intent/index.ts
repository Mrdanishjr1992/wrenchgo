import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import Stripe from 'https://esm.sh/stripe@13.11.0?target=deno'

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Stripe API version to use for Ephemeral Keys (required by Stripe)
const STRIPE_API_VERSION = '2023-10-16'

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const { contract_id, use_promo } = await req.json().catch(() => ({}))

    if (!contract_id) {
      return new Response(JSON.stringify({ error: 'contract_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !stripeSecretKey) {
      return new Response(JSON.stringify({
        error: 'Server configuration error',
        details: {
          hasSupabaseUrl: !!supabaseUrl,
          hasAnonKey: !!supabaseAnonKey,
          hasServiceKey: !!supabaseServiceRoleKey,
          hasStripeKey: !!stripeSecretKey,
        },
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Create Stripe client
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: STRIPE_API_VERSION,
    })

    // User-scoped Supabase client
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // Admin Supabase client (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Fetch contract details
    const { data: contract, error: contractError } = await supabaseAdmin
      .from('job_contracts')
      .select(
        `
          id,
          job_id,
          customer_id,
          mechanic_id,
          status,
          quoted_price_cents,
          platform_fee_cents,
          total_customer_cents,
          stripe_payment_intent_id,
          payment_authorized_at,
          payment_captured_at
        `
      )
      .eq('id', contract_id)
      .single()

    if (contractError || !contract) {
      return new Response(JSON.stringify({ error: 'Contract not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify this contract belongs to the authenticated customer
    if (contract.customer_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // If already authorized/captured, we can still return the existing PI (if any)
    // so the client can decide what to do.

    // Get customer profile for Stripe customer ID
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id, payment_method_status')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.stripe_customer_id) {
      return new Response(JSON.stringify({
        error: 'Customer not found or Stripe customer not set',
        code: 'STRIPE_CUSTOMER_MISSING',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (profile.payment_method_status !== 'active') {
      return new Response(JSON.stringify({
        error: 'No active payment method on file',
        code: 'PAYMENT_METHOD_REQUIRED',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Determine promo discount (preview only; consumption happens after PI confirms)
    let promo = {
      requested: !!use_promo,
      has_credit: false,
      discount_cents: 0,
      fee_after_cents: contract.platform_fee_cents,
      message: null as string | null,
    }

    if (use_promo) {
      const { data: preview, error: previewError } = await supabase.rpc('preview_promo_discount', {
        p_platform_fee_cents: contract.platform_fee_cents,
      })

      if (!previewError && preview?.success) {
        promo = {
          requested: true,
          has_credit: !!preview.has_credit,
          discount_cents: preview.discount_cents ?? 0,
          fee_after_cents: preview.fee_after_cents ?? contract.platform_fee_cents,
          message: preview.message ?? null,
        }
      }
    }

    const expectedAmountToAuthorize = Math.max(
      0,
      (contract.total_customer_cents ?? 0) - (promo.discount_cents ?? 0)
    )

    // Reuse existing PaymentIntent when possible
    let paymentIntent: Stripe.PaymentIntent

    if (contract.stripe_payment_intent_id) {
      try {
        const existing = await stripe.paymentIntents.retrieve(contract.stripe_payment_intent_id)

        // If amount matches what we'd create now, reuse.
        // Otherwise cancel and create a new one.
        if (existing && existing.amount === expectedAmountToAuthorize && existing.currency === 'usd') {
          paymentIntent = existing
        } else {
          // Best-effort cancel (ignore failures)
          try {
            if (existing && existing.status !== 'canceled' && existing.status !== 'succeeded') {
              await stripe.paymentIntents.cancel(existing.id)
            }
          } catch (_e) {
            // ignore
          }

          throw new Error('RECREATE')
        }
      } catch (_e) {
        // fall through to create a new PaymentIntent
        paymentIntent = await stripe.paymentIntents.create({
          amount: expectedAmountToAuthorize,
          currency: 'usd',
          customer: profile.stripe_customer_id,
          capture_method: 'manual',
          automatic_payment_methods: { enabled: true },
          metadata: {
            job_id: contract.job_id,
            contract_id: contract.id,
            customer_id: contract.customer_id,
            mechanic_id: contract.mechanic_id ?? '',
            type: 'booking',
            use_promo: promo.requested ? 'true' : 'false',
            promo_discount_cents: String(promo.discount_cents ?? 0),
            promo_fee_after_cents: String(promo.fee_after_cents ?? contract.platform_fee_cents),
          },
        })

        // Persist the latest PI id on the contract
        await supabaseAdmin
          .from('job_contracts')
          .update({ stripe_payment_intent_id: paymentIntent.id })
          .eq('id', contract.id)
      }
    } else {
      paymentIntent = await stripe.paymentIntents.create({
        amount: expectedAmountToAuthorize,
        currency: 'usd',
        customer: profile.stripe_customer_id,
        capture_method: 'manual',
        automatic_payment_methods: { enabled: true },
        metadata: {
          job_id: contract.job_id,
          contract_id: contract.id,
          customer_id: contract.customer_id,
          mechanic_id: contract.mechanic_id ?? '',
          type: 'booking',
          use_promo: promo.requested ? 'true' : 'false',
          promo_discount_cents: String(promo.discount_cents ?? 0),
          promo_fee_after_cents: String(promo.fee_after_cents ?? contract.platform_fee_cents),
        },
      })

      // Persist PI id on the contract
      await supabaseAdmin
        .from('job_contracts')
        .update({ stripe_payment_intent_id: paymentIntent.id })
        .eq('id', contract.id)
    }

    // Create an ephemeral key for the customer (required for PaymentSheet customer mode)
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: profile.stripe_customer_id },
      { apiVersion: STRIPE_API_VERSION }
    )

    // Upsert payment record (amount/platform fee BEFORE promo application).
    // If promo is used, the record will be updated after confirmation via apply_promo_to_payment.
    await supabaseAdmin
      .from('payments')
      .upsert(
        {
          job_id: contract.job_id,
          customer_id: contract.customer_id,
          mechanic_id: contract.mechanic_id,
          stripe_payment_intent_id: paymentIntent.id,
          amount_cents: contract.total_customer_cents,
          platform_fee_cents: contract.platform_fee_cents,
          status: 'pending',
        },
        { onConflict: 'stripe_payment_intent_id' }
      )

    return new Response(
      JSON.stringify({
        paymentIntent: paymentIntent.client_secret,
        ephemeralKey: ephemeralKey.secret,
        customer: profile.stripe_customer_id,
        paymentIntentId: paymentIntent.id,
        expectedAmountCents: expectedAmountToAuthorize,
        promo,
        contract: {
          id: contract.id,
          status: contract.status,
          payment_authorized_at: contract.payment_authorized_at,
          payment_captured_at: contract.payment_captured_at,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error creating payment intent:', error)

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
