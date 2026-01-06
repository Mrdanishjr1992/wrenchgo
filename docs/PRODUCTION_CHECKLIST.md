# WrenchGo Production Deployment Checklist

## Pre-Deployment

### Stripe Configuration

#### Dashboard Settings
- [ ] Enable Stripe Connect in Dashboard → Settings → Connect
- [ ] Set Connect platform settings:
  - [ ] Platform name: WrenchGo
  - [ ] Support email: support@wrenchgo.com
  - [ ] Platform website: https://wrenchgo.com
- [ ] Configure Connect branding (logo, colors)
- [ ] Set payout schedule: Manual (we control via weekly batch)
- [ ] Enable required payment methods (card, Apple Pay, Google Pay)
- [ ] Configure statement descriptor: "WRENCHGO*"

#### API Keys
- [ ] Generate live API keys (sk_live_..., pk_live_...)
- [ ] Store in Supabase secrets (never commit to repo):
  ```bash
  supabase secrets set STRIPE_SECRET_KEY=sk_live_...
  supabase secrets set STRIPE_PUBLISHABLE_KEY=pk_live_...
  ```
- [ ] Update mobile app environment variables:
  ```
  EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
  ```

#### Webhook Configuration
- [ ] Create webhook endpoint in Stripe Dashboard
  - URL: `https://your-project.supabase.co/functions/v1/stripe-webhook`
  - Events to listen for:
    - `payment_intent.succeeded`
    - `payment_intent.payment_failed`
    - `payment_intent.canceled`
    - `payment_intent.requires_action`
    - `account.updated`
    - `charge.refunded`
    - `charge.dispute.created`
    - `charge.dispute.closed`
    - `transfer.created`
    - `transfer.failed`
    - `payout.paid`
    - `payout.failed`
- [ ] Copy webhook signing secret
- [ ] Store in Supabase secrets:
  ```bash
  supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
  ```
- [ ] Test webhook delivery (send test event from Dashboard)

#### Connect Settings
- [ ] Review Connect terms of service
- [ ] Configure Connect account requirements:
  - [ ] Require business type
  - [ ] Require tax ID (if applicable)
  - [ ] Enable identity verification
- [ ] Set up Connect onboarding redirect URLs:
  - Return URL: `wrenchgo://onboarding-complete`
  - Refresh URL: `wrenchgo://onboarding-refresh`

---

### Supabase Configuration

#### Database
- [ ] Run all migrations in production:
  ```bash
  supabase db push
  ```
- [ ] Verify RLS policies enabled on all tables
- [ ] Create database backups schedule (daily recommended)
- [ ] Set up point-in-time recovery (PITR)

#### Edge Functions
- [ ] Deploy all Edge Functions:
  ```bash
  supabase functions deploy create-stripe-connect-account-link
  supabase functions deploy lock-invoice
  supabase functions deploy create-payment-intent
  supabase functions deploy stripe-webhook
  supabase functions deploy run-weekly-payouts
  ```
- [ ] Verify function logs are accessible
- [ ] Set function timeout to 60s (for webhook processing)

#### Secrets Management
- [ ] Set all required secrets:
  ```bash
  supabase secrets set STRIPE_SECRET_KEY=sk_live_...
  supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
  supabase secrets set CRON_SECRET=$(openssl rand -hex 32)
  ```
- [ ] Verify secrets are not exposed in logs
- [ ] Document secret rotation procedure

#### Realtime
- [ ] Enable Realtime for `payments` table
- [ ] Configure Realtime authorization (RLS applies)
- [ ] Test Realtime connection limits (default: 200 concurrent)

---

### Mobile App Configuration

#### Environment Variables
- [ ] Create production `.env` file:
  ```
  EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
  EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
  ```
- [ ] Verify no test keys in production build
- [ ] Configure deep link scheme: `wrenchgo://`

#### Stripe SDK
- [ ] Update `@stripe/stripe-react-native` to latest stable version
- [ ] Configure StripeProvider with live publishable key
- [ ] Test PaymentSheet in production mode
- [ ] Verify Apple Pay and Google Pay merchant IDs

#### App Store / Play Store
- [ ] Add required permissions in app.json:
  - iOS: `NSCameraUsageDescription` (for ID verification)
  - Android: `CAMERA` permission
- [ ] Configure deep link handling in app.json
- [ ] Test deep links on physical devices
- [ ] Submit app for review with payment flow screenshots

---

## Security Hardening

### API Security
- [ ] Verify all Edge Functions require authentication
- [ ] Implement rate limiting on payment endpoints:
  ```sql
  -- Example: max 5 payment attempts per job
  CREATE POLICY payment_rate_limit ON payments
  FOR INSERT WITH CHECK (
    (SELECT COUNT(*) FROM payments WHERE job_id = NEW.job_id) < 5
  );
  ```
- [ ] Add request logging for audit trail
- [ ] Implement IP allowlisting for webhook endpoint (Stripe IPs)

### Data Protection
- [ ] Encrypt sensitive fields (if storing card details - NOT RECOMMENDED)
- [ ] Implement PII data retention policy
- [ ] Configure automatic data deletion for old records
- [ ] Enable Supabase audit logs

### Fraud Prevention
- [ ] Enable Stripe Radar (automatic fraud detection)
- [ ] Set up 3D Secure for high-value transactions
- [ ] Implement velocity checks (max transactions per user per day)
- [ ] Monitor for suspicious patterns (same card, multiple accounts)

---

## Monitoring & Observability

### Logging
- [ ] Configure structured logging in Edge Functions:
  ```typescript
  console.log(JSON.stringify({
    level: 'info',
    event: 'payment_created',
    job_id: jobId,
    amount_cents: amount,
    timestamp: new Date().toISOString(),
  }))
  ```
- [ ] Set up log aggregation (Supabase Logs or external service)
- [ ] Create log retention policy (30 days minimum)

### Alerts
- [ ] Set up alerts for:
  - Payment failure rate > 10%
  - Webhook processing errors
  - Failed transfers
  - Database connection errors
  - Edge Function timeouts
- [ ] Configure alert channels (email, Slack, PagerDuty)
- [ ] Test alert delivery

### Dashboards
- [ ] Create monitoring dashboard with:
  - Total payments processed (daily/weekly/monthly)
  - Payment success rate
  - Average payment amount
  - Pending transfers
  - Failed webhooks
- [ ] Set up Stripe Dashboard access for support team

### Health Checks
- [ ] Implement health check endpoint:
  ```typescript
  // supabase/functions/health/index.ts
  serve(() => {
    return new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
  })
  ```
- [ ] Monitor Edge Function uptime (target: 99.9%)
- [ ] Set up database connection pool monitoring

---

## Operational Procedures

### Weekly Payout Execution
- [ ] Set up cron job to run every Monday at 9 AM UTC:
  ```bash
  # Using GitHub Actions, Supabase Cron, or external scheduler
  curl -X POST https://your-project.supabase.co/functions/v1/run-weekly-payouts \
    -H "Authorization: Bearer $CRON_SECRET"
  ```
- [ ] Create runbook for manual payout execution
- [ ] Document payout failure recovery procedure

### Incident Response
- [ ] Create incident response playbook:
  1. Payment failures: Check Stripe Dashboard → Retry if transient
  2. Webhook failures: Replay from Stripe Dashboard
  3. Transfer failures: Check mechanic account status → Retry
  4. Database issues: Check Supabase status page → Failover if needed
- [ ] Define on-call rotation
- [ ] Set up incident communication channels

### Refund Process
- [ ] Document refund approval workflow
- [ ] Create refund execution procedure:
  1. Verify refund eligibility
  2. Issue refund via Stripe Dashboard
  3. Webhook automatically updates database
  4. Notify customer and mechanic
- [ ] Handle partial refunds (if needed)

### Dispute Handling
- [ ] Document dispute response procedure:
  1. Receive dispute notification
  2. Gather evidence (job details, photos, signatures)
  3. Submit evidence via Stripe Dashboard
  4. Update job status based on outcome
- [ ] Set up dispute alert notifications
- [ ] Train support team on dispute process

---

## Testing in Production

### Smoke Tests (Post-Deployment)
- [ ] Create test mechanic account
- [ ] Complete Connect onboarding
- [ ] Create test job and complete payment flow
- [ ] Verify webhook processing
- [ ] Verify Realtime updates
- [ ] Test refund flow
- [ ] Delete test data

### Canary Deployment
- [ ] Deploy to 10% of users first
- [ ] Monitor error rates for 24 hours
- [ ] Gradually increase to 50%, then 100%
- [ ] Keep rollback plan ready

---

## Compliance & Legal

### PCI Compliance
- [ ] Verify no card data stored in database (Stripe handles all card data)
- [ ] Use Stripe Elements/PaymentSheet (PCI-compliant by default)
- [ ] Complete PCI self-assessment questionnaire (SAQ A)
- [ ] Display PCI compliance badge in app

### Terms of Service
- [ ] Update ToS to include:
  - Payment processing terms
  - Refund policy
  - Dispute resolution process
  - Weekly payout schedule
  - Platform fee disclosure (15%)
- [ ] Require users to accept updated ToS

### Privacy Policy
- [ ] Disclose data sharing with Stripe
- [ ] Document data retention policy
- [ ] Provide data export mechanism (GDPR)
- [ ] Implement data deletion on account closure

### Tax Compliance
- [ ] Issue 1099-K forms to mechanics (if required)
- [ ] Collect W-9 forms from US mechanics
- [ ] Implement tax reporting via Stripe Tax (optional)

---

## Performance Optimization

### Database Optimization
- [ ] Add indexes on frequently queried columns (already in schema)
- [ ] Enable query performance insights
- [ ] Set up connection pooling (Supabase default: 15 connections)
- [ ] Monitor slow queries (target: <100ms)

### Edge Function Optimization
- [ ] Minimize cold start time (keep functions warm)
- [ ] Implement caching for frequently accessed data
- [ ] Use connection pooling for database queries
- [ ] Optimize webhook processing (batch updates if possible)

### Mobile App Optimization
- [ ] Implement payment result caching
- [ ] Prefetch invoice data before payment screen
- [ ] Optimize Realtime subscription (unsubscribe on unmount)
- [ ] Implement retry logic with exponential backoff

---

## Rollback Plan

### Edge Function Rollback
```bash
# Revert to previous version
supabase functions deploy stripe-webhook --version <previous-version>
```

### Database Rollback
```bash
# Revert migration
supabase db reset --version <previous-migration>
```

### Mobile App Rollback
- [ ] Keep previous app version available in stores
- [ ] Implement feature flags for payment flow
- [ ] Test backward compatibility with old app versions

---

## Post-Launch Monitoring (First 30 Days)

### Week 1
- [ ] Monitor payment success rate daily
- [ ] Review all webhook errors
- [ ] Check for any RLS policy violations
- [ ] Verify first weekly payout executes successfully

### Week 2-4
- [ ] Analyze payment patterns (peak times, average amounts)
- [ ] Review customer support tickets related to payments
- [ ] Optimize based on real-world usage
- [ ] Conduct security audit

### Ongoing
- [ ] Monthly review of payment metrics
- [ ] Quarterly security audit
- [ ] Annual PCI compliance review
- [ ] Continuous monitoring of Stripe API changes

---

## Success Metrics

### Key Performance Indicators (KPIs)
- Payment success rate: >95%
- Webhook processing time: <2 seconds
- Weekly payout success rate: >99%
- Customer payment completion rate: >80%
- Dispute rate: <1%

### Business Metrics
- Total payment volume (GMV)
- Platform fee revenue
- Average transaction value
- Mechanic retention rate
- Customer satisfaction score

---

## Emergency Contacts

- Stripe Support: https://support.stripe.com
- Supabase Support: https://supabase.com/support
- On-call Engineer: [Your contact]
- Payment Operations Lead: [Your contact]
- Legal/Compliance: [Your contact]
