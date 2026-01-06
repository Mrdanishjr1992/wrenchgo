import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

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
      .select('*, quotes(*), job_adjustments(*)')
      .eq('id', job_id)
      .single()

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), { status: 404 })
    }

    if (job.customer_id !== user.id && job.mechanic_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 })
    }

    if (job.status !== 'customer_verified') {
      return new Response(JSON.stringify({ error: 'Job not ready for invoice' }), { status: 400 })
    }

    const { data: existingInvoice } = await supabase
      .from('job_invoices')
      .select('id')
      .eq('job_id', job_id)
      .single()

    if (existingInvoice) {
      return new Response(
        JSON.stringify({ success: true, invoice_id: existingInvoice.id, already_locked: true }),
        { status: 200 }
      )
    }

    const acceptedQuote = job.quotes.find((q: any) => q.accepted_at !== null)
    if (!acceptedQuote) {
      return new Response(JSON.stringify({ error: 'No accepted quote found' }), { status: 400 })
    }

    const adjustments = job.job_adjustments || []
    const adjustmentsTotal = adjustments.reduce((sum: number, adj: any) => sum + adj.amount_cents, 0)

    const subtotal = acceptedQuote.total_cents + adjustmentsTotal
    const platformFeePercent = 0.15
    const platformFeeCents = Math.round(subtotal * platformFeePercent)
    const mechanicNetCents = subtotal - platformFeeCents

    const lineItems = [
      {
        type: 'labor',
        description: 'Labor',
        amount_cents: acceptedQuote.labor_cost_cents,
      },
      {
        type: 'parts',
        description: 'Parts',
        amount_cents: acceptedQuote.parts_cost_cents,
      },
      ...adjustments.map((adj: any) => ({
        type: 'adjustment',
        description: adj.description,
        amount_cents: adj.amount_cents,
        adjustment_type: adj.adjustment_type,
      })),
      {
        type: 'platform_fee',
        description: 'Platform Fee (15%)',
        amount_cents: -platformFeeCents,
      },
    ]

    const { data: invoice, error: invoiceError } = await supabase
      .from('job_invoices')
      .insert({
        job_id,
        quote_id: acceptedQuote.id,
        status: 'locked',
        original_labor_cents: acceptedQuote.labor_cost_cents,
        original_parts_cents: acceptedQuote.parts_cost_cents,
        adjustments_cents: adjustmentsTotal,
        subtotal_cents: subtotal,
        platform_fee_cents: platformFeeCents,
        total_cents: subtotal,
        mechanic_net_cents: mechanicNetCents,
        line_items: lineItems,
        locked_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (invoiceError) {
      throw invoiceError
    }

    await supabase
      .from('jobs')
      .update({ status: 'completed' })
      .eq('id', job_id)

    return new Response(
      JSON.stringify({
        success: true,
        invoice_id: invoice.id,
        total_cents: invoice.total_cents,
        line_items: invoice.line_items,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error locking invoice:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
