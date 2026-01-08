/**
 * STRIPE WEBHOOK HANDLER - WrenchGo
 * 
 * This is the SOURCE OF TRUTH for payment state.
 * Never trust client-side success - only webhooks.
 * 
 * Key Events:
 * - payment_intent.succeeded → Payment complete, update DB, create ledger entry
 * - payment_intent.payment_failed → Mark failed, notify customer
 * - payment_intent.requires_action → 3DS needed
 * - transfer.created → Mechanic transfer initiated
 * - charge.refunded → Handle refund
 * - charge.dispute.created → Handle dispute
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
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    console.error('[WH] Missing stripe-signature header')
    return new Response(JSON.stringify({ error: 'Missing signature' }), { status: 400 })
  }

  let event: Stripe.Event

  try {
    const body = await req.text()
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err: any) {
    console.error('[WH] Signature verification failed:', err.message)
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 })
  }

  console.log(`[WH] Received event: ${event.type} (${event.id})`)

  // =========================================================
  // IDEMPOTENCY: Check if already processed
  // =========================================================
  const { data: existingEvent } = await supabase
    .from('stripe_webhook_events')
    .select('id')
    .eq('stripe_event_id', event.id)
    .single()

  if (existingEvent) {
    console.log(`[WH] Event ${event.id} already processed, skipping`)
    return new Response(JSON.stringify({ received: true, already_processed: true }), { status: 200 })
  }

  try {
    // =========================================================
    // EVENT ROUTING
    // =========================================================
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent, event.id)
        break

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent)
        break

      case 'payment_intent.canceled':
        await handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent)
        break

      case 'payment_intent.requires_action':
        await handlePaymentIntentRequiresAction(event.data.object as Stripe.PaymentIntent)
        break

      case 'payment_intent.processing':
        await handlePaymentIntentProcessing(event.data.object as Stripe.PaymentIntent)
        break

      case 'setup_intent.succeeded':
        await handleSetupIntentSucceeded(event.data.object as Stripe.SetupIntent)
        break

      case 'setup_intent.setup_failed':
        await handleSetupIntentFailed(event.data.object as Stripe.SetupIntent)
        break

      case 'payment_method.attached':
        await handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod)
        break

      case 'payment_method.detached':
        await handlePaymentMethodDetached(event.data.object as Stripe.PaymentMethod)
        break

      case 'account.updated':
        await handleAccountUpdated(event.data.object as Stripe.Account)
        break

      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge)
        break

      case 'charge.dispute.created':
        await handleDisputeCreated(event.data.object as Stripe.Dispute)
        break

      case 'transfer.created':
        await handleTransferCreated(event.data.object as Stripe.Transfer)
        break

      case 'transfer.failed':
        await handleTransferFailed(event.data.object as Stripe.Transfer)
        break

      case 'payout.paid':
        await handlePayoutPaid(event.data.object as Stripe.Payout)
        break

      default:
        console.log(`[WH] Unhandled event type: ${event.type}`)
    }

    // =========================================================
    // RECORD EVENT AS PROCESSED
    // =========================================================
    await supabase.from('stripe_webhook_events').insert({
      stripe_event_id: event.id,
      event_type: event.type,
      metadata: { processed: true, processed_at: new Date().toISOString() },
    })

    console.log(`[WH] Event ${event.id} processed successfully`)
    return new Response(JSON.stringify({ received: true }), { status: 200 })

  } catch (error: any) {
    console.error(`[WH] Error processing event ${event.id}:`, error.message, error.stack)
    
    // Record failed event for debugging
    await supabase.from('stripe_webhook_events').insert({
      stripe_event_id: event.id,
      event_type: event.type,
      metadata: { 
        processed: false, 
        error: error.message,
        attempted_at: new Date().toISOString() 
      },
    })
    
    // Return 500 so Stripe retries
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})

// =========================================================
// PAYMENT INTENT HANDLERS
// =========================================================

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent, eventId: string) {
  console.log(`[WH:PI_SUCCESS] Processing PI: ${paymentIntent.id}`)
  console.log(`[WH:PI_SUCCESS] Amount: ${paymentIntent.amount}, Status: ${paymentIntent.status}`)
  console.log(`[WH:PI_SUCCESS] Metadata:`, JSON.stringify(paymentIntent.metadata))

  const { job_id, mechanic_id, payment_id, mechanic_stripe_account_id } = paymentIntent.metadata
  const mechanicNetCents = parseInt(paymentIntent.metadata.transfer_cents || paymentIntent.metadata.mechanic_net_cents || '0')

  // Find payment record
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .select('*')
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .single()

  if (paymentError || !payment) {
    // Try by payment_id from metadata
    if (payment_id) {
      const { data: paymentById } = await supabase
        .from('payments')
        .select('*')
        .eq('id', payment_id)
        .single()
      
      if (paymentById) {
        console.log(`[WH:PI_SUCCESS] Found payment by metadata ID: ${payment_id}`)
      } else {
        console.error(`[WH:PI_SUCCESS] Payment not found for PI ${paymentIntent.id}`)
        return
      }
    } else {
      console.error(`[WH:PI_SUCCESS] Payment not found for PI ${paymentIntent.id}`)
      return
    }
  }

  const paymentRecord = payment || { id: payment_id }

  // Get charge ID from the PaymentIntent
  const chargeId = typeof paymentIntent.latest_charge === 'string' 
    ? paymentIntent.latest_charge 
    : paymentIntent.latest_charge?.id

  console.log(`[WH:PI_SUCCESS] Charge ID: ${chargeId}`)

  // =========================================================
  // UPDATE PAYMENT STATUS
  // =========================================================
  const { error: updatePaymentError } = await supabase
    .from('payments')
    .update({
      status: 'succeeded',
      stripe_charge_id: chargeId,
      paid_at: new Date().toISOString(),
    })
    .eq('stripe_payment_intent_id', paymentIntent.id)

  if (updatePaymentError) {
    console.error(`[WH:PI_SUCCESS] Failed to update payment:`, updatePaymentError)
  }

  // =========================================================
  // UPDATE INVOICE STATUS
  // =========================================================
  if (payment?.invoice_id) {
    await supabase
      .from('job_invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('id', payment.invoice_id)
  }

  // =========================================================
  // UPDATE JOB STATUS
  // =========================================================
  if (job_id) {
    await supabase
      .from('jobs')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
      })
      .eq('id', job_id)
  }

  // =========================================================
  // CREATE MECHANIC LEDGER ENTRY
  // For destination charges, the transfer happens automatically
  // We track it in our ledger for reporting
  // =========================================================
  const nextMonday = getNextMonday()

  await supabase.from('mechanic_ledger').insert({
    mechanic_id: mechanic_id || payment?.mechanic_id,
    payment_id: payment?.id || payment_id,
    job_id: job_id || payment?.job_id,
    stripe_account_id: mechanic_stripe_account_id,
    amount_cents: mechanicNetCents,
    status: 'transferred', // Destination charges transfer immediately
    available_for_transfer_at: nextMonday.toISOString(),
    transferred_at: new Date().toISOString(),
  })

  // =========================================================
  // HANDLE INVITATION PROMO AWARDING
  // =========================================================
  if (payment?.customer_id && payment?.platform_fee_cents > 0) {
    await handleInvitationAward(
      payment.customer_id, 
      payment.id, 
      payment.platform_fee_cents, 
      eventId
    )
  }

  // =========================================================
  // SEND NOTIFICATIONS
  // =========================================================
  const notifications = []
  
  if (payment?.customer_id) {
    notifications.push({
      user_id: payment.customer_id,
      type: 'payment_succeeded',
      title: 'Payment Successful',
      body: 'Your payment has been processed successfully.',
      data: { job_id, payment_id: payment.id, charge_id: chargeId },
    })
  }

  if (mechanic_id || payment?.mechanic_id) {
    notifications.push({
      user_id: mechanic_id || payment?.mechanic_id,
      type: 'payment_received',
      title: 'Payment Received',
      body: `You received $${(mechanicNetCents / 100).toFixed(2)} for this job.`,
      data: { job_id, payment_id: payment?.id, amount_cents: mechanicNetCents },
    })
  }

  if (notifications.length > 0) {
    await supabase.from('notifications').insert(notifications)
  }

  console.log(`[WH:PI_SUCCESS] Completed processing for PI: ${paymentIntent.id}`)
}

async function handlePaymentIntentProcessing(paymentIntent: Stripe.PaymentIntent) {
  console.log(`[WH:PI_PROCESSING] PI: ${paymentIntent.id}`)
  
  await supabase
    .from('payments')
    .update({ status: 'processing' })
    .eq('stripe_payment_intent_id', paymentIntent.id)
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log(`[WH:PI_FAILED] PI: ${paymentIntent.id}`)
  console.log(`[WH:PI_FAILED] Error:`, paymentIntent.last_payment_error?.message)

  await supabase
    .from('payments')
    .update({
      status: 'failed',
      error_message: paymentIntent.last_payment_error?.message || 'Payment failed',
    })
    .eq('stripe_payment_intent_id', paymentIntent.id)

  const { data: payment } = await supabase
    .from('payments')
    .select('customer_id, job_id')
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .single()

  if (payment) {
    await supabase.from('notifications').insert({
      user_id: payment.customer_id,
      type: 'payment_failed',
      title: 'Payment Failed',
      body: paymentIntent.last_payment_error?.message || 'Your payment could not be processed. Please try again.',
      data: { job_id: payment.job_id },
    })
  }
}

async function handlePaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent) {
  console.log(`[WH:PI_CANCELED] PI: ${paymentIntent.id}`)
  
  await supabase
    .from('payments')
    .update({ status: 'cancelled' })
    .eq('stripe_payment_intent_id', paymentIntent.id)
}

async function handlePaymentIntentRequiresAction(paymentIntent: Stripe.PaymentIntent) {
  console.log(`[WH:PI_REQUIRES_ACTION] PI: ${paymentIntent.id}`)
  
  await supabase
    .from('payments')
    .update({ status: 'requires_action' })
    .eq('stripe_payment_intent_id', paymentIntent.id)
}

// =========================================================
// SETUP INTENT HANDLERS (for saving payment methods)
// =========================================================

async function handleSetupIntentSucceeded(setupIntent: Stripe.SetupIntent) {
  console.log(`[WH:SI_SUCCESS] SI: ${setupIntent.id}`)
  
  const customerId = setupIntent.customer as string
  if (!customerId) return

  // Find user by Stripe customer ID
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (profile) {
    await supabase
      .from('profiles')
      .update({ payment_method_status: 'active' })
      .eq('id', profile.id)
    
    console.log(`[WH:SI_SUCCESS] Updated payment_method_status for user: ${profile.id}`)
  }
}

async function handleSetupIntentFailed(setupIntent: Stripe.SetupIntent) {
  console.log(`[WH:SI_FAILED] SI: ${setupIntent.id}`)
  console.log(`[WH:SI_FAILED] Error:`, setupIntent.last_setup_error?.message)
}

// =========================================================
// PAYMENT METHOD HANDLERS
// =========================================================

async function handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod) {
  console.log(`[WH:PM_ATTACHED] PM: ${paymentMethod.id}, Customer: ${paymentMethod.customer}`)
  
  const customerId = paymentMethod.customer as string
  if (!customerId) return

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (profile) {
    await supabase
      .from('profiles')
      .update({ payment_method_status: 'active' })
      .eq('id', profile.id)
  }
}

async function handlePaymentMethodDetached(paymentMethod: Stripe.PaymentMethod) {
  console.log(`[WH:PM_DETACHED] PM: ${paymentMethod.id}`)
  // Note: Customer ID is null after detachment
  // We'd need to track this differently if we want to update status
}

// =========================================================
// CONNECT ACCOUNT HANDLERS
// =========================================================

async function handleAccountUpdated(account: Stripe.Account) {
  console.log(`[WH:ACCOUNT] Account: ${account.id}`)
  console.log(`[WH:ACCOUNT] charges_enabled=${account.charges_enabled}, payouts_enabled=${account.payouts_enabled}`)

  await supabase
    .from('mechanic_stripe_accounts')
    .update({
      onboarding_completed: account.details_submitted || false,
      charges_enabled: account.charges_enabled || false,
      payouts_enabled: account.payouts_enabled || false,
      details_submitted: account.details_submitted || false,
    })
    .eq('stripe_account_id', account.id)
}

// =========================================================
// REFUND & DISPUTE HANDLERS
// =========================================================

async function handleChargeRefunded(charge: Stripe.Charge) {
  console.log(`[WH:REFUND] Charge: ${charge.id}`)

  const { data: payment } = await supabase
    .from('payments')
    .select('*')
    .eq('stripe_charge_id', charge.id)
    .single()

  if (!payment) {
    console.log(`[WH:REFUND] No payment found for charge: ${charge.id}`)
    return
  }

  await supabase
    .from('payments')
    .update({ status: 'refunded' })
    .eq('id', payment.id)

  await supabase
    .from('job_invoices')
    .update({ status: 'refunded' })
    .eq('id', payment.invoice_id)

  await supabase
    .from('mechanic_ledger')
    .update({ status: 'refunded' })
    .eq('payment_id', payment.id)

  await supabase.from('notifications').insert([
    {
      user_id: payment.customer_id,
      type: 'refund_issued',
      title: 'Refund Issued',
      body: 'Your payment has been refunded.',
      data: { job_id: payment.job_id, payment_id: payment.id },
    },
    {
      user_id: payment.mechanic_id,
      type: 'refund_issued',
      title: 'Payment Refunded',
      body: 'A payment has been refunded and will be deducted from your balance.',
      data: { job_id: payment.job_id, payment_id: payment.id },
    },
  ])
}

async function handleDisputeCreated(dispute: Stripe.Dispute) {
  console.log(`[WH:DISPUTE] Dispute: ${dispute.id}, Charge: ${dispute.charge}`)

  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id

  const { data: payment } = await supabase
    .from('payments')
    .select('*')
    .eq('stripe_charge_id', chargeId)
    .single()

  if (!payment) {
    console.log(`[WH:DISPUTE] No payment found for charge: ${chargeId}`)
    return
  }

  await supabase
    .from('jobs')
    .update({ status: 'disputed' })
    .eq('id', payment.job_id)

  await supabase
    .from('job_invoices')
    .update({ status: 'disputed' })
    .eq('id', payment.invoice_id)

  await supabase.from('notifications').insert([
    {
      user_id: payment.customer_id,
      type: 'dispute_created',
      title: 'Payment Dispute',
      body: 'A dispute has been filed for this payment.',
      data: { job_id: payment.job_id, payment_id: payment.id, dispute_id: dispute.id },
    },
    {
      user_id: payment.mechanic_id,
      type: 'dispute_created',
      title: 'Payment Dispute',
      body: 'A dispute has been filed. Funds may be held pending resolution.',
      data: { job_id: payment.job_id, payment_id: payment.id, dispute_id: dispute.id },
    },
  ])
}

// =========================================================
// TRANSFER & PAYOUT HANDLERS
// =========================================================

async function handleTransferCreated(transfer: Stripe.Transfer) {
  console.log(`[WH:TRANSFER] Transfer: ${transfer.id}, Amount: ${transfer.amount}`)
  
  // For destination charges, transfers are automatic
  // We can use this to confirm the transfer happened
  await supabase
    .from('transfers')
    .upsert({
      stripe_transfer_id: transfer.id,
      status: 'succeeded',
      amount_cents: transfer.amount,
      destination_account: transfer.destination as string,
      metadata: transfer.metadata,
    }, { onConflict: 'stripe_transfer_id' })
}

async function handleTransferFailed(transfer: Stripe.Transfer) {
  console.log(`[WH:TRANSFER_FAILED] Transfer: ${transfer.id}`)

  const { data: transferRecord } = await supabase
    .from('transfers')
    .select('*')
    .eq('stripe_transfer_id', transfer.id)
    .single()

  if (!transferRecord) return

  await supabase
    .from('transfers')
    .update({
      status: 'failed',
      error_message: 'Transfer failed',
    })
    .eq('id', transferRecord.id)

  if (transferRecord.ledger_item_ids) {
    await supabase
      .from('mechanic_ledger')
      .update({ status: 'available_for_transfer' })
      .in('id', transferRecord.ledger_item_ids)
  }
}

async function handlePayoutPaid(payout: Stripe.Payout) {
  console.log(`[WH:PAYOUT] Payout: ${payout.id}, Amount: ${payout.amount}`)

  const { data: ledgerItems } = await supabase
    .from('mechanic_ledger')
    .select('*')
    .eq('stripe_account_id', payout.destination)
    .eq('status', 'transferred')
    .is('paid_out_at', null)

  if (!ledgerItems || ledgerItems.length === 0) return

  await supabase
    .from('mechanic_ledger')
    .update({
      status: 'paid_out',
      stripe_payout_id: payout.id,
      paid_out_at: new Date(payout.arrival_date * 1000).toISOString(),
    })
    .in('id', ledgerItems.map(item => item.id))

  const mechanicId = ledgerItems[0].mechanic_id

  await supabase.from('notifications').insert({
    user_id: mechanicId,
    type: 'payout_completed',
    title: 'Payout Completed',
    body: `Your payout of $${(payout.amount / 100).toFixed(2)} has been sent to your bank.`,
    data: { payout_id: payout.id, amount_cents: payout.amount },
  })
}

// =========================================================
// INVITATION PROMO HANDLER
// =========================================================

async function handleInvitationAward(
  customerId: string,
  paymentId: string,
  platformFeeCents: number,
  stripeEventId: string
) {
  if (platformFeeCents <= 0) return

  const { data: invitation } = await supabase
    .from('invitations')
    .select('id, inviter_id')
    .eq('invited_id', customerId)
    .single()

  if (!invitation) return

  const { data: isFirst } = await supabase.rpc('check_first_qualifying_payment', {
    p_user_id: customerId,
    p_payment_id: paymentId,
  })

  if (!isFirst) return

  const { data: awardResult, error: awardError } = await supabase.rpc('award_invitation_credits', {
    p_invited_id: customerId,
    p_payment_id: paymentId,
    p_stripe_event_id: stripeEventId,
  })

  if (awardError) {
    console.error('[WH:INVITE] Error awarding credits:', awardError)
    return
  }

  if (awardResult?.success && awardResult?.inviter_id) {
    const awardType = awardResult.award_type === 'FEELESS_1'
      ? '1 free platform fee credit'
      : '5 x $5 off platform fee credits'

    await supabase.from('notifications').insert({
      user_id: awardResult.inviter_id,
      type: 'invitation_reward',
      title: 'Referral Reward Earned!',
      body: `Your friend completed their first job! You earned ${awardType}.`,
      data: { credit_type: awardResult.award_type },
    })
  }
}

// =========================================================
// UTILITIES
// =========================================================

function getNextMonday(): Date {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  const nextMonday = new Date(now)
  nextMonday.setDate(now.getDate() + daysUntilMonday)
  nextMonday.setHours(0, 0, 0, 0)
  return nextMonday
}
