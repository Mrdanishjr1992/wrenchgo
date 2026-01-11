import { supabase } from './supabase';
import type {
  InvoiceLineItem,
  Invoice,
  LineItemType,
  AddLineItemResponse,
  JobActionResponse,
  JobContract,
} from '../types/job-lifecycle';

// =====================================================
// LINE ITEM MANAGEMENT
// =====================================================

export async function addLineItem(
  jobId: string,
  item: {
    itemType: LineItemType;
    description: string;
    quantity: number;
    unitPriceCents: number;
    notes?: string;
    partNumber?: string;
    partSource?: string;
  }
): Promise<AddLineItemResponse> {
  const { data: userData } = await supabase.auth.getUser();
  const mechanicId = userData.user?.id;
  
  if (!mechanicId) {
    return { success: false, error: 'Not authenticated' };
  }
  
  const { data, error } = await supabase.rpc('add_invoice_line_item', {
    p_job_id: jobId,
    p_mechanic_id: mechanicId,
    p_item_type: item.itemType,
    p_description: item.description,
    p_quantity: item.quantity,
    p_unit_price_cents: item.unitPriceCents,
    p_notes: item.notes ?? null,
    p_part_number: item.partNumber ?? null,
    p_part_source: item.partSource ?? null,
  });
  
  if (error) {
    console.error('Add line item error:', error);
    return { success: false, error: error.message };
  }
  
  return data as AddLineItemResponse;
}

export async function approveLineItem(lineItemId: string): Promise<JobActionResponse> {
  const { data: userData } = await supabase.auth.getUser();
  const customerId = userData.user?.id;
  
  if (!customerId) {
    return { success: false, error: 'Not authenticated' };
  }
  
  const { data, error } = await supabase.rpc('customer_respond_to_line_item', {
    p_line_item_id: lineItemId,
    p_customer_id: customerId,
    p_approved: true,
    p_rejection_reason: null,
  });
  
  if (error) {
    console.error('Approve line item error:', error);
    return { success: false, error: error.message };
  }
  
  return data as JobActionResponse;
}

export async function rejectLineItem(
  lineItemId: string,
  reason?: string
): Promise<JobActionResponse> {
  const { data: userData } = await supabase.auth.getUser();
  const customerId = userData.user?.id;
  
  if (!customerId) {
    return { success: false, error: 'Not authenticated' };
  }
  
  const { data, error } = await supabase.rpc('customer_respond_to_line_item', {
    p_line_item_id: lineItemId,
    p_customer_id: customerId,
    p_approved: false,
    p_rejection_reason: reason ?? null,
  });
  
  if (error) {
    console.error('Reject line item error:', error);
    return { success: false, error: error.message };
  }
  
  return data as JobActionResponse;
}

// =====================================================
// DATA FETCHING
// =====================================================

export async function getInvoiceLineItems(contractId: string): Promise<InvoiceLineItem[]> {
  const { data, error } = await supabase
    .from('invoice_line_items')
    .select('*')
    .eq('contract_id', contractId)
    .order('sort_order', { ascending: true });
  
  if (error) {
    console.error('Get line items error:', error);
    return [];
  }
  
  return (data ?? []) as InvoiceLineItem[];
}

export async function getInvoice(contractId: string, preloadedContract?: any): Promise<Invoice | null> {
  // Get contract (or use preloaded)
  let contract = preloadedContract;
  if (!contract) {
    const { data, error: contractError } = await supabase
      .from('job_contracts')
      .select('*')
      .eq('id', contractId)
      .single();

    if (contractError || !data) {
      console.error('Get contract error:', contractError);
      return null;
    }
    contract = data;
  }

  // If no promo info on contract, check payment_promo_applications via payments table
  if (!contract.promo_discount_cents && contract.job_id) {
    const { data: payment } = await supabase
      .from('payments')
      .select('id')
      .eq('job_id', contract.job_id)
      .maybeSingle();

    if (payment) {
      const { data: promoApp } = await supabase
        .from('payment_promo_applications')
        .select('discount_cents, credit_type, fee_before_cents')
        .eq('payment_id', payment.id)
        .maybeSingle();

      if (promoApp && promoApp.discount_cents > 0) {
        contract.promo_discount_cents = promoApp.discount_cents;
        contract.promo_credit_type = promoApp.credit_type;
        contract.original_platform_fee_cents = promoApp.fee_before_cents;
      }
    }
  }

  // Get line items
  const lineItems = await getInvoiceLineItems(contractId);

  // Categorize items
  const approvedItems = lineItems.filter(i => i.approval_status === 'approved');
  const pendingItems = lineItems.filter(i => i.approval_status === 'pending');
  const rejectedItems = lineItems.filter(i =>
    i.approval_status === 'rejected' || i.approval_status === 'auto_rejected'
  );

  // Calculate subtotals
  const approvedSubtotal = approvedItems
    .filter(i => i.item_type !== 'platform_fee')
    .reduce((sum, i) => sum + i.total_cents, 0);
  const pendingSubtotal = pendingItems.reduce((sum, i) => sum + i.total_cents, 0);

  return {
    contract: contract as JobContract,
    line_items: lineItems,
    approved_items: approvedItems,
    pending_items: pendingItems,
    rejected_items: rejectedItems,
    approved_subtotal_cents: approvedSubtotal,
    pending_subtotal_cents: pendingSubtotal,
  };
}

export async function getInvoiceByJobId(jobId: string): Promise<Invoice | null> {
  // Get contract by job_id
  const { data: contract, error: contractError } = await supabase
    .from('job_contracts')
    .select('*')
    .eq('job_id', jobId)
    .single();

  if (contractError || !contract) {
    if (contractError?.code === 'PGRST116') return null; // Not found
    console.error('Get contract error:', contractError);
    return null;
  }

  // Get job promo info
  const { data: job } = await supabase
    .from('jobs')
    .select('promo_discount_cents, promo_credit_type, applied_promo_credit_id')
    .eq('id', jobId)
    .single();

  // Merge promo info into contract
  if (job && job.promo_discount_cents) {
    contract.promo_discount_cents = job.promo_discount_cents;
    contract.promo_credit_type = job.promo_credit_type;
    contract.original_platform_fee_cents = contract.platform_fee_cents;
  }

  return getInvoice(contract.id, contract);
}

// =====================================================
// PENDING ITEMS CHECK
// =====================================================

export async function getPendingLineItemsCount(contractId: string): Promise<number> {
  const { count, error } = await supabase
    .from('invoice_line_items')
    .select('*', { count: 'exact', head: true })
    .eq('contract_id', contractId)
    .eq('approval_status', 'pending');
  
  if (error) {
    console.error('Get pending count error:', error);
    return 0;
  }
  
  return count ?? 0;
}

// =====================================================
// SUBSCRIPTIONS
// =====================================================

export function subscribeToLineItems(
  contractId: string,
  callback: (items: InvoiceLineItem[]) => void
) {
  return supabase
    .channel(`invoice-items-${contractId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'invoice_line_items',
        filter: `contract_id=eq.${contractId}`,
      },
      async () => {
        // Refetch all items on any change
        const items = await getInvoiceLineItems(contractId);
        callback(items);
      }
    )
    .subscribe();
}

// =====================================================
// FORMATTING HELPERS
// =====================================================

export function formatLineItemType(type: LineItemType): string {
  switch (type) {
    case 'base_labor': return 'Labor';
    case 'additional_labor': return 'Additional Labor';
    case 'parts': return 'Parts';
    case 'diagnostic': return 'Diagnostic';
    case 'travel': return 'Travel Fee';
    case 'platform_fee': return 'Platform Fee';
    case 'discount': return 'Discount';
    case 'tax': return 'Tax';
    default: return type;
  }
}

export function getLineItemIcon(type: LineItemType): string {
  switch (type) {
    case 'base_labor':
    case 'additional_labor':
      return 'construct-outline';
    case 'parts':
      return 'cog-outline';
    case 'diagnostic':
      return 'search-outline';
    case 'travel':
      return 'car-outline';
    case 'platform_fee':
      return 'shield-checkmark-outline';
    case 'discount':
      return 'pricetag-outline';
    case 'tax':
      return 'receipt-outline';
    default:
      return 'ellipse-outline';
  }
}
