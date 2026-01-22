import { supabase } from './supabase';
import type { VerificationDocType, VettingReviewStatus, MechanicTier, StrikeReason } from '../constants/verification';

// =====================================================
// INTERFACES
// =====================================================

export interface VerificationStatus {
  status: string;
  reason: string | null;
  is_active: boolean;
  can_view_leads: boolean;
  can_submit_quotes: boolean;
  documents_uploaded: number;
  documents_approved: number;
  documents_required: number;
  vetting_responses: number;
  vetting_required: number;
  vetting_review_status: VettingReviewStatus;
  // Phase 2 additions
  tier: MechanicTier;
  probation_started_at: string | null;
  probation_completed_at: string | null;
  strike_count: number;
  max_quote_cents: number | null;
  max_radius_miles: number | null;
  blocked_symptom_keys: string[] | null;
}

export interface VerificationDocument {
  id: string;
  mechanic_id: string;
  doc_type: VerificationDocType;
  bucket: string;
  path: string;
  status: 'pending' | 'approved' | 'rejected';
  uploaded_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
}

export interface VettingResponse {
  id: string;
  mechanic_id: string;
  prompt_key: string;
  prompt_text: string;
  response_text: string;
  created_at: string;
}

export interface MechanicStrike {
  id: string;
  mechanic_id: string;
  job_id: string | null;
  reason: StrikeReason;
  notes: string | null;
  severity: number;
  expires_at: string | null;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
  is_active: boolean;
}

export interface CreateQuoteResult {
  success: boolean;
  quote_id?: string;
  error?: string;
  max_quote_cents?: number;
  blocked_symptom?: string;
}

// =====================================================
// EXISTING FUNCTIONS
// =====================================================

export async function getVerificationStatus(mechanicId?: string): Promise<VerificationStatus | null> {
  const { data, error } = await supabase.rpc('get_mechanic_verification_status', {
    p_mechanic_id: mechanicId,
  });
  if (error) {
    console.error('Error fetching verification status:', error);
    return null;
  }
  return data as VerificationStatus;
}

export async function getVerificationDocuments(mechanicId: string): Promise<VerificationDocument[]> {
  const { data, error } = await supabase
    .from('mechanic_verification_documents')
    .select('*')
    .eq('mechanic_id', mechanicId)
    .order('doc_type');
  if (error) {
    console.error('Error fetching verification documents:', error);
    return [];
  }
  return data || [];
}

export async function uploadVerificationDocument(
  mechanicId: string,
  docType: VerificationDocType,
  fileUri: string,
  contentType: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(fileUri);
    const blob = await response.arrayBuffer();

    const ext = contentType.includes('png') ? 'png' : 'jpg';
    const path = `${mechanicId}/${docType}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('mechanic-verification')
      .upload(path, blob, {
        contentType,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { error: dbError } = await supabase
      .from('mechanic_verification_documents')
      .upsert({
        mechanic_id: mechanicId,
        doc_type: docType,
        bucket: 'mechanic-verification',
        path,
        status: 'pending',
        uploaded_at: new Date().toISOString(),
      }, {
        onConflict: 'mechanic_id,doc_type',
      });

    if (dbError) throw dbError;

    return { success: true };
  } catch (error: any) {
    console.error('Error uploading verification document:', error);
    return { success: false, error: error.message };
  }
}

export async function getVettingResponses(mechanicId: string): Promise<VettingResponse[]> {
  const { data, error } = await supabase
    .from('mechanic_vetting_responses')
    .select('*')
    .eq('mechanic_id', mechanicId)
    .order('prompt_key');
  if (error) {
    console.error('Error fetching vetting responses:', error);
    return [];
  }
  return data || [];
}

export async function saveVettingResponse(
  mechanicId: string,
  promptKey: string,
  promptText: string,
  responseText: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('mechanic_vetting_responses')
      .upsert({
        mechanic_id: mechanicId,
        prompt_key: promptKey,
        prompt_text: promptText,
        response_text: responseText,
      }, {
        onConflict: 'mechanic_id,prompt_key',
      });

    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    console.error('Error saving vetting response:', error);
    return { success: false, error: error.message };
  }
}

export async function checkIsAdmin(userId?: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin', { uid: userId });
  if (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
  return data === true;
}

export async function getDocumentUrl(bucket: string, path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error) {
    console.error('Error getting document URL:', error);
    return null;
  }
  return data.signedUrl;
}

// =====================================================
// PHASE 2: QUOTE SUBMISSION WITH ENFORCEMENT
// =====================================================

export async function createQuoteForJob(
  jobId: string,
  priceCents: number,
  notes?: string,
  estimatedHours?: number,
  useQuoteRequests: boolean = false
): Promise<CreateQuoteResult> {
  const { data, error } = await supabase.rpc('create_quote_for_job', {
    p_job_id: jobId,
    p_price_cents: priceCents,
    p_notes: notes || null,
    p_estimated_hours: estimatedHours || null,
    p_use_quote_requests: useQuoteRequests,
  });

  if (error) {
    console.error('Error creating quote:', error);
    return { success: false, error: error.message };
  }

  return data as CreateQuoteResult;
}

// =====================================================
// PHASE 2: LEAD DECISION LOGGING
// =====================================================

export async function declineLead(
  jobId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('decline_lead', {
    p_job_id: jobId,
    p_reason: reason || null,
  });

  if (error) {
    console.error('Error declining lead:', error);
    return { success: false, error: error.message };
  }

  return data as { success: boolean; error?: string };
}

export async function logLeadView(jobId: string): Promise<void> {
  const { error } = await supabase.rpc('log_lead_view', { p_job_id: jobId });
  if (error) {
    console.error('Error logging lead view:', error);
  }
}

// =====================================================
// PHASE 2: ADMIN TIER MANAGEMENT
// =====================================================

export async function adminSetMechanicTier(
  mechanicId: string,
  tier: MechanicTier,
  reason?: string
): Promise<{ success: boolean; error?: string; old_tier?: string; new_tier?: string }> {
  const { data, error } = await supabase.rpc('admin_set_mechanic_tier', {
    p_mechanic_id: mechanicId,
    p_tier: tier,
    p_reason: reason || null,
  });

  if (error) {
    console.error('Error setting mechanic tier:', error);
    return { success: false, error: error.message };
  }

  return data;
}

export async function adminSetMechanicOverrides(
  mechanicId: string,
  options: {
    maxQuoteCentsOverride?: number;
    blockedSymptomKeys?: string[];
    maxLeadRadiusMilesOverride?: number;
    clearOverrides?: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('admin_set_mechanic_overrides', {
    p_mechanic_id: mechanicId,
    p_max_quote_cents_override: options.maxQuoteCentsOverride || null,
    p_blocked_symptom_keys: options.blockedSymptomKeys || null,
    p_max_lead_radius_miles_override: options.maxLeadRadiusMilesOverride || null,
    p_clear_overrides: options.clearOverrides || false,
  });

  if (error) {
    console.error('Error setting mechanic overrides:', error);
    return { success: false, error: error.message };
  }

  return data;
}

// =====================================================
// PHASE 2: ADMIN STRIKE MANAGEMENT
// =====================================================

export async function adminAddMechanicStrike(
  mechanicId: string,
  reason: StrikeReason,
  notes?: string,
  jobId?: string,
  severity: number = 1
): Promise<{ success: boolean; strike_id?: string; total_strikes?: number; error?: string }> {
  const { data, error } = await supabase.rpc('admin_add_mechanic_strike', {
    p_mechanic_id: mechanicId,
    p_reason: reason,
    p_notes: notes || null,
    p_job_id: jobId || null,
    p_severity: severity,
  });

  if (error) {
    console.error('Error adding mechanic strike:', error);
    return { success: false, error: error.message };
  }

  return data;
}

export async function adminListMechanicStrikes(mechanicId: string): Promise<MechanicStrike[]> {
  const { data, error } = await supabase.rpc('admin_list_mechanic_strikes', {
    p_mechanic_id: mechanicId,
  });

  if (error) {
    console.error('Error listing mechanic strikes:', error);
    return [];
  }

  return data || [];
}

export async function adminRemoveStrike(strikeId: string): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('admin_remove_strike', {
    p_strike_id: strikeId,
  });

  if (error) {
    console.error('Error removing strike:', error);
    return { success: false, error: error.message };
  }

  return data;
}

// =====================================================
// PHASE 2: MECHANIC STRIKE LIST (for mechanics)
// =====================================================

export async function getMechanicStrikes(mechanicId: string): Promise<MechanicStrike[]> {
  const { data, error } = await supabase
    .from('mechanic_strikes')
    .select('*')
    .eq('mechanic_id', mechanicId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching mechanic strikes:', error);
    return [];
  }

  return (data || []).map(s => ({
    ...s,
    is_active: !s.expires_at || new Date(s.expires_at) > new Date(),
    created_by_name: null,
  }));
}

// =====================================================
// UTILITY: FORMAT PROBATION LIMITS
// =====================================================

export function formatProbationLimits(status: VerificationStatus): string[] {
  const limits: string[] = [];

  if (status.tier !== 'probation') return limits;

  if (status.max_quote_cents) {
    limits.push(`Max quote: $${(status.max_quote_cents / 100).toFixed(0)}`);
  }

  if (status.max_radius_miles) {
    limits.push(`Max radius: ${status.max_radius_miles} miles`);
  }

  if (status.blocked_symptom_keys && status.blocked_symptom_keys.length > 0) {
    limits.push(`${status.blocked_symptom_keys.length} restricted job categories`);
  }

  return limits;
}
