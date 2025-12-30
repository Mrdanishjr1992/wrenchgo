# Legal Documents Integration - Status Report

## ✅ COMPLETED

### 1. Legal Documents Created
All legal documents have been created in `src/legal/`:
- ✅ `terms-of-service.ts` - Terms of Service
- ✅ `privacy-policy.ts` - Privacy Policy
- ✅ `refund-policy.ts` - Refund & Cancellation Policy
- ✅ `contractor-disclaimer.ts` - Independent Contractor Disclaimer
- ✅ `verification-disclaimer.ts` - Photo ID & Background Check Disclaimer
- ✅ `payments-disclosure.ts` - Payments & Fees Disclosure
- ✅ `index.ts` - Export file for all documents

**Contact Info:** hello@wrenchgoapp.com
**Governing Law:** Illinois
**Last Updated:** January 2025

### 2. Components Created
- ✅ `src/components/LegalDocumentViewer.tsx` - Reusable component for displaying legal documents with markdown support
- ✅ Installed `react-native-markdown-display` package

### 3. Legal Screens Created
- ✅ `app/(mechanic)/legal.tsx` - Legal documents screen for mechanics (includes all 6 documents)
- ✅ `app/(customer)/legal.tsx` - Legal documents screen for customers (excludes contractor disclaimer)

Both screens include:
- List of all relevant legal documents
- Tap to view in full-screen modal
- Contact email displayed
- Last updated date

---

## 🔄 NEXT STEPS (To Complete Integration)

### 1. Add "Legal" Button to Profile Screens

**For Mechanic Profile** (`app/(mechanic)/(tabs)/profile.tsx`):
Add a button before the `DeleteAccountButton` (around line 1562):

```tsx
<Pressable
  onPress={() => router.push("/(mechanic)/legal")}
  style={({ pressed }) => [
    card.container,
    {
      flexDirection: "row",
      alignItems: "center",
      padding: spacing.lg,
      marginBottom: spacing.md,
      opacity: pressed ? 0.7 : 1,
    },
  ]}
>
  <Ionicons name="document-text" size={24} color={colors.primary} />
  <Text style={[text.body, { color: colors.text, marginLeft: spacing.md, flex: 1 }]}>
    Legal & Privacy
  </Text>
  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
</Pressable>

<DeleteAccountButton variant="card" />
```

**For Customer Profile** (if exists):
Same button but navigate to `/(customer)/legal`

---

### 2. Update Sign-Up Flow

#### **Customer Sign-Up** (`app/(auth)/sign-up-customer.tsx` or similar):

Add Terms acceptance before account creation:

```tsx
const [acceptedTerms, setAcceptedTerms] = useState(false);
const [showTerms, setShowTerms] = useState(false);
const [showPrivacy, setShowPrivacy] = useState(false);

// In the form, before the submit button:
<View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
  <Pressable
    onPress={() => setAcceptedTerms(!acceptedTerms)}
    style={{
      width: 24,
      height: 24,
      borderWidth: 2,
      borderColor: colors.primary,
      borderRadius: 4,
      alignItems: "center",
      justifyContent: "center",
      marginRight: spacing.sm,
    }}
  >
    {acceptedTerms && <Ionicons name="checkmark" size={18} color={colors.primary} />}
  </Pressable>
  <Text style={[text.small, { color: colors.text, flex: 1 }]}>
    I agree to the{" "}
    <Text
      style={{ color: colors.primary, textDecorationLine: "underline" }}
      onPress={() => setShowTerms(true)}
    >
      Terms of Service
    </Text>
    {" "}and{" "}
    <Text
      style={{ color: colors.primary, textDecorationLine: "underline" }}
      onPress={() => setShowPrivacy(true)}
    >
      Privacy Policy
    </Text>
  </Text>
</View>

// Add modals:
<Modal visible={showTerms} animationType="slide" presentationStyle="pageSheet">
  <LegalDocumentViewer
    title="Terms of Service"
    content={TERMS_OF_SERVICE}
    onClose={() => setShowTerms(false)}
  />
</Modal>

<Modal visible={showPrivacy} animationType="slide" presentationStyle="pageSheet">
  <LegalDocumentViewer
    title="Privacy Policy"
    content={PRIVACY_POLICY}
    onClose={() => setShowPrivacy(false)}
  />
</Modal>

// In submit handler, check:
if (!acceptedTerms) {
  Alert.alert("Terms Required", "Please accept the Terms of Service and Privacy Policy to continue.");
  return;
}
```

#### **Mechanic Sign-Up**:
Same as customer, PLUS add Independent Contractor acknowledgment screen after basic info.

---

### 3. Add Photo ID Disclaimer

**In Photo ID Upload Screen** (wherever users upload ID):

Add disclaimer text above the upload button:

```tsx
<View style={[card.container, { padding: spacing.lg, marginBottom: spacing.md }]}>
  <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
    <Ionicons name="information-circle" size={20} color={colors.primary} style={{ marginRight: spacing.sm }} />
    <View style={{ flex: 1 }}>
      <Text style={[text.small, { color: colors.text, marginBottom: spacing.xs }]}>
        We require photo ID to promote accountability. This helps verify you're a real person but doesn't guarantee identity or safety.
      </Text>
      <Pressable onPress={() => setShowVerificationDisclaimer(true)}>
        <Text style={[text.small, { color: colors.primary, textDecorationLine: "underline" }]}>
          Learn more about verification
        </Text>
      </Pressable>
    </View>
  </View>
</View>

// Add modal:
<Modal visible={showVerificationDisclaimer} animationType="slide" presentationStyle="pageSheet">
  <LegalDocumentViewer
    title="Photo ID & Background Checks"
    content={VERIFICATION_DISCLAIMER}
    onClose={() => setShowVerificationDisclaimer(false)}
  />
</Modal>
```

---

### 4. Add Fee Breakdown to Payment Screen

**In Customer Payment Screen** (`app/(customer)/payment.tsx` or similar):

```tsx
<View style={[card.container, { padding: spacing.lg, marginBottom: spacing.md }]}>
  <Text style={[text.h3, { color: colors.text, marginBottom: spacing.md }]}>
    Payment Breakdown
  </Text>
  
  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm }}>
    <Text style={[text.body, { color: colors.text }]}>Mechanic's Quote</Text>
    <Text style={[text.body, { color: colors.text }]}>${quoteAmount.toFixed(2)}</Text>
  </View>
  
  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm }}>
    <Text style={[text.body, { color: colors.text }]}>Platform Fee</Text>
    <Text style={[text.body, { color: colors.text }]}>${platformFee.toFixed(2)}</Text>
  </View>
  
  {discount > 0 && (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm }}>
      <Text style={[text.body, { color: colors.success }]}>Promotional Discount</Text>
      <Text style={[text.body, { color: colors.success }]}>-${discount.toFixed(2)}</Text>
    </View>
  )}
  
  <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.sm }} />
  
  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md }}>
    <Text style={[text.body, { color: colors.text, fontWeight: "700" }]}>Total</Text>
    <Text style={[text.body, { color: colors.text, fontWeight: "700" }]}>${total.toFixed(2)}</Text>
  </View>
  
  <Pressable onPress={() => setShowPaymentsDisclosure(true)}>
    <Text style={[text.small, { color: colors.primary, textAlign: "center" }]}>
      How fees work
    </Text>
  </Pressable>
</View>

// Add modal:
<Modal visible={showPaymentsDisclosure} animationType="slide" presentationStyle="pageSheet">
  <LegalDocumentViewer
    title="Payments & Fees"
    content={PAYMENTS_DISCLOSURE}
    onClose={() => setShowPaymentsDisclosure(false)}
  />
</Modal>
```

**In Mechanic Quote Screen**:
Show what they'll receive after platform commission.

---

### 5. Add Independent Contractor Acknowledgment (Mechanics Only)

**In Mechanic Sign-Up Flow** (after basic info, before background check):

Create a new screen or modal:

```tsx
<View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg }}>
  <Text style={[text.h2, { color: colors.text, marginBottom: spacing.lg }]}>
    Important: You're an Independent Contractor
  </Text>
  
  <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xl }}>
    <View style={[card.container, { padding: spacing.lg, marginBottom: spacing.md }]}>
      <Ionicons name="briefcase" size={32} color={colors.primary} style={{ marginBottom: spacing.md }} />
      <Text style={[text.body, { color: colors.text, marginBottom: spacing.md }]}>
        As a mechanic on WrenchGo, you are an independent contractor, not an employee.
      </Text>
      <Text style={[text.body, { color: colors.text, marginBottom: spacing.sm }]}>
        This means:
      </Text>
      <Text style={[text.body, { color: colors.text, marginLeft: spacing.md }]}>
        • You set your own schedule and rates{"\n"}
        • You provide your own tools and equipment{"\n"}
        • You're responsible for your own taxes{"\n"}
        • You need your own insurance and licenses{"\n"}
        • You make your own business decisions
      </Text>
    </View>
    
    <Pressable onPress={() => setShowContractorDisclaimer(true)}>
      <Text style={[text.body, { color: colors.primary, textAlign: "center", marginBottom: spacing.lg }]}>
        Read Full Independent Contractor Terms
      </Text>
    </Pressable>
  </ScrollView>
  
  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: spacing.md }}>
    <Pressable
      onPress={() => setAcceptedContractor(!acceptedContractor)}
      style={{
        width: 24,
        height: 24,
        borderWidth: 2,
        borderColor: colors.primary,
        borderRadius: 4,
        alignItems: "center",
        justifyContent: "center",
        marginRight: spacing.sm,
      }}
    >
      {acceptedContractor && <Ionicons name="checkmark" size={18} color={colors.primary} />}
    </Pressable>
    <Text style={[text.body, { color: colors.text, flex: 1 }]}>
      I understand I'm an independent contractor, not an employee
    </Text>
  </View>
  
  <Pressable
    onPress={handleContinue}
    disabled={!acceptedContractor}
    style={[
      {
        backgroundColor: acceptedContractor ? colors.primary : colors.border,
        padding: spacing.md,
        borderRadius: radius.md,
        alignItems: "center",
      },
    ]}
  >
    <Text style={[text.body, { color: acceptedContractor ? "#fff" : colors.textSecondary, fontWeight: "600" }]}>
      Continue
    </Text>
  </Pressable>
</View>

// Add modal:
<Modal visible={showContractorDisclaimer} animationType="slide" presentationStyle="pageSheet">
  <LegalDocumentViewer
    title="Independent Contractor Terms"
    content={CONTRACTOR_DISCLAIMER}
    onClose={() => setShowContractorDisclaimer(false)}
  />
</Modal>
```

---

## 📋 QUICK CHECKLIST

Before launching:
- [ ] Add "Legal" button to mechanic profile screen
- [ ] Add "Legal" button to customer profile screen (if exists)
- [ ] Add Terms/Privacy acceptance to customer sign-up
- [ ] Add Terms/Privacy acceptance to mechanic sign-up
- [ ] Add Independent Contractor acknowledgment to mechanic sign-up
- [ ] Add Photo ID disclaimer to ID upload screens
- [ ] Add fee breakdown to customer payment screen
- [ ] Add fee breakdown to mechanic quote screen
- [ ] Test all legal document modals open correctly
- [ ] Test sign-up flow requires acceptance
- [ ] Verify all contact emails show hello@wrenchgoapp.com
- [ ] Verify all documents show "Last Updated: January 2025"

---

## 🎯 PRIORITY ORDER

1. **HIGH PRIORITY** (Required for launch):
   - Terms/Privacy acceptance in sign-up
   - Legal screen accessible from profile
   - Photo ID disclaimer on upload

2. **MEDIUM PRIORITY** (Should have):
   - Independent Contractor acknowledgment for mechanics
   - Fee breakdown on payment screens

3. **LOW PRIORITY** (Nice to have):
   - Contextual links to specific policies throughout app
   - In-app notifications when policies update

---

## 📝 NOTES

- All documents use plain English and mobile-friendly formatting
- Documents are stored as TypeScript constants for easy updates
- Markdown rendering allows for proper formatting
- Modal presentation provides good UX for reading long documents
- Contact email (hello@wrenchgoapp.com) is consistent across all documents
- Illinois is set as governing law
- No physical address included (as requested)
- Documents are production-ready but should be reviewed by a lawyer before launch

---

## 🚀 TO DEPLOY

1. Complete the integration steps above
2. Test all flows thoroughly
3. Have a lawyer review the documents (recommended)
4. Update "Last Updated" dates when making changes
5. Notify users of material changes via email/push notification

---

**All legal documents are ready to use!** Just need to integrate them into the UI flows as described above.
