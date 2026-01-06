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
    return new Response(JSON.stringify({ error: 'Missing signature' }), { status: 400 })
  }

  let event: Stripe.Event

  try {
    const body = await req.text()
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 })
  }

  const { data: existingEvent } = await supabase
    .from('stripe_webhook_events')
    .select('id')
    .eq('stripe_event_id', event.id)
    .single()

  if (existingEvent) {
    console.log(`Event ${event.id} already processed`)
    return new Response(JSON.stringify({ received: true, already_processed: true }), { status: 200 })
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent)
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
        console.log(`Unhandled event type: ${event.type}`)
    }

    await supabase.from('stripe_webhook_events').insert({
      stripe_event_id: event.id,
      event_type: event.type,
      metadata: { processed: true },
    })

    return new Response(JSON.stringify({ received: true }), { status: 200 })
  } catch (error) {
    console.error(`Error processing event ${event.id}:`, error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const jobId = paymentIntent.metadata.job_id
  const mechanicId = paymentIntent.metadata.mechanic_id
  const mechanicStripeAccountId = paymentIntent.metadata.mechanic_stripe_account_id
  const mechanicNetCents = parseInt(paymentIntent.metadata.mechanic_net_cents)

  const { data: payment } = await supabase
    .from('payments')
    .select('*')
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .single()

  if (!payment) {
    console.error(`Payment not found for PI ${paymentIntent.id}`)
    return
  }

  await supabase
    .from('payments')
    .update({
      status: 'succeeded',
      stripe_charge_id: paymentIntent.latest_charge as string,
    })
    .eq('id', payment.id)

  await supabase
    .from('job_invoices')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
    })
    .eq('id', payment.invoice_id)

  await supabase
    .from('jobs')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
    })
    .eq('id', jobId)

  const nextMonday = getNextMonday()

  await supabase.from('mechanic_ledger').insert({
    mechanic_id: mechanicId,
    payment_id: payment.id,
    job_id: jobId,
    stripe_account_id: mechanicStripeAccountId,
    amount_cents: mechanicNetCents,
    status: 'available_for_transfer',
    available_for_transfer_at: nextMonday.toISOString(),
  })

  await supabase.from('notifications').insert([
    {
      user_id: payment.customer_id,
      type: 'payment_succeeded',
      title: 'Payment Successful',
      body: 'Your payment has been processed successfully.',
      data: { job_id: jobId, payment_id: payment.id },
    },
    {
      user_id: mechanicId,
      type: 'payment_succeeded',
      title: 'Payment Received',
      body: 'Customer payment received. Funds will be transferred on next payout.',
      data: { job_id: jobId, payment_id: payment.id },
    },
  ])
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
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
      body: 'Your payment could not be processed. Please try again.',
      data: { job_id: payment.job_id },
    })
  }
}

async function handlePaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent) {
  await supabase
    .from('payments')
    .update({ status: 'cancelled' })
    .eq('stripe_payment_intent_id', paymentIntent.id)
}

async function handlePaymentIntentRequiresAction(paymentIntent: Stripe.PaymentIntent) {
  await supabase
    .from('payments')
    .update({ status: 'requires_action' })
    .eq('stripe_payment_intent_id', paymentIntent.id)
}

async function handleAccountUpdated(account: Stripe.Account) {
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

async function handleChargeRefunded(charge: Stripe.Charge) {
  const { data: payment } = await supabase
    .from('payments')
    .select('*')
    .eq('stripe_charge_id', charge.id)
    .single()

  if (!payment) return

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
      body: 'A payment has been refunded.',
      data: { job_id: payment.job_id, payment_id: payment.id },
    },
  ])
}

async function handleDisputeCreated(dispute: Stripe.Dispute) {
  const { data: payment } = await supabase
    .from('payments')
    .select('*')
    .eq('stripe_charge_id', dispute.charge as string)
    .single()

  if (!payment) return

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
      title: 'Dispute Created',
      body: 'A dispute has been filed for this payment.',
      data: { job_id: payment.job_id, payment_id: payment.id },
    },
    {
      user_id: payment.mechanic_id,
      type: 'dispute_created',
      title: 'Dispute Created',
      body: 'A dispute has been filed for this payment.',
      data: { job_id: payment.job_id, payment_id: payment.id },
    },
  ])
}

async function handleTransferCreated(transfer: Stripe.Transfer) {
  await supabase
    .from('transfers')
    .update({ status: 'succeeded' })
    .eq('stripe_transfer_id', transfer.id)
}

async function handleTransferFailed(transfer: Stripe.Transfer) {
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

  await supabase
    .from('mechanic_ledger')
    .update({ status: 'available_for_transfer' })
    .in('id', transferRecord.ledger_item_ids)
}

async function handlePayoutPaid(payout: Stripe.Payout) {
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

function getNextMonday(): Date {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  const nextMonday = new Date(now)
  nextMonday.setDate(now.getDate() + daysUntilMonday)
  nextMonday.setHours(0, 0, 0, 0)
  return nextMonday
}
