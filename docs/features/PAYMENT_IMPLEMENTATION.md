# Payment Implementation Guide with Fee Structure

## Overview

This guide shows how to implement customer payments to mechanics using Stripe Connect destination charges with the platform fee structure.

## Fee Structure

### Rules
- **Flat fee from customer**: $15 (1500 cents)
- **Mechanic commission**: 12% of labor, capped at $50 (5000 cents)

### Calculation Formula
```typescript
const labor_cents = /* job labor cost in cents */;

// Calculate mechanic commission (12% of labor, max $50)
const percent_fee_cents = Math.min(Math.round(labor_cents * 0.12), 5000);

// Customer pays: labor + flat fee
const customer_total_cents = labor_cents + 1500;

// Mechanic receives: labor - commission
const mechanic_payout_cents = labor_cents - percent_fee_cents;

// Platform keeps: flat fee + commission
const platform_revenue_cents = 1500 + percent_fee_cents;
```

## Implementation

### 1. Create Payment Edge Function

Create `supabase/functions/create-job-payment/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Stripe from "https://esm.sh/stripe@14.10.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentRequest {
  job_id: string;
  labor_cents: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { job_id, labor_cents }: PaymentRequest = await req.json();

    if (!job_id || !labor_cents || labor_cents <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid job_id or labor_cents" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get job details and verify customer owns this job
    const { data: job, error: jobError } = await supabaseClient
      .from("jobs")
      .select("id, customer_id, mechanic_id, status")
      .eq("id", job_id)
      .eq("customer_id", user.id)
      .single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: "Job not found or unauthorized" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (job.status !== "completed") {
      return new Response(
        JSON.stringify({ error: "Job must be completed before payment" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get customer's saved payment method
    const { data: customerData } = await supabaseClient
      .from("customer_payment_methods")
      .select("stripe_customer_id, stripe_payment_method_id")
      .eq("customer_id", user.id)
      .maybeSingle();

    if (!customerData?.stripe_payment_method_id) {
      return new Response(
        JSON.stringify({ error: "No payment method on file" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get mechanic's Stripe account
    const { data: mechanicAccount } = await supabaseClient
      .from("mechanic_payout_accounts")
      .select("stripe_account_id, payouts_enabled")
      .eq("mechanic_id", job.mechanic_id)
      .single();

    if (!mechanicAccount?.stripe_account_id) {
      return new Response(
        JSON.stringify({ error: "Mechanic has not set up payout account" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!mechanicAccount.payouts_enabled) {
      return new Response(
        JSON.stringify({ error: "Mechanic payouts not enabled" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Calculate fees
    const percent_fee_cents = Math.min(Math.round(labor_cents * 0.12), 5000);
    const customer_total_cents = labor_cents + 1500;
    const mechanic_payout_cents = labor_cents - percent_fee_cents;
    const platform_revenue_cents = 1500 + percent_fee_cents;

    // Create payment intent with destination charge
    const paymentIntent = await stripe.paymentIntents.create({
      amount: customer_total_cents,
      currency: "usd",
      customer: customerData.stripe_customer_id,
      payment_method: customerData.stripe_payment_method_id,
      confirm: true,
      off_session: true,
      transfer_data: {
        amount: mechanic_payout_cents,
        destination: mechanicAccount.stripe_account_id,
      },
      metadata: {
        job_id: job_id,
        customer_id: user.id,
        mechanic_id: job.mechanic_id,
        labor_cents: labor_cents.toString(),
        platform_fee_cents: platform_revenue_cents.toString(),
      },
      description: `Payment for job ${job_id}`,
    });

    // Update job with payment info
    await supabaseClient
      .from("jobs")
      .update({
        payment_status: "paid",
        payment_intent_id: paymentIntent.id,
        labor_cents: labor_cents,
        customer_total_cents: customer_total_cents,
        mechanic_payout_cents: mechanic_payout_cents,
        platform_fee_cents: platform_revenue_cents,
        paid_at: new Date().toISOString(),
      })
      .eq("id", job_id);

    return new Response(
      JSON.stringify({
        success: true,
        payment_intent_id: paymentIntent.id,
        customer_total_cents,
        mechanic_payout_cents,
        platform_fee_cents: platform_revenue_cents,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Payment error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Payment failed",
        type: error.type || "unknown_error"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
```

### 2. Update Jobs Table Schema

Add payment tracking columns to your jobs table:

```sql
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payment_intent_id TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS labor_cents INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_total_cents INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS mechanic_payout_cents INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS platform_fee_cents INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_jobs_payment_status ON jobs(payment_status);
CREATE INDEX IF NOT EXISTS idx_jobs_payment_intent_id ON jobs(payment_intent_id);
```

### 3. React Native Payment Component

Create a payment component for customers:

```typescript
import React, { useState } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';

interface JobPaymentProps {
  jobId: string;
  laborAmount: number; // in dollars
  onPaymentComplete: () => void;
}

export function JobPayment({ jobId, laborAmount, onPaymentComplete }: JobPaymentProps) {
  const [loading, setLoading] = useState(false);

  const calculateFees = (laborDollars: number) => {
    const labor_cents = Math.round(laborDollars * 100);
    const percent_fee_cents = Math.min(Math.round(labor_cents * 0.12), 5000);
    const customer_total_cents = labor_cents + 1500;
    const mechanic_payout_cents = labor_cents - percent_fee_cents;
    const platform_fee_cents = 1500 + percent_fee_cents;

    return {
      labor: labor_cents / 100,
      commission: percent_fee_cents / 100,
      flatFee: 15,
      total: customer_total_cents / 100,
      mechanicReceives: mechanic_payout_cents / 100,
      platformFee: platform_fee_cents / 100,
    };
  };

  const fees = calculateFees(laborAmount);

  const handlePayment = async () => {
    try {
      setLoading(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Error', 'Please sign in to continue');
        return;
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-job-payment`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            job_id: jobId,
            labor_cents: Math.round(laborAmount * 100),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Payment failed');
      }

      Alert.alert(
        'Payment Successful',
        `You paid $${fees.total.toFixed(2)}. The mechanic will receive $${fees.mechanicReceives.toFixed(2)}.`,
        [{ text: 'OK', onPress: onPaymentComplete }]
      );
    } catch (error: any) {
      Alert.alert('Payment Error', error.message || 'Failed to process payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 16, backgroundColor: '#f9f9f9', borderRadius: 8 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>
        Payment Summary
      </Text>

      <View style={{ gap: 8, marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text>Labor</Text>
          <Text>${fees.labor.toFixed(2)}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text>Service Fee</Text>
          <Text>${fees.flatFee.toFixed(2)}</Text>
        </View>
        <View style={{ 
          flexDirection: 'row', 
          justifyContent: 'space-between',
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: '#ddd'
        }}>
          <Text style={{ fontWeight: 'bold' }}>Total</Text>
          <Text style={{ fontWeight: 'bold' }}>${fees.total.toFixed(2)}</Text>
        </View>
      </View>

      <Text style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
        Mechanic receives: ${fees.mechanicReceives.toFixed(2)} (after {fees.commission.toFixed(2)} commission)
      </Text>

      <Pressable
        onPress={handlePayment}
        disabled={loading}
        style={({ pressed }) => ({
          backgroundColor: loading ? '#ccc' : '#007AFF',
          padding: 16,
          borderRadius: 8,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>
            Pay ${fees.total.toFixed(2)}
          </Text>
        )}
      </Pressable>
    </View>
  );
}
```

### 4. Deploy Payment Function

```bash
# Deploy the payment function
supabase functions deploy create-job-payment

# Verify it's deployed
supabase functions list
```

### 5. Test Payment Flow

```typescript
// Test with different labor amounts
const testCases = [
  { labor: 100, expectedTotal: 115, expectedMechanic: 88 },
  { labor: 500, expectedTotal: 515, expectedMechanic: 450 },
  { labor: 1000, expectedTotal: 1015, expectedMechanic: 950 },
];

testCases.forEach(({ labor, expectedTotal, expectedMechanic }) => {
  const labor_cents = labor * 100;
  const percent_fee_cents = Math.min(Math.round(labor_cents * 0.12), 5000);
  const customer_total_cents = labor_cents + 1500;
  const mechanic_payout_cents = labor_cents - percent_fee_cents;

  console.log(`Labor: $${labor}`);
  console.log(`Customer pays: $${customer_total_cents / 100} (expected: $${expectedTotal})`);
  console.log(`Mechanic gets: $${mechanic_payout_cents / 100} (expected: $${expectedMechanic})`);
  console.log('---');
});
```

## Fee Calculation Examples

### Example 1: Small Job ($100 labor)
```
Labor:              $100.00
Commission (12%):    $12.00
Flat fee:            $15.00
─────────────────────────────
Customer pays:      $115.00
Mechanic receives:   $88.00
Platform keeps:      $27.00
```

### Example 2: Medium Job ($500 labor)
```
Labor:              $500.00
Commission (12%):    $50.00 (capped)
Flat fee:            $15.00
─────────────────────────────
Customer pays:      $515.00
Mechanic receives:  $450.00
Platform keeps:      $65.00
```

### Example 3: Large Job ($1000 labor)
```
Labor:             $1000.00
Commission (12%):    $50.00 (capped at max)
Flat fee:            $15.00
─────────────────────────────
Customer pays:     $1015.00
Mechanic receives:  $950.00
Platform keeps:      $65.00
```

## Error Handling

### Common Payment Errors

```typescript
// Handle specific Stripe errors
try {
  const paymentIntent = await stripe.paymentIntents.create({...});
} catch (error: any) {
  switch (error.type) {
    case 'StripeCardError':
      // Card declined
      return { error: 'Card declined. Please use a different payment method.' };
    
    case 'StripeInvalidRequestError':
      // Invalid parameters
      return { error: 'Invalid payment request. Please try again.' };
    
    case 'StripeAPIError':
      // Stripe API error
      return { error: 'Payment service error. Please try again later.' };
    
    case 'StripeConnectionError':
      // Network error
      return { error: 'Network error. Please check your connection.' };
    
    default:
      return { error: 'Payment failed. Please contact support.' };
  }
}
```

## Security Considerations

1. **Verify job ownership** - Ensure customer owns the job
2. **Check job status** - Only allow payment for completed jobs
3. **Validate amounts** - Ensure labor_cents is positive and reasonable
4. **Check mechanic account** - Verify payouts are enabled
5. **Use off_session** - For saved payment methods
6. **Store metadata** - Track job_id, user_ids for reconciliation
7. **Handle webhooks** - Listen for payment_intent.succeeded/failed

## Webhook Implementation (Recommended)

Create `supabase/functions/stripe-payment-webhook/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import Stripe from "https://esm.sh/stripe@14.10.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    return new Response("Missing signature or secret", { status: 400 });
  }

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const jobId = paymentIntent.metadata.job_id;

        await supabaseClient
          .from("jobs")
          .update({
            payment_status: "paid",
            paid_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        // Notify mechanic
        // Send push notification or email
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const jobId = paymentIntent.metadata.job_id;

        await supabaseClient
          .from("jobs")
          .update({
            payment_status: "failed",
          })
          .eq("id", jobId);

        // Notify customer
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(error.message, { status: 400 });
  }
});
```

## Testing

### Test with Stripe Test Cards

```
Success: 4242 4242 4242 4242
Decline: 4000 0000 0000 0002
Insufficient funds: 4000 0000 0000 9995
```

### Test Payment Flow

1. Complete a job as mechanic
2. Sign in as customer
3. View completed job
4. See payment summary with fees
5. Tap "Pay" button
6. Verify payment succeeds
7. Check mechanic receives correct amount
8. Verify platform fee is correct

## Monitoring

Track these metrics:
- Total payments processed
- Average job value
- Platform revenue
- Failed payment rate
- Payout success rate
- Time to payout (Stripe → mechanic bank)

---

**Next Steps:**
1. Deploy payment edge function
2. Update jobs table schema
3. Add payment UI to customer app
4. Test with Stripe test cards
5. Set up webhook endpoint
6. Monitor payments in production
