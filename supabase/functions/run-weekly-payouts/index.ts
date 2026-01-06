import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization')
    const expectedToken = Deno.env.get('CRON_SECRET')

    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    console.log('Starting weekly payout run...')

    const now = new Date()

    const { data: ledgerItems, error: ledgerError } = await supabase
      .from('mechanic_ledger')
      .select('*')
      .eq('status', 'available_for_transfer')
      .lte('available_for_transfer_at', now.toISOString())

    if (ledgerError) {
      throw ledgerError
    }

    if (!ledgerItems || ledgerItems.length === 0) {
      console.log('No ledger items ready for transfer')
      return new Response(
        JSON.stringify({ success: true, message: 'No items to transfer' }),
        { status: 200 }
      )
    }

    const groupedByMechanic = ledgerItems.reduce((acc, item) => {
      if (!acc[item.mechanic_id]) {
        acc[item.mechanic_id] = []
      }
      acc[item.mechanic_id].push(item)
      return acc
    }, {} as Record<string, typeof ledgerItems>)

    const results = []

    for (const [mechanicId, items] of Object.entries(groupedByMechanic)) {
      try {
        const totalAmount = items.reduce((sum, item) => sum + item.amount_cents, 0)
        const stripeAccountId = items[0].stripe_account_id

        const idempotencyKey = `transfer_${mechanicId}_${now.toISOString().split('T')[0]}`

        const transfer = await stripe.transfers.create(
          {
            amount: totalAmount,
            currency: 'usd',
            destination: stripeAccountId,
            description: `Weekly payout for ${items.length} job(s)`,
            metadata: {
              mechanic_id: mechanicId,
              job_count: items.length.toString(),
              payout_date: now.toISOString(),
            },
          },
          { idempotencyKey }
        )

        const { data: transferRecord, error: transferInsertError } = await supabase
          .from('transfers')
          .insert({
            mechanic_id: mechanicId,
            stripe_account_id: stripeAccountId,
            stripe_transfer_id: transfer.id,
            amount_cents: totalAmount,
            status: 'pending',
            ledger_item_ids: items.map(item => item.id),
            metadata: {
              job_count: items.length,
              payout_date: now.toISOString(),
            },
          })
          .select()
          .single()

        if (transferInsertError) {
          throw transferInsertError
        }

        await supabase
          .from('mechanic_ledger')
          .update({
            status: 'transferred',
            stripe_transfer_id: transfer.id,
            transferred_at: now.toISOString(),
          })
          .in('id', items.map(item => item.id))

        await supabase.from('notifications').insert({
          user_id: mechanicId,
          type: 'transfer_created',
          title: 'Weekly Payout Initiated',
          body: `Your payout of $${(totalAmount / 100).toFixed(2)} has been initiated.`,
          data: {
            transfer_id: transfer.id,
            amount_cents: totalAmount,
            job_count: items.length,
          },
        })

        results.push({
          mechanic_id: mechanicId,
          transfer_id: transfer.id,
          amount_cents: totalAmount,
          job_count: items.length,
          success: true,
        })

        console.log(`Created transfer ${transfer.id} for mechanic ${mechanicId}: $${totalAmount / 100}`)
      } catch (error) {
        console.error(`Failed to create transfer for mechanic ${mechanicId}:`, error)
        results.push({
          mechanic_id: mechanicId,
          success: false,
          error: error.message,
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length

    console.log(`Payout run complete: ${successCount} succeeded, ${failureCount} failed`)

    return new Response(
      JSON.stringify({
        success: true,
        total_transfers: results.length,
        succeeded: successCount,
        failed: failureCount,
        results,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error running weekly payouts:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
