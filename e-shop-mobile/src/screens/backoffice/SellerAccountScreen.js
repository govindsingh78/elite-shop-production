import React, { useState } from "react";
import { View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { SellerStatusPill, sellerActions } from "@/components/SellerBits";
import { Button, Card, KeyValue, ListRow, Loader, Notice, Row, Screen, T, TextField } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { formatDate } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";

/** Admin: one seller's details and standing; approve, decline, deactivate or reactivate them. */
export default function SellerAccountScreen() {
  const { id } = useLocalSearchParams();
  const { request } = useAuth();
  const { data, loading, refreshing, error, reload } = useLoad(() => request(`/admin/sellers/${id}`), [id, request]);

  if (loading) return <Loader />;
  if (!data) return <Screen><Notice tone="error" message={error || "This seller couldn’t be loaded."} /></Screen>;
  const { seller } = data;
  const status = seller.seller_status;
  const hidden = status !== "approved";

  return (
    <Screen keyboard refreshing={refreshing} onRefresh={reload}>
      <Stack.Screen options={{ title: seller.name }} />
      <Card style={{ marginBottom: 14 }}>
        <T variant="h2">{seller.name}</T>
        <T variant="small">{seller.email}{seller.phone ? ` · ${seller.phone}` : ""}</T>
        <T variant="small">Joined {formatDate(seller.created_at)}</T>
        <View style={{ marginTop: 8, alignSelf: "flex-start" }}><SellerStatusPill status={status} /></View>
        {seller.seller_status_note && hidden ? (
          <Notice tone="error" style={{ marginTop: 12 }} title={`${status === "rejected" ? "Declined" : "Deactivated"} ${formatDate(seller.seller_status_at)}`} message={seller.seller_status_note} />
        ) : null}
      </Card>

      {/* Keyed on the status, so the reason box starts empty after each change. */}
      <StatusCard key={status} seller={seller} onChanged={reload} />

      <Card style={{ marginTop: 14 }}>
        <T variant="h3" style={{ marginBottom: 4 }}>Business & GST</T>
        <KeyValue label="Legal name" value={seller.legal_name || "Not added"} />
        <KeyValue label="GSTIN" value={seller.gstin || (seller.business_address ? "Not registered" : "Not added")} />
        <KeyValue label="State" value={seller.business_state_name || "—"} last={!seller.business_address} />
        {seller.business_address ? <KeyValue label="Address" value={seller.business_address} last /> : null}
      </Card>

      <Card style={{ marginTop: 14 }}>
        <T variant="h3" style={{ marginBottom: 4 }}>Selling</T>
        <KeyValue label="Approved products" value={`${seller.listed_products_count}${hidden && seller.listed_products_count ? " (hidden)" : ""}`} />
        <KeyValue label="All products" value={String(seller.products_count)} />
        <KeyValue label="Open orders" value={String(seller.open_orders)} strong={seller.open_orders > 0} last />
        {status === "approved" || status === "deactivated" ? (
          <ListRow icon="pie-chart-outline" title="Commission & payouts" onPress={() => router.push(`/admin/commission/${seller.id}`)} last />
        ) : null}
      </Card>
    </Screen>
  );
}

function StatusCard({ seller, onChanged }) {
  const { request } = useAuth();
  const toast = useToast();
  const [asking, setAsking] = useState(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  const actions = sellerActions(seller.seller_status);

  const change = async (action) => {
    setSaving(action.status);
    setError("");
    try {
      const result = await request(`/admin/sellers/${seller.id}/status`, { method: "PATCH", body: { status: action.status, note: action.reason ? reason : null } });
      toast(result.message);
      onChanged();
    } catch (changeError) {
      if (action.reason) setError(changeError.fieldErrors?.note || changeError.message);
      else toast(changeError.message, "error");
    } finally {
      setSaving("");
    }
  };

  const copy = {
    pending: "This seller signed up and is waiting for you. They can’t list products until you approve them.",
    approved: "Active: their approved products are in the store and they can handle their orders.",
    deactivated: "Their products are hidden from the store and they can’t change products or orders. Reactivate to bring their approved products back.",
    rejected: "You declined this application. You can still approve them later.",
  }[seller.seller_status];

  return (
    <Card>
      <T variant="h3">Seller account</T>
      <T variant="small" style={{ marginBottom: 12 }}>{copy}</T>
      {asking ? (
        <>
          <TextField label={asking.reason} hint="The seller sees this." multiline maxLength={500} value={reason} onChangeText={(text) => { setReason(text); setError(""); }} error={error} />
          {asking.status === "deactivated" && seller.open_orders > 0 ? (
            <Notice tone="warning" style={{ marginBottom: 12 }} message={`They have ${seller.open_orders} open order${seller.open_orders === 1 ? "" : "s"}. Deactivating doesn’t cancel ${seller.open_orders === 1 ? "it" : "them"} — you can manage ${seller.open_orders === 1 ? "it" : "them"} from Orders.`} />
          ) : null}
          <Row gap={10}>
            <Button title={asking.label} icon={asking.icon} variant="danger" small block={false} loading={saving === asking.status} onPress={() => change(asking)} />
            <Button title="Cancel" variant="ghost" small block={false} disabled={Boolean(saving)} onPress={() => { setAsking(null); setError(""); }} />
          </Row>
        </>
      ) : (
        <Row gap={10} style={{ flexWrap: "wrap" }}>
          {actions.map((action) => (
            <Button key={action.status} title={action.label} icon={action.icon} variant={action.variant} small block={false} loading={saving === action.status} disabled={Boolean(saving)} onPress={() => (action.reason ? setAsking(action) : change(action))} />
          ))}
        </Row>
      )}
    </Card>
  );
}
