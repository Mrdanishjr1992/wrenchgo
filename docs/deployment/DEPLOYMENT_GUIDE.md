# 🚀 Photo ID Verification - Deployment Steps

## ✅ Code Changes Complete
All code has been implemented and errors have been fixed. Now follow these steps to deploy to production.

---

## Step 1: Deploy Database Migrations

### Option A: Using Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your WrenchGo project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run the Migration**
   - Open the file: `supabase/migrations/DEPLOY_ALL_ID_VERIFICATION.sql`
   - Copy the entire contents
   - Paste into the SQL Editor
   - Click "Run" (or press Ctrl+Enter)

4. **Verify Success**
   - You should see "Success. No rows returned"
   - Check for any error messages

### Option B: Using Supabase CLI (If linked to remote)

```bash
# Link to your remote project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# Push migrations
supabase db push
```

---

## Step 2: Verify Storage Bucket Creation

1. **Go to Storage in Dashboard**
   - Click "Storage" in the left sidebar
   - You should see a bucket named `identity-docs`

2. **Check Bucket Settings**
   - Click on `identity-docs` bucket
   - Verify it's marked as "Private" (not public)
   - Check that RLS is enabled

3. **View Policies**
   - Click "Policies" tab
   - You should see 5 policies:
     - ✅ Users can upload own ID documents
     - ✅ Users can read own ID documents
     - ✅ Users can update own ID documents
     - ✅ Users can delete own ID documents
     - ✅ Admins can read all ID documents

---

## Step 3: Verify Database Changes

1. **Check Profiles Table**
   - Go to "Table Editor" > "profiles"
   - Scroll right to see new columns:
     - `id_photo_path`
     - `id_status` (default: 'none')
     - `id_uploaded_at`
     - `id_verified_at`
     - `id_rejected_reason`
     - `id_verified_by`

2. **Check RLS Policies**
   - Go to "Authentication" > "Policies"
   - Find the `jobs` table
   - You should see: "Verified users can create jobs"
   - Find the `quotes` table
   - You should see: "Verified mechanics can accept quotes"

3. **Test the Verification Function**
   - Go to SQL Editor
   - Run this query:
   ```sql
   SELECT is_user_id_verified(auth.uid());
   ```
   - Should return `false` (since you haven't uploaded ID yet)

---

## Step 4: Test Customer Flow

### 4.1 Build and Run the App

```bash
# For development
npx expo start

# For production build (EAS)
eas build --platform android --profile preview
# or
eas build --platform ios --profile preview
```

### 4.2 Test as Customer

1. **Sign in as a customer**
   - Use an existing customer account or create a new one

2. **Try to request a service**
   - Go to "Request Service"
   - Fill out the form
   - Try to submit
   - ✅ **Expected**: You should see an alert:
     - "ID Verification Required"
     - "You need to verify your photo ID before requesting a mechanic..."
     - Two buttons: "Verify Now" and "Cancel"

3. **Upload ID**
   - Tap "Verify Now"
   - You should be taken to the Photo ID screen
   - Tap "Upload Photo ID"
   - Choose "Take Photo" or "Choose from Library"
   - Select/take a photo
   - ✅ **Expected**: 
     - Loading indicator appears
     - Success message: "ID uploaded successfully! We'll review it shortly."
     - Status changes to "Pending Review" (yellow badge)

4. **Verify in Database**
   - Go to Supabase Dashboard > Table Editor > profiles
   - Find your user
   - Check that:
     - `id_status` = 'pending'
     - `id_uploaded_at` has a timestamp
     - `id_photo_path` has a value like `{userId}/photo-id.jpg`

5. **Verify in Storage**
   - Go to Storage > identity-docs
   - You should see a folder with your user ID
   - Inside, there should be a `photo-id.jpg` file

---

## Step 5: Test Admin Verification

### 5.1 View the Uploaded ID

1. **Get the signed URL**
   - Go to SQL Editor
   - Run this query (replace `USER_ID` with the actual user ID):
   ```sql
   SELECT 
     id,
     full_name,
     id_photo_path,
     storage.create_signed_url('identity-docs', id_photo_path, 3600) as signed_url
   FROM profiles
   WHERE id = 'USER_ID';
   ```

2. **Open the URL**
   - Copy the `signed_url` from the results
   - Paste it in your browser
   - ✅ **Expected**: You should see the uploaded ID photo

### 5.2 Approve the ID

1. **Update the profile**
   - Go to Table Editor > profiles
   - Find the user
   - Edit the row:
     - Set `id_status` to `verified`
     - Set `id_verified_at` to current timestamp (or use `NOW()`)
     - Set `id_verified_by` to your admin user ID (optional)
   - Save

2. **Or use SQL**
   ```sql
   UPDATE profiles
   SET 
     id_status = 'verified',
     id_verified_at = NOW(),
     id_verified_by = 'YOUR_ADMIN_USER_ID'
   WHERE id = 'USER_ID';
   ```

### 5.3 Test Service Request Again

1. **Go back to the app**
   - Try to request a service again
   - Fill out the form
   - Submit
   - ✅ **Expected**: 
     - No blocking alert
     - Service request is created successfully
     - You proceed to the "Searching for mechanics" screen

---

## Step 6: Test Mechanic Flow

### 6.1 Test as Mechanic

1. **Sign in as a mechanic**
   - Use an existing mechanic account or create a new one

2. **Try to send a quote**
   - Go to a job/lead
   - Fill out the quote form
   - Try to submit
   - ✅ **Expected**: You should see an alert:
     - "ID Verification Required"
     - "You need to verify your photo ID before sending quotes..."
     - Two buttons: "Verify Now" and "Cancel"

3. **Upload ID**
   - Tap "Verify Now"
   - Upload a photo ID (same process as customer)
   - ✅ **Expected**: Status changes to "Pending Review"

4. **Admin approves**
   - Follow Step 5.2 to approve the mechanic's ID

5. **Send quote again**
   - Try to send a quote
   - ✅ **Expected**: 
     - No blocking alert
     - Quote is sent successfully

---

## Step 7: Test Rejection Flow

### 7.1 Reject an ID

1. **Update the profile**
   - Go to Table Editor > profiles
   - Find a user with `id_status = 'pending'`
   - Edit the row:
     - Set `id_status` to `rejected`
     - Set `id_rejected_reason` to something like:
       - "ID photo is blurry. Please upload a clearer image."
       - "ID is expired. Please upload a current ID."
       - "Unable to verify. Please ensure all corners of ID are visible."
   - Save

2. **Or use SQL**
   ```sql
   UPDATE profiles
   SET 
     id_status = 'rejected',
     id_rejected_reason = 'ID photo is blurry. Please upload a clearer image.',
     id_verified_at = NULL
   WHERE id = 'USER_ID';
   ```

### 7.2 Test Re-upload

1. **Go back to the app**
   - Navigate to the Photo ID screen
   - ✅ **Expected**:
     - Status shows "Rejected" (red badge)
     - Rejection reason is displayed
     - "Upload Photo ID" button is still available

2. **Upload a new ID**
   - Tap "Upload Photo ID"
   - Select a new photo
   - ✅ **Expected**:
     - Status changes back to "Pending Review"
     - Rejection reason is cleared
     - Old ID is replaced with new one

---

## Step 8: Test Backend Enforcement (RLS)

### 8.1 Test Direct API Bypass Attempt

1. **Try to create a job without verification**
   - Use a REST client (Postman, Insomnia, etc.)
   - Or use SQL Editor:
   ```sql
   -- This should FAIL if user is not verified
   INSERT INTO jobs (customer_id, vehicle_id, symptom, status)
   VALUES (
     'UNVERIFIED_USER_ID',
     'VEHICLE_ID',
     'wont_start',
     'searching'
   );
   ```
   - ✅ **Expected**: Error message about RLS policy violation

2. **Try to update a quote without verification**
   ```sql
   -- This should FAIL if mechanic is not verified
   UPDATE quotes
   SET status = 'pending'
   WHERE mechanic_id = 'UNVERIFIED_MECHANIC_ID';
   ```
   - ✅ **Expected**: Error message about RLS policy violation

---

## Step 9: Monitor and Maintain

### 9.1 Find Pending Verifications

```sql
SELECT 
  id,
  full_name,
  role,
  id_uploaded_at,
  AGE(NOW(), id_uploaded_at) as pending_duration
FROM profiles
WHERE id_status = 'pending'
ORDER BY id_uploaded_at ASC;
```

### 9.2 Verification Statistics

```sql
SELECT 
  id_status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM profiles
GROUP BY id_status;
```

### 9.3 Average Verification Time

```sql
SELECT 
  AVG(EXTRACT(EPOCH FROM (id_verified_at - id_uploaded_at)) / 3600) as avg_hours
FROM profiles
WHERE id_status = 'verified'
AND id_uploaded_at IS NOT NULL
AND id_verified_at IS NOT NULL;
```

---

## 🎯 Deployment Checklist

- [ ] Run migration SQL in Supabase Dashboard
- [ ] Verify `identity-docs` storage bucket exists and is private
- [ ] Verify 5 storage RLS policies are active
- [ ] Verify `profiles` table has 6 new columns
- [ ] Verify `is_user_id_verified()` function exists
- [ ] Verify 2 new RLS policies on `jobs` and `quotes` tables
- [ ] Test customer upload flow
- [ ] Test admin verification workflow
- [ ] Test customer can request service after verification
- [ ] Test mechanic upload flow
- [ ] Test mechanic can send quote after verification
- [ ] Test rejection and re-upload flow
- [ ] Test backend RLS enforcement
- [ ] Set up monitoring for pending verifications

---

## 🐛 Troubleshooting

### "Bucket already exists" error
- This is fine - it means the bucket was already created
- The `ON CONFLICT DO NOTHING` clause handles this

### "Policy already exists" error
- This is fine - policies use `IF NOT EXISTS`
- You can safely re-run the migration

### Storage upload fails
- Check that RLS is enabled on `storage.objects`
- Verify the user is authenticated
- Check browser console for detailed error

### RLS policies not working
- Verify the `is_user_id_verified()` function exists
- Check that policies are enabled on the tables
- Test the function directly: `SELECT is_user_id_verified(auth.uid());`

### Image not displaying
- Signed URLs expire after 1 hour
- Generate a new signed URL if needed
- Check that `id_photo_path` is correct in the database

---

## ✅ Success Criteria

You'll know the deployment is successful when:

1. ✅ All migrations run without errors
2. ✅ Storage bucket and policies are visible in dashboard
3. ✅ Customers are blocked from requesting services until verified
4. ✅ Mechanics are blocked from sending quotes until verified
5. ✅ Users can upload ID photos successfully
6. ✅ Admins can view and verify uploaded IDs
7. ✅ After verification, users can perform their actions
8. ✅ Rejection flow works and users can re-upload
9. ✅ Backend RLS prevents bypassing verification checks

---

## 🎉 Next Steps After Deployment

1. **Monitor pending verifications daily**
   - Set up a reminder to check for pending IDs
   - Aim for < 24 hour turnaround time

2. **Collect user feedback**
   - Ask users about the verification experience
   - Identify any pain points or confusion

3. **Plan admin dashboard**
   - Build a dedicated admin panel for easier verification
   - Add bulk approval tools
   - Create verification history/audit log

4. **Consider automation**
   - Research OCR/AI verification services
   - Implement fraud detection
   - Add automated checks for common issues

5. **Update user communications**
   - Add email notifications for verification status
   - Create help articles about the process
   - Add FAQs to the app

---

**Deployment Guide Complete! 🚀**

Follow these steps carefully and check off each item as you complete it.
