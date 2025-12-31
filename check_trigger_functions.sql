-- Get the definition of check_user_not_deleted function
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'check_user_not_deleted';

-- Also check check_email_not_blocked
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'check_email_not_blocked';
