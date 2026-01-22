import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import Stripe from 'https://esm.sh/stripe@14.11.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const jobId: string | undefined = body?.job_id;
    const quoteId: string | undefined = body?.quote_id;
    const contractId: string | undefined = body?.contract_id;
    const applyPromo: boolean = Boolean(body?.apply_promo);

    if (!jobId || !quoteId) {
      return new Response(JSON.stringify({ error: 'Missing job_id or quote_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Missing authorization token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !stripeSecretKey) {
      return new Response(JSON.stringify({ error: 'Missing required environment variables' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // IMPORTANT:
    // - We use the SERVICE ROLE key for PostgREST access.
    // - We pass the USER JWT in the Authorization header so auth.uid() inside RPCs is the user.
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid user token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load quote
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('id, job_id, mechanic_id, price_cents, status')
      .eq('id', quoteId)
      .single();

    if (quoteError || !quote) {
      return new Response(JSON.stringify({ error: 'Quote not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (quote.job_id !== jobId) {
      return new Response(JSON.stringify({ error: 'Quote does not belong to this job' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // NOTE:
    // The quote may already be 'accepted' at this point, because the client creates the contract first.
    // We allow both states.
    if (quote.status !== 'pending' && quote.status !== 'accepted') {
      return new Response(JSON.stringify({ error: 'Quote is not payable in its current status' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve/validate contract (optional but recommended)
    let resolvedContractId: string | null = contractId ?? null;
    let contractStatus: string | null = null;

    if (resolvedContractId) {
      const { data: contract, error: contractError } = await supabase
        .from('job_contracts')
        .select('id, status, stripe_payment_intent_id')
        .eq('id', resolvedContractId)
        .eq('job_id', jobId)
        .eq('quote_id', quoteId)
        .eq('customer_id', user.id)
        .single();

      if (contractError || !contract) {
        return new Response(JSON.stringify({ error: 'Contract not found for this job/quote' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      contractStatus = contract.status;

      // If we already have a payment intent tied to the contract, just return it.
      if (contract.stripe_payment_intent_id) {
        const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });
        const existing = await stripe.paymentIntents.retrieve(contract.stripe_payment_intent_id);

        return new Response(
          JSON.stringify({
            success: true,
            payment_intent_id: existing.id,
            status: existing.status,
            requires_action: existing.status === 'requires_action',
            client_secret: existing.client_secret,
            contract_activated: contract.status === 'active',
            already_exists: true,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    } else {
      // Try to find the latest pending_payment contract for this job/quote/customer
      const { data: contract } = await supabase
        .from('job_contracts')
        .select('id, status')
        .eq('job_id', jobId)
        .eq('quote_id', quoteId)
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (contract?.id) {
        resolvedContractId = contract.id;
        contractStatus = contract.status;
      }
    }

    // Fetch customer stripe customer id
    const { data: customerProfile, error: customerError } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (customerError || !customerProfile?.stripe_customer_id) {
      return new Response(
        JSON.stringify({ error: 'Customer Stripe account not found. Please set up your payment method.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Fetch customer's default payment method
    const { data: paymentMethod, error: paymentMethodError } = await supabase
      .from('customer_payment_methods')
      .select('stripe_payment_method_id')
      .eq('user_id', user.id)
      .eq('is_default', true)
      .eq('status', 'active')
      .single();

    if (paymentMethodError || !paymentMethod?.stripe_payment_method_id) {
      return new Response(
        JSON.stringify({ error: 'No default payment method found. Please add a payment method.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Fetch mechanic's stripe connected account
    const { data: stripeAccount, error: stripeAccountError } = await supabase
      .from('mechanic_stripe_accounts')
      .select('stripe_account_id')
      .eq('mechanic_id', quote.mechanic_id)
      .eq('is_active', true)
      .single();

    if (stripeAccountError || !stripeAccount?.stripe_account_id) {
      return new Response(JSON.stringify({ error: 'Mechanic Stripe account not found or inactive' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create payment record (base platform fee before promo credits)
    const basePlatformFee = 1500;

    const { data: paymentRecord, error: paymentError } = await supabase
      .from('payments')
      .insert({
        job_id: jobId,
        customer_id: user.id,
        mechanic_id: quote.mechanic_id,
        amount_cents: quote.price_cents + basePlatformFee,
        platform_fee_cents: basePlatformFee,
        status: 'pending',
        metadata: {
          type: 'booking_hold',
          job_id: jobId,
          quote_id: quoteId,
          contract_id: resolvedContractId,
          apply_promo: applyPromo,
        },
      })
      .select()
      .single();

    if (paymentError || !paymentRecord) {
      return new Response(JSON.stringify({ error: 'Failed to create payment record' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Apply promo credits BEFORE creating the Stripe PaymentIntent
    // (This keeps Stripe amount in sync with the final amount_cents in DB.)
    if (applyPromo) {
      try {
        await supabase.rpc('apply_promo_to_payment', {
          p_payment_id: paymentRecord.id,
          p_platform_fee_cents: basePlatformFee,
        });
      } catch (_e) {
        // best-effort; proceed without promo
      }
    }

    // Reload payment after promo application to get final amount & platform fee
    const { data: finalPayment, error: finalPaymentError } = await supabase
      .from('payments')
      .select('amount_cents, platform_fee_cents')
      .eq('id', paymentRecord.id)
      .single();

    if (finalPaymentError || !finalPayment) {
      return new Response(JSON.stringify({ error: 'Failed to load final payment amounts' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' });

    // Create authorization hold (manual capture)
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: finalPayment.amount_cents,
        currency: 'usd',
        customer: customerProfile.stripe_customer_id,
        payment_method: paymentMethod.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        capture_method: 'manual',
        application_fee_amount: finalPayment.platform_fee_cents,
        transfer_data: {
          destination: stripeAccount.stripe_account_id,
        },
        metadata: {
          job_id: jobId,
          quote_id: quoteId,
          contract_id: resolvedContractId ?? '',
          payment_record_id: paymentRecord.id,
          type: 'booking_hold',
        },
      },
      {
        // Prevent accidental double-charges if client retries
        idempotencyKey: paymentRecord.id,
      },
    );

    // Map Stripe status to our DB enum
    const mappedStatus = paymentIntent.status === 'requires_action'
      ? 'requires_action'
      : (paymentIntent.status === 'succeeded' ? 'succeeded' : 'processing');

    const { error: updateError } = await supabase
      .from('payments')
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        status: mappedStatus,
        client_secret: paymentIntent.client_secret,
        paid_at: paymentIntent.status === 'succeeded' ? new Date().toISOString() : null,
        error_message: null,
        metadata: {
          ...(paymentRecord.metadata ?? {}),
          stripe_status: paymentIntent.status,
          capture_method: 'manual',
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentRecord.id);

    if (updateError) {
      return new Response(JSON.stringify({ error: 'Failed to update payment record' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If the intent is already authorized (requires_capture), we can immediately activate the contract
    let contractActivated = false;
    if (resolvedContractId && paymentIntent.status !== 'requires_action') {
      try {
        const { data: ok } = await supabase.rpc('authorize_contract_payment', {
          p_contract_id: resolvedContractId,
          p_stripe_payment_intent_id: paymentIntent.id,
        });
        contractActivated = Boolean(ok);
      } catch (_e) {
        // If this fails, the client can call authorize_contract_payment after verifying status.
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_record_id: paymentRecord.id,
        payment_intent_id: paymentIntent.id,
        status: paymentIntent.status,
        requires_action: paymentIntent.status === 'requires_action',
        client_secret: paymentIntent.client_secret,
        contract_id: resolvedContractId,
        contract_activated: contractActivated,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error creating booking payment:', error);

    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
