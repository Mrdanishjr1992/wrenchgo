import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import Stripe from 'https://esm.sh/stripe@13.11.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const STRIPE_API_VERSION = '2023-10-16'

type Body = {
  contract_id?: string
  payment_intent_id?: string
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return json(405, { error: 'Method not allowed' })
    }

    const body = (await req.json().catch(() => ({}))) as Body
    const authHeader = req.headers.get('Authorization') ?? ''

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey || !stripeKey) {
      return json(500, { error: 'Server misconfigured: missing env vars' })
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return json(401, { error: 'Unauthorized' })
    }

    if (!body.contract_id && !body.payment_intent_id) {
      return json(400, { error: 'Missing contract_id or payment_intent_id' })
    }

    // 1) Resolve contract + payment intent id
    let contractId = body.contract_id
    let paymentIntentId = body.payment_intent_id

    // If only payment_intent_id was provided, derive contract_id from Stripe metadata
    const stripe = new Stripe(stripeKey, { apiVersion: STRIPE_API_VERSION })

    if (paymentIntentId && !contractId) {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
      contractId = (pi.metadata?.contract_id as string | undefined) ?? undefined
      if (!contractId) {
        return json(400, {
          error: 'Unable to resolve contract_id from PaymentIntent metadata',
        })
      }
    }

    // 2) Fetch contract (admin) and validate ownership
    const { data: contract, error: contractError } = await supabaseAdmin
      .from('job_contracts')
      .select(
        'id, job_id, customer_id, mechanic_id, status, platform_fee_cents, total_customer_cents, stripe_payment_intent_id, payment_authorized_at'
      )
      .eq('id', contractId as string)
      .single()

    if (contractError || !contract) {
      return json(404, { error: 'Contract not found' })
    }

    if (contract.customer_id !== user.id) {
      return json(403, { error: 'Forbidden' })
    }

    // If contract already authorized, we're done (idempotent)
    if (contract.payment_authorized_at) {
      return json(200, { success: true, already_authorized: true })
    }

    // If we did not receive a PI id, use the one stored on the contract
    if (!paymentIntentId) {
      paymentIntentId = contract.stripe_payment_intent_id ?? undefined
    }

    if (!paymentIntentId) {
      return json(400, {
        error:
          'Missing payment_intent_id and contract has no stripe_payment_intent_id. Call create-payment-intent first.',
      })
    }

    // 3) Verify PI is authorized (manual capture => requires_capture)
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (paymentIntent.status !== 'requires_capture') {
      return json(400, {
        error: 'PaymentIntent not authorized',
        status: paymentIntent.status,
      })
    }

    // 4) Find corresponding payment record (created by create-payment-intent)
    const { data: paymentRow, error: paymentRowError } = await supabaseAdmin
      .from('payments')
      .select('id, amount_cents, platform_fee_cents, status')
      .eq('stripe_payment_intent_id', paymentIntent.id)
      .maybeSingle()

    if (paymentRowError) {
      return json(500, { error: 'Failed to load payment record' })
    }

    if (!paymentRow) {
      return json(500, {
        error:
          'Payment record missing for this PaymentIntent. Ensure create-payment-intent upsert succeeded.',
      })
    }

    // 5) Optional: promo (if create-payment-intent set metadata)
    const usePromo = paymentIntent.metadata?.use_promo === 'true'
    const promoDiscountCents = Number(paymentIntent.metadata?.promo_discount_cents ?? '0')

    if (usePromo && promoDiscountCents > 0) {
      // Confirm the discount is still available before consuming.
      const { data: preview, error: previewError } = await supabase.rpc(
        'preview_promo_discount',
        {
          p_platform_fee_cents: contract.platform_fee_cents,
        }
      )

      if (previewError || !preview?.success || !preview?.has_credit) {
        // Cancel the authorization hold to avoid giving a free discount.
        try {
          await stripe.paymentIntents.cancel(paymentIntent.id)
        } catch (_) {
          // ignore
        }
        return json(409, {
          error: 'Promo no longer available. Please retry payment.',
        })
      }

      if (preview.discount_cents !== promoDiscountCents) {
        try {
          await stripe.paymentIntents.cancel(paymentIntent.id)
        } catch (_) {
          // ignore
        }
        return json(409, {
          error: 'Promo discount changed. Please retry payment.',
        })
      }

      const { data: apply, error: applyError } = await supabase.rpc(
        'apply_promo_to_payment',
        {
          p_payment_id: paymentRow.id,
          p_platform_fee_cents: contract.platform_fee_cents,
        }
      )

      if (applyError || !apply?.success) {
        try {
          await stripe.paymentIntents.cancel(paymentIntent.id)
        } catch (_) {
          // ignore
        }
        return json(409, {
          error: apply?.message ?? 'Failed to apply promo credit',
        })
      }

      // Reload payment row after promo application and ensure amount matches PI
      const { data: updatedPayment } = await supabaseAdmin
        .from('payments')
        .select('amount_cents')
        .eq('id', paymentRow.id)
        .maybeSingle()

      if (updatedPayment && updatedPayment.amount_cents !== paymentIntent.amount) {
        try {
          await stripe.paymentIntents.cancel(paymentIntent.id)
        } catch (_) {
          // ignore
        }
        return json(409, {
          error: 'Promo application mismatch. Please retry payment.',
        })
      }
    }

    // 6) Activate contract in DB (escrow authorized)
    const { data: authorized, error: authzError } = await supabase.rpc(
      'authorize_contract_payment',
      {
        p_contract_id: contract.id,
        p_stripe_payment_intent_id: paymentIntent.id,
      }
    )

    if (authzError || !authorized) {
      // Cancel hold if we can't persist authorization.
      try {
        await stripe.paymentIntents.cancel(paymentIntent.id)
      } catch (_) {
        // ignore
      }
      return json(500, { error: 'Failed to authorize contract payment in DB' })
    }

    // 7) Update payment row status
    await supabaseAdmin
      .from('payments')
      .update({ status: 'authorized' })
      .eq('stripe_payment_intent_id', paymentIntent.id)

    return json(200, { success: true })
  } catch (error) {
    console.error('Error confirming contract payment:', error)
    return json(500, { error: 'Internal server error' })
  }
})
