import React from "react";
import { Pressable, Image, View } from "react-native";
import { lightColors } from "../ui/theme";

export function ProfileAvatar({
  uri,
  onPress,
}: {
  uri?: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          width: 180,
          height: 180,
          borderRadius: 20,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: lightColors.surface,
        }}
      >
        <Image
          source={
            uri
              ? { uri }
              : require("../../assets/profile.png")
          }
          style={{ width: "100%", height: "100%" }}
          resizeMode="contain"
        />
      </View>
    </Pressable>
  );
}
