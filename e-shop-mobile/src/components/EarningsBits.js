import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { OrderStatusPill } from "@/components/OrderBits";
import { Button, Notice, Pill, Stat, T } from "@/components/ui";
import { formatDate, formatPrice } from "@/lib/format";
import { colors, fonts, radius } from "@/theme";

export const PAYOUT_METHODS = { upi: "UPI", bank_transfer: "Bank transfer", cash: "Cash", other: "Other" };

/** 10 → "10%", 12.5 → "12.5%" */
export const formatRate = (rate) => `${Number(rate || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}%`;

/**
 * The four headline figures. `perspective` is "admin" (Elitezaar's view of one or all sellers) or "seller".
 */
export function EarningsStats({ figures, perspective = "admin", all = false }) {
  const tiles = perspective === "seller"
    ? [["balance", "Due to you", "wallet-outline", "emerald"], ["earnings", "Your earnings", "trending-up-outline", "teal"], ["commission", "Elitezaar commission", "pie-chart-outline", "gold"], ["paid", "Paid to you", "checkmark-done-outline", "emerald"]]
    : [["balance", all ? "Owed to sellers" : "Owed to seller", "wallet-outline", "emerald"], ["commission", "Your commission", "pie-chart-outline", "gold"], ["earnings", all ? "Sellers’ earnings" : "Seller’s earnings", "trending-up-outline", "teal"], ["paid", all ? "Paid to sellers" : "Paid out", "checkmark-done-outline", "emerald"]];
  return (
    <View style={styles.stats}>
      {tiles.map(([key, label, icon, tone]) => (
        <Stat key={key} icon={icon} label={label} value={formatPrice(figures[key])} tone={key === "balance" && figures.balance < 0 ? "danger" : tone} />
      ))}
    </View>
  );
}

export function PendingNotice({ figures, perspective = "admin", style }) {
  if (!(figures?.pending_earnings > 0)) return null;
  return (
    <Notice
      tone="info"
      style={style}
      message={perspective === "seller"
        ? `${formatPrice(figures.pending_earnings)} more will be due to you once your current orders are delivered.`
        : `${formatPrice(figures.pending_earnings)} more becomes payable once orders on the way are delivered.`}
    />
  );
}

export function RatePill({ seller, defaultRate }) {
  return seller.commission_rate === null
    ? <Pill label={`${formatRate(defaultRate ?? seller.effective_rate)} · default`} color={colors.emerald} background={colors.mint} />
    : <Pill label={`${formatRate(seller.commission_rate)} · custom`} color={colors.goldDeep} background={colors.goldSoft} />;
}

export function HowEarningsWork({ perspective = "admin" }) {
  const rules = [
    perspective === "seller"
      ? "Elitezaar keeps a commission on the price of each product you sell. Delivery charges aren’t included."
      : "Elitezaar keeps a commission on the price of each product a seller sells. Delivery charges aren’t included.",
    "Earnings become payable once an order is delivered. Cancelled orders don’t count.",
    perspective === "seller" ? "Each sale keeps the rate in force when it was ordered." : "Rate changes apply to new orders; each sale keeps the rate in force when it was ordered.",
  ];
  return rules.map((rule) => (
    <View key={rule} style={styles.rule}>
      <View style={styles.ruleDot} />
      <T variant="small" style={{ flex: 1 }}>{rule}</T>
    </View>
  ));
}

/** One product sold: the sale, Elitezaar's commission and the seller's earning. */
export function SoldItemRow({ item, last, onPress }) {
  const cancelled = item.order_status === "cancelled";
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && { opacity: 0.8 }]}>
      <View style={{ flex: 1 }}>
        <T variant="strong" numberOfLines={2} style={cancelled && styles.struck}>{item.product_title}</T>
        <T variant="small">Order #{item.order_id} · {formatDate(item.ordered_at)} · Qty {item.quantity}</T>
        <T variant="small">{formatPrice(item.line_total)} sale{item.commission_rate === null ? "" : ` · ${formatRate(item.commission_rate)} = ${formatPrice(item.commission_amount)}`}</T>
        <View style={{ marginTop: 6, alignSelf: "flex-start" }}><OrderStatusPill status={item.order_status} /></View>
      </View>
      <Text style={[styles.amount, cancelled && styles.struck]}>{formatPrice(item.earning)}</Text>
    </Pressable>
  );
}

/** The first page of sales from the screen's data, with "Show more" loading the next pages. */
export function SalesList({ firstPage, fetchPage, onItemPress }) {
  const [more, setMore] = useState({ base: firstPage, items: [], page: firstPage.current_page, last: firstPage.last_page });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // A reload brings a new first page: start again from it.
  if (more.base !== firstPage) setMore({ base: firstPage, items: [], page: firstPage.current_page, last: firstPage.last_page });

  const items = [...firstPage.data, ...more.items];
  const loadMore = async () => {
    setLoading(true);
    setError("");
    try {
      const next = await fetchPage(more.page + 1);
      setMore((current) => ({ ...current, items: [...current.items, ...next.data], page: next.current_page, last: next.last_page }));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  if (!items.length) return <T variant="body">No sales yet.</T>;
  return (
    <>
      {items.map((item, index) => (
        <SoldItemRow key={item.id} item={item} last={index === items.length - 1 && more.page >= more.last} onPress={onItemPress ? () => onItemPress(item) : undefined} />
      ))}
      {error ? <Notice tone="error" message={error} style={{ marginTop: 8 }} /> : null}
      {more.page < more.last ? <Button title="Show more" variant="outline" small loading={loading} onPress={loadMore} style={{ marginTop: 10 }} /> : null}
    </>
  );
}

export function PayoutRow({ payout, last, onRemove }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={styles.payoutIcon}><Ionicons name="checkmark-done" size={18} color={colors.emerald} /></View>
      <View style={{ flex: 1 }}>
        <T variant="strong">{formatPrice(payout.amount)}</T>
        <T variant="small">{formatDate(payout.paid_on)}{payout.method ? ` · ${PAYOUT_METHODS[payout.method] || payout.method}` : ""}</T>
        {payout.reference ? <T variant="small" numberOfLines={1}>Ref {payout.reference}</T> : null}
        {payout.note ? <T variant="small" numberOfLines={2}>{payout.note}</T> : null}
      </View>
      {onRemove ? (
        <Pressable onPress={() => onRemove(payout)} hitSlop={8} accessibilityLabel="Remove payout">
          <Ionicons name="trash-outline" size={19} color={colors.danger} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  rule: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  ruleDot: { width: 6, height: 6, marginTop: 8, borderRadius: 3, backgroundColor: colors.teal },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  amount: { color: colors.emerald, fontFamily: fonts.heading, fontSize: 16 },
  struck: { color: colors.faint, textDecorationLine: "line-through" },
  payoutIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.mint },
});
