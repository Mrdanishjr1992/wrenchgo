# Rating Reminder Push Notifications

This edge function sends rating reminder push notifications to eligible users.

## Schedule Setup

To run this function daily, set up a cron job in Supabase:

1. Go to Supabase Dashboard → Database → Extensions
2. Enable `pg_cron` extension
3. Go to SQL Editor and run:

```sql
SELECT cron.schedule(
  'send-rating-reminders',
  '0 10 * * *',  -- 10:00 AM UTC daily
  $$
  SELECT net.http_post(
    url := 'https://komsqqxqirvfgforixxq.supabase.co/functions/v1/send-rating-reminders',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

## Manual Trigger

```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-rating-reminders \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

## Deployment

```bash
supabase functions deploy send-rating-reminders
```
