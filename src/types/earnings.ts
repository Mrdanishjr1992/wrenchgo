// Types for Earnings & Taxes screen

export interface EarningsSummary {
  net_completed_cents: number;
  gross_completed_cents: number;
  commission_completed_cents: number;
  adjustments_completed_cents: number;
  net_pending_cents: number;
  count_completed: number;
  avg_net_completed_cents: number;
  take_rate_bps: number;
}

export interface PayoutRecord {
  payout_id: string;
  contract_id: string;
  status: "pending" | "processing" | "completed" | "failed" | "held" | "cancelled";
  gross_amount_cents: number;
  commission_cents: number;
  adjustments_cents: number;
  net_amount_cents: number;
  scheduled_for: string | null;
  processed_at: string | null;
  failed_at: string | null;
  held_at: string | null;
  failure_reason: string | null;
  hold_reason: string | null;
  job_id: string;
  job_title: string;
  customer_id: string;
  customer_name: string;
  created_at: string;
}

export interface MonthlyBreakdown {
  month: number;
  net_cents: number;
  commission_cents: number;
  adjustments_cents: number;
}

export interface TaxYearSummary {
  year_net_payouts_cents: number;
  year_commission_cents: number;
  year_adjustments_cents: number;
  year_taxable_estimate_cents: number;
  monthly_breakdown: MonthlyBreakdown[];
}

export type TimeRangeKey =
  | "today"
  | "this_week"
  | "this_month"
  | "last_3_months"
  | "last_6_months"
  | "this_year"
  | "custom";

export interface TimeRange {
  key: TimeRangeKey;
  label: string;
  start: Date;
  end: Date;
}
