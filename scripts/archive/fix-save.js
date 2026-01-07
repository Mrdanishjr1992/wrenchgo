const fs = require('fs');
let content = fs.readFileSync('app/(mechanic)/(tabs)/profile.tsx', 'utf8');

const oldText = `      Alert.alert("Saved", "Profile updated successfully.");`;

const newText = `      // Save tools
      await supabase.from("mechanic_tools").delete().eq("mechanic_id", userId);
      if (selectedTools.size > 0) {
        await supabase
          .from("mechanic_tools")
          .insert(Array.from(selectedTools).map((tool_key) => ({
            mechanic_id: userId,
            tool_key,
          })));
      }

      // Save safety measures
      await supabase.from("mechanic_safety").delete().eq("mechanic_id", userId);
      if (selectedSafety.size > 0) {
        await supabase
          .from("mechanic_safety")
          .insert(Array.from(selectedSafety).map((safety_key) => ({
            mechanic_id: userId,
            safety_key,
          })));
      }

      Alert.alert("Saved", "Profile updated successfully.");`;

content = content.replace(oldText, newText);
fs.writeFileSync('app/(mechanic)/(tabs)/profile.tsx', content);
console.log('Done');