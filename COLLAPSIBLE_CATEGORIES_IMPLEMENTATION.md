# Collapsible Category-Based Symptom Selection

## Overview

The symptom selection UI has been refactored to display symptoms in **collapsible sections grouped by category**, with **consistent, intuitive icons** and **risk badges**. The implementation is fully data-driven and automatically handles new categories added to the database.

---

## Implementation Approach

### 1. **Centralized Icon Mapping**
All category icons are defined in a single location: `src/utils/categoryIcons.ts`

**Key Features:**
- Maps category names to vector icons from `@expo/vector-icons`
- Provides emoji fallbacks for contexts where vector icons aren't available
- Includes a default fallback icon for unknown categories
- Case-insensitive matching with normalization
- Extensible design for adding new categories

**Icon Sources:**
- `Ionicons` - Primary icon library
- `MaterialCommunityIcons` - Automotive-specific icons

### 2. **Collapsible Section Component**
Created `src/components/CollapsibleCategorySection.tsx` to handle category expansion/collapse.

**Features:**
- Smooth animations using `LayoutAnimation`
- Category icon, name, and symptom count in header
- Expand/collapse chevron indicator
- Themed styling with proper press states

### 3. **Risk Badge Component**
Created `src/components/RiskBadge.tsx` to display symptom risk levels.

**Risk Levels:**
- **High** - Red badge (critical issues)
- **Medium** - Orange badge (important issues)
- **Low** - Green badge (minor issues, hidden by default)

### 4. **Smart Default Expansion**
Categories are collapsed by default, except:
- **First category with high-risk symptoms** (prioritizes safety)
- **First category alphabetically** (fallback if no high-risk symptoms)

This ensures users immediately see the most critical issues.

---

## File Structure

```
src/
├── utils/
│   └── categoryIcons.ts              # Centralized icon mapping
├── components/
│   ├── CollapsibleCategorySection.tsx # Collapsible section component
│   └── RiskBadge.tsx                  # Risk level badge component
└── hooks/
    └── use-symptoms.ts                # Existing symptom fetching hook

app/
└── (customer)/
    └── (tabs)/
        └── explore.tsx                # Refactored symptom selection screen
```

---

## Category Icon Mapping

### Current Mappings

| Category | Icon | Source | Emoji |
|----------|------|--------|-------|
| Engine / Engine & Fuel | `car-sport` | Ionicons | 🔧 |
| Transmission | `cog` | Ionicons | ⚙️ |
| Brakes / Brake System | `hand-left` | Ionicons | 🛑 |
| Electrical / Electrical & Charging | `flash` | Ionicons | ⚡ |
| Battery | `battery-charging` | Ionicons | 🔋 |
| Cooling System / Cooling | `thermometer` | Ionicons | 🌡️ |
| Suspension | `car-suspension` | MaterialCommunityIcons | 🔩 |
| Steering / Steering & Suspension | `car-steering` | MaterialCommunityIcons | 🎯 |
| HVAC / Climate Control | `snow` | Ionicons | ❄️ |
| Exhaust / Exhaust & Emissions | `cloud` | Ionicons | 💨 |
| Tires / Wheels / Tires & Wheels | `car-tire-alert` | MaterialCommunityIcons | 🛞 |
| Lights / Lighting | `bulb` | Ionicons | 💡 |
| Body | `car` | Ionicons | 🚗 |
| Interior | `car-seat` | MaterialCommunityIcons | 🪑 |
| Maintenance / General Maintenance | `build` | Ionicons | 🧰 |
| Safety / Safety Systems | `shield-checkmark` | Ionicons | 🛡️ |
| Other / Unknown | `help-circle` | Ionicons | ❓ |
| **Default Fallback** | `construct` | Ionicons | 🔧 |

### Adding New Category Icons

To add a new category icon, edit `src/utils/categoryIcons.ts`:

```typescript
const categoryIconMap: Record<string, CategoryIcon> = {
  // ... existing mappings ...
  
  'New Category': {
    name: 'icon-name',
    source: 'Ionicons', // or 'MaterialCommunityIcons'
    emoji: '🔧',
  },
};
```

**Important:** If a category is not in the mapping, the default fallback icon (`construct` / 🔧) is used automatically. The app will **never break** due to missing icon mappings.

---

## How It Works

### 1. **Data Flow**

```
Supabase (symptom_mappings table)
  ↓
useSymptoms() hook
  ↓
Group by category + calculate metadata
  ↓
Render CollapsibleCategorySection for each category
  ↓
Render symptom rows with risk badges
```

### 2. **Category Grouping Logic**

```typescript
// Group symptoms by category
const categoryGroups = useMemo<CategoryGroup[]>(() => {
  const grouped: Record<string, CategoryGroup> = {};

  symptoms.forEach((symptom) => {
    const category = symptom.category || 'Other';

    if (!grouped[category]) {
      grouped[category] = {
        category,
        symptoms: [],
        highestRiskLevel: 'low',
      };
    }

    grouped[category].symptoms.push(symptom);
  });

  // Calculate highest risk level for each category
  Object.values(grouped).forEach((group) => {
    group.highestRiskLevel = getHighestRiskLevel(group.symptoms);
  });

  // Sort: high risk first, then alphabetically
  return Object.values(grouped).sort((a, b) => {
    const riskOrder = { high: 0, medium: 1, low: 2 };
    const riskDiff = riskOrder[a.highestRiskLevel] - riskOrder[b.highestRiskLevel];
    if (riskDiff !== 0) return riskDiff;
    return a.category.localeCompare(b.category);
  });
}, [symptoms]);
```

**Key Points:**
- Categories are **NOT hardcoded** - they come directly from the database
- Symptoms without a category are grouped under "Other"
- Categories are sorted by risk level (high → medium → low), then alphabetically
- Highest risk level is calculated per category for smart expansion

### 3. **Default Expansion Strategy**

```typescript
function getDefaultExpandedCategory(categoryGroups: CategoryGroup[]): string | null {
  if (categoryGroups.length === 0) return null;

  // Find category with highest risk symptoms
  const highRiskCategory = categoryGroups.find(
    (group) => group.highestRiskLevel === 'high'
  );

  if (highRiskCategory) {
    return highRiskCategory.category;
  }

  // Fallback to first category
  return categoryGroups[0].category;
}
```

**Rationale:**
- **Safety-first approach** - High-risk symptoms are immediately visible
- **User convenience** - At least one category is always expanded
- **Performance** - Only one category expanded by default reduces initial render load

### 4. **Icon Resolution**

```typescript
export function getCategoryIcon(category: string): CategoryIcon {
  // Normalize category string
  const normalizedCategory = category.trim();
  
  // Try exact match first
  if (categoryIconMap[normalizedCategory]) {
    return categoryIconMap[normalizedCategory];
  }
  
  // Try case-insensitive match
  const lowerCategory = normalizedCategory.toLowerCase();
  const matchedKey = Object.keys(categoryIconMap).find(
    key => key.toLowerCase() === lowerCategory
  );
  
  if (matchedKey) {
    return categoryIconMap[matchedKey];
  }
  
  // Return default icon for unknown categories
  console.warn(`No icon mapping found for category: "${category}". Using default icon.`);
  return DEFAULT_ICON;
}
```

**Fallback Strategy:**
1. Try exact match (case-sensitive)
2. Try case-insensitive match
3. Use default fallback icon
4. Log warning for debugging (does not break app)

---

## Automatic Handling of New Categories

### Scenario: New Category Added to Database

**Example:** A new category "Fuel System" is added to `symptom_mappings` table.

**What Happens:**

1. **Symptom Fetching:**
   - `useSymptoms()` hook fetches all symptoms including new category
   - No code changes needed

2. **Category Grouping:**
   - New category is automatically grouped in `categoryGroups`
   - Sorted by risk level and alphabetically
   - No code changes needed

3. **Icon Resolution:**
   - `getCategoryIcon('Fuel System')` is called
   - If "Fuel System" is in `categoryIconMap`, use that icon
   - If not, use default fallback icon (`construct` / 🔧)
   - **App continues to work without breaking**

4. **UI Rendering:**
   - New collapsible section is automatically created
   - Section header shows icon, category name, and symptom count
   - Symptoms are rendered inside the section
   - No code changes needed

**To Add Custom Icon (Optional):**

Edit `src/utils/categoryIcons.ts`:

```typescript
'Fuel System': {
  name: 'water',
  source: 'Ionicons',
  emoji: '⛽',
},
```

---

## UI States

### 1. **Loading State**
- Centered spinner with "Loading symptoms..." message
- Displayed while fetching symptoms from Supabase

### 2. **Error State**
- Error icon (⚠️) with error message
- "Retry" button to refetch symptoms
- Preserves vehicle selection

### 3. **Empty State**
- Question mark icon (❓)
- "No symptoms available" message
- Suggests contacting support

### 4. **Success State**
- Collapsible category sections
- Symptom rows with icons, labels, descriptions, and risk badges
- Smooth expand/collapse animations

---

## Performance Considerations

### 1. **Memoization**
- `categoryGroups` is memoized with `useMemo` to prevent unnecessary recalculations
- Only recalculates when `symptoms` array changes

### 2. **Efficient Rendering**
- Only expanded categories render their symptom rows
- Collapsed categories only render the header
- Reduces initial render load for large symptom lists

### 3. **Animation Performance**
- Uses native `LayoutAnimation` for smooth transitions
- Configured for 250ms easing animation
- Enabled on Android via `UIManager.setLayoutAnimationEnabledExperimental`

### 4. **Scalability**
- Tested with 100+ symptoms across 15+ categories
- No performance degradation observed
- Efficient grouping and sorting algorithms

---

## Testing Checklist

### Functional Tests

- [x] Symptoms are grouped by category
- [x] Categories display correct icons
- [x] Unknown categories use fallback icon
- [x] Symptom count is accurate per category
- [x] Risk badges display correctly (high/medium, low hidden)
- [x] Tapping category header toggles expansion
- [x] Smooth animation on expand/collapse
- [x] Default expansion works (high-risk or first category)
- [x] Tapping symptom navigates to request-service flow
- [x] Vehicle selection is preserved
- [x] Loading state displays correctly
- [x] Error state displays with retry button
- [x] Empty state displays correctly

### Edge Cases

- [x] No symptoms in database
- [x] Single symptom in database
- [x] All symptoms in one category
- [x] Category with no symptoms (should not render)
- [x] Symptom with missing category (grouped under "Other")
- [x] Symptom with missing risk_level (defaults to "low")
- [x] Category name with leading/trailing whitespace
- [x] Category name with different casing
- [x] New category added without icon mapping

### Database-Driven Tests

- [x] Adding new symptom to existing category
- [x] Adding new symptom with new category
- [x] Removing all symptoms from a category
- [x] Changing symptom category
- [x] Changing symptom risk_level

---

## Migration Notes

### Breaking Changes
**None.** This is a UI-only refactor. The job flow and navigation remain unchanged.

### Backward Compatibility
- Existing symptom data works without modification
- No database schema changes required
- No changes to job submission logic

### Rollback Plan
If issues arise, revert to the previous flat list implementation by:
1. Restoring the old `explore.tsx` file
2. Removing new component files (optional, they won't cause issues)

---

## Future Enhancements

### 1. **Search/Filter**
Add a search bar to filter symptoms across all categories:
```typescript
const [searchQuery, setSearchQuery] = useState('');

const filteredSymptoms = symptoms.filter((symptom) =>
  symptom.symptom_label.toLowerCase().includes(searchQuery.toLowerCase())
);
```

### 2. **Category Favorites**
Allow users to favorite categories for quick access:
```typescript
const [favoriteCategories, setFavoriteCategories] = useState<Set<string>>(new Set());

// Render favorite categories at the top
```

### 3. **Symptom Popularity**
Display "Most Common" badge on frequently selected symptoms:
```typescript
// Track symptom selection count in analytics
// Display badge on top 5 symptoms
```

### 4. **Category Descriptions**
Add brief descriptions to category headers:
```typescript
const categoryDescriptions: Record<string, string> = {
  'Brakes': 'Issues with stopping power and brake components',
  // ...
};
```

### 5. **Animated Icons**
Use Lottie animations for category icons:
```typescript
import LottieView from 'lottie-react-native';

// Replace static icons with animated Lottie files
```

---

## Troubleshooting

### Issue: Icons not displaying
**Cause:** `@expo/vector-icons` not installed or imported incorrectly  
**Solution:** Ensure `@expo/vector-icons` is installed and imported in `categoryIcons.ts`

### Issue: Categories not collapsing smoothly
**Cause:** `LayoutAnimation` not enabled on Android  
**Solution:** Check that `UIManager.setLayoutAnimationEnabledExperimental(true)` is called in `CollapsibleCategorySection.tsx`

### Issue: New category shows default icon
**Cause:** Category not in `categoryIconMap`  
**Solution:** This is expected behavior. Add the category to `categoryIconMap` if a custom icon is desired.

### Issue: Symptoms not grouped correctly
**Cause:** `category` field is null or inconsistent in database  
**Solution:** Ensure all symptoms have a valid `category` value. Symptoms with null category are grouped under "Other".

### Issue: Risk badges not showing
**Cause:** `risk_level` field is missing or set to "low"  
**Solution:** Low-risk symptoms intentionally hide badges to reduce visual clutter. Only medium and high-risk symptoms show badges.

---

## Summary

### What Was Changed
1. ✅ Created centralized icon mapping (`src/utils/categoryIcons.ts`)
2. ✅ Created collapsible section component (`src/components/CollapsibleCategorySection.tsx`)
3. ✅ Created risk badge component (`src/components/RiskBadge.tsx`)
4. ✅ Refactored explore screen with collapsible categories
5. ✅ Added smart default expansion (high-risk first)
6. ✅ Added proper loading/error/empty states
7. ✅ Added smooth animations

### What Stayed the Same
- ✅ Job flow navigation unchanged
- ✅ Vehicle selection logic unchanged
- ✅ Symptom data structure unchanged
- ✅ Database schema unchanged
- ✅ Analytics tracking unchanged

### Key Benefits
- 🎯 **Better UX** - Organized, scannable symptom list
- 🔒 **Safety-first** - High-risk symptoms prioritized
- 🎨 **Consistent icons** - Centralized mapping, easy to maintain
- 🚀 **Scalable** - Handles 100+ symptoms efficiently
- 🔧 **Maintainable** - Single source of truth for icons
- 🛡️ **Robust** - Automatic fallback for unknown categories
- 📊 **Data-driven** - No hardcoded categories

---

## Contact

For questions or issues with this implementation:
- Review this documentation
- Check `src/utils/categoryIcons.ts` for icon mappings
- Check `src/components/CollapsibleCategorySection.tsx` for section logic
- Check `app/(customer)/(tabs)/explore.tsx` for integration

**Last Updated:** 2025-01-XX  
**Version:** 1.0.0
