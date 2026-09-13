/** Plan — the hero screen: income → protected → future money → flexible → approve. */
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, Plan } from "../api";
import { colors, fmt, monthName } from "../ui";

export default function PlanScreen({ onChanged }: { onChanged: () => void }) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setBusy(true);
    try {
      const current = await api.currentPlan();
      setPlan(current ?? (await api.latestPlan()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load plan");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { load(); }, []);

  if (busy) return <View style={s.center}><ActivityIndicator color={colors.accent} /></View>;
  if (error) return <View style={s.center}><Text style={{ color: colors.amber }}>{error}</Text></View>;

  if (!plan) {
    return (
      <View style={s.wrap}>
        <Text style={s.h1}>Salary Plan</Text>
        <View style={[s.card, s.hero]}>
          <Text style={s.noteCenter}>Generate your first plan — obligations protected first, then safety, goals and flexible spending.</Text>
          <Pressable style={[s.btn, s.primary]} onPress={async () => { setBusy(true); setPlan(await api.generatePlan()); setBusy(false); }}>
            <Text style={s.btnText}>Generate plan</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const t = plan.totals;
  const isDraft = plan.status === "draft";

  return (
    <ScrollView style={s.wrap} contentContainerStyle={{ paddingBottom: 32 }}>
      <Text style={s.h1}>Salary Plan</Text>
      <Text style={s.subline}>
        {monthName(plan.period)} · <Text style={{ color: isDraft ? colors.amber : colors.accent, fontWeight: "700" }}>{plan.status}</Text> · engine v{plan.calculationVersion}
      </Text>

      {plan.warnings.map((w, i) => (
        <View key={i} style={s.warn}><Text style={s.warnText}>{w.message}</Text></View>
      ))}

      {(plan.adaptations ?? []).length > 0 ? (
        <View style={s.card}>
          <Text style={s.h2}>LEARNED FROM LAST MONTH</Text>
          {plan.adaptations!.map((a) => (
            <View key={a.categoryId} style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>{a.name}{a.material ? "  ★" : ""}</Text>
                <Text style={s.sub}>{a.reason}</Text>
              </View>
              <Text style={s.value}>{a.fromWeight} → {a.toWeight}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={s.card}>
        <Text style={s.h2}>INCOME</Text>
        <View style={s.row}><Text style={s.label}>Expected take-home</Text><Text style={s.value}>{fmt(t.income)}</Text></View>
      </View>

      <View style={s.card}>
        <Text style={s.h2}>PROTECTED MONEY</Text>
        {plan.allocations.obligations.map((o) => (
          <View key={o.recurringItemId} style={s.row}>
            <Text style={s.label}>{o.name}{o.dueDay ? `  (day ${o.dueDay})` : ""}</Text>
            <Text style={s.value}>{fmt(o.amount)}</Text>
          </View>
        ))}
        <View style={[s.row, { borderTopColor: colors.border, borderTopWidth: 1 }]}>
          <Text style={[s.label, { fontWeight: "800" }]}>Protected total</Text><Text style={s.value}>{fmt(t.protected)}</Text>
        </View>
      </View>

      <View style={s.card}>
        <Text style={s.h2}>FUTURE MONEY</Text>
        <View style={s.row}><Text style={s.label}>Emergency fund</Text><Text style={s.value}>{fmt(t.emergency)}</Text></View>
        {plan.allocations.goals.map((g) => (
          <View key={g.goalId} style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>{g.name}</Text>
              <Text style={s.sub}>priority {g.priority}{g.requiredMonthlyPaceMinor ? ` · pace ${fmt(g.requiredMonthlyPaceMinor, plan.currency)}/mo` : ""}</Text>
            </View>
            <Text style={[s.value, g.planned.amountMinor === 0 && { color: colors.dim }]}>{fmt(g.planned)}</Text>
          </View>
        ))}
        <View style={s.row}><Text style={s.label}>Buffer</Text><Text style={s.value}>{fmt(t.buffer)}</Text></View>
      </View>

      <View style={s.card}>
        <Text style={s.h2}>LIFE SPENDING</Text>
        {plan.allocations.flexible.map((f) => (
          <View key={f.categoryId} style={s.row}>
            <Text style={s.label}>{f.name}</Text><Text style={s.value}>{fmt(f.planned)}</Text>
          </View>
        ))}
        <View style={[s.row, { borderTopColor: colors.border, borderTopWidth: 1 }]}>
          <Text style={[s.label, { fontWeight: "800" }]}>Flexible total</Text><Text style={s.value}>{fmt(t.flexible)}</Text>
        </View>
      </View>

      {isDraft ? (
        <Pressable style={[s.btn, s.primary]} onPress={async () => { setPlan(await api.approvePlan(plan.id)); onChanged(); }}>
          <Text style={s.btnText}>Approve plan</Text>
        </Pressable>
      ) : (
        <Text style={s.noteCenter}>Approved {plan.approvedAt ? new Date(plan.approvedAt).toLocaleString() : ""}</Text>
      )}
      <Pressable style={s.ghostBtn} onPress={async () => { setBusy(true); await api.generatePlan(); await load(); }}>
        <Text style={{ color: colors.dim, fontWeight: "600" }}>Regenerate plan</Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  h1: { fontSize: 24, fontWeight: "800", color: colors.text },
  subline: { color: colors.dim, marginTop: 4, marginBottom: 4 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 12 },
  hero: { backgroundColor: colors.surface2 },
  h2: { color: colors.dim, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 4 },
  row: { flexDirection: "row", alignItems: "baseline", gap: 10, paddingVertical: 7 },
  label: { color: colors.text, fontSize: 15 },
  sub: { color: colors.dim, fontSize: 12, marginTop: 2 },
  value: { color: colors.text, fontWeight: "700", fontVariant: ["tabular-nums"] },
  warn: { borderColor: "rgba(251,191,36,0.35)", backgroundColor: "rgba(251,191,36,0.08)", borderRadius: 12, padding: 12, marginTop: 10 },
  warnText: { color: colors.amber, fontSize: 13 },
  btn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 14 },
  primary: { backgroundColor: colors.accent },
  btnText: { color: "#06220f", fontWeight: "700", fontSize: 16 },
  ghostBtn: { alignItems: "center", padding: 14, marginTop: 4 },
  noteCenter: { color: colors.dim, fontSize: 12, textAlign: "center", marginTop: 14 },
});
