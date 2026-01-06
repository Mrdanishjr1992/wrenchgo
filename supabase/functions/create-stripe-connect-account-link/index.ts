import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
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

    const { return_url, refresh_url } = await req.json()

    if (!return_url || !refresh_url) {
      return new Response(JSON.stringify({ error: 'Missing return_url or refresh_url' }), { status: 400 })
    }

    let stripeAccountId: string

    const { data: existingAccount } = await supabase
      .from('mechanic_stripe_accounts')
      .select('stripe_account_id')
      .eq('mechanic_id', user.id)
      .single()

    if (existingAccount?.stripe_account_id) {
      stripeAccountId = existingAccount.stripe_account_id
    } else {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: user.email,
        capabilities: {
          transfers: { requested: true },
        },
        metadata: {
          mechanic_id: user.id,
          app: 'wrenchgo',
        },
      })

      stripeAccountId = account.id

      await supabase.from('mechanic_stripe_accounts').insert({
        mechanic_id: user.id,
        stripe_account_id: stripeAccountId,
        onboarding_completed: false,
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: false,
        country: 'US',
        currency: 'usd',
      })
    }

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url,
      return_url,
      type: 'account_onboarding',
    })

    return new Response(
      JSON.stringify({
        success: true,
        url: accountLink.url,
        stripe_account_id: stripeAccountId,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error creating account link:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
