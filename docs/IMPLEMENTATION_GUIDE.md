# WrenchGo Platform Protection - Implementation Guide

## Overview
This guide provides technical implementation details for the WrenchGo platform protection system, including database setup, API integration, and testing procedures.

---

## Database Setup

### 1. Apply Migrations

Run the migrations in order:

```bash
supabase migration up
```

Or apply specific migrations:

```bash
psql -h your-db-host -U postgres -d your-db -f supabase/migrations/0047_chat_moderation_system.sql
psql -h your-db-host -U postgres -d your-db -f supabase/migrations/0048_chat_moderation_rpcs.sql
```

### 2. Verify Tables Created

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'message_audit_logs',
  'user_violations', 
  'chat_restrictions',
  'preferred_mechanics',
  'chat_lifecycle_config'
);

-- Check functions exist
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN (
  'detect_contact_info',
  'calculate_message_risk',
  'scan_message_before_send',
  'record_violation',
  'get_chat_status'
);
```

### 3. Seed Chat Lifecycle Configuration

```sql
-- Insert default chat lifecycle rules
INSERT INTO public.chat_lifecycle_config (job_stage, chat_state, allow_contact_info, strictness_level, post_completion_hours, description) VALUES
  ('pending', 'open', false, 8, NULL, 'Pre-booking: High strictness, no contact info'),
  ('accepted', 'open', false, 6, NULL, 'Job accepted: Medium-high strictness'),
  ('in_progress', 'open', true, 3, NULL, 'Active job: Low strictness, emergency contact allowed'),
  ('completed', 'open', true, 2, 48, 'Post-completion: 48hr active window, low strictness'),
  ('completed_readonly', 'read_only', false, 10, NULL, 'After 48hr: Read-only, no new messages'),
  ('cancelled', 'closed', false, 10, NULL, 'Cancelled jobs: Chat closed'),
  ('disputed', 'restricted', false, 9, NULL, 'Disputed jobs: Restricted communication');
```

---

## API Integration

### TypeScript Client Setup

```typescript
import { 
  scanMessageBeforeSend, 
  getChatStatus,
  logMessageAudit,
  recordViolation 
} from '@/lib/chat-moderation';

// Before sending a message
const scanResult = await scanMessageBeforeSend({
  conversation_id: conversationId,
  sender_id: userId,
  message_text: messageText,
  job_id: jobId,
});

// Handle the result
switch (scanResult.action) {
  case 'blocked':
    // Show error, don't send message
    Alert.alert('Message Blocked', scanResult.message);
    break;
    
  case 'masked':
    // Send masked version
    await sendMessage(scanResult.masked_text);
    break;
    
  case 'warned':
    // Show warning but send original
    showWarning(scanResult.warning_message);
    await sendMessage(messageText);
    break;
    
  case 'allowed':
    // Send normally
    await sendMessage(messageText);
    break;
}

// Log the audit trail
await logMessageAudit(
  conversationId,
  userId,
  messageText,
  scanResult,
  scanResult.action,
  scanResult.masked_text
);
```

### Check Chat Status

```typescript
// Check if user can send messages
const chatStatus = await getChatStatus(conversationId, userId, jobId);

if (!chatStatus.can_send) {
  // Show restriction banner
  showRestrictionBanner({
    state: chatStatus.chat_state,
    message: chatStatus.message,
    buttons: chatStatus.button_actions,
  });
}
```

### Record Violations

```typescript
// When a violation occurs
const result = await recordViolation({
  user_id: userId,
  violation_type: 'contact_info_sharing',
  message_audit_id: auditLogId,
  details: { patterns: detectedPatterns },
});

if (result.restriction) {
  // User has been restricted
  showRestrictionNotice(result.restriction);
}
```

---

## Testing

### 1. Test Contact Info Detection

```sql
-- Test phone number detection
SELECT detect_contact_info('Call me at 555-123-4567');
SELECT detect_contact_info('My number is five five five 1234');

-- Test email detection
SELECT detect_contact_info('Email me at john@example.com');
SELECT detect_contact_info('Contact: john [at] example [dot] com');

-- Test social media
SELECT detect_contact_info('Find me on Instagram @mechanic_mike');
SELECT detect_contact_info('Add me on WhatsApp');

-- Test legitimate patterns (should have low risk)
SELECT detect_contact_info('VIN: 1HGBH41JXMN109186');
SELECT detect_contact_info('Part number: 555-1234-ABC');
```

### 2. Test Risk Calculation

```sql
-- Test with different user contexts
SELECT calculate_message_risk(
  'Call me at 555-1234',
  'user-id-here',
  'job-id-here',
  'pending',  -- High strictness stage
  5,          -- Account age in days
  0           -- Completed jobs
);

-- Should have lower risk for established users
SELECT calculate_message_risk(
  'Call me at 555-1234',
  'user-id-here',
  'job-id-here',
  'in_progress',  -- Low strictness stage
  365,            -- Account age in days
  50              -- Completed jobs
);
```

### 3. Test Message Scanning

```sql
-- Test the full scan flow
SELECT scan_message_before_send(
  'conv-123',
  'user-id',
  'Text me at 555-1234',
  'job-id'
);

-- Test with legitimate content
SELECT scan_message_before_send(
  'conv-123',
  'user-id',
  'The VIN is 1HGBH41JXMN109186 and I need part 555-ABC',
  'job-id'
);
```

### 4. Test Progressive Enforcement

```sql
-- Simulate multiple violations
DO $$
DECLARE
  v_user_id uuid := 'test-user-id';
BEGIN
  -- First violation (education)
  PERFORM record_violation(v_user_id, 'contact_info_sharing', NULL, NULL);
  
  -- Second violation (warning)
  PERFORM record_violation(v_user_id, 'contact_info_sharing', NULL, NULL);
  
  -- Third violation (restriction)
  PERFORM record_violation(v_user_id, 'contact_info_sharing', NULL, NULL);
  
  -- Check restriction was applied
  RAISE NOTICE 'Restrictions: %', (
    SELECT json_agg(restriction_type) 
    FROM chat_restrictions 
    WHERE user_id = v_user_id
  );
END $$;
```

### 5. Test Chat Lifecycle

```sql
-- Test chat status for different job stages
SELECT get_chat_status('conv-123', 'user-id', 'job-id-pending');
SELECT get_chat_status('conv-123', 'user-id', 'job-id-in-progress');
SELECT get_chat_status('conv-123', 'user-id', 'job-id-completed');
```

---

## UI Component Integration

### ChatRoom Component

The `ChatRoom` component has been updated with:

1. **Message Scanning**: All messages are scanned before sending
2. **Status Banner**: Shows chat restrictions and state
3. **Warning Display**: Shows moderation warnings inline
4. **Policy Modal**: Explains why platform protection matters

### Key Features

```typescript
// Automatic scanning before send
const scanResult = await scanMessageBeforeSend({...});

// Display warnings
{moderationWarning && (
  <ChatModerationWarning
    action={moderationWarning.action}
    message={moderationWarning.warning_message}
    onLearnMore={() => setShowPolicyModal(true)}
  />
)}

// Display restrictions
{chatStatus && chatStatus.chat_state !== 'open' && (
  <ChatStatusBanner
    chatState={chatStatus.chat_state}
    restrictionType={chatStatus.restriction_type}
    message={chatStatus.message}
  />
)}
```

---

## Monitoring & Analytics

### Key Metrics to Track

```sql
-- Violation rate by user
SELECT 
  user_id,
  COUNT(*) as violation_count,
  MAX(severity) as highest_severity,
  MAX(created_at) as last_violation
FROM user_violations
GROUP BY user_id
ORDER BY violation_count DESC;

-- Message action distribution
SELECT 
  action_taken,
  COUNT(*) as count,
  AVG(risk_score) as avg_risk_score
FROM message_audit_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY action_taken;

-- False positive rate (messages with legitimate patterns but high risk)
SELECT 
  COUNT(*) as potential_false_positives
FROM message_audit_logs
WHERE 
  action_taken IN ('blocked', 'masked')
  AND legitimate_patterns IS NOT NULL
  AND array_length(legitimate_patterns, 1) > 0;

-- Active restrictions
SELECT 
  restriction_type,
  COUNT(*) as active_count,
  AVG(EXTRACT(EPOCH FROM (expires_at - NOW()))/3600) as avg_hours_remaining
FROM chat_restrictions
WHERE expires_at IS NULL OR expires_at > NOW()
GROUP BY restriction_type;
```

### Audit Log Queries

```sql
-- Recent blocked messages
SELECT 
  sender_id,
  message_text,
  detected_patterns,
  risk_score,
  created_at
FROM message_audit_logs
WHERE action_taken = 'blocked'
ORDER BY created_at DESC
LIMIT 50;

-- User violation history
SELECT 
  v.user_id,
  v.violation_type,
  v.severity,
  v.created_at,
  m.message_text,
  m.detected_patterns
FROM user_violations v
LEFT JOIN message_audit_logs m ON v.message_audit_id = m.id
WHERE v.user_id = 'specific-user-id'
ORDER BY v.created_at DESC;
```

---

## Admin Tools

### Manual Review Queue

```sql
-- Messages flagged for review
SELECT 
  id,
  sender_id,
  message_text,
  detected_patterns,
  risk_score,
  created_at
FROM message_audit_logs
WHERE 
  action_taken = 'blocked'
  AND risk_score > 7
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY risk_score DESC;
```

### Whitelist Management

```sql
-- Add user to whitelist (reduce strictness)
UPDATE profiles
SET moderation_whitelist = true
WHERE id = 'user-id';

-- Add pattern to legitimate patterns
-- (Modify detect_contact_info function to include new patterns)
```

### Manual Restriction Management

```sql
-- Apply manual restriction
INSERT INTO chat_restrictions (user_id, restriction_type, reason, applied_by, expires_at)
VALUES (
  'user-id',
  'suspended',
  'Manual review: repeated policy violations',
  'admin-user-id',
  NOW() + INTERVAL '7 days'
);

-- Remove restriction
DELETE FROM chat_restrictions
WHERE user_id = 'user-id' AND restriction_type = 'suspended';
```

---

## Performance Optimization

### Indexes

The migrations include these indexes:

```sql
-- Message audit logs
CREATE INDEX idx_message_audit_conversation ON message_audit_logs(conversation_id);
CREATE INDEX idx_message_audit_sender ON message_audit_logs(sender_id);
CREATE INDEX idx_message_audit_action ON message_audit_logs(action_taken);

-- User violations
CREATE INDEX idx_violations_user ON user_violations(user_id);
CREATE INDEX idx_violations_severity ON user_violations(severity);

-- Chat restrictions
CREATE INDEX idx_restrictions_user ON chat_restrictions(user_id);
CREATE INDEX idx_restrictions_expires ON chat_restrictions(expires_at);
```

### Caching Recommendations

```typescript
// Cache chat status for active conversations
const chatStatusCache = new Map<string, ChatStatusResponse>();

async function getCachedChatStatus(conversationId: string, userId: string) {
  const cacheKey = `${conversationId}-${userId}`;
  
  if (chatStatusCache.has(cacheKey)) {
    return chatStatusCache.get(cacheKey);
  }
  
  const status = await getChatStatus(conversationId, userId);
  chatStatusCache.set(cacheKey, status);
  
  // Expire cache after 5 minutes
  setTimeout(() => chatStatusCache.delete(cacheKey), 5 * 60 * 1000);
  
  return status;
}
```

---

## Troubleshooting

### Common Issues

**Issue**: Messages are being blocked incorrectly

**Solution**: 
1. Check the `legitimate_patterns` in audit logs
2. Review the `check_legitimate_patterns` function
3. Add new patterns to the whitelist
4. Adjust strictness levels in `chat_lifecycle_config`

**Issue**: Users not receiving restrictions after violations

**Solution**:
1. Verify `record_violation` function is being called
2. Check `user_violations` table for entries
3. Verify `chat_restrictions` table for active restrictions
4. Check `get_user_violation_count` function logic

**Issue**: Chat status not updating correctly

**Solution**:
1. Verify job status is being updated correctly
2. Check `chat_lifecycle_config` has correct rules
3. Verify `get_chat_status` function logic
4. Clear any cached chat status

---

## Security Considerations

### Rate Limiting

Implement rate limiting on message sending:

```typescript
const messageRateLimit = new Map<string, number[]>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userMessages = messageRateLimit.get(userId) || [];
  
  // Remove messages older than 1 minute
  const recentMessages = userMessages.filter(t => now - t < 60000);
  
  // Allow max 20 messages per minute
  if (recentMessages.length >= 20) {
    return false;
  }
  
  recentMessages.push(now);
  messageRateLimit.set(userId, recentMessages);
  return true;
}
```

### Data Privacy

- Message audit logs contain sensitive data
- Implement data retention policies (e.g., delete after 90 days)
- Restrict access to audit logs to admin users only
- Anonymize data for analytics

```sql
-- Cleanup old audit logs
DELETE FROM message_audit_logs
WHERE created_at < NOW() - INTERVAL '90 days';

-- Anonymize for analytics
CREATE VIEW message_analytics AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  action_taken,
  risk_score,
  job_stage,
  account_age_days,
  completed_jobs
FROM message_audit_logs;
```

---

## Next Steps

1. **Apply migrations** to your database
2. **Seed chat lifecycle config** with default rules
3. **Test detection functions** with sample messages
4. **Integrate UI components** into your chat interface
5. **Set up monitoring** for violations and false positives
6. **Train support team** on manual review process
7. **Communicate policy** to users via in-app announcements

---

## Support

For technical questions or issues:
- **GitHub Issues**: [your-repo]/issues
- **Email**: dev@wrenchgo.com
- **Slack**: #platform-protection

**Last Updated**: January 2025
