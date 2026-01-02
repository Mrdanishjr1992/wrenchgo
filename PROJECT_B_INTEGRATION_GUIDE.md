somple# 🔗 PROJECT B INTEGRATION - SETUP & VERIFICATION GUIDE

## 📋 OVERVIEW

This guide walks you through linking Project A (WrenchGo) to Project B (external Supabase project) using Edge Functions for secure, maintainable cross-project access.

**Architecture:** Client → Edge Function (Project A) → Project B (via service role)

---

## 🎯 PREREQUISITES

- [ ] Access to both Project A and Project B Supabase dashboards
- [ ] Supabase CLI installed (`supabase --version`)
- [ ] Project A linked locally (`supabase link`)

---

## 📝 STEP 1: GET PROJECT B CREDENTIALS

### 1.1 Get Project B URL and Service Role Key

1. Go to **Project B Dashboard** → Settings → API
2. Copy the following:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Service Role Key**: `eyJhbGc...` (starts with eyJ)

⚠️ **SECURITY WARNING**: Service role key has FULL database access. Never expose to client!

---

## 🔧 STEP 2: CONFIGURE LOCAL ENVIRONMENT

### 2.1 Create Local Environment File

```bash
# Copy template
cp supabase/.env.local.template supabase/.env.local

# Edit supabase/.env.local with your actual values
```

### 2.2 Fill in Your Credentials

Edit `supabase/.env.local`:

```bash
PROJECT_B_URL=https://your-actual-project-b.supabase.co
PROJECT_B_SERVICE_ROLE_KEY=eyJhbGc...your-actual-service-role-key
```

### 2.3 Verify .gitignore

Ensure `supabase/.env.local` is NOT committed:

```bash
# Should show .env*.local in .gitignore
cat .gitignore | grep "env"
```

✅ Already configured in your `.gitignore` (line 43)

---

## 🧪 STEP 3: TEST LOCALLY

### 3.1 Start Local Supabase

```bash
supabase start
```

**Expected output:**
```
Started supabase local development setup.
API URL: http://localhost:54321
...
```

### 3.2 Deploy Edge Function Locally

```bash
supabase functions serve project-b-proxy --env-file supabase/.env.local
```

**Expected output:**
```
Serving functions on http://localhost:54321/functions/v1/
  - project-b-proxy
```

### 3.3 Test Edge Function with curl

Open a new terminal and test:

```bash
# Test SELECT
curl -X POST http://localhost:54321/functions/v1/project-b-proxy \
  -H "Authorization: Bearer YOUR_LOCAL_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "select",
    "table": "users",
    "query": {
      "select": "id, email",
      "limit": 5
    }
  }'
```

**Expected response:**
```json
{
  "data": [
    {"id": "...", "email": "..."},
    ...
  ]
}
```

### 3.4 Test from Your App

1. Start your Expo app: `npm start`
2. Navigate to the example screen: `app/examples/ProjectBExample.tsx`
3. Click "Fetch Users from Project B"
4. Verify data loads without errors

---

## 🚀 STEP 4: DEPLOY TO PRODUCTION

### 4.1 Set Production Secrets

```bash
# Set Project B URL
supabase secrets set PROJECT_B_URL=https://your-project-b.supabase.co

# Set Project B Service Role Key
supabase secrets set PROJECT_B_SERVICE_ROLE_KEY=eyJhbGc...your-key
```

**Alternative:** Set via Dashboard:
1. Go to **Project A Dashboard** → Edge Functions → Secrets
2. Add both secrets manually

### 4.2 Deploy Edge Function

```bash
supabase functions deploy project-b-proxy
```

**Expected output:**
```
Deploying function project-b-proxy...
Function deployed successfully!
URL: https://xxxxx.supabase.co/functions/v1/project-b-proxy
```

### 4.3 Verify Secrets Are Set

```bash
supabase secrets list
```

**Expected output:**
```
PROJECT_B_URL
PROJECT_B_SERVICE_ROLE_KEY
```

---

## ✅ STEP 5: VERIFICATION CHECKLIST

### Local Environment

- [ ] `supabase/.env.local` exists with correct credentials
- [ ] `supabase/.env.local` is in `.gitignore`
- [ ] `supabase start` runs without errors
- [ ] `supabase functions serve project-b-proxy` runs without errors
- [ ] curl test returns data from Project B
- [ ] App can fetch data from Project B locally

### Production Environment

- [ ] Secrets set in Supabase Dashboard (or via CLI)
- [ ] Edge Function deployed successfully
- [ ] Production app can fetch data from Project B
- [ ] No service role keys exposed in client code
- [ ] No errors in Edge Function logs

### Security Checklist

- [ ] Service role key NEVER in client code
- [ ] Service role key NEVER in git history
- [ ] `.env.local` in `.gitignore`
- [ ] Edge Function validates requests appropriately
- [ ] Rate limiting considered (if needed)

---

## 🔍 TROUBLESHOOTING

### Issue: "Project B credentials not configured"

**Solution:**
- Local: Check `supabase/.env.local` exists and has correct values
- Production: Run `supabase secrets list` to verify secrets are set

### Issue: "CORS error"

**Solution:**
- Edge Function already has CORS headers configured
- Ensure you're calling from allowed origin

### Issue: "Unauthorized" or "Invalid JWT"

**Solution:**
- Verify you're passing the correct anon key in Authorization header
- Check Project B service role key is correct

### Issue: Edge Function times out

**Solution:**
- Check Project B is accessible from your network
- Verify Project B URL is correct
- Check Project B database is not overloaded

### Issue: "supabase start" fails

**Solution:**
- Ensure Docker is running
- Run `supabase stop` then `supabase start`
- Check ports 54321, 54322, etc. are not in use

---

## 📊 MONITORING & LOGGING

### View Edge Function Logs (Local)

```bash
# Logs appear in terminal where you ran:
supabase functions serve project-b-proxy
```

### View Edge Function Logs (Production)

1. Go to **Project A Dashboard** → Edge Functions → project-b-proxy
2. Click "Logs" tab
3. Monitor for errors or performance issues

### Add Custom Logging

Edit `supabase/functions/project-b-proxy/index.ts`:

```typescript
console.log('Request:', { action, table, query })
console.log('Response:', { data: result.data })
```

---

## 🎯 USAGE EXAMPLES

### Example 1: Fetch Data

```typescript
import { callProjectB } from '@/utils/projectBClient'

const { data, error } = await callProjectB({
  action: 'select',
  table: 'users',
  query: {
    select: 'id, email, created_at',
    match: { status: 'active' },
    limit: 10
  }
})
```

### Example 2: Insert Data

```typescript
const { data, error } = await callProjectB({
  action: 'insert',
  table: 'logs',
  query: {
    data: {
      event: 'user_action',
      timestamp: new Date().toISOString()
    }
  }
})
```

### Example 3: Call RPC

```typescript
const { data, error } = await callProjectB({
  action: 'rpc',
  table: '',
  query: {
    function: 'get_statistics',
    params: { year: 2025 }
  }
})
```

---

## 🔐 SECURITY BEST PRACTICES

1. **Never expose service role key to client**
   - ✅ Use Edge Functions as proxy
   - ❌ Never put in app code or environment variables accessible to client

2. **Implement rate limiting**
   - Consider adding rate limiting to Edge Function
   - Use Supabase's built-in rate limiting features

3. **Validate inputs**
   - Add input validation in Edge Function
   - Sanitize table names and query parameters

4. **Audit logging**
   - Log all Project B access for security audits
   - Monitor for unusual patterns

5. **Least privilege**
   - Consider creating a dedicated role in Project B with limited permissions
   - Use that role instead of service role if possible

---

## 🚦 SUCCESS CRITERIA

After completing this guide, you should have:

✅ Secure connection between Project A and Project B
✅ Edge Function deployed and working locally and in production
✅ No service role keys exposed to client
✅ App can read/write to Project B as needed
✅ All credentials properly secured
✅ Monitoring and logging in place

---

## 📚 ADDITIONAL RESOURCES

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Supabase Secrets Management](https://supabase.com/docs/guides/functions/secrets)
- [Cross-Project Access Patterns](https://supabase.com/docs/guides/platform/multi-tenancy)

---

## 🆘 NEED HELP?

If you encounter issues:

1. Check the troubleshooting section above
2. Review Edge Function logs
3. Verify all credentials are correct
4. Test with curl before testing in app
5. Check Supabase status page for outages

---

**Last Updated:** 2025-01-27
**Version:** 1.0
