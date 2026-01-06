export type JobStatus =
  | 'draft'
  | 'quoted'
  | 'accepted'
  | 'in_progress'
  | 'mechanic_verified'
  | 'customer_verified'
  | 'completed'
  | 'paid'
  | 'cancelled'
  | 'disputed'

export type InvoiceStatus = 'draft' | 'locked' | 'paid' | 'refunded' | 'disputed'

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'requires_action'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'refunded'

export type LedgerStatus = 'pending' | 'available_for_transfer' | 'transferred' | 'paid_out' | 'refunded'

export type TransferStatus = 'pending' | 'succeeded' | 'failed' | 'reversed'

export type NotificationType =
  | 'payment_succeeded'
  | 'payment_failed'
  | 'transfer_created'
  | 'payout_completed'
  | 'job_completed'
  | 'dispute_created'
  | 'refund_issued'

export interface Job {
  id: string
  customer_id: string
  mechanic_id: string | null
  status: JobStatus
  title: string
  description: string | null
  mechanic_verified_at: string | null
  customer_verified_at: string | null
  completed_at: string | null
  paid_at: string | null
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export interface Quote {
  id: string
  job_id: string
  mechanic_id: string
  labor_cost_cents: number
  parts_cost_cents: number
  total_cents: number
  description: string | null
  accepted_at: string | null
  created_at: string
  updated_at: string
}

export interface JobAdjustment {
  id: string
  job_id: string
  mechanic_id: string
  adjustment_type: string
  amount_cents: number
  description: string
  customer_approved_at: string | null
  created_at: string
}

export interface JobInvoice {
  id: string
  job_id: string
  quote_id: string
  status: InvoiceStatus
  original_labor_cents: number
  original_parts_cents: number
  adjustments_cents: number
  subtotal_cents: number
  platform_fee_cents: number
  total_cents: number
  mechanic_net_cents: number
  line_items: LineItem[]
  locked_at: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

export interface LineItem {
  type: string
  description: string
  amount_cents: number
  adjustment_type?: string
}

export interface Payment {
  id: string
  job_id: string
  invoice_id: string
  customer_id: string
  mechanic_id: string
  stripe_payment_intent_id: string
  stripe_charge_id: string | null
  amount_cents: number
  status: PaymentStatus
  client_secret: string | null
  error_message: string | null
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export interface MechanicLedger {
  id: string
  mechanic_id: string
  payment_id: string
  job_id: string
  stripe_account_id: string
  amount_cents: number
  status: LedgerStatus
  available_for_transfer_at: string | null
  transferred_at: string | null
  stripe_transfer_id: string | null
  paid_out_at: string | null
  stripe_payout_id: string | null
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export interface Transfer {
  id: string
  mechanic_id: string
  stripe_account_id: string
  stripe_transfer_id: string
  amount_cents: number
  status: TransferStatus
  ledger_item_ids: string[]
  error_message: string | null
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string
  data: Record<string, any>
  read_at: string | null
  sent_at: string | null
  created_at: string
}

export interface MechanicStripeAccount {
  id: string
  mechanic_id: string
  stripe_account_id: string
  onboarding_completed: boolean
  charges_enabled: boolean
  payouts_enabled: boolean
  details_submitted: boolean
  country: string | null
  currency: string
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}
