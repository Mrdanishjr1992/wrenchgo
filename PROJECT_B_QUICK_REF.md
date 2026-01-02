ch ctely # 🔗 PROJECT B INTEGRATION - QUICK REFERENCE

## 🚀 QUICK START (5 MINUTES)

### 1. Get Credentials
```bash
# From Project B Dashboard → Settings → API
PROJECT_B_URL=https://xxxxx.supabase.co
PROJECT_B_SERVICE_ROLE_KEY=eyJhbGc...
```

### 2. Configure Local
```bash
# Create supabase/.env.local
echo "PROJECT_B_URL=https://your-project-b.supabase.co" > supabase/.env.local
echo "PROJECT_B_SERVICE_ROLE_KEY=your-key" >> supabase/.env.local
```

### 3. Test Local
```bash
supabase start
supabase functions serve project-b-proxy --env-file supabase/.env.local
```

### 4. Deploy Production
```bash
supabase secrets set PROJECT_B_URL=https://your-project-b.supabase.co
supabase secrets set PROJECT_B_SERVICE_ROLE_KEY=your-key
supabase functions deploy project-b-proxy
```

---

## 📝 USAGE IN APP

```typescript
import { callProjectB } from '@/utils/projectBClient'

// Fetch data
const { data, error } = await callProjectB({
  action: 'select',
  table: 'users',
  query: { select: 'id, email', limit: 10 }
})

// Insert data
await callProjectB({
  action: 'insert',
  table: 'logs',
  query: { data: { event: 'test' } }
})

// Call RPC
await callProjectB({
  action: 'rpc',
  table: '',
  query: { function: 'my_function', params: {} }
})
```

---

## 🔍 TROUBLESHOOTING

| Issue | Solution |
|-------|----------|
| "Credentials not configured" | Check `supabase/.env.local` or `supabase secrets list` |
| CORS error | Already configured in Edge Function |
| Unauthorized | Verify service role key is correct |
| Timeout | Check Project B URL and network access |

---

## ✅ VERIFICATION

```bash
# Local
curl -X POST http://localhost:54321/functions/v1/project-b-proxy \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"select","table":"users","query":{"limit":1}}'

# Production
supabase secrets list  # Should show PROJECT_B_URL and PROJECT_B_SERVICE_ROLE_KEY
```

---

## 🔐 SECURITY CHECKLIST

- [ ] Service role key NOT in client code
- [ ] `.env.local` in `.gitignore` ✅
- [ ] Secrets set in production
- [ ] Edge Function validates inputs

---

## 📚 FILES CREATED

- `supabase/functions/project-b-proxy/index.ts` - Edge Function
- `supabase/.env.local` - Local secrets (gitignored)
- `supabase/.env.local.template` - Template for team
- `utils/projectBClient.ts` - TypeScript client
- `app/examples/ProjectBExample.tsx` - Usage example
- `PROJECT_B_INTEGRATION_GUIDE.md` - Full guide

---

**See `PROJECT_B_INTEGRATION_GUIDE.md` for detailed instructions**
