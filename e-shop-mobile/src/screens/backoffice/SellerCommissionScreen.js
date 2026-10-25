import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { EarningsStats, PAYOUT_METHODS, PayoutRow, PendingNotice, RatePill, SalesList, formatRate } from "@/components/EarningsBits";
import { Button, Card, Loader, Notice, Row, Screen, SelectField, T, TextField } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { confirmAction } from "@/lib/confirm";
import { formatPrice } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { colors } from "@/theme";

/** Admin: one seller's sales, rate and payouts, and recording a new payout. */
export default function SellerCommissionScreen() {
  const { id } = useLocalSearchParams();
  const { request } = useAuth();
  const toast = useToast();
  const { data, loading, refreshing, error, reload } = useLoad(() => request(`/admin/commissions/sellers/${id}`), [id, request]);

  if (loading) return <Loader />;
  if (!data) return <Screen><Notice tone="error" message={error || "This seller couldn’t be loaded."} /></Screen>;
  const { seller } = data;

  const removePayout = (payout) => confirmAction({
    title: `Remove the ${formatPrice(payout.amount)} payout?`,
    message: "The amount will be owed to the seller again.",
    confirmLabel: "Remove",
    onConfirm: async () => {
      try {
        const result = await request(`/admin/commissions/payouts/${payout.id}`, { method: "DELETE" });
        toast(result.message, "info");
        reload();
      } catch (removeError) {
        toast(removeError.message, "error");
      }
    },
  });

  return (
    <Screen keyboard refreshing={refreshing} onRefresh={reload}>
      <Stack.Screen options={{ title: seller.name }} />
      <Card style={{ marginBottom: 14 }}>
        <T variant="h2">{seller.name}</T>
        <T variant="small">{seller.email}</T>
        <View style={{ marginTop: 8, alignSelf: "flex-start" }}><RatePill seller={seller} defaultRate={data.default_rate} /></View>
      </Card>
      <EarningsStats figures={seller} />
      <PendingNotice figures={seller} style={{ marginTop: 12 }} />

      {/* Keyed on the balance, so the form starts fresh after each payout. */}
      <PayoutCard key={`payout-${seller.balance}`} seller={seller} onSaved={reload} />
      <RateCard key={`rate-${seller.commission_rate}`} seller={seller} defaultRate={data.default_rate} onSaved={reload} />

      <Card style={{ marginTop: 14 }}>
        <T variant="h3">Payouts</T>
        {data.payouts.length
          ? data.payouts.map((payout, index) => <PayoutRow key={payout.id} payout={payout} last={index === data.payouts.length - 1} onRemove={removePayout} />)
          : <T variant="body" style={{ marginTop: 6 }}>No payouts recorded yet.</T>}
      </Card>

      <Card style={{ marginTop: 14 }}>
        <T variant="h3">Sales</T>
        <SalesList
          firstPage={data.items}
          fetchPage={async (page) => (await request(`/admin/commissions/sellers/${id}`, { query: { page } })).items}
          onItemPress={(item) => router.push(`/admin/order/${item.order_id}`)}
        />
      </Card>
    </Screen>
  );
}

function PayoutCard({ seller, onSaved }) {
  const { request } = useAuth();
  const toast = useToast();
  const [values, setValues] = useState({ amount: "", method: "upi", reference: "", note: "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const owed = seller.balance > 0;

  const change = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const result = await request(`/admin/commissions/sellers/${seller.id}/payouts`, { method: "POST", body: values });
      toast(`${formatPrice(result.payout.amount)} payout recorded`);
      onSaved();
    } catch (saveError) {
      setErrors(Object.keys(saveError.fieldErrors || {}).length ? saveError.fieldErrors : { general: saveError.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ marginTop: 14 }}>
      <T variant="h3">Record a payout</T>
      <T variant="small" style={{ marginBottom: 12 }}>After you’ve sent the money by UPI or bank transfer. It’s dated today.</T>
      {errors.general ? <Notice tone="error" message={errors.general} style={{ marginBottom: 10 }} /> : null}
      {owed ? (
        <>
          <TextField label="Amount (₹)" keyboardType="decimal-pad" value={values.amount} onChangeText={(text) => change("amount", text)} error={errors.amount} icon="cash-outline" placeholder={seller.balance.toFixed(2)} />
          {!values.amount ? (
            <Pressable onPress={() => change("amount", seller.balance.toFixed(2))} hitSlop={6} style={{ alignSelf: "flex-start", marginTop: -6, marginBottom: 12 }}>
              <T variant="strong" color={colors.tealDark}>Pay full balance ({formatPrice(seller.balance)})</T>
            </Pressable>
          ) : null}
          <SelectField label="Method" value={values.method} options={Object.entries(PAYOUT_METHODS).map(([value, label]) => ({ value, label }))} onChange={(value) => change("method", value)} />
          <TextField label="Reference (optional)" value={values.reference} onChangeText={(text) => change("reference", text)} maxLength={120} placeholder="UPI or bank reference" />
          <TextField label="Note (optional)" value={values.note} onChangeText={(text) => change("note", text)} maxLength={500} placeholder="e.g. October sales" />
          <Button title="Record payout" icon="checkmark-done" loading={saving} onPress={save} />
        </>
      ) : <T variant="body">Nothing is owed to this seller right now.</T>}
    </Card>
  );
}

function RateCard({ seller, defaultRate, onSaved }) {
  const { request } = useAuth();
  const toast = useToast();
  const [value, setValue] = useState(seller.commission_rate === null ? "" : String(seller.commission_rate));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (rate) => {
    setSaving(true);
    setError("");
    try {
      const result = await request(`/admin/commissions/sellers/${seller.id}`, { method: "PUT", body: { commission_rate: rate } });
      toast(result.message);
      onSaved();
    } catch (saveError) {
      setError(saveError.fieldErrors?.commission_rate || saveError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ marginTop: 14 }}>
      <T variant="h3">Commission rate</T>
      <T variant="small" style={{ marginBottom: 12 }}>Applies to this seller’s new orders. Leave empty for the {formatRate(defaultRate)} default.</T>
      <TextField label="Custom rate (%)" keyboardType="decimal-pad" value={value} onChangeText={(text) => { setValue(text); setError(""); }} error={error} placeholder={String(defaultRate)} icon="pie-chart-outline" />
      <Row gap={10}>
        <Button title="Save rate" icon="checkmark" small block={false} loading={saving} onPress={() => save(value === "" ? null : value)} />
        {seller.commission_rate !== null ? <Button title="Use default" variant="outline" small block={false} disabled={saving} onPress={() => save(null)} /> : null}
      </Row>
    </Card>
  );
}
