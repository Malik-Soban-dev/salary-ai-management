/** Profile — settings, savings style, data rights, sign out. */
import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, Profile as ProfileT, setToken } from "../api";
import { colors } from "../ui";

export default function ProfileScreen({
  profile, onProfile, onSignOut,
}: { profile: ProfileT; onProfile: (p: ProfileT) => void; onSignOut: () => void }) {
  const [billing, setBilling] = useState<{ state: string; daysRemaining?: number } | null>(null);

  useState(() => { api.billing().then(setBilling).catch(() => {}); });

  const setStyle = async (style: string) => {
    onProfile(await api.updateProfile({ preferences: { savingsStyle: style } }));
  };

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ paddingBottom: 32 }}>
      <Text style={s.h1}>Profile</Text>

      <View style={s.card}>
        <Text style={s.h2}>TRIAL & BILLING</Text>
        <Text style={s.note}>
          {billing?.state === "active"
            ? "Subscription active — thanks for supporting the product."
            : billing?.state === "trialing"
              ? `Trial · ${billing.daysRemaining} day(s) left. Subscribe to keep full access after the trial.`
              : "Trial ended — subscribe to continue planning. Your data is preserved."}
        </Text>
        {billing?.state !== "active" ? (
          <Pressable style={[s.btn, s.primary]} onPress={async () => setBilling(await api.checkout())}>
            <Text style={s.btnText}>Subscribe (mock — real billing comes with store release)</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={s.card}>
        <Text style={s.h2}>WORLD SETTINGS</Text>
        <Text style={s.note}>{profile.locale.countryCode} · {profile.locale.language} · {profile.locale.timezone} · {profile.currency}</Text>
        <Text style={s.sub}>Currency, language and timezone are yours to change — the app never assumes a country. Full editors arrive with the settings release.</Text>
      </View>

      <View style={s.card}>
        <Text style={s.h2}>SAVINGS STYLE</Text>
        <View style={s.pills}>
          {["conservative", "balanced", "ambitious"].map((st) => (
            <Pressable key={st} onPress={() => setStyle(st)} style={[s.pill, st === profile.preferences.savingsStyle && s.pillOn]}>
              <Text style={[s.pillText, st === profile.preferences.savingsStyle && { color: colors.accent }]}>{st}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.sub}>Plans adapt gradually — no wild swings from one unusual month.</Text>
      </View>

      <View style={s.card}>
        <Text style={s.h2}>YOUR DATA</Text>
        <Text style={s.note}>All records are yours: export and deletion endpoints exist server-side and are wired into this app's release build.</Text>
        <Pressable style={s.ghostBtn} onPress={() => Alert.alert("Sign out", "Sign out of Salary AI on this device?", [
          { text: "Cancel", style: "cancel" },
          { text: "Sign out", style: "destructive", onPress: async () => { await setToken(null); onSignOut(); } },
        ])}>
          <Text style={{ color: colors.red, fontWeight: "600" }}>Sign out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  h1: { fontSize: 24, fontWeight: "800", color: colors.text },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 14 },
  h2: { color: colors.dim, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 6 },
  note: { color: colors.dim, fontSize: 13, lineHeight: 18 },
  sub: { color: colors.dim, fontSize: 12, marginTop: 6, lineHeight: 17 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  pillOn: { borderColor: colors.accent },
  pillText: { color: colors.dim, fontWeight: "600", fontSize: 13 },
  btn: { borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 12 },
  primary: { backgroundColor: colors.accent },
  btnText: { color: "#06220f", fontWeight: "700", fontSize: 14 },
  ghostBtn: { alignItems: "center", padding: 12, marginTop: 6 },
});
