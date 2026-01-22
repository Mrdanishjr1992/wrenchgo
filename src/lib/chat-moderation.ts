import { supabase } from './supabase';
import logger from './logger';
import type {
  ScanMessageRequest,
  ScanMessageResponse,
  ChatStatusResponse,
  MessageAuditLog,
  RecordViolationRequest,
  UserViolation,
  ViolationHistory,
  PreferredMechanic,
  UpdatePreferredMechanicRequest,
  ChatRestriction,
} from '../types/chat-moderation';

export async function scanMessageBeforeSend(
  messageText: string,
  recipientId: string,
  jobId?: string
): Promise<ScanMessageResponse> {
  const { data, error } = await supabase.rpc('scan_message_before_send', {
    p_message_text: messageText,
    p_recipient_id: recipientId,
    p_job_id: jobId ?? null,
  });

  if (error) {
    logger.error('Message scan failed', { recipientId, jobId });
    return {
      allowed: true,
      action: 'allowed',
      risk_score: 0,
      message: 'Message scan failed, allowing by default',
    };
  }

  return data as ScanMessageResponse;
}

export async function logMessageAudit(
  messageId: string,
  conversationId: string,
  recipientId: string,
  originalContent: string,
  displayedContent: string,
  action: string,
  riskResult: any,
  jobId?: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc('log_message_audit', {
    p_message_id: messageId,
    p_conversation_id: conversationId,
    p_recipient_id: recipientId,
    p_original_content: originalContent,
    p_displayed_content: displayedContent,
    p_action: action,
    p_risk_result: riskResult,
    p_job_id: jobId ?? null,
  });

  if (error) {
    console.error('Error logging message audit:', error);
    return null;
  }

  return data as string;
}

export async function recordViolation(
  request: RecordViolationRequest
): Promise<{ success: boolean; tier?: string; restriction?: ChatRestriction }> {
  const { data, error } = await supabase.rpc('record_violation', {
    p_user_id: request.user_id,
    p_violation_type: request.violation_type,
    p_message_audit_id: request.message_audit_id ?? null,
    p_details: request.details ?? null,
  });

  if (error) {
    console.error('Error recording violation:', error);
    return { success: false };
  }

  return data as { success: boolean; tier?: string; restriction?: ChatRestriction };
}

export async function getUserViolationHistory(userId: string): Promise<ViolationHistory | null> {
  const { data, error } = await supabase.rpc('get_user_violation_count', {
    p_user_id: userId,
  });

  if (error) {
    console.error('Error getting violation history:', error);
    return null;
  }

  return data as ViolationHistory;
}

export async function getChatStatus(
  conversationId: string,
  jobId: string
): Promise<ChatStatusResponse> {
  const { data, error } = await supabase.rpc('get_chat_status', {
    p_conversation_id: conversationId,
    p_job_id: jobId,
  });

  if (error) {
    console.error('Error getting chat status:', error);
    return {
      can_send: true,
      chat_state: 'open',
      message: 'Unable to determine chat status, allowing by default',
    };
  }

  return data as ChatStatusResponse;
}

export async function updatePreferredMechanic(
  request: UpdatePreferredMechanicRequest
): Promise<{ success: boolean; commission_tier?: number }> {
  const { data, error } = await supabase.rpc('update_preferred_mechanic', {
    p_customer_id: request.customer_id,
    p_mechanic_id: request.mechanic_id,
    p_job_value: request.job_value,
  });

  if (error) {
    console.error('Error updating preferred mechanic:', error);
    return { success: false };
  }

  return data as { success: boolean; commission_tier?: number };
}

export async function getPreferredMechanics(customerId: string): Promise<PreferredMechanic[]> {
  const { data, error } = await supabase.rpc('get_preferred_mechanics', {
    p_customer_id: customerId,
  });

  if (error) {
    console.error('Error getting preferred mechanics:', error);
    return [];
  }

  return (data ?? []) as PreferredMechanic[];
}

export async function getMessageAuditLogs(
  conversationId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<MessageAuditLog[]> {
  const { limit = 50, offset = 0 } = options;

  const { data, error } = await supabase
    .from('message_audit_logs')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error getting message audit logs:', error);
    return [];
  }

  return (data ?? []) as MessageAuditLog[];
}

export async function getUserViolations(
  userId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<UserViolation[]> {
  const { limit = 20, offset = 0 } = options;

  const { data, error } = await supabase
    .from('user_violations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error getting user violations:', error);
    return [];
  }

  return (data ?? []) as UserViolation[];
}

export async function getActiveChatRestrictions(userId: string): Promise<ChatRestriction[]> {
  const { data, error } = await supabase
    .from('chat_restrictions')
    .select('*')
    .eq('user_id', userId)
    .or('expires_at.is.null,expires_at.gt.now()')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error getting chat restrictions:', error);
    return [];
  }

  return (data ?? []) as ChatRestriction[];
}
