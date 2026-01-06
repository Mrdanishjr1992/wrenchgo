import React from "react";
import { View, Image } from "react-native";

export function LogoHeader() {
  return (
    <View
      style={{
        width: 80,
        height: 100,
        borderRadius: 20,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Image
        source={require("../../assets/logo.png")}
        style={{
          width: "100%",
          height: "100%",
        }}
        resizeMode="contain"
      />
    </View>
  );
}
