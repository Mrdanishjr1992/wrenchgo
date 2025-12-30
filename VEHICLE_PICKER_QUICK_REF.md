# Vehicle Picker Drawer - Quick Reference

## What Changed

**Before**: Selecting a vehicle navigated to `/(customer)/garage/index?returnTo=...`

**After**: Vehicle selection happens in a bottom drawer modal (stays on current screen)

---

## New Component

**`src/components/VehiclePickerDrawer.tsx`**

```typescript
<VehiclePickerDrawer
  visible={showVehicleDrawer}
  onClose={() => setShowVehicleDrawer(false)}
  vehicles={vehicles}
  selectedVehicleId={selectedVehicleId}
  onSelect={(vehicle) => {
    setSelectedVehicleId(vehicle.id);
    setSelectedVehicle(vehicle);
    setShowVehicleDrawer(false);
  }}
  onAddNew={() => setShowVehicleDrawer(false)}
  loading={loadingVehicles}
  returnTo="explore" // or "request-service"
/>
```

---

## Key Features

✅ **Auto-select single vehicle** (if user has exactly 1)
✅ **Block actions** until vehicle selected
✅ **Empty state** with "Add Your First Vehicle" CTA
✅ **Cannot dismiss** without selection (forces choice)
✅ **Consistent styling** (uses theme system)
✅ **Loading state** with spinner

---

## Updated Screens

### Explore (`app/(customer)/(tabs)/explore.tsx`)
- Loads vehicles on focus
- Opens drawer instead of navigating
- Blocks symptom selection until vehicle chosen

### Request Service (`app/(customer)/request-service.tsx`)
- Replaced custom drawer with `VehiclePickerDrawer`
- Removed 150+ lines of duplicate code
- Opens drawer on "Change" button

### Garage Index (`app/(customer)/garage/index.tsx`)
- **No changes** (still works for garage management)
- Only accessed directly, not for vehicle selection

---

## User Flows

### 0 Vehicles
1. Open drawer → Empty state
2. Tap "Add Your First Vehicle"
3. Navigate to garage/add
4. Return with new vehicle selected

### 1 Vehicle
1. Open screen → Auto-selected
2. No drawer shown
3. Can immediately proceed

### 2+ Vehicles
1. Open screen → No selection
2. Tap action → Drawer opens
3. Select vehicle → Drawer closes
4. Proceed with action

---

## Testing

```bash
# Test auto-select
1. Have exactly 1 vehicle
2. Open Explore
3. Vehicle should be pre-selected

# Test blocking
1. Have 0 or 2+ vehicles
2. Tap symptom without selecting
3. Drawer should open (blocks navigation)

# Test drawer
1. Open drawer
2. Try to dismiss without selecting
3. Should not close (if no vehicle selected)

# Test empty state
1. Delete all vehicles
2. Open drawer
3. Should show "Add Your First Vehicle" button
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/VehiclePickerDrawer.tsx` | NEW (+330 lines) |
| `app/(customer)/(tabs)/explore.tsx` | REWRITE (~200 lines) |
| `app/(customer)/request-service.tsx` | SIMPLIFIED (-140 lines) |

**Net**: +190 lines, cleaner code, better UX

---

## Common Issues

### Drawer won't dismiss
- **Cause**: No vehicle selected
- **Fix**: Select a vehicle or add one

### Vehicles not loading
- **Cause**: FK mismatch (customer_id vs user_id)
- **Fix**: Already fixed - uses `user_id` everywhere

### "index" UUID errors
- **Cause**: String-based navigation
- **Fix**: Already fixed - explicit object navigation

---

## Quick Wins

1. **Cleaner code**: Removed duplicate drawer implementation
2. **Better UX**: No navigation away from screen
3. **Safer**: Blocks actions until vehicle selected
4. **Consistent**: Same drawer across all screens
5. **Maintainable**: Single source of truth for vehicle selection

---

## Next Steps

1. Test on device (iOS + Android)
2. Verify modal behavior on different screen sizes
3. Test with 0, 1, and 10+ vehicles
4. Ensure "Add New Vehicle" flow works end-to-end
5. Check performance with large vehicle lists
