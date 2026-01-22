import React from "react";
import { useLocalSearchParams } from "expo-router";
import { ChatRoom } from "../../../components/chat/ChatRoom";

export default function MechanicJobChat() {
  const params = useLocalSearchParams<{ jobId?: string | string[] }>();
  const jobId = Array.isArray(params.jobId) ? params.jobId[0] : params.jobId;

  if (!jobId) {
    return null;
  }

  return (
    <ChatRoom
      jobId={jobId}
      role="mechanic"
      headerTitle="Chat"
      headerSubtitle="Message your customer"
      backRoute="/(mechanic)/(tabs)/inbox"
    />
  );
}