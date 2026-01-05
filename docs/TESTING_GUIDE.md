# 🧪 Testing Guide - WrenchGo UI Enhancements

## 📋 Pre-Testing Checklist

### **1. Verify Database**
```bash
# Check row counts
npx supabase db query "
SELECT 'symptoms' AS table_name, COUNT(*) AS count FROM symptoms
UNION ALL SELECT 'symptom_education', COUNT(*) FROM symptom_education;
"

# Expected output:
# symptoms: 17
# symptom_education: 17
```

### **2. Verify Expo Server**
```bash
# Should be running on terminal 6
# If not, start it:
npx expo start --clear
```

### **3. Open App**
- Press `a` for Android emulator
- Press `i` for iOS simulator (if available)

---

## 🧪 Test Cases

### **Test 1: Explore Tab - Icons Display**

**Steps**:
1. Open app
2. Navigate to "Explore" tab (bottom navigation)
3. Scroll through symptoms

**Expected**:
- ✅ All symptoms show emoji icons (🔧, 🔋, 🛑, 💧, 🚨, 🔊, ⚠️, 🔌, 🌡️)
- ✅ Icons are 22pt size, clearly visible
- ✅ Icons are inside rounded accent-colored containers

**Pass/Fail**: ___________

---

### **Test 2: Explore Tab - Collapsible Categories**

**Steps**:
1. In Explore tab, find a category header (e.g., "Brakes")
2. Tap the category header
3. Observe the chevron animation
4. Tap again to expand

**Expected**:
- ✅ Category collapses when tapped (symptoms hidden)
- ✅ Chevron rotates from 90° to 0° (› to ›)
- ✅ Symptom count badge visible (e.g., "3")
- ✅ Tapping again expands the category
- ✅ Smooth animation

**Pass/Fail**: ___________

---

### **Test 3: Explore Tab - Search Functionality**

**Steps**:
1. In Explore tab, locate the search bar (below "STEP 2")
2. Type "battery" in the search bar
3. Observe filtered results
4. Tap the ✕ button to clear search
5. Try searching for "brake"
6. Try searching for "xyz" (no results)

**Expected**:
- ✅ Search bar has 🔍 icon
- ✅ Typing "battery" shows only battery-related symptoms
- ✅ Clear button (✕) appears when text is entered
- ✅ Tapping ✕ clears search and shows all symptoms
- ✅ Searching "brake" shows brake-related symptoms
- ✅ Searching "xyz" shows "No symptoms found" message
- ✅ "Clear Search" button appears in no results state

**Pass/Fail**: ___________

---

### **Test 4: Education Tab - Symptoms with Icons**

**Steps**:
1. Navigate to "Education" tab (bottom navigation)
2. Ensure "Symptoms" tab is selected (top tabs)
3. Scroll through symptoms

**Expected**:
- ✅ All 17 symptoms display
- ✅ Each symptom has an emoji icon (28pt size)
- ✅ Icon appears to the left of symptom label
- ✅ Risk badges visible (HIGH/MEDIUM/LOW)
- ✅ Category shown at bottom of each card

**Pass/Fail**: ___________

---

### **Test 5: Education Tab - Guides (Collapsible)**

**Steps**:
1. In Education tab, tap "Guides" tab (top tabs)
2. Observe "Symptom Guides" section
3. Tap on a guide card (e.g., "Battery Problems")
4. Observe expanded content
5. Tap again to collapse
6. Scroll to see all 17 guides

**Expected**:
- ✅ "Tap to expand" hint visible next to "Symptom Guides" header
- ✅ All guides start collapsed (2-line summary)
- ✅ Badges visible when collapsed: "✅ What we check", "🛟 Is it safe?", "💵 How quotes work"
- ✅ Tapping expands the guide
- ✅ Chevron rotates from 0° to 90° (› to ›)
- ✅ Expanded content shows:
  - Full summary
  - 🛟 Is it safe to drive? (with specific warnings)
  - ✅ What we'll check (detailed process)
  - 💵 How quotes work (price ranges like "$150-$300")
- ✅ Tapping again collapses the guide
- ✅ All 17 guides visible

**Pass/Fail**: ___________

---

### **Test 6: Content Quality - Plain English**

**Steps**:
1. In Education > Guides tab
2. Expand "Battery Problems" guide
3. Read the content

**Expected**:
- ✅ No technical jargon (no "solenoid", "parasitic draw")
- ✅ Specific price ranges visible (e.g., "$100-$200", "$300-$600")
- ✅ Safety warnings are clear (e.g., "Usually safe for short trips, but...")
- ✅ Conversational tone ("We'll test...", "You might...")
- ✅ Actionable advice ("Best to address it soon")

**Pass/Fail**: ___________

---

### **Test 7: Content Quality - Safety Warnings**

**Steps**:
1. In Education > Guides tab
2. Expand "Overheating" guide
3. Read the "Is it safe to drive?" section

**Expected**:
- ✅ Clear warning: "DO NOT DRIVE if overheating"
- ✅ Specific instructions: "Pull over safely, turn off the engine, wait 30 minutes"
- ✅ Consequence explained: "Continuing to drive can warp the head or blow the head gasket ($2,000+ repair)"
- ✅ Safety indicator dot is RED

**Pass/Fail**: ___________

---

### **Test 8: Edge Cases - Long Text**

**Steps**:
1. In Explore tab, search for "cooling"
2. Observe symptom cards with longer explainers
3. In Education > Guides, expand a guide with long content

**Expected**:
- ✅ Long explainers truncate to 2 lines with "..." in Explore tab
- ✅ Long guide summaries truncate to 2 lines when collapsed
- ✅ Full text visible when expanded
- ✅ No text overflow or layout breaking

**Pass/Fail**: ___________

---

### **Test 9: Edge Cases - Empty Search**

**Steps**:
1. In Explore tab, type "zzzzz" in search bar
2. Observe "No symptoms found" message
3. Tap "Clear Search" button

**Expected**:
- ✅ "No symptoms found" message displays
- ✅ 🔍 icon visible
- ✅ Helpful message: "Try a different search term or clear the search to see all symptoms."
- ✅ "Clear Search" button visible
- ✅ Tapping button clears search and shows all symptoms

**Pass/Fail**: ___________

---

### **Test 10: Performance - Scroll Smoothness**

**Steps**:
1. In Explore tab, scroll through all symptoms rapidly
2. In Education > Guides tab, scroll through all guides rapidly
3. Expand/collapse multiple guides quickly

**Expected**:
- ✅ Smooth scrolling (no lag or stuttering)
- ✅ Expand/collapse animations are smooth
- ✅ No frame drops
- ✅ Search filtering is instant (no delay)

**Pass/Fail**: ___________

---

### **Test 11: Accessibility - Touch Targets**

**Steps**:
1. In Explore tab, try tapping category headers
2. Try tapping symptom cards
3. Try tapping search bar and clear button
4. In Education > Guides, try tapping guide cards

**Expected**:
- ✅ All touch targets are at least 44x44 points
- ✅ Category headers are easy to tap
- ✅ Symptom cards are easy to tap
- ✅ Search bar and clear button are easy to tap
- ✅ Guide cards are easy to tap
- ✅ No accidental taps

**Pass/Fail**: ___________

---

### **Test 12: Accessibility - Text Readability**

**Steps**:
1. Review all text in Explore tab
2. Review all text in Education tab
3. Check color contrast

**Expected**:
- ✅ All text is readable (not too small)
- ✅ Color contrast is sufficient (text vs background)
- ✅ Font weights are appropriate (headings vs body)
- ✅ Line heights are comfortable (not cramped)

**Pass/Fail**: ___________

---

## 🐛 Bug Tracking

### **Bugs Found**

| # | Test Case | Description | Severity | Status |
|---|-----------|-------------|----------|--------|
| 1 |           |             |          |        |
| 2 |           |             |          |        |
| 3 |           |             |          |        |

---

## 📊 Test Results Summary

**Total Tests**: 12
**Passed**: ___________
**Failed**: ___________
**Pass Rate**: ___________%

---

## 🎯 Next Steps

### **If All Tests Pass**:
1. ✅ Mark Phase 5 as complete
2. ✅ Update progress document
3. ✅ Create final summary for user
4. ✅ Celebrate! 🎉

### **If Tests Fail**:
1. Document bugs in table above
2. Prioritize by severity (Critical > High > Medium > Low)
3. Fix critical and high severity bugs
4. Re-test
5. Update progress document

---

## 📝 Notes

- Test on both Android and iOS if possible
- Test in both light and dark mode if app supports it
- Test with different screen sizes if possible
- Take screenshots of any bugs found
- Note any performance issues (lag, stuttering, etc.)

---

## 🎉 Testing Complete!

**Tester**: ___________
**Date**: ___________
**Device**: ___________
**OS Version**: ___________
**App Version**: ___________

**Overall Assessment**: ___________

**Recommendations**: ___________
