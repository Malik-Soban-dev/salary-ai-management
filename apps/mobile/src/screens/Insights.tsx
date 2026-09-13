/** Insights — month-end learning review + rollover, emergency fund, variance, assistant. */
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api, Insights, MonthEnd } from "../api";
import { colors, fmt, monthName } from "../ui";

interface ChatMsg { role: "user" | "ai"; text: string; meta?: string }

export default function InsightsScreen({ onChanged }: { onChanged: () => void }) {
  const [ins, setIns] = useState<Insights | null>(null);
  const [me, setMe] = useState<MonthEnd | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    (async () => {
      setIns(await api.insights());
      setMe(await api.monthEnd());
    })();
  }, []);

  if (!ins || !me) {
    return <View style={s.center}><ActivityIndicator color={colors.accent} /></View>;
  }

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setChat((c) => [...c, { role: "user", text }]);
    try {
      const sid = sessionId ?? (await api.startAiSession()).id;
      setSessionId(sid);
      const res = await api.sendAi(sid, text);
      setChat((c) => [...c, { role: "ai", text: res.reply, meta: `${res.provider} · grounded in ${res.recommendation.calculation_id}` }]);
    } catch (e) {
      setChat((c) => [...c, { role: "ai", text: e instanceof Error ? e.message : "Something went wrong" }]);
    }
  };

  const rollover = async () => {
    setRolling(true);
    try {
      await api.rollover();
      onChanged();
      setMe(await api.monthEnd());
      setChat((c) => [...c, { role: "ai", text: "✅ Applied learning and drafted next month's plan — open the Plan tab to review and approve." }]);
    } finally {
      setRolling(false);
    }
  };

  const cur = ins.currency;

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ paddingBottom: 32 }}>
      <Text style={s.h1}>Insights</Text>
      <Text style={s.sub}>{monthName(ins.period)} · {ins.transactionCount} transactions</Text>
      <View style={s.card}>
        <Text style={s.h2}>MONTH-END REVIEW</Text>
        {me.ready ? (
          <>
            <Text style={s.note}>Compared {me.evidence.categorizedInPeriod} categorized transactions against your plan — proposed adjustments for {monthName(me.nextPeriod)}:</Text>
            {me.proposals.map((p) => (
              <View key={p.categoryId} style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>{p.name}{p.material ? "  ★" : ""}</Text>
                  <Text style={s.sub}>{p.reason}</Text>
                </View>
                <Text style={s.value}>{p.fromWeight} → {p.toWeight}</Text>
              </View>
            ))}
            <Pressable style={[s.btn, s.primary, rolling && { opacity: 0.5 }]} disabled={rolling} onPress={rollover}>
              <Text style={s.btnText}>{rolling ? "Planning…" : `Plan ${monthName(me.nextPeriod)} with these adjustments`}</Text>
            </Pressable>
          </>
        ) : (
          <Text style={s.note}>{me.reason}</Text>
        )}
      </View>

      <View style={s.card}>
        <Text style={s.h2}>EMERGENCY FUND</Text>
        <View style={s.bar}><View style={[s.barFill, ins.emergency.progressPercent < 100 && { backgroundColor: colors.amber }, { width: `${Math.min(100, ins.emergency.progressPercent)}%` }]} /></View>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>{ins.emergency.progressPercent}%</Text>
            <Text style={s.sub}>{ins.emergency.essentialsCoverageMonths} months of essentials covered</Text>
          </View>
          <Text style={s.value}>{fmt(ins.emergency.current)} / {fmt(ins.emergency.target)}</Text>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.h2}>BUDGET VS ACTUAL</Text>
        {ins.variance ? ins.variance.lines.map((l) => (
          <View key={l.categoryId} style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>{l.name}</Text>
              <Text style={s.sub}>{l.percentUsed}% used</Text>
            </View>
            <Text style={[s.value, l.status === "over" ? { color: colors.red } : l.status === "on_track" ? { color: colors.accent } : { color: colors.dim }]}>
              {fmt(l.actual)} <Text style={{ color: colors.dim }}>/ {fmt(l.planned)}</Text>
            </Text>
          </View>
        )) : <Text style={s.note}>Approve a plan to compare against it.</Text>}
      </View>

      <View style={s.card}>
        <Text style={s.h2}>ASK YOUR ASSISTANT</Text>
        {chat.map((m, i) => (
          <View key={i} style={[s.msg, m.role === "user" ? s.msgUser : s.msgAi]}>
            <Text style={{ color: colors.text, fontSize: 13 }}>{m.text}</Text>
            {m.meta ? <Text style={s.msgMeta}>{m.meta}</Text> : null}
          </View>
        ))}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <TextInput style={[s.input, { flex: 1 }]} placeholder="Can I spend 5000 on shoes?" placeholderTextColor={colors.dim} value={input} onChangeText={setInput} onSubmitEditing={send} />
          <Pressable style={[s.btn, s.primary, { paddingHorizontal: 18, marginTop: 0, justifyContent: "center" }]} onPress={send}>
            <Text style={s.btnText}>Ask</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  h1: { fontSize: 24, fontWeight: "800", color: colors.text, marginBottom: 4 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 14 },
  h2: { color: colors.dim, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "baseline", gap: 10, paddingVertical: 7 },
  label: { color: colors.text, fontSize: 15 },
  sub: { color: colors.dim, fontSize: 12, marginTop: 2 },
  value: { color: colors.text, fontWeight: "700", fontVariant: ["tabular-nums"] },
  bar: { height: 8, backgroundColor: colors.surface2, borderRadius: 99, overflow: "hidden", marginTop: 4 },
  barFill: { height: 8, backgroundColor: colors.accent, borderRadius: 99 },
  note: { color: colors.dim, fontSize: 13, marginTop: 4, lineHeight: 18 },
  msg: { borderRadius: 14, padding: 10, marginTop: 8, maxWidth: "90%", fontSize: 13 },
  msgUser: { alignSelf: "flex-end", backgroundColor: colors.surface2 },
  msgAi: { alignSelf: "flex-start", backgroundColor: "rgba(34,197,94,0.08)", borderWidth: 1, borderColor: colors.border },
  msgMeta: { color: colors.dim, fontSize: 10, marginTop: 5 },
  input: { backgroundColor: colors.surface2, borderColor: colors.border, borderWidth: 1, borderRadius: 12, color: colors.text, paddingHorizontal: 14, paddingVertical: 11, marginTop: 6 },
  btn: { borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 12 },
  primary: { backgroundColor: colors.accent },
  btnText: { color: "#06220f", fontWeight: "700", fontSize: 14 },
});
