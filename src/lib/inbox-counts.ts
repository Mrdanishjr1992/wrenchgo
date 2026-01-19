import { supabase } from './supabase';

export async function getUnreadMessagesCount(): Promise<number> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return 0;

  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .neq('sender_id', userId)
    .is('read_at', null);

  if (error) {
    console.error('Error fetching unread messages count:', error);
    return 0;
  }

  return count ?? 0;
}

export async function getUnreadNotificationsCount(): Promise<number> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('Error fetching unread notifications count:', error);
    return 0;
  }

  return count ?? 0;
}

export function subscribeToUnreadCounts(
  userId: string,
  onMessagesChange: (count: number) => void,
  onNotificationsChange: (count: number) => void
) {
  const messagesChannel = supabase
    .channel('inbox-messages-count')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'messages',
      },
      () => {
        getUnreadMessagesCount().then(onMessagesChange);
      }
    )
    .subscribe();

  const notificationsChannel = supabase
    .channel('inbox-notifications-count')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        getUnreadNotificationsCount().then(onNotificationsChange);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(messagesChannel);
    supabase.removeChannel(notificationsChannel);
  };
}
