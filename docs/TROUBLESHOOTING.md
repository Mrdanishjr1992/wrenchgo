# 🔧 Troubleshooting Guide - Connection Issues

## 🔍 Quick Diagnostics

### **1. Check Supabase Status**
```bash
npx supabase status
```

**Expected Output**:
```
supabase local development setup is running.
Project URL: http://127.0.0.1:54321
```

If not running:
```bash
npx supabase start
```

---

### **2. Verify Environment Variables**

**Check `.env` file**:
```bash
cat .env | Select-String "EXPO_PUBLIC_SUPABASE"
```

**Expected Output**:
```
EXPO_PUBLIC_SUPABASE_URL=http://10.0.2.2:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Important**: 
- Android Emulator: Use `10.0.2.2`
- iOS Simulator: Use `127.0.0.1`
- Physical Device: Use your computer's local IP (e.g., `192.168.1.x`)

---

### **3. Test Supabase Connection**

**From Host Machine**:
```bash
curl "http://127.0.0.1:54321/rest/v1/symptoms?select=key,label&limit=3"
```

**Expected**: JSON response with symptoms

**From Android Emulator** (using adb):
```bash
adb shell curl "http://10.0.2.2:54321/rest/v1/symptoms?select=key,label&limit=3"
```

**Expected**: JSON response with symptoms

---

## 🐛 Common Issues & Fixes

### **Issue 1: "Network request failed"**

**Cause**: App can't reach Supabase

**Solutions**:

1. **Restart Expo Server** (most common fix):
   ```bash
   # Stop the server (Ctrl+C in Expo terminal)
   npx expo start --clear
   ```

2. **Verify Supabase is Running**:
   ```bash
   npx supabase status
   ```
   If stopped, start it:
   ```bash
   npx supabase start
   ```

3. **Check Firewall**:
   - Windows Firewall might be blocking port 54321
   - Allow Docker Desktop through firewall
   - Allow Node.js through firewall

4. **Restart Docker Desktop**:
   - Sometimes Docker networking gets stuck
   - Restart Docker Desktop
   - Run `npx supabase start` again

---

### **Issue 2: "Invalid API key"**

**Cause**: Wrong anon key in `.env`

**Solution**:
```bash
# Get the correct key from Supabase
npx supabase status
```

Copy the "anon key" and update `.env`:
```env
EXPO_PUBLIC_SUPABASE_ANON_KEY=<paste_key_here>
```

Restart Expo:
```bash
npx expo start --clear
```

---

### **Issue 3: App loads but no data shows**

**Cause**: Database is empty or RLS policies blocking access

**Solutions**:

1. **Verify Data Exists**:
   ```bash
   npx supabase db query "SELECT COUNT(*) FROM symptoms;"
   ```
   **Expected**: 17

2. **Reset Database** (if count is 0):
   ```bash
   npx supabase db reset
   ```

3. **Check RLS Policies**:
   ```bash
   npx supabase db query "SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';"
   ```

---

### **Issue 4: Environment variables not updating**

**Cause**: Expo caches environment variables

**Solutions**:

1. **Clear Expo Cache**:
   ```bash
   npx expo start --clear
   ```

2. **Restart Metro Bundler**:
   - Press `Ctrl+C` to stop
   - Run `npx expo start --clear` again

3. **Reload App**:
   - In Android emulator, press `r` in Expo terminal
   - Or shake device and tap "Reload"

4. **Nuclear Option** (if nothing else works):
   ```bash
   # Stop everything
   npx expo stop
   npx supabase stop
   
   # Clear all caches
   rm -rf node_modules/.cache
   rm -rf .expo
   
   # Restart everything
   npx supabase start
   npx expo start --clear
   ```

---

### **Issue 5: "Connection refused" or "ECONNREFUSED"**

**Cause**: Port 54321 is not accessible

**Solutions**:

1. **Check if Supabase is listening**:
   ```bash
   netstat -an | Select-String "54321"
   ```
   **Expected**: Shows LISTENING on port 54321

2. **Check Docker Containers**:
   ```bash
   docker ps | Select-String "supabase"
   ```
   **Expected**: Shows running containers

3. **Restart Supabase**:
   ```bash
   npx supabase stop
   npx supabase start
   ```

---

## 🔄 Full Reset Procedure

If nothing else works, do a complete reset:

### **Step 1: Stop Everything**
```bash
# Stop Expo
# Press Ctrl+C in Expo terminal

# Stop Supabase
npx supabase stop
```

### **Step 2: Verify .env File**
```bash
cat .env
```

Ensure it has:
```env
EXPO_PUBLIC_SUPABASE_URL=http://10.0.2.2:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
```

### **Step 3: Start Supabase**
```bash
npx supabase start
```

Wait for it to fully start (shows the dashboard URLs).

### **Step 4: Verify Database**
```bash
npx supabase db query "SELECT COUNT(*) FROM symptoms;"
```

**Expected**: 17

If 0, reset database:
```bash
npx supabase db reset
```

### **Step 5: Start Expo**
```bash
npx expo start --clear
```

### **Step 6: Reload App**
- Press `r` in Expo terminal
- Or shake device and tap "Reload"

---

## 📱 Device-Specific Issues

### **Android Emulator**

**Issue**: Can't reach `10.0.2.2`

**Solutions**:
1. Verify emulator is running: `adb devices`
2. Test connection: `adb shell ping 10.0.2.2`
3. Try alternative: `adb reverse tcp:54321 tcp:54321`
   - Then use `http://localhost:54321` in `.env`

### **iOS Simulator**

**Issue**: Can't reach `127.0.0.1`

**Solutions**:
1. Use `127.0.0.1` (not `10.0.2.2`)
2. Update `.env`:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   ```
3. Restart Expo: `npx expo start --clear`

### **Physical Device**

**Issue**: Can't reach local Supabase

**Solutions**:
1. Get your computer's local IP:
   ```bash
   ipconfig | Select-String "IPv4"
   ```
   Example: `192.168.1.100`

2. Update `.env`:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=http://192.168.1.100:54321
   ```

3. Ensure device and computer are on same WiFi network

4. Restart Expo: `npx expo start --clear`

---

## 🎯 Quick Checklist

Before asking for help, verify:

- [ ] Supabase is running (`npx supabase status`)
- [ ] Database has data (`SELECT COUNT(*) FROM symptoms;` returns 17)
- [ ] `.env` has correct URL (`http://10.0.2.2:54321` for Android)
- [ ] `.env` has correct anon key
- [ ] Expo server restarted with `--clear` flag
- [ ] App reloaded in emulator (press `r`)
- [ ] No firewall blocking port 54321
- [ ] Docker Desktop is running

---

## 🆘 Still Not Working?

If you've tried everything above and it's still not working, provide:

1. **Error Message**: Exact error from app console
2. **Supabase Status**: Output of `npx supabase status`
3. **Environment Variables**: Output of `cat .env | Select-String "EXPO_PUBLIC"`
4. **Device Type**: Android emulator, iOS simulator, or physical device
5. **Network Test**: Output of `curl "http://127.0.0.1:54321/rest/v1/symptoms?select=key&limit=1"`

---

## 💡 Pro Tips

1. **Always use `--clear` flag** when restarting Expo after changing `.env`
2. **Check Expo logs** for environment variable values (they're printed on startup)
3. **Use Supabase Studio** to verify data: `http://127.0.0.1:54323`
4. **Test API directly** before blaming the app
5. **Keep Docker Desktop running** - Supabase needs it

---

## ✅ Success Indicators

You'll know it's working when you see:

**In Expo Logs**:
```
✅ Connected to Supabase
✅ Symptoms loaded: 17
✅ Education cards loaded: 7
✅ Symptom education loaded: 17
```

**In App**:
- Explore tab shows symptoms with icons
- Education tab shows guides
- No error messages
- Data loads quickly

---

**Last Updated**: 2025-02-02
**Version**: 1.0
