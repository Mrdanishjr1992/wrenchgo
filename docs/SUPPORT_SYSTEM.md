# Customer Support System - Phase 1

## Overview
Phase 1 of the customer support system provides users with a comprehensive help and support experience, including FAQs, SLA information, and a contact form for submitting support requests.

## Features Implemented

### 1. Database Schema
- **Table**: `public.support_requests`
  - Stores all support requests with category, message, job_id, screenshot, metadata, and status
  - Includes RLS policies for secure access
  - Indexed for efficient queries

- **Storage Bucket**: `support-screenshots`
  - Stores user-uploaded screenshots (max 5MB)
  - Supports PNG, JPG, JPEG, WebP formats
  - Organized by user ID

### 2. Edge Function
- **Function**: `support-request`
  - Handles support request submissions
  - Sends email notifications via Resend API
  - Includes user metadata (platform, app version, device model, role)

### 3. TypeScript Types
- **File**: `src/types/support.ts`
  - `SupportCategory`: payment, job, safety, bug, account, general
  - `SupportStatus`: open, in_progress, resolved, closed
  - `SupportRequest`: Full request object
  - `SUPPORT_CATEGORIES`: Category definitions with icons and SLAs
  - `SUPPORT_FAQ`: Frequently asked questions

### 4. Client API Functions
- **File**: `src/lib/support.ts`
  - `getDeviceMetadata()`: Collects device and app information
  - `uploadSupportScreenshot()`: Uploads screenshots to storage
  - `submitSupportRequest()`: Submits support requests via Edge Function
  - `getUserSupportRequests()`: Fetches user's support history
  - `getSupportRequestById()`: Fetches specific support request

### 5. UI Components

#### Contact Support Screen
- **Files**: 
  - `app/(mechanic)/contact-support.tsx`
  - `app/(customer)/contact-support.tsx`
- **Features**:
  - Category selection dropdown
  - Multi-line message input
  - Optional screenshot upload
  - Automatic metadata attachment
  - Success state with SLA information
  - Error handling

#### Help & Support Section
- **File**: `src/components/HelpSupportSection.tsx`
- **Features**:
  - FAQ modal with expandable questions
  - SLA modal with response time information
  - Contact Support button
  - Works for both mechanic and customer roles

### 6. Profile Integration
- Added Help & Support section to:
  - Mechanic Profile: `app/(mechanic)/(tabs)/profile.tsx`
  - Customer Account: `app/(customer)/(tabs)/account.tsx`

## Service Level Agreements (SLA)

| Category | Response Time |
|----------|---------------|
| Payment Issues | 12-24 hours |
| Safety Issues | 12-24 hours |
| Job Issues | 24 hours |
| Bug Reports | 48 hours |
| Account Questions | 48 hours |
| General Questions | 48 hours |

## Usage

### For Users
1. Navigate to Profile/Account screen
2. Tap "Help & Support"
3. View FAQs or SLA information
4. Tap "Contact Support" to submit a request
5. Select category, enter message, optionally attach screenshot
6. Submit and receive confirmation with expected response time

### For Developers
```typescript
import { submitSupportRequest, uploadSupportScreenshot } from '@/lib/support';

// Submit a support request
const response = await submitSupportRequest({
  category: 'bug',
  message: 'App crashes when...',
  job_id: 'optional-job-id',
  screenshot_url: 'optional-screenshot-url',
  metadata: { role: 'mechanic' }
});

// Upload a screenshot
const { url, error } = await uploadSupportScreenshot(imageUri, userId);
```

## Email Notifications
Support requests trigger email notifications to `support@wrenchgoapp.com` with:
- User ID and role
- Category and message
- Job ID (if applicable)
- Screenshot link (if provided)
- Device metadata (platform, app version, device model)

## Security
- RLS policies ensure users can only view their own requests
- Only service role can update/delete requests
- Screenshot uploads are scoped to user's folder
- All requests are authenticated via JWT

## Future Enhancements (Phase 2+)
- Admin dashboard for managing support requests
- In-app chat for real-time support
- Push notifications for status updates
- Support request history view
- Automated responses for common issues
- Priority escalation system
- Support agent assignment
- Customer satisfaction ratings

## Testing
To test the support system:
1. Run `npx supabase db reset` to apply migrations
2. Start the app and navigate to Profile/Account
3. Access Help & Support section
4. Submit a test support request
5. Verify email notification (if Resend API key is configured)
6. Check `support_requests` table in Supabase dashboard

## Configuration
Set the following environment variables in Supabase Edge Functions:
- `RESEND_API_KEY`: API key for Resend email service (optional)

## Files Created/Modified

### Created
- `supabase/migrations/0049_support_phase1.sql`
- `supabase/functions/support-request/index.ts`
- `src/types/support.ts`
- `src/lib/support.ts`
- `app/(mechanic)/contact-support.tsx`
- `app/(customer)/contact-support.tsx`
- `src/components/HelpSupportSection.tsx`

### Modified
- `app/(mechanic)/(tabs)/profile.tsx`
- `app/(customer)/(tabs)/account.tsx`
