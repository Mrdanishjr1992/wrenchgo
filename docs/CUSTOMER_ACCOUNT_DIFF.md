# Customer Account Integration - Code Diff Summary

## File Modified: `app/(customer)/(tabs)/account.tsx`

### Imports Added
```diff
+ import * as Location from "expo-location";
+ import { ReviewsList } from "../../../components/reviews/ReviewsList";
```

### State Variables Added
```diff
+ const [locationLat, setLocationLat] = useState("");
+ const [locationLng, setLocationLng] = useState("");
+ const [paymentMethod, setPaymentMethod] = useState<any>(null);
+ const [loadingLocation, setLoadingLocation] = useState(false);
+ const [reviews, setReviews] = useState<any[]>([]);
+ const [loadingReviews, setLoadingReviews] = useState(false);
```

### Load Function - Payment Method Fetch
```diff
  const load = useCallback(async () => {
    try {
      setLoading(true);
      // ... existing profile fetch ...
      
+     const { data: paymentData } = await supabase
+       .from("customer_payment_methods")
+       .select("stripe_customer_id, stripe_payment_method_id, card_brand, card_last4, card_exp_month, card_exp_year")
+       .eq("customer_id", data.id)
+       .maybeSingle();
+
+     setPaymentMethod(paymentData);
+
+     const { data: reviewsData } = await supabase
+       .from("reviews")
+       .select(`
+         id,
+         overall_rating,
+         performance_rating,
+         timing_rating,
+         cost_rating,
+         comment,
+         created_at,
+         reviewer:profiles!reviews_reviewer_id_fkey(id, full_name, avatar_url)
+       `)
+       .eq("reviewee_id", data.id)
+       .order("created_at", { ascending: false })
+       .limit(10);
+
+     setReviews(reviewsData || []);
    } catch (e: any) {
      // ... error handling ...
    }
  }, [router]);
```

### New Function - Fetch Current Location
```diff
+ const fetchCurrentLocation = useCallback(async () => {
+   try {
+     setLoadingLocation(true);
+     const { status } = await Location.requestForegroundPermissionsAsync();
+     if (status !== 'granted') {
+       Alert.alert('Permission denied', 'Please allow location access to use this feature.');
+       return;
+     }
+
+     const location = await Location.getCurrentPositionAsync({});
+     const lat = location.coords.latitude.toFixed(6);
+     const lng = location.coords.longitude.toFixed(6);
+     
+     setLocationLat(lat);
+     setLocationLng(lng);
+
+     if (profile?.id) {
+       const { error } = await supabase
+         .from("profiles")
+         .update({
+           city: `${lat}, ${lng}`,
+           updated_at: new Date().toISOString(),
+         })
+         .eq("id", profile.id);
+
+       if (error) throw error;
+       
+       Alert.alert('Success', 'Location saved successfully');
+       await load();
+     }
+   } catch (error: any) {
+     console.error('Location error:', error);
+     Alert.alert('Error', error.message || 'Failed to get location');
+   } finally {
+     setLoadingLocation(false);
+   }
+ }, [profile, load]);
```

### UI Sections Added (After Appearance Section)

#### 1. Payment Method Section
```diff
+         <View style={[card, { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.sm }]}>
+           <Text style={text.section}>Payment Method</Text>
+           {paymentMethod?.stripe_payment_method_id ? (
+             <View style={{ gap: spacing.sm }}>
+               <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
+                 <View style={{ /* icon container */ }}>
+                   <Ionicons name="card" size={22} color={colors.accent} />
+                 </View>
+                 <View style={{ flex: 1 }}>
+                   <Text style={{ /* card info */ }}>
+                     {paymentMethod.card_brand?.toUpperCase() || "Card"} •••• {paymentMethod.card_last4}
+                   </Text>
+                   <Text style={{ /* expiration */ }}>
+                     Expires {paymentMethod.card_exp_month}/{paymentMethod.card_exp_year}
+                   </Text>
+                 </View>
+               </View>
+               <Pressable onPress={() => Alert.alert("Update Payment", "Payment method update coming soon")}>
+                 <Text>Update Payment Method</Text>
+               </Pressable>
+             </View>
+           ) : (
+             <Pressable onPress={() => Alert.alert("Add Payment", "Payment method setup coming soon")}>
+               <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
+               <Text>ADD PAYMENT METHOD</Text>
+             </Pressable>
+           )}
+         </View>
```

#### 2. Current Location Section
```diff
+         <View style={[card, { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.sm }]}>
+           <Text style={text.section}>Current Location</Text>
+           <Text style={{ /* description */ }}>
+             Save your current location for faster service requests
+           </Text>
+           <Pressable
+             onPress={fetchCurrentLocation}
+             disabled={loadingLocation}
+           >
+             {loadingLocation ? (
+               <ActivityIndicator color={colors.accent} size="small" />
+             ) : (
+               <>
+                 <Ionicons name="location" size={18} color={colors.accent} />
+                 <Text>Use Current Location</Text>
+               </>
+             )}
+           </Pressable>
+         </View>
```

#### 3. Reviews Section
```diff
+         {profile?.id && (
+           <View style={[card, { padding: spacing.lg, borderRadius: radius.lg, gap: spacing.sm }]}>
+             <Text style={text.section}>My Reviews</Text>
+             <Text style={{ /* description */ }}>
+               Reviews from mechanics you've worked with
+             </Text>
+             <ReviewsList
+               reviews={reviews}
+               loading={loadingReviews}
+               mechanicName={profile.full_name}
+             />
+           </View>
+         )}
```

---

## Components Reused (No Changes)

### `components/reviews/ReviewsList.tsx`
- ✅ Used as-is
- ✅ Receives `reviews` array prop
- ✅ Handles empty state
- ✅ Renders review cards

### `src/components/DeleteAccountButton.tsx`
- ✅ No changes
- ✅ Still used in account page

### `src/ui/styles.ts` - `createCard`
- ✅ No changes
- ✅ Used for all card styling

### `src/ui/theme-context.tsx` - `useTheme`
- ✅ No changes
- ✅ Used for theme tokens

---

## Database Queries Added

### Payment Method Query
```sql
SELECT 
  stripe_customer_id, 
  stripe_payment_method_id, 
  card_brand, 
  card_last4, 
  card_exp_month, 
  card_exp_year
FROM customer_payment_methods
WHERE customer_id = $profile_id
LIMIT 1
```

### Reviews Query
```sql
SELECT 
  id,
  overall_rating,
  performance_rating,
  timing_rating,
  cost_rating,
  comment,
  created_at,
  reviewer:profiles!reviews_reviewer_id_fkey(id, full_name, avatar_url)
FROM reviews
WHERE reviewee_id = $profile_id
ORDER BY created_at DESC
LIMIT 10
```

### Location Update Query
```sql
UPDATE profiles
SET 
  city = $coordinates,
  updated_at = NOW()
WHERE id = $profile_id
```

---

## Line Count Changes

### Before
- Total lines: ~567

### After
- Total lines: ~747

### Net Change
- **+180 lines** (approx)
  - +2 imports
  - +6 state variables
  - +1 function (fetchCurrentLocation)
  - +2 queries in load()
  - +3 UI sections (Payment, Location, Reviews)

---

## Breaking Changes
- ❌ None

## Migration Required
- ❌ None

## New Dependencies
- ❌ None (expo-location already installed)

## Schema Changes
- ❌ None (all tables/columns exist)

---

## Testing Commands

```bash
# Check for TypeScript errors
npx tsc --noEmit

# Run linter
npm run lint

# Start dev server
npm start

# Test on iOS
npm run ios

# Test on Android
npm run android
```

---

## Manual Testing Checklist

### Payment Method
- [ ] Load page with no payment method → Shows "Add" button
- [ ] Load page with payment method → Shows card details
- [ ] Tap "Add Payment Method" → Shows alert
- [ ] Tap "Update Payment Method" → Shows alert

### Current Location
- [ ] Tap "Use Current Location" → Requests permission
- [ ] Grant permission → Fetches coordinates
- [ ] Deny permission → Shows alert
- [ ] Success → Shows success alert + saves to DB
- [ ] Error → Shows error alert

### Reviews
- [ ] Load page with reviews → Shows review list
- [ ] Load page without reviews → Shows empty state
- [ ] Reviews display correctly (stars, text, date)
- [ ] Reviewer name shows correctly

### General
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Theme consistency maintained
- [ ] Scrolling works smoothly
- [ ] Edit mode still works
- [ ] Save profile still works
- [ ] Sign out still works
- [ ] Delete account still works

---

**Status**: ✅ Complete & Ready for Review
