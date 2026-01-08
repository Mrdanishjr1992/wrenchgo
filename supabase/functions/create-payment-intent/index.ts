/**
 * CREATE PAYMENT INTENT - WrenchGo
 * 
 * STRIPE CONNECT MODEL: Destination Charges
 * 
 * Why Destination Charges (not Direct Charges):
 * 1. Platform collects payment → visible in YOUR dashboard
 * 2. Platform fee automatically deducted before transfer
 * 3. Refunds/disputes handled by platform (you)
 * 4. Simpler: no stripeAccount header needed
 * 5. Mechanic sees transfer in THEIR dashboard
 * 
 * Flow:
 * 1. Customer pays $100 to WrenchGo (platform)
 * 2. Stripe automatically transfers $85 to mechanic
 * 3. Platform keeps $15 fee
 * 4. Payment visible in platform dashboard
 * 5. Transfer visible in mechanic's connected account
 */

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
    // =========================================================
    // STEP 1: Authenticate user
    // =========================================================
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('[PI] Missing authorization header')
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('[PI] Auth failed:', userError?.message)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    console.log(`[PI] User authenticated: ${user.id}`)

    // =========================================================
    // STEP 2: Validate request
    // =========================================================
    const { job_id } = await req.json()
    if (!job_id) {
      return new Response(JSON.stringify({ error: 'Missing job_id' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    console.log(`[PI] Processing job: ${job_id}`)

    // =========================================================
    // STEP 3: Load and validate job
    // =========================================================
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', job_id)
      .single()

    if (jobError || !job) {
      console.error('[PI] Job not found:', job_id)
      return new Response(JSON.stringify({ error: 'Job not found' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    if (job.customer_id !== user.id) {
      console.error('[PI] User not job owner:', user.id, job.customer_id)
      return new Response(JSON.stringify({ error: 'Only customer can initiate payment' }), { 
        status: 403, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    if (job.status !== 'completed') {
      return new Response(JSON.stringify({ error: 'Job not completed yet' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    if (!job.mechanic_verified_at || !job.customer_verified_at) {
      return new Response(JSON.stringify({ error: 'Both parties must verify completion' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // =========================================================
    // STEP 4: Load invoice
    // =========================================================
    const { data: invoice, error: invoiceError } = await supabase
      .from('job_invoices')
      .select('*')
      .eq('job_id', job_id)
      .single()

    if (invoiceError || !invoice) {
      console.error('[PI] Invoice not found for job:', job_id)
      return new Response(JSON.stringify({ error: 'Invoice not found' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    if (invoice.status !== 'locked') {
      return new Response(JSON.stringify({ error: 'Invoice not locked' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    console.log(`[PI] Invoice loaded: ${invoice.id}, total=${invoice.total_cents}`)

    // =========================================================
    // STEP 5: Validate mechanic Stripe account
    // =========================================================
    const { data: mechanicAccount, error: mechanicAccountError } = await supabase
      .from('mechanic_stripe_accounts')
      .select('*')
      .eq('mechanic_id', job.mechanic_id)
      .single()

    if (mechanicAccountError || !mechanicAccount) {
      console.error('[PI] Mechanic account not found:', job.mechanic_id)
      return new Response(JSON.stringify({ error: 'Mechanic not onboarded to Stripe' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    if (!mechanicAccount.onboarding_completed || !mechanicAccount.charges_enabled) {
      console.error('[PI] Mechanic account not ready:', mechanicAccount.stripe_account_id)
      return new Response(JSON.stringify({ error: 'Mechanic Stripe account not ready for payments' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    console.log(`[PI] Mechanic Stripe account: ${mechanicAccount.stripe_account_id}`)

    // =========================================================
    // STEP 6: Check for existing valid payment
    // =========================================================
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('*')
      .eq('job_id', job_id)
      .in('status', ['pending', 'processing', 'requires_action', 'succeeded'])
      .single()

    if (existingPayment?.stripe_payment_intent_id && 
        existingPayment.stripe_payment_intent_id !== 'pending_creation') {
      console.log(`[PI] Returning existing payment: ${existingPayment.id}`)
      return new Response(
        JSON.stringify({
          success: true,
          payment_id: existingPayment.id,
          client_secret: existingPayment.client_secret,
          amount_cents: existingPayment.amount_cents,
          status: existingPayment.status,
          already_exists: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // =========================================================
    // STEP 7: Create payment record first (for promo application)
    // =========================================================
    const originalPlatformFeeCents = invoice.platform_fee_cents || 0
    const originalTotalCents = invoice.total_cents
    const mechanicNetCents = invoice.mechanic_net_cents

    const { data: payment, error: paymentInsertError } = await serviceSupabase
      .from('payments')
      .insert({
        job_id,
        invoice_id: invoice.id,
        customer_id: job.customer_id,
        mechanic_id: job.mechanic_id,
        stripe_payment_intent_id: 'pending_creation',
        amount_cents: originalTotalCents,
        platform_fee_cents: originalPlatformFeeCents,
        status: 'pending',
        client_secret: null,
        metadata: {
          mechanic_stripe_account_id: mechanicAccount.stripe_account_id,
          mechanic_net_cents: mechanicNetCents,
          original_platform_fee_cents: originalPlatformFeeCents,
          original_total_cents: originalTotalCents,
        },
      })
      .select()
      .single()

    if (paymentInsertError) {
      console.error('[PI] Failed to create payment record:', paymentInsertError)
      throw paymentInsertError
    }

    console.log(`[PI] Payment record created: ${payment.id}`)

    // =========================================================
    // STEP 8: Apply promo credits (if any)
    // =========================================================
    let discountCents = 0
    let finalPlatformFeeCents = originalPlatformFeeCents
    let promoCreditType: string | null = null
    let promoApplicationId: string | null = null

    if (originalPlatformFeeCents > 0) {
      const { data: promoResult, error: promoError } = await serviceSupabase.rpc('apply_promo_to_payment', {
        p_payment_id: payment.id,
        p_user_id: user.id,
      })

      if (promoError) {
        console.error('[PI] Promo application error (non-fatal):', promoError)
      } else if (promoResult?.applied) {
        discountCents = promoResult.discount_cents
        finalPlatformFeeCents = promoResult.fee_after_cents
        promoCreditType = promoResult.credit_type
        promoApplicationId = promoResult.application_id
        console.log(`[PI] Promo applied: type=${promoCreditType}, discount=${discountCents}`)
      }
    }

    // =========================================================
    // STEP 9: Calculate final amounts
    // =========================================================
    const finalTotalCents = originalTotalCents - discountCents

    if (finalTotalCents < 50) {
      // Stripe minimum is $0.50
      throw new Error('Payment amount too low (minimum $0.50)')
    }

    // The mechanic always gets their full net amount
    // The discount comes from the platform fee
    const transferAmount = mechanicNetCents

    console.log(`[PI] Amounts: total=${finalTotalCents}, transfer=${transferAmount}, fee=${finalPlatformFeeCents}`)

    // =========================================================
    // STEP 10: Create Stripe PaymentIntent with DESTINATION CHARGE
    // =========================================================
    const idempotencyKey = `pi_${payment.id}_v2`

    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: finalTotalCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      
      // ⚠️ CRITICAL: This is what makes it a destination charge
      // Money goes to platform, then Stripe auto-transfers to mechanic
      transfer_data: {
        destination: mechanicAccount.stripe_account_id,
        amount: transferAmount, // Mechanic receives this amount
      },
      
      // Platform fee is implicit: total - transfer_amount
      // But we can also use application_fee_amount for explicit control
      // application_fee_amount: finalPlatformFeeCents,
      
      metadata: {
        // Essential IDs for webhook reconciliation
        job_id,
        invoice_id: invoice.id,
        payment_id: payment.id,
        customer_id: job.customer_id,
        mechanic_id: job.mechanic_id,
        
        // Stripe account for debugging
        mechanic_stripe_account_id: mechanicAccount.stripe_account_id,
        
        // Amounts for audit trail
        total_cents: finalTotalCents.toString(),
        transfer_cents: transferAmount.toString(),
        platform_fee_cents: finalPlatformFeeCents.toString(),
        discount_cents: discountCents.toString(),
        promo_credit_type: promoCreditType || '',
      },
      
      description: `WrenchGo Job #${job_id.slice(0, 8)}: ${job.title}`,
      
      // Statement descriptor (max 22 chars)
      statement_descriptor_suffix: 'WRENCHGO',
    }

    console.log(`[PI] Creating PaymentIntent with idempotency key: ${idempotencyKey}`)

    const paymentIntent = await stripe.paymentIntents.create(
      paymentIntentParams,
      { idempotencyKey }
    )

    console.log(`[PI] PaymentIntent created: ${paymentIntent.id}, status=${paymentIntent.status}`)

    // =========================================================
    // STEP 11: Update payment record with Stripe details
    // =========================================================
    const { error: updateError } = await serviceSupabase
      .from('payments')
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        amount_cents: finalTotalCents,
        platform_fee_cents: finalPlatformFeeCents,
        client_secret: paymentIntent.client_secret,
        metadata: {
          mechanic_stripe_account_id: mechanicAccount.stripe_account_id,
          mechanic_net_cents: mechanicNetCents,
          transfer_amount_cents: transferAmount,
          original_platform_fee_cents: originalPlatformFeeCents,
          original_total_cents: originalTotalCents,
          discount_cents: discountCents,
          promo_application_id: promoApplicationId,
          promo_credit_type: promoCreditType,
        },
      })
      .eq('id', payment.id)

    if (updateError) {
      console.error('[PI] Failed to update payment record:', updateError)
      // Don't throw - PI is created, we can reconcile via webhook
    }

    // =========================================================
    // STEP 12: Return success response
    // =========================================================
    console.log(`[PI] SUCCESS: payment_id=${payment.id}, pi_id=${paymentIntent.id}`)

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: payment.id,
        payment_intent_id: paymentIntent.id,
        client_secret: paymentIntent.client_secret,
        amount_cents: finalTotalCents,
        original_amount_cents: originalTotalCents,
        discount_cents: discountCents,
        promo_applied: discountCents > 0,
        promo_credit_type: promoCreditType,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('[PI] ERROR:', error.message, error.stack)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
