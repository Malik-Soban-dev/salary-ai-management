import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { api, getToken, setToken, Profile } from "./src/api";
import { colors } from "./src/ui";
import WelcomeScreen from "./src/screens/Welcome";
import HomeScreen from "./src/screens/Home";
import PlanScreen from "./src/screens/Plan";
import SpendScreen from "./src/screens/Spend";
import InsightsScreen from "./src/screens/Insights";
import ProfileScreen from "./src/screens/Profile";

const Tab = createBottomTabNavigator();
const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg, card: colors.surface, text: colors.text, primary: colors.accent, border: colors.border } };

const ICONS: Record<string, string> = { Home: "◉", Plan: "≡", Spend: "+", Insights: "◔", Profile: "☺" };

export default function App() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) {
        try {
          setProfile(await api.profile());
          setAuthed(true);
        } catch {
          await setToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const onAuthed = async (token: string) => {
    await setToken(token);
    setProfile(await api.profile());
    setAuthed(true);
  };

  if (loading) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        <Text style={{ color: colors.dim }}>Loading…</Text>
      </View>
    );
  }

  if (!authed) {
    return <WelcomeScreen onAuthed={onAuthed} />;
  }

  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.dim,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
          tabBarIcon: () => <Text style={{ fontSize: 16, color: colors.accent }}>{ICONS[route.name] ?? "•"}</Text>,
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        })}
      >
        <Tab.Screen name="Home" options={{ title: "Today" }}>
          {() => <HomeScreen profile={profile!} onChanged={refresh} key={`h${refreshKey}`} />}
        </Tab.Screen>
        <Tab.Screen name="Plan" options={{ title: "Salary Plan" }}>
          {() => <PlanScreen onChanged={refresh} key={`p${refreshKey}`} />}
        </Tab.Screen>
        <Tab.Screen name="Spend" options={{ title: "Spending" }}>
          {() => <SpendScreen profile={profile!} onChanged={refresh} key={`s${refreshKey}`} />}
        </Tab.Screen>
        <Tab.Screen name="Insights" options={{ title: "Insights" }}>
          {() => <InsightsScreen onChanged={refresh} key={`i${refreshKey}`} />}
        </Tab.Screen>
        <Tab.Screen name="Profile" options={{ title: "Profile" }}>
          {() => <ProfileScreen profile={profile!} onProfile={setProfile} onSignOut={() => setAuthed(false)} key={`pr${refreshKey}`} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
