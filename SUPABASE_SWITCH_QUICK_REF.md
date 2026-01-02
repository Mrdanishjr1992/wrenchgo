# 🔄 SUPABASE ACCOUNT SWITCH - QUICK REFERENCE

## 📋 CURRENT PROJECT INFO
- **Project Ref:** `kkpkpybqbtmcvriqrmrt`
- **URL:** `https://kkpkpybqbtmcvriqrmrt.supabase.co`

---

## ⚡ QUICK SWITCH (10 COMMANDS)

```powershell
# 1. Backup current project (OPTIONAL)
supabase db dump -f "backup_old_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"

# 2. Stop local Supabase
supabase stop

# 3. Unlink old project
supabase unlink

# 4. Logout from old account
supabase logout

# 5. Login to NEW account
supabase login

# 6. Link to NEW project
supabase link --project-ref [NEW-PROJECT-REF]

# 7. Update .env file (MANUAL STEP - see below)

# 8. Deploy migrations to new project
supabase db push

# 9. Deploy Edge Functions (if any)
supabase functions deploy project-b-proxy

# 10. Test
supabase start
npm start
```

---

## 📝 MANUAL STEP: UPDATE .env FILE

Edit `.env` file:

```bash
# OLD (remove these)
EXPO_PUBLIC_SUPABASE_URL=https://kkpkpybqbtmcvriqrmrt.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_vxO0iiikifg7EH-rVaNgMQ_xZgb_uwb

# NEW (add these - get from new project dashboard)
EXPO_PUBLIC_SUPABASE_URL=https://[NEW-PROJECT-REF].supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=[NEW-ANON-KEY]
```

**Get new credentials from:**
New Project Dashboard → Settings → API

---

## ✅ VERIFICATION

```powershell
# Check linked project
supabase status

# Check tables exist
supabase db remote exec "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"

# Test app
npm start
```

---

## 🔄 ROLLBACK (If needed)

```powershell
supabase unlink
supabase logout
supabase login
supabase link --project-ref kkpkpybqbtmcvriqrmrt
# Restore .env file from git
git checkout .env
```

---

## 📚 FULL GUIDE

See `SUPABASE_ACCOUNT_SWITCH_GUIDE.md` for detailed step-by-step instructions.

---

## ⚠️ BEFORE YOU START

- [ ] Have NEW project credentials ready
- [ ] Backup old project (if needed)
- [ ] 30-60 minutes available
- [ ] Understand data will NOT transfer automatically

---

## 🎯 DECISION: DO YOU NEED OLD DATA?

**Fresh Start (No Data):** Follow quick switch above

**Migrate Data:** 
1. Backup: `supabase db dump -f backup.sql`
2. Follow quick switch
3. Restore: `supabase db remote exec < backup.sql`

---

**Current Project:** `kkpkpybqbtmcvriqrmrt`
**Status:** Ready to switch
