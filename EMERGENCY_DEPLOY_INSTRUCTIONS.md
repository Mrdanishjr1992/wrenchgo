y# EMERGENCY: Deploy Delete Account Function

## Your Current Issues:
1. ❌ Disk is full - preventing Docker/Gradle from working
2. ❌ Cannot deploy via CLI
3. ✅ Edge Function code is fixed and ready

## SOLUTION: Deploy via Supabase Dashboard

### Step 1: Go to Supabase Dashboard
https://supabase.com/dashboard/project/kkpkpybqbtmcvriqrmrt/functions

### Step 2: Find or Create the Function
- If `delete-account` exists, click on it
- If not, click **New Function** and name it `delete-account`

### Step 3: Copy the Code
Open `supabase/functions/delete-account/index.ts` in VS Code and copy ALL contents (296 lines)

### Step 4: Paste and Deploy
1. Paste the code into the dashboard editor
2. Click **Deploy** button
3. Wait for deployment to complete

### Step 5: Test
Try deleting an account from your app. The error should be gone.

---

## After Deployment: Fix Your Disk Space

Your disk is full. Clean up:

```powershell
# Clean npm cache
npm cache clean --force

# Clean node_modules (you can reinstall later)
Remove-Item -Recurse -Force node_modules

# Clean Gradle cache
cd android
./gradlew clean
cd ..

# Clean Docker (if installed)
docker system prune -a --volumes
```

## DO NOT Reset Database
Your database is fine. The migration error is because you're trying to reset, which will delete all data.
