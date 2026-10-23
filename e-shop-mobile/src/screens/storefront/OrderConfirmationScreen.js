import React from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import SupportCard from "@/components/SupportCard";
import { AddressBlock, OrderItemRow, PaymentStatusPill } from "@/components/OrderBits";
import { Button, Card, EmptyState, KeyValue, Notice, Row, Screen, T } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { firstName, formatPrice, paymentMethodLabel } from "@/lib/format";
import { colors } from "@/theme";

export default function OrderConfirmationScreen() {
  const { lastOrder: order } = useCart();
  const { isCustomer } = useAuth();

  if (!order) {
    return (
      <Screen safeTop>
        <EmptyState icon="receipt-outline" title="No recent order" message="Your confirmed orders appear in your account." actionLabel="Back to the store" onAction={() => router.replace("/")} />
      </Screen>
    );
  }

  const awaitingPayment = order.payment_method === "razorpay" && order.payment_status !== "paid";

  return (
    <Screen
      safeTop
      footer={(
        <View>
          {isCustomer ? <Button title="Track this order" icon="navigate-outline" onPress={() => router.replace(`/customer/orders/${order.id}`)} /> : null}
          <Button title="Continue shopping" variant={isCustomer ? "outline" : "primary"} onPress={() => router.replace("/")} style={isCustomer && { marginTop: 10 }} />
        </View>
      )}
    >
      <LinearGradient colors={["#1f4a3d", "#0a1f19"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.check}><Ionicons name="checkmark" size={34} color={colors.emerald} /></View>
        <T variant="eyebrow" color="#e0b77d" style={{ marginTop: 16 }}>Order #{order.id} confirmed</T>
        <T variant="h1" color={colors.white} center style={{ marginTop: 6 }}>Thank you, {firstName(order.customer_name)}!</T>
        <T variant="body" color="#b8c8be" center style={{ marginTop: 6 }}>
          {awaitingPayment ? "Your order is saved and waiting for payment." : "We’re getting your pieces ready. You’ll get updates at every step."}
        </T>
      </LinearGradient>

      {awaitingPayment ? <Notice tone="warning" title="Payment pending" message="Complete the payment from your order, or pay in cash when it arrives." style={{ marginTop: 14 }} /> : null}
      {!isCustomer ? <Notice tone="info" message={`We’ll send order updates to ${order.customer_email}.`} style={{ marginTop: 14 }} /> : null}

      <Card style={{ marginTop: 14 }}>
        <Row justify="space-between">
          <T variant="h3">Items</T>
          <PaymentStatusPill status={order.payment_status} />
        </Row>
        {(order.items || []).map((item, index, list) => <OrderItemRow key={item.id} item={item} last={index === list.length - 1} />)}
        <KeyValue label="Subtotal" value={formatPrice(order.subtotal)} />
        <KeyValue label="Delivery" value={Number(order.shipping_amount) > 0 ? formatPrice(order.shipping_amount) : "Free"} />
        <KeyValue label="Payment" value={paymentMethodLabel(order.payment_method)} />
        <KeyValue label="Total" value={formatPrice(order.total)} strong last />
      </Card>

      <Card style={{ marginTop: 12 }}>
        <T variant="h3" style={{ marginBottom: 8 }}>Delivering to</T>
        <AddressBlock order={order} />
      </Card>

      <SupportCard orderId={order.id} style={{ marginTop: 12 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", borderRadius: 28, paddingHorizontal: 20, paddingVertical: 28 },
  check: { width: 66, height: 66, alignItems: "center", justifyContent: "center", borderRadius: 33, backgroundColor: "#e0b77d" },
});
