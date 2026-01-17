import { supabase } from './supabase';
import type { VerificationDocType, VettingReviewStatus } from '../constants/verification';

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
