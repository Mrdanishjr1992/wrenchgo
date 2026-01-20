import { supabase } from './supabase';

export interface PaymentBreakdown {
  quoteAmountCents: number;
  customerPlatformFeeCents: number;
  customerDiscountCents: number;
  customerTotalCents: number;
  mechanicPlatformCommissionCents: number;
  mechanicPayoutCents: number;
  platformRevenueCents: number;
  promotionApplied?: {
    code: string;
    type: string;
    discountCents: number;
  };
}

export interface CreatePaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
  paymentId: string;
  breakdown: PaymentBreakdown;
}

export interface ValidationResponse {
  valid: boolean;
  promotion?: {
    code: string;
    type: string;
    description: string;
  };
  discountCents?: number;
  reason?: string;
}

export interface Payment {
  id: string;
  job_id: string;
  quote_id: string;
  customer_id: string;
  mechanic_id: string;
  quote_amount_cents: number;
  customer_platform_fee_cents: number;
  customer_discount_cents: number;
  customer_total_cents: number;
  mechanic_platform_commission_cents: number;
  mechanic_discount_cents: number;
  mechanic_payout_cents: number;
  platform_revenue_cents: number;
  currency: string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_transfer_id: string | null;
  stripe_connected_account_id: string | null;
  status: 'requires_payment' | 'processing' | 'paid' | 'failed' | 'refunded' | 'partially_refunded' | 'cancelled';
  payment_method_type: string | null;
  receipt_url: string | null;
  failure_reason: string | null;
  refund_amount_cents: number;
  promotion_codes: string[];
  paid_at: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
}

export const CUSTOMER_PLATFORM_FEE_CENTS = 1500;
export const MECHANIC_COMMISSION_RATE = 0.12;
export const MECHANIC_COMMISSION_CAP_CENTS = 5000;

export function calculateMechanicCommission(quoteAmountCents: number): number {
  return Math.min(Math.round(quoteAmountCents * MECHANIC_COMMISSION_RATE), MECHANIC_COMMISSION_CAP_CENTS);
}

export function formatCurrency(cents: number | null | undefined): string {
  const value = Number(cents);
  if (cents === null || cents === undefined || !Number.isFinite(value)) {
    return "$0.00";
  }
  return `$${(value / 100).toFixed(2)}`;
}

export function centsToDollars(cents: number | null | undefined): number {
  const value = Number(cents);
  if (!Number.isFinite(value)) return 0;
  return value / 100;
}

export function dollarsToCents(dollars: number | null | undefined): number {
  const value = Number(dollars);
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100);
}

export async function createPaymentIntent(
  jobId: string,
  quoteId: string,
  promotionCode?: string
): Promise<CreatePaymentIntentResponse> {
  const { data, error } = await supabase.functions.invoke('create-payment-intent', {
    body: {
      jobId,
      quoteId,
      promotionCode,
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to create payment intent');
  }

  return data;
}

export async function validatePromotion(
  promotionCode: string,
  quoteAmountCents: number
): Promise<ValidationResponse> {
  const { data, error } = await supabase.functions.invoke('validate-promotion', {
    body: {
      promotionCode,
      quoteAmountCents,
    },
  });

  if (error) {
    throw new Error(error.message || 'Failed to validate promotion');
  }

  return data;
}

export async function getPaymentByJobId(jobId: string): Promise<Payment | null> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching payment:', error);
    return null;
  }

  return data;
}

export async function getPaymentsByCustomerId(customerId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching payments:', error);
    return [];
  }

  return data || [];
}

export async function getPaymentsByMechanicId(mechanicId: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('mechanic_id', mechanicId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching payments:', error);
    return [];
  }

  return data || [];
}

export function calculateCustomerBreakdown(
  quoteAmountCents: number,
  discountCents: number = 0
): {
  quoteAmount: number;
  platformFee: number;
  discount: number;
  total: number;
} {
  const platformFee = CUSTOMER_PLATFORM_FEE_CENTS;
  const total = Math.max(0, quoteAmountCents + platformFee - discountCents);

  return {
    quoteAmount: quoteAmountCents,
    platformFee,
    discount: discountCents,
    total,
  };
}

export function calculateMechanicBreakdown(
  quoteAmountCents: number
): {
  jobAmount: number;
  platformCommission: number;
  payout: number;
} {
  const platformCommission = calculateMechanicCommission(quoteAmountCents);
  const payout = quoteAmountCents - platformCommission;

  return {
    jobAmount: quoteAmountCents,
    platformCommission,
    payout,
  };
}

export function getPaymentStatusColor(status: Payment['status']): string {
  switch (status) {
    case 'paid':
      return '#10b981';
    case 'processing':
      return '#f59e0b';
    case 'failed':
    case 'cancelled':
      return '#ef4444';
    case 'refunded':
    case 'partially_refunded':
      return '#6b7280';
    default:
      return '#9ca3af';
  }
}

export function getPaymentStatusLabel(status: Payment['status']): string {
  switch (status) {
    case 'requires_payment':
      return 'Requires Payment';
    case 'processing':
      return 'Processing';
    case 'paid':
      return 'Paid';
    case 'failed':
      return 'Failed';
    case 'refunded':
      return 'Refunded';
    case 'partially_refunded':
      return 'Partially Refunded';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Unknown';
  }
}
