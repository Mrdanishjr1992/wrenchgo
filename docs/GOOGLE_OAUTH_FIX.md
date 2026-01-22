# 🔐 Google OAuth Configuration Update

## ⚠️ CRITICAL: SHA-1 Fingerprint Changed

Your app's SHA-1 fingerprint has changed. You **MUST** update your Google Cloud Console OAuth configuration.

### **Current Correct Values**
```
Package Name: com.wrenchgo
SHA-1: 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
```

---

## 🔧 Update Google Cloud Console

### **Step 1: Go to Google Cloud Console**
1. Visit: https://console.cloud.google.com/
2. Select your project: **WrenchGo**

### **Step 2: Navigate to OAuth Credentials**
1. Click **APIs & Services** → **Credentials**
2. Find your OAuth 2.0 Client ID (Android)
3. Click **Edit** (pencil icon)

### **Step 3: Update SHA-1 Fingerprint**
1. In the **SHA-1 certificate fingerprints** section
2. **Remove** the old fingerprint:
   ```
   FC:08:8F:05:C7:64:C8:71:18:F8:E6:20:9F:5E:08:BC:1B:9C:D9:64
   ```
3. **Add** the new fingerprint:
   ```
   5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
   ```
4. Verify **Package name** is: `com.wrenchgo`
5. Click **Save**

### **Step 4: Wait for Propagation**
- Changes can take **5-10 minutes** to propagate
- Google needs to update their OAuth servers

### **Step 5: Test Google Sign-In**
1. Restart your app
2. Try Google Sign-In
3. Should work without "error throwing" issue

---

## 🎯 Quick Verification

After updating Google Cloud Console, verify:

```bash
# Check your current SHA-1
cd android && ./gradlew signingReport
```

**Expected Output**:
```
Variant: debug
Config: debug
Store: C:\Users\<username>\.android\debug.keystore
Alias: androiddebugkey
SHA1: 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
```

---

## 📋 Complete OAuth Configuration Checklist

In Google Cloud Console, you should have **TWO** OAuth clients:

### **1. Web Client (for Expo)**
- **Type**: Web application
- **Name**: WrenchGo Web Client
- **Authorized JavaScript origins**: (leave empty)
- **Authorized redirect URIs**: (leave empty)
- **Client ID**: `455158957304-uis2hapnk672ledqh18tlgp5vdcflf4q.apps.googleusercontent.com`

### **2. Android Client**
- **Type**: Android
- **Name**: WrenchGo Android
- **Package name**: `com.wrenchgo`
- **SHA-1**: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`

---

## 🐛 Why This Matters

The "error throwing" issue you're seeing is likely caused by:

1. **Google OAuth rejection**: Your app's SHA-1 doesn't match what's registered in Google Cloud Console
2. **Google returns an error** when you try to sign in
3. **App throws a generic error** because the OAuth flow failed

**Fix**: Update the SHA-1 in Google Cloud Console to match your current debug keystore.

---

## 🔄 If You Regenerated Your Keystore

If you regenerated your debug keystore (or it was recreated), you need to:

1. **Get the new SHA-1**:
   ```bash
   cd android && ./gradlew signingReport
   ```

2. **Update Google Cloud Console** with the new SHA-1

3. **Update `.env`** with the new SHA-1 (for reference)

4. **Wait 5-10 minutes** for Google to propagate changes

5. **Restart app** and test

---

## ✅ Success Indicators

After updating, you should see:

**In App**:
- Google Sign-In button works
- No "error throwing" message
- Successful authentication

**In Logs**:
- No OAuth errors
- Successful token exchange
- User profile loaded

---

## 🆘 Still Not Working?

If Google Sign-In still fails after updating:

1. **Wait 10 minutes** - Google needs time to propagate
2. **Clear app data** - Old OAuth tokens might be cached
3. **Rebuild app**: `npx expo run:android`
4. **Check Google Cloud Console** - Verify SHA-1 is saved correctly
5. **Verify package name** - Must be exactly `com.wrenchgo`

---

**Last Updated**: 2025-02-02
**Version**: 1.0
