/** Spend — quick-add from text (parser preview → save), recent transactions. */
import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api, ParsedDraft, Profile, Transaction } from "../api";
import { colors, fmt } from "../ui";

export default function SpendScreen({ profile, onChanged }: { profile: Profile; onChanged: () => void }) {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<ParsedDraft | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => setTxns(await api.transactions(60));
  useEffect(() => { load(); }, []);

  const catName = (id?: string) => profile.categories.find((c) => c.id === id)?.name ?? "Uncategorized";

  const preview = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      setDraft(await api.parseTransaction(text.trim()));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!draft || draft.amountMajor == null) return;
    await api.addTransaction({
      amount: draft.amountMajor,
      merchant: draft.merchantGuess,
      categoryId: draft.categoryId ?? undefined,
      source: "text",
      confidence: draft.confidence,
    });
    setDraft(null); setText("");
    await load(); onChanged();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={txns}
        keyExtractor={(t) => t.id}
        ListHeaderComponent={
          <View style={s.card}>
            <Text style={s.h2}>QUICK ADD</Text>
            <TextInput
              style={s.input}
              placeholder='e.g. Spent 950 on dinner · Aaj petrol pe 3000 kharch hua'
              placeholderTextColor={colors.dim}
              value={text}
              onChangeText={setText}
              onSubmitEditing={preview}
            />
            <Pressable style={[s.btn, s.primary]} onPress={preview} disabled={busy}>
              {busy ? <ActivityIndicator color="#06220f" /> : <Text style={s.btnText}>Preview</Text>}
            </Pressable>
            {draft ? (
              draft.amountMajor == null ? (
                <Text style={s.warnText}>Couldn't find an amount — try "Spent 950 on dinner".</Text>
              ) : (
                <View style={{ marginTop: 12 }}>
                  <View style={s.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.label}>{draft.merchantGuess}</Text>
                      <Text style={s.sub}>
                        {catName(draft.categoryId ?? undefined)} · confidence {Math.round(draft.confidence * 100)}%
                        {draft.confidence < 0.5 ? " — saving teaches the system" : ""}
                      </Text>
                    </View>
                    <Text style={[s.value, { color: colors.red }]}>−{fmt(Math.round(draft.amountMajor * 100), profile.currency)}</Text>
                  </View>
                  <Pressable style={[s.btn, s.primary]} onPress={save}>
                    <Text style={s.btnText}>Save transaction</Text>
                  </Pressable>
                </View>
              )
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>{item.merchant}</Text>
              <Text style={s.sub}>{catName(item.categoryId)} · {item.date} · {item.source}</Text>
            </View>
            <Text style={[s.value, { color: colors.red }]}>−{fmt(item.amount)}</Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
        ListEmptyComponent={<Text style={s.note}>No transactions yet — add your first above.</Text>}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        ListFooterComponent={<Text style={s.noteCenter}>{txns.length} recent · corrections update category learning</Text>}
      />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 14 },
  h2: { color: colors.dim, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 6 },
  input: { backgroundColor: colors.surface2, borderColor: colors.border, borderWidth: 1, borderRadius: 12, color: colors.text, paddingHorizontal: 14, paddingVertical: 12 },
  row: { flexDirection: "row", alignItems: "baseline", gap: 10, paddingVertical: 9 },
  label: { color: colors.text, fontSize: 15, fontWeight: "600" },
  sub: { color: colors.dim, fontSize: 12, marginTop: 2 },
  value: { color: colors.text, fontWeight: "700", fontVariant: ["tabular-nums"] },
  btn: { borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 12 },
  primary: { backgroundColor: colors.accent },
  btnText: { color: "#06220f", fontWeight: "700", fontSize: 15 },
  note: { color: colors.dim, fontSize: 13, marginTop: 8 },
  noteCenter: { color: colors.dim, fontSize: 11, textAlign: "center", marginTop: 12 },
  warnText: { color: colors.amber, marginTop: 10, fontSize: 13 },
});
