import { useState } from "react";
import { View, Text, TextInput, Button, Alert, Pressable } from "react-native";
import * as Location from "expo-location";
import { router } from "expo-router";
import { supabase } from "../../src/lib/supabase";

const ISSUE_TITLES = [
  "No start / Battery",
  "Brakes",
  "Oil / Fluids",
  "Check engine light",
  "Overheating",
  "Tire / Flat",
  "Other",
];

export default function RequestService() {
  const [title, setTitle] = useState<string>(ISSUE_TITLES[0]);
  const [description, setDescription] = useState("");
  const [preferredTime, setPreferredTime] = useState("ASAP");
  const [loading, setLoading] = useState(false);

  const createJob = async () => {
    try {
      setLoading(true);

      // 1) Get signed-in user
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        Alert.alert("Not signed in", "Please sign in again.");
        router.replace("/(auth)/sign-in");
        return;
      }

      // 2) Get customer location
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permission needed", "Location permission is needed to create a service request.");
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      // PostGIS geography point expects lng lat
      const wkt = `POINT(${lng} ${lat})`;

      // 3) Insert into jobs table
      const { error } = await supabase.from("jobs").insert({
        customer_id: userId,
        title,
        description: description.trim() || null,
        preferred_time: preferredTime.trim() || null,
        status: "searching",
        location: wkt,
      });

      if (error) throw error;

      Alert.alert("Request posted", "Your service request is now searching for mechanics.");
      router.back();
    } catch (e: any) {
      Alert.alert("Create job error", e?.message ?? "Failed to create request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "700" }}>Request Service</Text>

      <Text style={{ fontWeight: "700" }}>Issue type</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {ISSUE_TITLES.map((t) => {
          const active = t === title;
          return (
            <Pressable
              key={t}
              onPress={() => setTitle(t)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderWidth: 1,
                borderRadius: 999,
                backgroundColor: active ? "#ddd" : "transparent",
              }}
            >
              <Text style={{ fontWeight: "600" }}>{t}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={{ fontWeight: "700" }}>Preferred time</Text>
      <TextInput
        value={preferredTime}
        onChangeText={setPreferredTime}
        placeholder="ASAP / Today / Tomorrow / 2pm…"
        style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
      />

      <Text style={{ fontWeight: "700" }}>Description</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the problem (sounds, symptoms, car model, etc.)"
        multiline
        style={{ borderWidth: 1, padding: 10, borderRadius: 8, minHeight: 110 }}
      />

      <Button title={loading ? "Posting…" : "Post Request"} onPress={createJob} disabled={loading} />
      <Button title="Cancel" onPress={() => router.back()} disabled={loading} />
    </View>
  );
}
