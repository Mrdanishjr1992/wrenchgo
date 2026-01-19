/**
 * Compile-time schema validation utilities
 * 
 * These types and helpers ensure that all database queries use only
 * columns that actually exist in the schema, validated at compile time.
 */

import type { DatabaseSchema, TableName, TableColumn } from '../../types/database';

/**
 * Asserts that all columns in the array are valid for the given table.
 * This is a compile-time check - if any column doesn't exist, TypeScript will error.
 * 
 * Usage:
 * ```ts
 * const PROFILE_COLS = ['id', 'email', 'full_name'] as const satisfies readonly TableColumn<'profiles'>[];
 * ```
 */
export type AssertColumns<
  T extends TableName,
  Cols extends readonly string[]
> = Cols extends readonly TableColumn<T>[] ? Cols : never;

/**
 * Type-safe select string builder
 * Creates a comma-separated string of columns for Supabase select()
 */
export function selectColumns<T extends TableName>(
  _table: T,
  columns: readonly TableColumn<T>[]
): string {
  return columns.join(', ');
}

/**
 * Validates that a column name exists on a table at compile time
 * Returns the column name if valid, errors if not
 */
export function assertColumn<T extends TableName>(
  _table: T,
  column: TableColumn<T>
): TableColumn<T> {
  return column;
}

/**
 * Creates a type-safe column array for a specific table
 * Will error at compile time if any column doesn't exist
 */
export function tableColumns<T extends TableName>(
  _table: T,
  columns: readonly TableColumn<T>[]
): readonly TableColumn<T>[] {
  return columns;
}

/**
 * Checks if a string is a valid column for a table (runtime check)
 */
export function isValidColumn<T extends TableName>(
  column: string,
  validColumns: readonly string[]
): boolean {
  return validColumns.includes(column);
}

// Pre-defined column sets for common admin queries
// These are validated at compile time against DatabaseSchema

export const PROFILE_SELECT = [
  'id', 'email', 'full_name', 'phone', 'role', 'avatar_url',
  'created_at', 'updated_at', 'deleted_at', 'hub_id',
  'service_zip', 'service_lat', 'service_lng', 'city', 'state'
] as const satisfies readonly TableColumn<'profiles'>[];

export const JOB_SELECT = [
  'id', 'status', 'description', 'title', 'location_address', 'location_lat', 'location_lng',
  'customer_id', 'accepted_mechanic_id', 'vehicle_id', 'hub_id',
  'created_at', 'updated_at', 'deleted_at', 'scheduled_at',
  'completed_at', 'cancelled_at', 'symptom_key', 'final_price_cents'
] as const satisfies readonly TableColumn<'jobs'>[];

export const DISPUTE_SELECT = [
  'id', 'job_id', 'filed_by', 'description', 'status',
  'resolution_notes', 'resolved_at', 'resolved_by',
  'created_at', 'updated_at', 'category', 'priority'
] as const satisfies readonly TableColumn<'disputes'>[];

export const SUPPORT_SELECT = [
  'id', 'user_id', 'job_id', 'message', 'status',
  'category', 'screenshot_url', 'metadata',
  'created_at', 'updated_at'
] as const satisfies readonly TableColumn<'support_requests'>[];

export const PAYMENT_SELECT = [
  'id', 'job_id', 'customer_id', 'mechanic_id', 'amount_cents',
  'status', 'stripe_payment_intent_id', 'created_at', 'updated_at', 'deleted_at'
] as const satisfies readonly TableColumn<'payments'>[];

export const PAYOUT_SELECT = [
  'id', 'mechanic_id', 'net_amount_cents', 'status',
  'stripe_transfer_id', 'scheduled_for', 'processed_at',
  'failed_at', 'failure_reason', 'created_at'
] as const satisfies readonly TableColumn<'payouts'>[];

export const HUB_SELECT = [
  'id', 'name', 'slug', 'zip', 'is_active',
  'lat', 'lng', 'active_radius_miles', 'max_radius_miles',
  'launch_date', 'created_at'
] as const satisfies readonly TableColumn<'service_hubs'>[];

export const WAITLIST_SELECT = [
  'id', 'email', 'zip', 'user_type', 'nearest_hub_id',
  'distance_miles', 'invited_at', 'converted_at', 'created_at'
] as const satisfies readonly TableColumn<'waitlist'>[];

export const MECHANIC_PROFILE_SELECT = [
  'id', 'hourly_rate_cents', 'bio', 'years_experience',
  'is_available', 'service_radius_km', 'verification_status',
  'verification_reason', 'created_at', 'updated_at'
] as const satisfies readonly TableColumn<'mechanic_profiles'>[];
