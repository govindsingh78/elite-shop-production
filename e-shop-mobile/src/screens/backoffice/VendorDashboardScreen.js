import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { OrderCard } from "@/components/OrderBits";
import { SellerAccountNotice } from "@/components/SellerBits";
import SupportCard from "@/components/SupportCard";
import { Button, Card, ListRow, Loader, Notice, Pill, Row, Screen, SectionHeader, Stat, T } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { formatRate } from "@/components/EarningsBits";
import { firstName, formatPrice, formatPriceShort } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { colors, fonts, radius } from "@/theme";

export default function VendorDashboardScreen() {
  const { request, user } = useAuth();
  const { data, loading, refreshing, error, reload } = useLoad(() => request("/vendor/dashboard"), [request], { refocus: true });
  const stats = data?.stats;
  // Until approved (or once deactivated) a seller can look around but not list products.
  const canSell = data?.account?.can_sell !== false;

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <LinearGradient colors={["#3d4a2a", "#14271f"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <T variant="eyebrow" color="#e0a458">Seller hub</T>
        <Text style={styles.heroTitle}>Hello, {firstName(user?.name)}</Text>
        <T variant="body" color="#c9d3c7">{stats ? (stats.to_ship ? `${stats.to_ship} order${stats.to_ship === 1 ? "" : "s"} waiting to ship.` : "You’re all caught up on shipping.") : "Here’s how your store is doing."}</T>
        <Row gap={10} style={{ marginTop: 16 }}>
          {canSell ? <Button title="Add product" variant="gold" icon="add" small block={false} onPress={() => router.push("/vendor/product-form")} /> : null}
          <Button title="Orders" variant="light" icon="receipt-outline" small block={false} onPress={() => router.push("/vendor/orders")} />
        </Row>
      </LinearGradient>

      {error ? <Notice tone="error" message={error} style={{ marginTop: 14 }} /> : null}
      <SellerAccountNotice account={data?.account} style={{ marginTop: 14 }} />
      {loading ? <Loader /> : stats ? (
        <>
          {canSell && stats.total_products === 0 ? (
            <Card style={{ marginTop: 14 }}>
              <T variant="h3">Start selling your products</T>
              <T variant="body" style={{ marginTop: 4 }}>List your first product today. It takes about a minute, and it goes live in the store once our team approves it.</T>
              <Button title="List your first product" icon="add" onPress={() => router.push("/vendor/product-form")} style={{ marginTop: 14 }} />
            </Card>
          ) : null}
          {canSell && (stats.pending_review || stats.rejected) ? (
            <Pressable onPress={() => router.push({ pathname: "/vendor/products", params: { approval: stats.rejected ? "rejected" : "pending" } })} style={({ pressed }) => [{ marginTop: 14 }, pressed && { opacity: 0.85 }]}>
              <Notice
                tone={stats.rejected ? "error" : "warning"}
                title={[
                  stats.pending_review ? `${stats.pending_review} listing${stats.pending_review === 1 ? "" : "s"} in review` : null,
                  stats.rejected ? `${stats.rejected} need${stats.rejected === 1 ? "s" : ""} changes` : null,
                ].filter(Boolean).join(" · ")}
                message={stats.rejected ? "See our team’s note, update the listing and save to resubmit." : "They appear in the store as soon as our team approves them."}
              />
            </Pressable>
          ) : null}
          {stats.balance_due !== 0 || stats.pending_earnings > 0 ? (
            <Pressable onPress={() => router.push("/vendor/earnings")} style={({ pressed }) => [{ marginTop: 14 }, pressed && { opacity: 0.85 }]}>
              <Notice
                tone="success"
                title={`${formatPrice(stats.balance_due)} due to you`}
                message={`${stats.pending_earnings > 0 ? `${formatPrice(stats.pending_earnings)} more once your current orders are delivered. ` : ""}Elitezaar’s commission is ${formatRate(stats.commission_rate)}. Tap to see your earnings.`}
              />
            </Pressable>
          ) : null}
          <View style={styles.stats}>
            <Stat icon="wallet-outline" label="Revenue" value={formatPriceShort(stats.revenue)} tone="gold" />
            <Stat icon="cube-outline" label="Units sold" value={stats.units_sold} />
            <Stat icon="receipt-outline" label="Orders" value={stats.total_orders} tone="teal" />
            <Stat icon="send-outline" label="To ship" value={stats.to_ship} tone={stats.to_ship ? "danger" : "emerald"} />
            <Stat icon="pricetags-outline" label="Live products" value={`${stats.active_products}/${stats.total_products}`} />
            <Stat icon="alert-circle-outline" label="Low stock" value={stats.low_stock} tone={stats.low_stock ? "danger" : "emerald"} />
          </View>

          <View style={{ marginTop: 22 }}>
            <SectionHeader eyebrow="Latest" title="Recent orders" actionLabel="All orders" onAction={() => router.push("/vendor/orders")} />
            {data.recent_orders.length ? data.recent_orders.map((order) => (
              <OrderCard key={order.id} order={order} showCustomer amount={order.vendor_subtotal} onPress={() => router.push(`/vendor/order/${order.id}`)} />
            )) : <Card><T variant="body">No orders yet — they’ll appear here as soon as someone buys your products.</T></Card>}
          </View>

          {data.low_stock_products.length ? (
            <Card style={{ marginTop: 10 }}>
              <T variant="h3" style={{ marginBottom: 4 }}>Running low</T>
              {data.low_stock_products.map((product, index) => (
                <ListRow
                  key={product.id}
                  icon="cube-outline"
                  title={product.title}
                  subtitle={`SKU ${product.sku}`}
                  right={<Pill label={`${product.qty} left`} color={colors.danger} background={colors.dangerSoft} />}
                  onPress={() => router.push({ pathname: "/vendor/product-form", params: { id: String(product.id) } })}
                  last={index === data.low_stock_products.length - 1}
                />
              ))}
            </Card>
          ) : null}
        </>
      ) : null}

      <SupportCard audience="seller" style={{ marginTop: 14 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: 20 },
  heroTitle: { marginTop: 6, marginBottom: 4, color: colors.white, fontFamily: fonts.display, fontSize: 26, letterSpacing: -0.6 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16 },
});
