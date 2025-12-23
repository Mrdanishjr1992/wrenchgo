import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../src/ui/theme";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable } from "react-native";

export default function CustomerTabsLayout() {
  const router = useRouter();
  return (

    <Tabs
      screenOptions={{
        headerShown: true,
        headerTitleAlign: "left",
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.text,

        headerRight: () => (
          <Pressable
            onPress={() => router.push("/(customer)/(tabs)/account")}
            hitSlop={12}
            style={{ paddingRight: 14 }}
          >
            <Ionicons
              name="person-circle-outline"
              size={28}
              color={colors.accent}
            />
          </Pressable>
        ),

        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 68,
          paddingTop: 10,
          paddingBottom: 12,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "700" },
      }}
    >
    <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          tabBarIcon: ({ color, size }) => <Ionicons name="search" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: "Jobs",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="mail" color={color} size={size} />
          ),
        }}
      />

      {/* hide these from tab bar but keep routes available */}
      <Tabs.Screen
        name="messages"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          href: null,
          headerRight: () => null, // hides it on Leads
        }}
      />  
      </Tabs>
  )
}
