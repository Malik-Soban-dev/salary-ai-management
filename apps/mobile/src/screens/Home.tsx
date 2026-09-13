/** Home — safe-to-spend hero, trial banner, goal progress, grounded assistant entry. */
import React, { useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { api, Profile, SafeToSpend, GoalWithProjection } from "../api";
import { colors, fmt, monthName } from "../ui";

export default function HomeScreen({ profile, onChanged }: { profile: Profile; onChanged: () => void }) {
  const [sts, setSts] = useState<SafeToSpend | null>(null);
  const [goals, setGoals] = useState<GoalWithProjection[]>([]);
  const [billing, setBilling] = useState<{ state: string; daysRemaining?: number; trialEndsAt?: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const [a, b, c] = await Promise.all([api.safeToSpend(), api.goals(), api.billing()]);
      setSts(a); setGoals(b); setBilling(c);
    } finally {
      setRefreshing(false);
    }
  };
  useEffect(() => { load(); }, []);

  const cur = sts?.currency ?? profile.currency;
  const available = sts?.availableNow?.amountMinor ?? 0;

  return (
    <ScrollView
      style={s.wrap}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.dim} />}
    >
      {billing?.state === "trialing" ? (
        <View style={[s.card, s.trial]}>
          <View style={{ flex: 1 }}>
            <Text style={s.badge}>Trial · {billing.daysRemaining} day{(billing.daysRemaining ?? 1) === 1 ? "" : "s"} left</Text>
            <Text style={s.note}>Full access until {billing.trialEndsAt ? new Date(billing.trialEndsAt).toLocaleDateString() : "the trial ends"}. Your data stays yours.</Text>
          </View>
          <Pressable style={[s.btnSmall, s.primary]} onPress={async () => { const b = await api.checkout(); setBilling(b); }}>
            <Text style={s.btnSmallText}>Keep it</Text>
          </Pressable>
        </View>
      ) : billing?.state === "expired" ? (
        <View style={[s.card, s.trial]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.badge, s.badgeRed]}>Trial ended</Text>
            <Text style={s.note}>Subscribe to continue planning — your data is preserved.</Text>
          </View>
          <Pressable style={[s.btnSmall, s.primary]} onPress={async () => { const b = await api.checkout(); setBilling(b); onChanged(); }}>
            <Text style={s.btnSmallText}>Subscribe</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={[s.card, s.hero]}>
        <Text style={s.h2}>SAFE TO SPEND</Text>
        <Text style={[s.amount, available === 0 && { color: colors.amber }]}>{fmt(available, cur)}</Text>
        {sts && !sts.estimated ? (
          <>
            <Text style={s.dim}>≈ {fmt(sts.dailyRecommended)} / day for the next {sts.daysRemaining} days</Text>
            <View style={s.pillRow}>
              <Text style={s.pill}>Flexible left {fmt(sts.breakdown!.flexibleRemaining)}</Text>
              <Text style={s.pill}>Reserved {fmt(sts.breakdown!.reservedForUpcomingObligations)}</Text>
              {sts.breakdown!.overspend.amountMinor > 0 ? <Text style={[s.pill, { color: colors.red }]}>Overspent {fmt(sts.breakdown!.overspend)}</Text> : null}
            </View>
          </>
        ) : (
          <Text style={s.note}>{sts?.note ?? "Approve this month's plan to get exact numbers."}</Text>
        )}
      </View>

      <View style={s.card}>
        <Text style={s.h2}>GOALS</Text>
        {goals.length === 0 ? (
          <Text style={s.note}>No goals yet — add one from Insights.</Text>
        ) : (
          goals.map((g) => {
            const pct = Math.min(100, Math.round((g.savedAmountMinor / Math.max(1, g.targetAmountMinor)) * 100));
            return (
              <View key={g.id} style={{ marginBottom: 12 }}>
                <View style={s.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>{g.name}</Text>
                    <Text style={s.sub}>{pct}% · {fmt(g.monthlyPlannedMinor, g.currency)}/mo {g.projection.onTrack ? "" : "· behind pace"}</Text>
                  </View>
                  <Text style={s.value}>{fmt(g.savedAmountMinor, g.currency)}</Text>
                </View>
                <View style={s.bar}><View style={[s.barFill, { width: `${pct}%` }]} /></View>
              </View>
            );
          })
        )}
      </View>

      {sts && !sts.estimated ? (
        <Text style={s.footer}>{monthName(sts.period)} · engine v{sts.calculationVersion}</Text>
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 14 },
  hero: { backgroundColor: colors.surface2 },
  h2: { color: colors.dim, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  amount: { fontSize: 38, fontWeight: "800", color: colors.accent, marginTop: 6, fontVariant: ["tabular-nums"] },
  dim: { color: colors.dim, marginTop: 4, fontVariant: ["tabular-nums"] },
  note: { color: colors.dim, fontSize: 12, marginTop: 8, lineHeight: 17 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  pill: { fontSize: 11, color: colors.dim, backgroundColor: colors.bg, borderColor: colors.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: "hidden" },
  badge: { fontSize: 11, fontWeight: "700", color: colors.accent, backgroundColor: "rgba(34,197,94,0.13)", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, alignSelf: "flex-start" },
  badgeRed: { color: colors.red, backgroundColor: "rgba(248,113,113,0.12)" },
  trial: { flexDirection: "row", alignItems: "center", gap: 12 },
  row: { flexDirection: "row", alignItems: "baseline", gap: 10, paddingVertical: 6 },
  label: { color: colors.text, fontSize: 15, fontWeight: "600" },
  sub: { color: colors.dim, fontSize: 12, marginTop: 2 },
  value: { color: colors.text, fontWeight: "700", fontVariant: ["tabular-nums"] },
  bar: { height: 7, backgroundColor: colors.surface2, borderRadius: 99, overflow: "hidden", marginTop: 6 },
  barFill: { height: 7, backgroundColor: colors.accent, borderRadius: 99 },
  footer: { color: colors.dim, fontSize: 11, textAlign: "center", marginTop: 16 },
  btnSmall: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  primary: { backgroundColor: colors.accent },
  btnSmallText: { color: "#06220f", fontWeight: "700", fontSize: 13 },
});
