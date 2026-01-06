import React from "react";
import { useLocalSearchParams } from "expo-router";
import { ChatRoom } from "../../../components/chat/ChatRoom";

export default function CustomerJobChat() {
  const params = useLocalSearchParams<{ jobId?: string | string[] }>();
  const jobId = Array.isArray(params.jobId) ? params.jobId[0] : params.jobId;

  if (!jobId) {
    return null;
  }

  return (
    <ChatRoom
      jobId={jobId}
      role="customer"
      headerTitle="Chat"
      headerSubtitle="Message your mechanic"
      backRoute="/(customer)/(tabs)/inbox"
    />
  );
}