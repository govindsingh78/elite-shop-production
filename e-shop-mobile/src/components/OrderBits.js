import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pill, T } from "@/components/ui";
import { productImageUrl } from "@/lib/config";
import { formatDate, formatDateTime, formatPrice, ORDER_STATUSES, PAYMENT_STATUSES, timeAgo } from "@/lib/format";
import { currentMilestone, MILESTONES, TRACKING_STATUSES, trackingLabel } from "@/lib/tracking";
import { colors, fonts, radius, shadow } from "@/theme";

export function OrderStatusPill({ status }) {
  const config = ORDER_STATUSES[status] || { label: status, color: colors.muted, background: colors.lineSoft };
  return <Pill label={config.label} color={config.color} background={config.background} />;
}

export function PaymentStatusPill({ status }) {
  const config = PAYMENT_STATUSES[status] || { label: status, color: colors.muted, background: colors.lineSoft };
  return <Pill label={config.label} color={config.color} background={config.background} />;
}

/** One order in a list. `amount` lets vendors show only their share of a mixed order. */
export function OrderCard({ order, onPress, amount, showCustomer }) {
  const latest = order.latest_tracking_event;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.orderCard, pressed && { opacity: 0.85 }]}>
      <View style={styles.orderTop}>
        <View style={{ flex: 1 }}>
          <T variant="h3">Order #{order.id}</T>
          <T variant="small">{formatDate(order.created_at)} · {order.items_count ?? order.items?.length ?? 0} item{(order.items_count ?? 0) === 1 ? "" : "s"}</T>
        </View>
        <OrderStatusPill status={order.status} />
      </View>
      {showCustomer ? (
        <View style={styles.customerRow}>
          <Ionicons name="person-circle-outline" size={18} color={colors.muted} />
          <T variant="body" numberOfLines={1} style={{ flex: 1, fontSize: 15 }}>{order.customer_name} · {order.city}</T>
        </View>
      ) : null}
      <View style={styles.orderBottom}>
        <View style={{ flex: 1 }}>
          {latest ? (
            <T variant="small" numberOfLines={1}>
              <Text style={{ color: colors.tealDark, fontFamily: fonts.bodyBold }}>{trackingLabel(latest.status)}</Text>
              {latest.location ? ` · ${latest.location}` : ""} · {timeAgo(latest.event_at || latest.created_at)}
            </T>
          ) : <T variant="small">Awaiting confirmation</T>}
        </View>
        <T variant="price">{formatPrice(amount ?? order.total)}</T>
      </View>
    </Pressable>
  );
}

/** Ordered item with thumbnail. */
/** One ordered item. `onReview` adds a "Rate & review" link (customers, delivered orders). */
export function OrderItemRow({ item, last, onReview }) {
  const image = productImageUrl(item.product?.image);
  return (
    <View style={[styles.itemRow, !last && styles.itemBorder]}>
      <View style={styles.itemThumb}>
        {image ? <Image source={{ uri: image }} style={styles.itemImage} /> : <Text style={styles.itemInitial}>{item.product_title?.charAt(0)}</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <T variant="title" numberOfLines={2}>{item.product_title}</T>
        {item.size ? <T variant="small" color={colors.text}>Size <T variant="strong">{item.size}</T></T> : null}
        <T variant="small">{item.sku ? `SKU ${item.sku} · ` : ""}{item.quantity} × {formatPrice(item.unit_price)}</T>
        {onReview ? (
          <Pressable onPress={onReview} hitSlop={6} style={styles.reviewLink} accessibilityRole="link">
            <Ionicons name="star" size={13} color="#b07a2a" />
            <Text style={styles.reviewLinkText}>Rate &amp; review</Text>
          </Pressable>
        ) : null}
      </View>
      <T variant="strong">{formatPrice(item.line_total)}</T>
    </View>
  );
}

/** Five-step delivery progress bar. */
export function MilestoneBar({ order }) {
  const cancelled = order.status === "cancelled";
  const reached = currentMilestone(order);
  return (
    <View>
      <View style={styles.milestones}>
        {MILESTONES.map((milestone, index) => {
          const done = !cancelled && index <= reached;
          return (
            <React.Fragment key={milestone.label}>
              {index > 0 ? <View style={[styles.milestoneLine, done && styles.milestoneLineDone]} /> : null}
              <View style={[styles.milestoneDot, done && styles.milestoneDotDone, !cancelled && index === reached && styles.milestoneDotCurrent]}>
                {done ? <Ionicons name="checkmark" size={13} color={colors.white} /> : null}
              </View>
            </React.Fragment>
          );
        })}
      </View>
      <View style={styles.milestoneLabels}>
        {MILESTONES.map((milestone, index) => (
          <Text key={milestone.label} style={[styles.milestoneLabel, !cancelled && index <= reached && { color: colors.emerald }]} numberOfLines={2}>{milestone.label}</Text>
        ))}
      </View>
      {cancelled ? <T variant="strong" color={colors.danger} style={{ marginTop: 10 }}>This order was cancelled.</T> : null}
    </View>
  );
}

/** Vertical list of tracking updates, newest first. `onDelete` shows a remove button (staff only). */
export function TrackingTimeline({ events = [], onDelete }) {
  if (!events.length) return <T variant="small">No tracking updates yet.</T>;
  return (
    <View>
      {events.map((event, index) => {
        const config = TRACKING_STATUSES[event.status];
        const first = index === 0;
        return (
          <View key={event.id} style={styles.event}>
            <View style={styles.eventRail}>
              <View style={[styles.eventIcon, first && styles.eventIconCurrent]}>
                <Ionicons name={config?.icon || "ellipse-outline"} size={15} color={first ? colors.white : colors.emerald} />
              </View>
              {index < events.length - 1 ? <View style={styles.eventLine} /> : null}
            </View>
            <View style={styles.eventBody}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <T variant="title">{trackingLabel(event.status)}</T>
                  <T variant="small">{formatDateTime(event.event_at || event.created_at)}{event.location ? ` · ${event.location}` : ""}</T>
                </View>
                {onDelete ? (
                  <Pressable onPress={() => onDelete(event)} hitSlop={8} accessibilityLabel="Remove this update">
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </Pressable>
                ) : null}
              </View>
              {event.description ? <T variant="body" style={{ marginTop: 3, fontSize: 15 }}>{event.description}</T> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function AddressBlock({ order }) {
  return (
    <View>
      <T variant="title">{order.customer_name}</T>
      <T variant="body">{order.address}</T>
      <T variant="body">{[order.city, order.state, order.postal_code].filter(Boolean).join(", ")}</T>
      {order.country ? <T variant="body">{order.country}</T> : null}
      {order.customer_phone ? <T variant="small" style={{ marginTop: 4 }}>{order.customer_phone}</T> : null}
      {order.customer_email ? <T variant="small">{order.customer_email}</T> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  reviewLink: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, alignSelf: "flex-start" },
  reviewLinkText: { color: "#b07a2a", fontFamily: fonts.bodyBold, fontSize: 13.5 },
  orderCard: { borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.lg, padding: 16, marginBottom: 12, backgroundColor: colors.white, ...shadow.card },
  orderTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  customerRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  orderBottom: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, borderTopWidth: 1, borderTopColor: colors.lineSoft, paddingTop: 12 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  itemThumb: { width: 56, height: 64, alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: 12, backgroundColor: colors.mint },
  itemImage: { width: "100%", height: "100%" },
  itemInitial: { color: colors.emerald, fontFamily: fonts.heading, fontSize: 20 },
  milestones: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
  milestoneDot: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.white },
  milestoneDotDone: { borderColor: colors.emerald, backgroundColor: colors.emerald },
  milestoneDotCurrent: { borderColor: colors.teal, backgroundColor: colors.tealDark, shadowColor: colors.teal, shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  milestoneLine: { flex: 1, height: 3, marginHorizontal: 2, borderRadius: 2, backgroundColor: colors.line },
  milestoneLineDone: { backgroundColor: colors.emerald },
  milestoneLabels: { flexDirection: "row", marginTop: 8 },
  milestoneLabel: { flex: 1, color: colors.muted, fontFamily: fonts.bodyBold, fontSize: 11.5, lineHeight: 14, textAlign: "center" },
  event: { flexDirection: "row", gap: 12 },
  eventRail: { alignItems: "center", width: 30 },
  eventIcon: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: colors.mint },
  eventIconCurrent: { backgroundColor: colors.emerald },
  eventLine: { flex: 1, width: 2, minHeight: 18, marginVertical: 3, backgroundColor: colors.line },
  eventBody: { flex: 1, paddingBottom: 18 },
});
