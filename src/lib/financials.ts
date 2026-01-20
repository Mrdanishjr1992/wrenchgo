import { supabase } from "./supabase";

export type CustomerJobFinancials = {
  job_id: string;
  quote_amount_cents: number;
  subtotal_cents: number;
  platform_fee_cents: number;
  total_cents: number;
  payment_status: "paid" | "pending";
  payment_method: string;
  paid_at: string | null;
  invoice: {
    id: string;
    invoice_number: string;
    status: string;
    items: Array<{
      type: string;
      description: string;
      quantity: number;
      unit_price_cents: number;
      total_cents: number;
    }>;
  } | null;
  line_items: Array<{
    type: string;
    description: string;
    quantity: number;
    unit_price_cents: number;
    total_cents: number;
    status: string;
  }> | null;
};

export type MechanicJobFinancials = {
  job_id: string;
  gross_amount_cents: number;
  commission_cents: number;
  net_payout_cents: number;
  payout_status: "pending" | "processing" | "completed" | "failed";
  payout_id: string | null;
  stripe_transfer_id: string | null;
  statement: {
    id: string;
    invoice_number: string;
    status: string;
    items: Array<{
      type: string;
      description: string;
      total_cents: number;
    }>;
  } | null;
};

export type FinancialSummary = {
  total_jobs: number;
  // Customer fields
  total_spent_cents?: number;
  total_fees_cents?: number;
  // Mechanic fields
  gross_earnings_cents?: number;
  total_earnings_cents?: number;
  total_commission_cents?: number;
  pending_payouts_cents?: number;
  completed_payouts_cents?: number;
};

export function formatCents(cents: number | null | undefined): string {
  const value = Number(cents);
  if (cents === null || cents === undefined || !Number.isFinite(value)) {
    return "$0.00";
  }
  return `$${(value / 100).toFixed(2)}`;
}

export function formatCentsCompact(cents: number | null | undefined): string {
  const value = Number(cents);
  if (cents === null || cents === undefined || !Number.isFinite(value)) {
    return "$0";
  }
  const dollars = value / 100;
  if (Math.abs(dollars) >= 1000) {
    return `$${(dollars / 1000).toFixed(1)}k`;
  }
  return `$${dollars.toFixed(0)}`;
}

export async function getCustomerJobFinancials(
  jobId: string,
  customerId: string
): Promise<CustomerJobFinancials | null> {
  const { data, error } = await supabase.rpc("get_customer_job_financials", {
    p_job_id: jobId,
    p_customer_id: customerId,
  });

  if (error) {
    console.error("Error fetching customer financials:", error);
    return null;
  }

  return data as CustomerJobFinancials;
}

export async function getMechanicJobFinancials(
  jobId: string,
  mechanicId: string
): Promise<MechanicJobFinancials | null> {
  const { data, error } = await supabase.rpc("get_mechanic_job_financials", {
    p_job_id: jobId,
    p_mechanic_id: mechanicId,
  });

  if (error) {
    console.error("Error fetching mechanic financials:", error);
    return null;
  }

  return data as MechanicJobFinancials;
}

export async function getFinancialSummary(
  userId: string,
  role: "customer" | "mechanic",
  periodType: "all_time" | "year" | "month" | "week" = "all_time"
): Promise<FinancialSummary | null> {
  const { data, error } = await supabase.rpc("get_financial_summary", {
    p_user_id: userId,
    p_role: role,
    p_period_type: periodType,
  });

  if (error) {
    console.error("Error fetching financial summary:", error);
    return null;
  }

  return data as FinancialSummary;
}

export async function generateJobInvoices(
  jobId: string
): Promise<{ customerInvoiceId: string; mechanicStatementId: string } | null> {
  const { data, error } = await supabase.rpc("generate_job_invoices", {
    p_job_id: jobId,
  });

  if (error) {
    console.error("Error generating invoices:", error);
    return null;
  }

  if (data && data.length > 0) {
    return {
      customerInvoiceId: data[0].customer_invoice_id,
      mechanicStatementId: data[0].mechanic_statement_id,
    };
  }

  return null;
}

export async function getInvoice(invoiceId: string) {
  const { data, error } = await supabase
    .from("invoices")
    .select(
      `
      *,
      items:invoice_items(*)
    `
    )
    .eq("id", invoiceId)
    .single();

  if (error) {
    console.error("Error fetching invoice:", error);
    return null;
  }

  return data;
}

export async function getUserInvoices(
  userId: string,
  type?: "customer_invoice" | "mechanic_statement"
) {
  let query = supabase
    .from("invoices")
    .select("*")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false });

  if (type) {
    query = query.eq("invoice_type", type);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching invoices:", error);
    return [];
  }

  return data;
}

export async function getLedgerEntries(jobId: string) {
  const { data, error } = await supabase
    .from("financial_ledger")
    .select("*")
    .eq("job_id", jobId)
    .order("effective_at", { ascending: true });

  if (error) {
    console.error("Error fetching ledger entries:", error);
    return [];
  }

  return data;
}

export const PAYOUT_STATUS_LABELS: Record<string, string> = {
  pending: "Payout Pending",
  processing: "Processing Payout",
  completed: "Paid Out",
  failed: "Payout Failed",
  held: "Payout On Hold",
};

export const PAYOUT_STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  processing: "#3b82f6",
  completed: "#10b981",
  failed: "#ef4444",
  held: "#6b7280",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending_authorization: "Awaiting Authorization",
  authorized: "Authorized (Not Charged)",
  captured: "Payment Complete",
  failed: "Payment Failed",
  refunded: "Refunded",
};

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending_authorization: "#6b7280",
  authorized: "#f59e0b",
  captured: "#10b981",
  failed: "#ef4444",
  refunded: "#8b5cf6",
};

export type JobFinancialBreakdown = {
  job_id: string;
  customer_name: string;
  job_title: string;
  job_status: string;
  // Contract data
  quoted_price_cents: number;
  platform_fee_cents: number;
  subtotal_cents: number;
  total_customer_cents: number;
  mechanic_commission_cents: number;
  mechanic_payout_cents: number;
  // Mechanic promo
  mechanic_promo_discount_cents: number;
  original_mechanic_commission_cents: number | null;
  mechanic_promo_credit_type: string | null;
  // Payment status
  payment_authorized_at: string | null;
  payment_captured_at: string | null;
  payment_status: "pending_authorization" | "authorized" | "captured" | "failed" | "refunded";
  // Payout
  payout_status: string | null;
  payout_scheduled_for: string | null;
  payout_processed_at: string | null;
  // Line items
  line_items: Array<{
    id: string;
    item_type: string;
    description: string;
    quantity: number;
    unit_price_cents: number;
    total_cents: number;
    approval_status: string;
  }>;
};

export async function getJobFinancialBreakdown(
  jobId: string,
  mechanicId: string
): Promise<JobFinancialBreakdown | null> {
  try {
    // Get contract
    const { data: contract, error: contractErr } = await supabase
      .from("job_contracts")
      .select("*")
      .eq("job_id", jobId)
      .eq("mechanic_id", mechanicId)
      .single();

    if (contractErr && contractErr.code !== "PGRST116") {
      console.error("Error fetching contract:", contractErr);
      return null;
    }

    if (!contract) return null;

    // Get job details
    const { data: job } = await supabase
      .from("jobs")
      .select("title, status, customer_id")
      .eq("id", jobId)
      .single();

    // Get customer name
    let customerName = "Customer";
    if (job?.customer_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", job.customer_id)
        .single();
      customerName = profile?.full_name || "Customer";
    }

    // Get line items
    const { data: lineItems } = await supabase
      .from("invoice_line_items")
      .select("id, item_type, description, quantity, unit_price_cents, total_cents, approval_status")
      .eq("contract_id", contract.id)
      .order("sort_order", { ascending: true });

    // Get payout
    const { data: payout } = await supabase
      .from("payouts")
      .select("status, scheduled_for, processed_at")
      .eq("contract_id", contract.id)
      .single();

    // Determine payment status
    let paymentStatus: JobFinancialBreakdown["payment_status"] = "pending_authorization";
    if (contract.refund_amount_cents && contract.refund_amount_cents > 0) {
      paymentStatus = "refunded";
    } else if (contract.payment_captured_at) {
      paymentStatus = "captured";
    } else if (contract.payment_authorized_at) {
      paymentStatus = "authorized";
    }

    return {
      job_id: jobId,
      customer_name: customerName,
      job_title: job?.title || "Job",
      job_status: job?.status || "unknown",
      quoted_price_cents: contract.quoted_price_cents,
      platform_fee_cents: contract.platform_fee_cents,
      subtotal_cents: contract.subtotal_cents,
      total_customer_cents: contract.total_customer_cents,
      mechanic_commission_cents: contract.mechanic_commission_cents,
      mechanic_payout_cents: contract.mechanic_payout_cents,
      // Mechanic promo
      mechanic_promo_discount_cents: contract.mechanic_promo_discount_cents || 0,
      original_mechanic_commission_cents: contract.original_mechanic_commission_cents || null,
      mechanic_promo_credit_type: contract.applied_mechanic_promo_credit_id ?
        (contract.mechanic_promo_discount_cents >= 1500 ? 'FEELESS' : 'FEELESS3') : null,
      payment_authorized_at: contract.payment_authorized_at,
      payment_captured_at: contract.payment_captured_at,
      payment_status: paymentStatus,
      payout_status: payout?.status || null,
      payout_scheduled_for: payout?.scheduled_for || null,
      payout_processed_at: payout?.processed_at || null,
      line_items: lineItems || [],
    };
  } catch (err) {
    console.error("Error fetching job financial breakdown:", err);
    return null;
  }
}

export async function listMechanicPayouts(
  mechanicId: string,
  filters?: { status?: string; limit?: number }
) {
  let query = supabase
    .from("payouts")
    .select(
      `
      id,
      contract_id,
      gross_amount_cents,
      commission_cents,
      net_amount_cents,
      status,
      scheduled_for,
      processed_at,
      failed_at,
      failure_reason,
      held_at,
      hold_reason,
      contract:job_contracts(job_id, jobs(title))
    `
    )
    .eq("mechanic_id", mechanicId)
    .order("created_at", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching mechanic payouts:", error);
    return [];
  }

  return data;
}

export async function getMechanicEarningsSummary(
  mechanicId: string,
  periodType: "week" | "month" | "all_time" = "all_time"
): Promise<{
  total_jobs: number;
  total_earnings_cents: number;
  total_commission_cents: number;
  pending_payouts_cents: number;
  completed_payouts_cents: number;
} | null> {
  // Try to get from financial_summaries first
  const { data: summary } = await supabase
    .from("financial_summaries")
    .select("*")
    .eq("user_id", mechanicId)
    .eq("role", "mechanic")
    .eq("period_type", periodType)
    .single();

  if (summary) {
    return {
      total_jobs: summary.total_jobs || 0,
      total_earnings_cents: summary.total_earnings_cents || 0,
      total_commission_cents: summary.total_commission_cents || 0,
      pending_payouts_cents: summary.pending_payouts_cents || 0,
      completed_payouts_cents: summary.completed_payouts_cents || 0,
    };
  }

  // Fallback: compute from payouts
  const { data: payouts } = await supabase
    .from("payouts")
    .select("gross_amount_cents, commission_cents, net_amount_cents, status")
    .eq("mechanic_id", mechanicId);

  if (!payouts) return null;

  const pending = payouts.filter((p) => ["pending", "processing"].includes(p.status));
  const completed = payouts.filter((p) => p.status === "completed");

  return {
    total_jobs: payouts.length,
    total_earnings_cents: payouts.reduce((sum, p) => sum + (p.gross_amount_cents || 0), 0),
    total_commission_cents: payouts.reduce((sum, p) => sum + (p.commission_cents || 0), 0),
    pending_payouts_cents: pending.reduce((sum, p) => sum + (p.net_amount_cents || 0), 0),
    completed_payouts_cents: completed.reduce((sum, p) => sum + (p.net_amount_cents || 0), 0),
  };
}
