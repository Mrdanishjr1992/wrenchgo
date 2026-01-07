const fs = require('fs');
const content = fs.readFileSync('app/(mechanic)/quote-review.tsx', 'utf8');
const lines = content.split('\n');

// Find line 198 (after 'return;' and '}')
const insertAfter = 198;
const payoutCheck = `
      // Check if mechanic has payout setup
      const { data: profile } = await supabase
        .from("profiles")
        .select("stripe_account_id")
        .eq("id", userData.user.id)
        .single();

      if (!profile?.stripe_account_id) {
        Alert.alert(
          "Payout Setup Required",
          "Please set up your payout account before sending quotes.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Set Up Payout", onPress: () => router.push("/(mechanic)/payout-setup") },
          ]
        );
        setSubmitting(false);
        return;
      }
`;

lines.splice(insertAfter, 0, payoutCheck);
fs.writeFileSync('app/(mechanic)/quote-review.tsx', lines.join('\n'));
console.log('Done');
