import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { EarningsStats, HowEarningsWork, PendingNotice, RatePill } from "@/components/EarningsBits";
import { Button, Card, Loader, Notice, Screen, SectionHeader, T, TextField } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { formatPrice } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { colors, radius, shadow } from "@/theme";

/** Admin: every seller's sales, Elitezaar's commission and what's owed to them. */
export default function CommissionsScreen() {
  const { request } = useAuth();
  const { data, loading, refreshing, error, reload } = useLoad(() => request("/admin/commissions"), [request], { refocus: true });

  if (loading) return <Loader />;
  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      {error ? <Notice tone="error" message={error} style={{ marginBottom: 14 }} /> : null}
      {data ? (
        <>
          <T variant="body" style={{ marginBottom: 14 }}>What sellers have sold, Elitezaar’s share, and what you owe them.</T>
          <EarningsStats figures={data.totals} all />
          <PendingNotice figures={data.totals} style={{ marginTop: 12 }} />

          {/* Mounted with the loaded rate, so the field starts from it. */}
          <DefaultRateCard key={data.default_rate} rate={data.default_rate} onSaved={reload} />

          <SectionHeader eyebrow="Sellers" title="Who you owe" style={{ marginTop: 24 }} />
          {data.sellers.length ? data.sellers.map((seller) => (
            <Pressable key={seller.id} onPress={() => router.push(`/admin/commission/${seller.id}`)} style={({ pressed }) => [styles.seller, pressed && { opacity: 0.85 }]}>
              <View style={{ flex: 1 }}>
                <T variant="title" numberOfLines={1}>{seller.name}</T>
                <T variant="small" numberOfLines={1}>{seller.email}</T>
                <T variant="small">Sold {formatPrice(seller.sales)} · Paid {formatPrice(seller.paid)}</T>
                <View style={{ marginTop: 6, alignSelf: "flex-start" }}><RatePill seller={seller} defaultRate={data.default_rate} /></View>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <T variant="small">Owed</T>
                <T variant="price" color={seller.balance > 0 ? colors.emerald : colors.muted}>{formatPrice(seller.balance)}</T>
              </View>
            </Pressable>
          )) : <Card><T variant="body">No sellers yet. Sellers who sign up appear here.</T></Card>}
        </>
      ) : null}
    </Screen>
  );
}

function DefaultRateCard({ rate, onSaved }) {
  const { request } = useAuth();
  const toast = useToast();
  const [value, setValue] = useState(String(rate));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const result = await request("/admin/commissions/settings", { method: "PUT", body: { default_rate: value } });
      toast(result.message);
      onSaved();
    } catch (saveError) {
      setError(saveError.fieldErrors?.default_rate || saveError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ marginTop: 16 }}>
      <T variant="h3">Default commission</T>
      <T variant="small" style={{ marginBottom: 12 }}>For sellers without their own rate.</T>
      <TextField label="Commission on each sale (%)" keyboardType="decimal-pad" value={value} onChangeText={(text) => { setValue(text); setError(""); }} error={error} icon="pie-chart-outline" />
      <Button title="Save default" icon="checkmark" small loading={saving} onPress={save} />
      <View style={{ marginTop: 14 }}><HowEarningsWork /></View>
    </Card>
  );
}

const styles = StyleSheet.create({
  seller: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.lg, padding: 14, backgroundColor: colors.white, ...shadow.card },
});
