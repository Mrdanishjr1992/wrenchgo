import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform, Button 
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "../../../src/lib/supabase";

type Message = {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
};

export default function ChatScreen() {
  const router = useRouter();
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  const loadMessages = async () => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true });

    setMessages((data as Message[]) ?? []);
  };

  const sendMessage = async () => {
    if (!text.trim() || !userId) return;

    await supabase.from("messages").insert({
      job_id: jobId,
      sender_id: userId,
      body: text.trim(),
    });

    setText("");
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });

    loadMessages();

    const channel = supabase
      .channel("job-chat-" + jobId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `job_id=eq.${jobId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
    <View
      style={{
        padding: 12,
        borderBottomWidth: 1,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: "700" }}>Chat</Text>
      <Button title="Back" onPress={() => router.back()} />
    </View>

      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 12 }}
        renderItem={({ item }) => {
          const mine = item.sender_id === userId;
          return (
            <View
              style={{
                alignSelf: mine ? "flex-end" : "flex-start",
                backgroundColor: mine ? "#DCF8C6" : "#eee",
                padding: 10,
                borderRadius: 10,
                marginBottom: 6,
                maxWidth: "80%",
              }}
            >
              <Text>{item.body}</Text>
            </View>
          );
        }}
      />

      <View
        style={{
          flexDirection: "row",
          padding: 10,
          borderTopWidth: 1,
        }}
      >
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
          style={{
            flex: 1,
            borderWidth: 1,
            borderRadius: 20,
            paddingHorizontal: 12,
            marginRight: 8,
          }}
        />
        <Pressable
          onPress={sendMessage}
          style={{
            backgroundColor: "black",
            borderRadius: 20,
            paddingHorizontal: 16,
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
