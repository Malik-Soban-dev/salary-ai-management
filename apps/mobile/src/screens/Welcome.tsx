import React, { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../api";
import { colors } from "../ui";

export default function WelcomeScreen({ onAuthed }: { onAuthed: (token: string) => void }) {
  const [mode, setMode] = useState<"intro" | "in">("intro");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const res = await api.register(email.trim(), password, currency);
      onAuthed(res.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  };

  if (mode === "intro") {
    return (
      <View style={[s.wrap, s.center]}>
        <Text style={s.logo}>💸</Text>
        <Text style={s.h1}>Salary AI</Text>
        <Text style={s.tag}>I'll learn how you use money and turn each salary into a plan that adapts to your life.</Text>
        <Pressable style={[s.btn, s.primary]} onPress={() => setMode("in")}>
          <Text style={s.btnText}>Get started</Text>
        </Pressable>
        <Text style={s.note}>3-day free trial · your data stays yours</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.wrap}>
      <Text style={s.h2}>Create your account</Text>
      <Text style={s.label}>Email</Text>
      <TextInput style={s.input} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={colors.dim} />
      <Text style={s.label}>Password</Text>
      <TextInput style={s.input} secureTextEntry value={password} onChangeText={setPassword} placeholder="min 8 characters" placeholderTextColor={colors.dim} />
      <Text style={s.label}>Currency</Text>
      <View style={s.pills}>
        {["USD", "PKR", "EUR", "GBP", "INR", "AED", "JPY"].map((c) => (
          <Pressable key={c} onPress={() => setCurrency(c)} style={[s.pill, c === currency && s.pillOn]}>
            <Text style={[s.pillText, c === currency && { color: colors.accent }]}>{c}</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
      <Pressable style={[s.btn, s.primary, busy && { opacity: 0.5 }]} disabled={busy} onPress={submit}>
        {busy ? <ActivityIndicator color="#06220f" /> : <Text style={s.btnText}>Create account</Text>}
      </Pressable>
      <Text style={s.note}>By continuing you accept the 3-day trial and subscription terms shown in-app.</Text>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: "center" },
  center: { alignItems: "center" },
  logo: { fontSize: 48, marginBottom: 8 },
  h1: { fontSize: 28, fontWeight: "800", color: colors.text, marginBottom: 8 },
  h2: { fontSize: 22, fontWeight: "800", color: colors.text, marginBottom: 16 },
  tag: { color: colors.dim, textAlign: "center", marginBottom: 32, lineHeight: 20 },
  label: { color: colors.dim, fontWeight: "600", fontSize: 13, marginTop: 14, marginBottom: 4 },
  input: { backgroundColor: colors.surface2, borderColor: colors.border, borderWidth: 1, borderRadius: 12, color: colors.text, paddingHorizontal: 14, paddingVertical: 12 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  pillOn: { borderColor: colors.accent },
  pillText: { color: colors.dim, fontWeight: "600", fontSize: 13 },
  btn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 20 },
  primary: { backgroundColor: colors.accent },
  btnText: { color: "#06220f", fontWeight: "700", fontSize: 16 },
  note: { color: colors.dim, fontSize: 12, textAlign: "center", marginTop: 14 },
  error: { color: colors.amber, marginTop: 12 },
});
