/**
 * Admin Safe Fetch Utility
 * Wraps all admin queries with consistent error handling and logging
 */

export interface SafeFetchResult<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export async function adminSafeFetch<T>(
  label: string,
  queryFn: () => Promise<T>
): Promise<SafeFetchResult<T>> {
  try {
    const data = await queryFn();
    return { data, error: null, success: true };
  } catch (err: any) {
    const errorMessage = err?.message || err?.code || 'Unknown error';
    console.error(`[Admin ${label}] Error:`, errorMessage, err);
    return { data: null, error: errorMessage, success: false };
  }
}

/**
 * Schema Map for Admin Tables
 * 
 * profiles (customers & mechanics):
 *   id, email, full_name, display_name, phone, avatar_url, role, 
 *   city, state, hub_id, deleted_at, created_at, updated_at
 * 
 * mechanic_profiles:
 *   id (FK profiles), bio, years_experience, hourly_rate_cents, 
 *   service_radius_km, mobile_service, is_available, rating_avg, 
 *   rating_count, jobs_completed, stripe_account_id, 
 *   stripe_onboarding_complete, deleted_at, created_at, updated_at
 *   (verification_status added in later migration)
 * 
 * jobs:
 *   id, customer_id, vehicle_id, accepted_mechanic_id, title, description,
 *   status (job_status enum), symptom_key, symptom_id, location_lat, 
 *   location_lng, location_address, preferred_time, scheduled_at, 
 *   completed_at, cancelled_at, final_price_cents, hub_id, deleted_at, 
 *   created_at, updated_at
 * 
 * quotes:
 *   id, job_id, mechanic_id, price_cents, estimated_hours, notes,
 *   status (text: pending/accepted/declined/expired/withdrawn),
 *   created_at, updated_at
 * 
 * disputes:
 *   id, job_id, contract_id, filed_by, filed_by_role, filed_against,
 *   status (dispute_status enum), category, description, desired_resolution,
 *   evidence_urls, resolved_at, resolved_by, resolution_type, resolution_notes,
 *   customer_refund_cents, mechanic_adjustment_cents, internal_notes,
 *   assigned_to, priority, response_deadline, evidence_deadline,
 *   created_at, updated_at
 *   NOTE: NO deleted_at column
 * 
 * support_requests:
 *   id, user_id, category, message, job_id, screenshot_url, metadata,
 *   status (text: open/resolved), created_at, updated_at
 *   NOTE: NO deleted_at column
 * 
 * payments:
 *   id, job_id, customer_id, mechanic_id, stripe_payment_intent_id,
 *   amount_cents, platform_fee_cents, status (payment_status enum),
 *   paid_at, refunded_at, deleted_at, created_at, updated_at
 *   payment_status: pending, processing, succeeded, failed, refunded, partially_refunded
 * 
 * payouts:
 *   id, contract_id, mechanic_id, gross_amount_cents, commission_cents,
 *   adjustments_cents, net_amount_cents, status (payout_status enum),
 *   stripe_transfer_id, stripe_payout_id, scheduled_for, processed_at,
 *   failed_at, failure_reason, held_at, hold_reason, released_at,
 *   created_at, updated_at
 *   payout_status: pending, processing, completed, failed, held, cancelled
 * 
 * service_hubs:
 *   id, name, slug, zip, lat, lng, max_radius_miles, active_radius_miles,
 *   is_active, invite_only, auto_expand_enabled, launch_date, graduated_at,
 *   location, settings, created_at
 * 
 * waitlist:
 *   id, email, phone, zip, lat, lng, location, nearest_hub_id, distance_miles,
 *   ring, user_type, service_needed, services_offered, years_experience,
 *   willing_travel_miles, invited_at, converted_at, created_at
 *   NOTE: full_name, city, state, status columns may not exist - check migration
 */
