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
    const serviceSupabase = createClient(supabaseUrl, supabaseServiceKey)

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

    const { data: mechanicAccount, error: mechanicAccountError } = await supabase
      .from('mechanic_stripe_accounts')
      .select('*')
      .eq('mechanic_id', job.mechanic_id)
      .single()

    if (mechanicAccountError || !mechanicAccount || !mechanicAccount.onboarding_completed) {
      return new Response(JSON.stringify({ error: 'Mechanic not onboarded' }), { status: 400 })
    }

    // Check for existing payment for this job
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('*')
      .eq('job_id', job_id)
      .in('status', ['pending', 'processing', 'requires_action', 'succeeded'])
      .single()

    if (existingPayment) {
      // If payment exists with a valid PI, check if amount matches
      if (existingPayment.stripe_payment_intent_id && existingPayment.stripe_payment_intent_id !== 'pending_creation') {
        // Return existing payment - promo was already applied when it was created
        return new Response(
          JSON.stringify({
            success: true,
            payment_id: existingPayment.id,
            client_secret: existingPayment.client_secret,
            amount_cents: existingPayment.amount_cents,
            status: existingPayment.status,
            already_exists: true,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    // =========================================================
    // STEP 1: Create payment row FIRST (to get payment_id for promo)
    // =========================================================
    const originalPlatformFeeCents = invoice.platform_fee_cents || 0
    const originalTotalCents = invoice.total_cents

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
          mechanic_net_cents: invoice.mechanic_net_cents,
          original_platform_fee_cents: originalPlatformFeeCents,
          original_total_cents: originalTotalCents,
        },
      })
      .select()
      .single()

    if (paymentInsertError) {
      console.error('Error creating payment row:', paymentInsertError)
      throw paymentInsertError
    }

    // =========================================================
    // STEP 2: Apply promo credit BEFORE creating PaymentIntent
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
        console.error('Error applying promo:', promoError)
        // Continue without promo - don't fail the payment
      } else if (promoResult?.applied) {
        discountCents = promoResult.discount_cents
        finalPlatformFeeCents = promoResult.fee_after_cents
        promoCreditType = promoResult.credit_type
        promoApplicationId = promoResult.application_id
        console.log(`Promo applied: ${promoCreditType}, discount=${discountCents}, fee_after=${finalPlatformFeeCents}`)
      } else {
        console.log('No promo applied:', promoResult?.reason || 'unknown')
      }
    }

    // =========================================================
    // STEP 3: Calculate final amount for PaymentIntent
    // =========================================================
    const finalTotalCents = originalTotalCents - discountCents

    if (finalTotalCents < 0) {
      throw new Error('Invalid total: discount exceeds total amount')
    }

    console.log(`Payment amounts: original_total=${originalTotalCents}, discount=${discountCents}, final_total=${finalTotalCents}`)

    // =========================================================
    // STEP 4: Create Stripe PaymentIntent with discounted amount
    // =========================================================
    const idempotencyKey = `payment_${payment.id}`

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: finalTotalCents,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        metadata: {
          job_id,
          invoice_id: invoice.id,
          payment_id: payment.id,
          customer_id: job.customer_id,
          mechanic_id: job.mechanic_id,
          mechanic_stripe_account_id: mechanicAccount.stripe_account_id,
          mechanic_net_cents: invoice.mechanic_net_cents.toString(),
          platform_fee_cents: finalPlatformFeeCents.toString(),
          original_platform_fee_cents: originalPlatformFeeCents.toString(),
          discount_cents: discountCents.toString(),
          promo_credit_type: promoCreditType || '',
        },
        description: `WrenchGo Job: ${job.title}`,
      },
      { idempotencyKey }
    )

    // =========================================================
    // STEP 5: Update payment row with Stripe PI details
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
          mechanic_net_cents: invoice.mechanic_net_cents,
          original_platform_fee_cents: originalPlatformFeeCents,
          original_total_cents: originalTotalCents,
          discount_cents: discountCents,
          promo_application_id: promoApplicationId,
          promo_credit_type: promoCreditType,
        },
      })
      .eq('id', payment.id)

    if (updateError) {
      console.error('Error updating payment with PI:', updateError)
      throw updateError
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: payment.id,
        client_secret: paymentIntent.client_secret,
        amount_cents: finalTotalCents,
        original_amount_cents: originalTotalCents,
        discount_cents: discountCents,
        promo_applied: discountCents > 0,
        promo_credit_type: promoCreditType,
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