# WrenchGo Reviews, Ratings, Badges & Profile System

## Overview

Complete implementation of a badge, ratings, reviews, and public profile card system for WrenchGo marketplace app.

## Features Implemented

### 1. **Badge System**
- Verified skills (evidence-backed)
- Earned badges (achievement-based)
- Admin-awarded badges
- Badge types: `verified_skill`, `earned`, `admin`

### 2. **Rating System**
- Multi-category ratings:
  - Overall (1-5 stars)
  - Performance (1-5)
  - Timing (1-5)
  - Cost (1-5)
- Aggregated ratings view (computed from reviews)
- Star distribution (5-star, 4-star, etc.)

### 3. **Review System**
- Written reviews with star ratings
- Tied to completed jobs
- One review per job per reviewer (enforced by DB constraint)
- 24-hour edit window
- Review reporting/flagging system
- Admin moderation (hide reviews)

### 4. **Profile Card UI**
- Profile photo with verified badge overlay
- Name, role, city/service area
- Aggregated ratings + review count
- Badges display (scrollable chips)
- Skills list with verification markers
- Bio section
- Service radius for mechanics

### 5. **Skills System**
- Master skills catalog (31 pre-seeded skills)
- Mechanic skill claims with levels: beginner, intermediate, advanced, expert
- Skill verification by admins
- Years of experience tracking

## Database Schema

### Tables Created

#### `profiles` (enhanced)
```sql
- display_name TEXT
- city TEXT
- service_area TEXT
- bio TEXT
- radius_miles INTEGER
- is_available BOOLEAN
- profile_complete BOOLEAN
- required_fields_missing JSONB
```

#### `skills`
```sql
- id UUID PRIMARY KEY
- name TEXT UNIQUE
- category TEXT (brakes, electrical, diagnostics, etc.)
- description TEXT
```

#### `mechanic_skills`
```sql
- id UUID PRIMARY KEY
- mechanic_id UUID → profiles(id)
- skill_id UUID → skills(id)
- level TEXT (beginner|intermediate|advanced|expert)
- years_experience INTEGER
- is_verified BOOLEAN
- verification_method TEXT
- verified_at TIMESTAMPTZ
- verified_by UUID → profiles(id)
- UNIQUE(mechanic_id, skill_id)
```

#### `badges`
```sql
- id UUID PRIMARY KEY
- code TEXT UNIQUE
- title TEXT
- description TEXT
- icon TEXT
- badge_type TEXT (verified_skill|earned|admin)
- criteria_json JSONB
```

#### `user_badges`
```sql
- id UUID PRIMARY KEY
- user_id UUID → profiles(id)
- badge_id UUID → badges(id)
- source TEXT (admin|manual|system)
- awarded_at TIMESTAMPTZ
- expires_at TIMESTAMPTZ
- UNIQUE(user_id, badge_id)
```

#### `reviews`
```sql
- id UUID PRIMARY KEY
- job_id UUID → jobs(id)
- reviewer_id UUID → profiles(id)
- reviewee_id UUID → profiles(id)
- reviewer_role TEXT (customer|mechanic)
- reviewee_role TEXT (customer|mechanic)
- overall_rating INTEGER (1-5)
- performance_rating INTEGER (1-5)
- timing_rating INTEGER (1-5)
- cost_rating INTEGER (1-5)
- comment TEXT
- is_hidden BOOLEAN
- hidden_reason TEXT
- UNIQUE(job_id, reviewer_id)
```

#### `review_reports`
```sql
- id UUID PRIMARY KEY
- review_id UUID → reviews(id)
- reported_by UUID → profiles(id)
- reason TEXT (spam|inappropriate|fake|harassment|other)
- details TEXT
- status TEXT (pending|reviewed|resolved|dismissed)
```

#### `user_ratings` (VIEW)
Aggregated ratings computed from reviews:
```sql
- user_id
- review_count
- avg_overall_rating
- avg_performance_rating
- avg_timing_rating
- avg_cost_rating
- last_review_at
- five_star_count, four_star_count, etc.
```

## Security (RLS Policies)

### Public Read Access
- ✅ Anyone can view: profiles, skills, badges, user_badges, visible reviews, aggregated ratings
- ✅ Anonymous users can browse mechanic profiles and reviews

### Controlled Write Access
- ✅ Only authenticated users can create reviews (for jobs they participated in)
- ✅ Only mechanics can add/manage their own skills
- ✅ Only admins can verify skills and award badges
- ✅ Only admins can hide reviews
- ✅ Users can edit reviews within 24 hours
- ✅ Users can report reviews

### Fraud Prevention
- ✅ One review per job per reviewer (DB constraint)
- ✅ Reviews only allowed after job completion
- ✅ Reviewer must be job participant
- ✅ Review reporting system

## API Functions

### TypeScript Helper Functions (`src/lib/reviews.ts`)

```typescript
// Profile & Ratings
getPublicProfile(userId: string): Promise<PublicProfile | null>
getUserRatings(userId: string): Promise<UserRating | null>
getUserBadges(userId: string): Promise<UserBadge[]>
getMechanicSkills(mechanicId: string): Promise<MechanicSkill[]>

// Reviews
getUserReviews(userId, options): Promise<{ reviews, total }>
submitReview(payload: CreateReviewPayload): Promise<{ success, error? }>
canUserReviewJob(jobId: string): Promise<{ canReview, reason? }>
reportReview(payload: ReportReviewPayload): Promise<{ success, error? }>

// Skills
addMechanicSkill(payload: CreateSkillPayload): Promise<{ success, error? }>
updateMechanicSkill(skillId, updates): Promise<{ success, error? }>
deleteMechanicSkill(skillId: string): Promise<{ success, error? }>
getAllSkills(): Promise<Skill[]>

// Search
searchMechanicsBySkill(skillId, options): Promise<PublicProfile[]>
```

## UI Components

### 1. `UserProfileCard` (`components/profile/UserProfileCard.tsx`)
Reusable profile card component with:
- Profile photo with verified badge overlay
- Name, role, location
- Star ratings + review count
- Sub-ratings (performance, timing, cost)
- Badges (scrollable horizontal)
- Skills grid (verified markers)
- Bio section
- Compact mode for lists

**Usage:**
```tsx
<UserProfileCard 
  profile={profile} 
  onPress={() => router.push(`/profile/${profile.id}`)}
  compact={false}
/>
```

### 2. `ReviewsList` (`components/reviews/ReviewsList.tsx`)
Reviews list with:
- Star ratings display
- Category ratings
- Review text
- Reviewer info
- Report button
- Pagination support
- Empty state

**Usage:**
```tsx
<ReviewsList
  reviews={reviews}
  onLoadMore={handleLoadMore}
  hasMore={hasMore}
  loading={loading}
  onReportReview={handleReport}
/>
```

### 3. `ReviewForm` (`components/reviews/ReviewForm.tsx`)
Review submission form with:
- Overall rating selector (large stars)
- Category ratings (performance, timing, cost)
- Comment text area (1000 char limit)
- Validation
- Submit/Cancel buttons

**Usage:**
```tsx
<ReviewForm
  jobId={jobId}
  revieweeId={revieweeId}
  reviewerRole="customer"
  revieweeRole="mechanic"
  onSubmit={handleSubmit}
  onCancel={handleCancel}
/>
```

## App Screens

### 1. Public Profile Page (`app/profile/[userId].tsx`)
- Full profile card
- Service area info (for mechanics)
- Reviews list with sorting (Recent/Rating)
- Load more pagination
- Report review functionality

**Route:** `/profile/[userId]`

### 2. Review Submission (`app/jobs/[jobId]/review.tsx`)
- Eligibility check (job completed, user participated, no existing review)
- Review form
- Success/error handling
- Auto-navigation back on success

**Route:** `/jobs/[jobId]/review`

## Pre-Seeded Data

### Skills (31 skills across 10 categories)
- **Brakes:** Brake Repair, Brake System Diagnostics
- **Maintenance:** Oil Change, Fluid Services, Wiper Replacement
- **Tires:** Tire Rotation, Tire Replacement, Wheel Alignment
- **Electrical:** Battery, Alternator, Starter, Diagnostics, Light Bulbs
- **Engine:** Diagnostics, Tune-Up, Timing Belt, Overhaul, Diesel
- **Transmission:** Diagnostics, Repair, Clutch Replacement
- **Suspension:** Suspension Repair
- **Steering:** Steering Repair
- **HVAC:** A/C Service, Heating Repair
- **Exhaust:** Exhaust System Repair
- **Diagnostics:** Emissions Testing, Pre-Purchase Inspection
- **Fuel:** Fuel System Service
- **Specialized:** Hybrid Service, EV Service

### Badges (15 badges)
- **Admin:** Verified Identity, New Mechanic, Mobile Pro
- **Earned:** Top Rated, Expert Mechanic, Reliable, Fast Responder, Rising Star, Customer Favorite, Specialist
- **Verified Skills:** Verified Brakes, Engine, Electrical, Transmission, Diagnostics

## Performance Optimizations

### Indexes Created
```sql
-- Profiles
idx_profiles_city, idx_profiles_service_area, idx_profiles_available

-- Skills
idx_skills_category

-- Mechanic Skills
idx_mechanic_skills_mechanic, idx_mechanic_skills_skill, idx_mechanic_skills_verified

-- Badges
idx_badges_type, idx_badges_code

-- User Badges
idx_user_badges_user, idx_user_badges_badge, idx_user_badges_active

-- Reviews
idx_reviews_job, idx_reviews_reviewer, idx_reviews_reviewee
idx_reviews_reviewee_visible, idx_reviews_created, idx_reviews_overall_rating

-- Review Reports
idx_review_reports_review, idx_review_reports_status
```

### Query Optimization
- Aggregated ratings computed via VIEW (no N+1 queries)
- Composite indexes for common queries
- Pagination support in all list queries
- Efficient filtering (is_hidden, expires_at, etc.)

## Deployment Steps

### 1. Run Migrations
```bash
# Apply migrations in order
supabase migration up
```

Or manually run:
1. `supabase/migrations/20250125000000_create_reviews_ratings_system.sql`
2. `supabase/migrations/20250125000001_seed_skills_badges.sql`

### 2. Verify RLS Policies
```sql
-- Check policies are enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('skills', 'mechanic_skills', 'badges', 'user_badges', 'reviews', 'review_reports');
```

### 3. Test Permissions
- Test anonymous read access to profiles/reviews
- Test authenticated user review submission
- Test admin skill verification
- Test review reporting

### 4. Seed Initial Data
The seed migration includes 31 skills and 15 badges. Verify:
```sql
SELECT COUNT(*) FROM skills; -- Should be 31
SELECT COUNT(*) FROM badges; -- Should be 15
```

## Usage Examples

### Display Mechanic Profile in List
```tsx
import { UserProfileCard } from '@/components/profile/UserProfileCard';
import { getPublicProfile } from '@/src/lib/reviews';

const MechanicList = () => {
  const [mechanics, setMechanics] = useState([]);
  
  // Load mechanics...
  
  return (
    <FlatList
      data={mechanics}
      renderItem={({ item }) => (
        <UserProfileCard
          profile={item}
          compact={true}
          onPress={() => router.push(`/profile/${item.id}`)}
        />
      )}
    />
  );
};
```

### Show Review CTA After Job Completion
```tsx
// In job detail screen
const JobDetail = ({ job }) => {
  const [canReview, setCanReview] = useState(false);
  
  useEffect(() => {
    if (job.status === 'completed') {
      canUserReviewJob(job.id).then(({ canReview }) => {
        setCanReview(canReview);
      });
    }
  }, [job]);
  
  return (
    <View>
      {/* Job details */}
      {canReview && (
        <TouchableOpacity onPress={() => router.push(`/jobs/${job.id}/review`)}>
          <Text>Rate Your Experience</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};
```

### Add Skills to Mechanic Profile
```tsx
import { addMechanicSkill, getAllSkills } from '@/src/lib/reviews';

const AddSkillScreen = () => {
  const [skills, setSkills] = useState([]);
  
  useEffect(() => {
    getAllSkills().then(setSkills);
  }, []);
  
  const handleAddSkill = async (skillId: string) => {
    const result = await addMechanicSkill({
      skill_id: skillId,
      level: 'intermediate',
      years_experience: 3,
    });
    
    if (result.success) {
      Alert.alert('Success', 'Skill added to your profile');
    }
  };
  
  return (
    <FlatList
      data={skills}
      renderItem={({ item }) => (
        <TouchableOpacity onPress={() => handleAddSkill(item.id)}>
          <Text>{item.name}</Text>
        </TouchableOpacity>
      )}
    />
  );
};
```

## Admin Functions

### Verify a Mechanic Skill
```sql
-- Admin dashboard or Edge Function
UPDATE mechanic_skills
SET 
  is_verified = true,
  verification_method = 'admin',
  verified_at = now(),
  verified_by = '<admin_user_id>'
WHERE id = '<mechanic_skill_id>';
```

### Award a Badge
```sql
INSERT INTO user_badges (user_id, badge_id, source)
VALUES (
  '<user_id>',
  (SELECT id FROM badges WHERE code = 'TOP_RATED'),
  'admin'
);
```

### Hide a Review
```sql
UPDATE reviews
SET 
  is_hidden = true,
  hidden_reason = 'Violates community guidelines',
  hidden_at = now(),
  hidden_by = '<admin_user_id>'
WHERE id = '<review_id>';
```

### View Pending Reports
```sql
SELECT 
  rr.*,
  r.comment,
  r.overall_rating,
  reviewer.full_name as reviewer_name,
  reviewee.full_name as reviewee_name
FROM review_reports rr
JOIN reviews r ON r.id = rr.review_id
JOIN profiles reviewer ON reviewer.id = r.reviewer_id
JOIN profiles reviewee ON reviewee.id = r.reviewee_id
WHERE rr.status = 'pending'
ORDER BY rr.created_at DESC;
```

## Future Enhancements

### Earned Badges Auto-Award System
Create an Edge Function or cron job to auto-award earned badges:

```typescript
// Example: Award TOP_RATED badge
const awardTopRatedBadge = async () => {
  const { data: eligibleUsers } = await supabase
    .from('user_ratings')
    .select('user_id')
    .gte('avg_overall_rating', 4.8)
    .gte('review_count', 50);
  
  for (const user of eligibleUsers) {
    // Check if already has badge
    const { data: existing } = await supabase
      .from('user_badges')
      .select('id')
      .eq('user_id', user.user_id)
      .eq('badge_id', '<TOP_RATED_BADGE_ID>')
      .single();
    
    if (!existing) {
      await supabase.from('user_badges').insert({
        user_id: user.user_id,
        badge_id: '<TOP_RATED_BADGE_ID>',
        source: 'system',
      });
    }
  }
};
```

### Profile Completion Checker
```typescript
const checkProfileCompletion = async (userId: string) => {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  const required = ['full_name', 'phone', 'city'];
  const missing = required.filter(field => !profile[field]);
  
  await supabase
    .from('profiles')
    .update({
      profile_complete: missing.length === 0,
      required_fields_missing: missing,
    })
    .eq('id', userId);
};
```

### Review Response System
Allow reviewees to respond to reviews:
```sql
ALTER TABLE reviews
ADD COLUMN response TEXT,
ADD COLUMN response_at TIMESTAMPTZ,
ADD COLUMN responded_by UUID REFERENCES profiles(id);
```

## Troubleshooting

### Reviews not showing
- Check `is_hidden = false` filter
- Verify RLS policies allow read access
- Check job status is 'completed'

### Can't submit review
- Verify job is completed
- Check user participated in job
- Ensure no existing review for this job+reviewer
- Verify all ratings are 1-5

### Badges not displaying
- Check `expires_at IS NULL OR expires_at > now()`
- Verify badge relationship is loaded
- Check RLS policies

### Skills not verified
- Only admins can set `is_verified = true`
- Check admin role in profiles table
- Verify RLS policy allows admin updates

## Files Created

### Migrations
- `supabase/migrations/20250125000000_create_reviews_ratings_system.sql`
- `supabase/migrations/20250125000001_seed_skills_badges.sql`

### Types
- `src/types/reviews.ts`

### Library Functions
- `src/lib/reviews.ts`

### Components
- `components/profile/UserProfileCard.tsx`
- `components/reviews/ReviewsList.tsx`
- `components/reviews/ReviewForm.tsx`

### Screens
- `app/profile/[userId].tsx`
- `app/jobs/[jobId]/review.tsx`

## Support

For issues or questions:
1. Check RLS policies are enabled
2. Verify migrations ran successfully
3. Check Supabase logs for errors
4. Test with authenticated vs anonymous users
5. Verify job status and user participation

---

**Built for WrenchGo** - A comprehensive marketplace solution for mechanics and customers.
