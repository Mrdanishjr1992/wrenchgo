import { View, Image, Text } from "react-native";
import { colors, spacing, text } from "./theme";

export function LogoHeader({ subtitle }: { subtitle?: string }) {
  return (

<View
  style={{
    width: 80,
    height: 100,
    borderRadius: 20,
   // backgroundColor: "transparent", // 🔑 important
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
