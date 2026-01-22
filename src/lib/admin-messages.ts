import { supabase } from './supabase';

export interface AdminMessage {
  id: string;
  sender_admin_id: string;
  sender_name: string;
  sender_type: 'admin' | 'user';
  body: string;
  related_job_id: string | null;
  related_job_title: string | null;
  related_support_request_id: string | null;
  related_dispute_id: string | null;
  attachment_url: string | null;
  attachment_type: 'image' | 'file' | null;
  read_at: string | null;
  created_at: string;
  thread_id: string | null;
}

export interface AdminMessageRow {
  id: string;
  sender_admin_id: string;
  recipient_id: string;
  body: string;
  related_job_id: string | null;
  related_support_request_id: string | null;
  related_dispute_id: string | null;
  attachment_url: string | null;
  attachment_type: 'image' | 'file' | null;
  read_at: string | null;
  created_at: string;
  thread_id: string | null;
}

export interface SendAdminMessageParams {
  recipientId: string;
  body: string;
  relatedJobId?: string;
  supportRequestId?: string;
  disputeId?: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'file';
}

export interface ThreadMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_type: 'admin' | 'user';
  body: string;
  related_job_id: string | null;
  related_job_title: string | null;
  attachment_url: string | null;
  attachment_type: 'image' | 'file' | null;
  read_at: string | null;
  created_at: string;
}

export interface SupportThread {
  thread_id: string;
  subject: string;
  last_message_body: string;
  last_message_at: string;
  last_message_sender_type: 'admin' | 'user';
  unread_count: number;
  total_messages: number;
  related_job_id: string | null;
  related_job_title: string | null;
  created_at: string;
}

export async function listMyAdminMessages(
  limit: number = 50,
  offset: number = 0
): Promise<AdminMessage[]> {
  const { data, error } = await supabase.rpc('list_my_admin_messages', {
    p_limit: limit,
    p_offset: offset,
  });
  
  if (error) throw error;
  return data || [];
}

export async function markAdminMessageRead(messageId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('mark_admin_message_read', {
    p_message_id: messageId,
  });
  
  if (error) throw error;
  return data;
}

export async function getUnreadAdminMessageCount(): Promise<number> {
  const { data, error } = await supabase.rpc('get_unread_admin_message_count');

  if (error) throw error;
  return data || 0;
}

export async function getSupportThread(
  threadId: string,
  limit: number = 100
): Promise<ThreadMessage[]> {
  const { data, error } = await supabase.rpc('get_support_thread', {
    p_thread_id: threadId,
    p_limit: limit,
  });

  if (error) throw error;
  return data || [];
}

export async function userReplyToSupport(params: {
  body: string;
  threadId?: string;
  relatedJobId?: string;
  relatedSupportRequestId?: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'file';
}): Promise<AdminMessageRow> {
  const { data, error } = await supabase.rpc('user_reply_to_support', {
    p_body: params.body,
    p_thread_id: params.threadId || null,
    p_related_job_id: params.relatedJobId || null,
    p_related_support_request_id: params.relatedSupportRequestId || null,
    p_attachment_url: params.attachmentUrl || null,
    p_attachment_type: params.attachmentType || null,
  });

  if (error) throw error;
  return data;
}

export async function getOrCreateSupportThread(): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_support_thread');

  if (error) throw error;
  return data;
}

export async function adminSendMessage(params: SendAdminMessageParams): Promise<AdminMessageRow> {
  const { data, error } = await supabase.rpc('admin_send_message', {
    p_recipient_id: params.recipientId,
    p_body: params.body,
    p_related_job_id: params.relatedJobId || null,
    p_support_request_id: params.supportRequestId || null,
    p_dispute_id: params.disputeId || null,
    p_attachment_url: params.attachmentUrl || null,
    p_attachment_type: params.attachmentType || null,
  });
  
  if (error) throw error;
  return data;
}

export async function adminListUserMessages(
  userId: string,
  limit: number = 100
): Promise<AdminMessage[]> {
  const { data, error } = await supabase.rpc('admin_list_user_messages', {
    p_user_id: userId,
    p_limit: limit,
  });

  if (error) throw error;
  return data || [];
}

export async function listMySupportThreads(
  limit: number = 50,
  offset: number = 0
): Promise<SupportThread[]> {
  const { data, error } = await supabase.rpc('list_my_support_threads', {
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw error;
  return data || [];
}

export async function getUnreadSupportThreadCount(): Promise<number> {
  const { data, error } = await supabase.rpc('get_unread_support_thread_count');

  if (error) throw error;
  return data || 0;
}

export async function markSupportThreadRead(threadId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('mark_support_thread_read', {
    p_thread_id: threadId,
  });

  if (error) throw error;
  return data;
}