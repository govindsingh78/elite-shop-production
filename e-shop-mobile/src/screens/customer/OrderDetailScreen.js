import React, { useCallback, useEffect, useRef } from "react";
import { View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { AddressBlock, MilestoneBar, OrderItemRow, OrderStatusPill, PaymentStatusPill, TrackingTimeline } from "@/components/OrderBits";
import { Card, EmptyState, KeyValue, Loader, Notice, Row, Screen, T } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { formatDate, formatPrice, paymentMethodLabel, timeAgo } from "@/lib/format";
import { lastKnownLocation, trackingLabel } from "@/lib/tracking";
import { useLoad } from "@/lib/useLoad";
import { colors } from "@/theme";

const POLL_MS = 10000;

/** Customer order with live tracking: refreshes every 10 seconds while open and announces new updates. */
export default function CustomerOrderDetailScreen() {
  const { id } = useLocalSearchParams();
  const { request } = useAuth();
  const toast = useToast();
  const { data: order, loading, refreshing, error, reload, refresh } = useLoad(() => request(`/customer/orders/${id}`), [id, request]);
  const latestId = useRef(null);

  useEffect(() => {
    const newest = order?.tracking_events?.[0];
    if (!newest) return;
    if (latestId.current !== null && newest.id !== latestId.current) toast(`Update: ${trackingLabel(newest.status)}${newest.location ? ` · ${newest.location}` : ""}`, "info");
    latestId.current = newest.id;
  }, [order, toast]);

  useFocusEffect(useCallback(() => {
    const finished = order && ["delivered", "cancelled"].includes(order.status);
    if (finished) return undefined;
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.status]));

  if (loading) return <Loader />;
  if (error && !order) return <Screen><EmptyState icon="alert-circle-outline" title="Order unavailable" message={error} /></Screen>;

  const events = order.tracking_events || [];
  const location = lastKnownLocation(events);
  const live = !["delivered", "cancelled"].includes(order.status);

  return (
    <>
      <Stack.Screen options={{ title: `Order #${order.id}` }} />
      <Screen refreshing={refreshing} onRefresh={reload}>
        <Card>
          <Row justify="space-between" align="flex-start">
            <View style={{ flex: 1 }}>
              <T variant="label">Placed {formatDate(order.created_at)}</T>
              <T variant="h2" style={{ marginTop: 2 }}>{events[0] ? trackingLabel(events[0].status) : "Order placed"}</T>
              {events[0] ? <T variant="small">{timeAgo(events[0].event_at || events[0].created_at)}</T> : null}
            </View>
            <OrderStatusPill status={order.status} />
          </Row>
          <View style={{ marginTop: 18 }}><MilestoneBar order={order} /></View>
          {live ? (
            <Row gap={6} style={{ marginTop: 14 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.teal }} />
              <T variant="small">Live — updates appear automatically</T>
            </Row>
          ) : null}
        </Card>

        {(order.courier_name || order.tracking_number || order.estimated_delivery_date || location) ? (
          <Card style={{ marginTop: 12 }}>
            <T variant="h3" style={{ marginBottom: 4 }}>Shipment</T>
            {location ? <KeyValue label="Last seen" value={location} /> : null}
            {order.courier_name ? <KeyValue label="Courier" value={order.courier_name} /> : null}
            {order.tracking_number ? <KeyValue label="Tracking number" value={order.tracking_number} /> : null}
            {order.estimated_delivery_date ? <KeyValue label="Expected by" value={formatDate(order.estimated_delivery_date)} last /> : null}
          </Card>
        ) : null}

        <Card style={{ marginTop: 12 }}>
          <Row gap={8} style={{ marginBottom: 14 }}>
            <Ionicons name="navigate-outline" size={18} color={colors.emerald} />
            <T variant="h3">Tracking history</T>
          </Row>
          <TrackingTimeline events={events} />
        </Card>

        <Card style={{ marginTop: 12 }}>
          <Row justify="space-between">
            <T variant="h3">Items</T>
            <PaymentStatusPill status={order.payment_status} />
          </Row>
          {(order.items || []).map((item, index, list) => <OrderItemRow key={item.id} item={item} last={index === list.length - 1} />)}
          <KeyValue label="Subtotal" value={formatPrice(order.subtotal)} />
          <KeyValue label={order.shipping_method?.name ? `Delivery · ${order.shipping_method.name}` : "Delivery"} value={Number(order.shipping_amount) > 0 ? formatPrice(order.shipping_amount) : "Free"} />
          <KeyValue label="Payment" value={paymentMethodLabel(order.payment_method)} />
          <KeyValue label="Total" value={formatPrice(order.total)} strong last />
        </Card>

        {order.payment_method === "razorpay" && order.payment_status !== "paid" ? (
          <Notice tone="warning" title="Payment pending" message="This order hasn’t been paid online yet. You can pay in cash when it arrives." style={{ marginTop: 12 }} />
        ) : null}

        <Card style={{ marginTop: 12 }}>
          <T variant="h3" style={{ marginBottom: 8 }}>Delivery address</T>
          <AddressBlock order={order} />
          {order.notes ? <T variant="small" style={{ marginTop: 10 }}>Note: {order.notes}</T> : null}
        </Card>
      </Screen>
    </>
  );
}
