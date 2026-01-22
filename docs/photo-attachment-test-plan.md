# Photo Attachment Feature - Manual Test Plan

## Overview
This document outlines the manual testing procedures for the newly added photo attachment features across the WrenchGo application.

---

## 1. Customer Job Request Photos (`request-service.tsx`)

### Test Case 1.1: Add Photos to New Job Request
**Steps:**
1. Login as a customer
2. Navigate to "Request Service"
3. Complete the service request form
4. In the "Attach Photos" section, tap "Camera"
5. Take a photo of the vehicle/issue
6. Verify the thumbnail appears
7. Tap "Library" and select multiple photos
8. Verify all thumbnails appear (max 5)
9. Submit the job request

**Expected:**
- Photos are uploaded to `job-media` bucket
- `create_job_media_record` RPC is called for each photo
- Photos appear in `job_media` table with category `customer_request`

### Test Case 1.2: Remove Photo Before Submission
**Steps:**
1. Add 3 photos to a job request
2. Tap the X button on the middle photo
3. Verify it's removed
4. Add 2 more photos (should allow since now at 4)

**Expected:**
- Photo is removed from the list
- Can add more photos up to the max (5)

---

## 2. Mechanic Before/After Photos (`JobActions.tsx`)

### Test Case 2.1: Before Photos Required for Starting Work
**Steps:**
1. Login as a mechanic
2. Navigate to an accepted job
3. Try to click "Start Work" without photos
4. Add at least one "before" photo
5. Click "Start Work"

**Expected:**
- "Start Work" button is disabled until at least one before photo is uploaded
- Photos are uploaded with category `mechanic_before`

### Test Case 2.2: After Photos Required for Completion
**Steps:**
1. As a mechanic on an in-progress job
2. Try to click "Mark Complete" without photos
3. Add at least one "after" photo
4. Click "Mark Complete"

**Expected:**
- "Mark Complete" button is disabled until at least one after photo is uploaded
- Photos are uploaded with category `mechanic_after`

---

## 3. Support Request Photos (`contact-support.tsx`)

### Test Case 3.1: Customer Multi-Photo Support Request
**Steps:**
1. Login as a customer
2. Navigate to Contact Support
3. Select a category and enter a message
4. Tap "Camera" to take a photo
5. Tap "Library" to add more photos (up to 5 total)
6. Remove one photo by tapping the X
7. Submit the request

**Expected:**
- All photos are uploaded to `support-screenshots` bucket
- URLs are stored in `metadata.screenshot_urls` array
- First URL is also stored in `screenshot_url` field for backward compatibility

### Test Case 3.2: Mechanic Multi-Photo Support Request
**Steps:**
1. Login as a mechanic
2. Navigate to Contact Support
3. Follow same steps as Test Case 3.1

**Expected:**
- Same behavior as customer support request
- Role is correctly identified as 'mechanic' in metadata

---

## 4. Dispute Evidence Photos (`job/[id].tsx`)

### Test Case 4.1: Customer Files Dispute with Evidence
**Steps:**
1. Login as a customer
2. Navigate to a completed job
3. Tap "Report an Issue"
4. Enter issue description
5. Add evidence photos (up to 5)
6. Enter desired resolution
7. Submit the dispute

**Expected:**
- Photos are uploaded to `job-media` bucket with path `{job_id}/customer/dispute_evidence/{uuid}.jpg`
- `customerFileComeback` RPC receives the evidence URLs
- Dispute record contains the evidence URLs in `evidence_urls` array

### Test Case 4.2: Dispute Without Photos
**Steps:**
1. File a dispute without adding any photos
2. Submit

**Expected:**
- Dispute is created successfully
- `evidence_urls` is empty/null

---

## 5. Admin Evidence Gallery (`AdminEvidenceGallery.tsx`)

### Test Case 5.1: View Dispute Evidence in Admin Panel
**Steps:**
1. Login as admin
2. Navigate to Disputes
3. Select a dispute that has evidence photos

**Expected:**
- Evidence photos display as thumbnails
- Tapping a thumbnail opens full-size preview
- Photo count is accurate

### Test Case 5.2: View Empty Evidence Gallery
**Steps:**
1. Navigate to a dispute without evidence photos

**Expected:**
- Gallery shows "No evidence photos submitted"
- No errors or broken images

---

## 6. Storage Permissions & RLS

### Test Case 6.1: Unauthorized Access Attempt
**Steps:**
1. As User A, upload a photo to their job
2. As User B (different customer), try to access the photo URL directly

**Expected:**
- Access denied or photo not visible
- RLS policies enforce job participant access

### Test Case 6.2: Admin Access to All Media
**Steps:**
1. Login as admin
2. View job details for any job

**Expected:**
- Admin can view all job media
- `admin_get_job_evidence` RPC returns categorized media

---

## 7. Edge Cases

### Test Case 7.1: Network Failure During Upload
**Steps:**
1. Start uploading a photo
2. Disable network mid-upload (or use slow network simulation)

**Expected:**
- Error message displayed
- User can retry
- No partial/corrupt records created

### Test Case 7.2: Maximum File Size
**Steps:**
1. Try to upload an extremely large photo (10MB+)

**Expected:**
- Image is compressed before upload
- Upload succeeds with reasonable file size

### Test Case 7.3: Photo Limit Enforcement
**Steps:**
1. Try to add more than 5 photos in any photo picker

**Expected:**
- Alert displayed: "Limit Reached"
- Cannot add more photos

---

## Database Verification Queries

```sql
-- Check job media records for a specific job
SELECT * FROM job_media WHERE job_id = '<job_id>' ORDER BY created_at;

-- Check dispute evidence
SELECT id, evidence_urls FROM disputes WHERE job_id = '<job_id>';

-- Check support request screenshots
SELECT id, screenshot_url, metadata->'screenshot_urls' as urls 
FROM support_requests WHERE id = '<request_id>';
```

---

## Notes
- All photo uploads use compression (resize to 1200px width, 70% JPEG quality)
- Thumbnails are 80x80px in UI
- Camera and library permissions are requested on first use
- iOS requires Info.plist camera usage description
- Android requires runtime camera/storage permissions
