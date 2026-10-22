import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { OrderCard } from "@/components/OrderBits";
import { Button, Card, ListRow, Loader, Notice, Pill, Row, Screen, SectionHeader, Stat, T } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { firstName, formatPriceShort } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { colors, fonts, radius } from "@/theme";

export default function VendorDashboardScreen() {
  const { request, user } = useAuth();
  const { data, loading, refreshing, error, reload } = useLoad(() => request("/vendor/dashboard"), [request], { refocus: true });
  const stats = data?.stats;

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <LinearGradient colors={["#3d4a2a", "#14271f"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <T variant="eyebrow" color="#e0a458">Seller hub</T>
        <Text style={styles.heroTitle}>Hello, {firstName(user?.name)}</Text>
        <T variant="body" color="#c9d3c7">{stats ? (stats.to_ship ? `${stats.to_ship} order${stats.to_ship === 1 ? "" : "s"} waiting to ship.` : "You’re all caught up on shipping.") : "Here’s how your store is doing."}</T>
        <Row gap={10} style={{ marginTop: 16 }}>
          <Button title="Add product" variant="gold" icon="add" small block={false} onPress={() => router.push("/vendor/product-form")} />
          <Button title="Orders" variant="light" icon="receipt-outline" small block={false} onPress={() => router.push("/vendor/orders")} />
        </Row>
      </LinearGradient>

      {error ? <Notice tone="error" message={error} style={{ marginTop: 14 }} /> : null}
      {loading ? <Loader /> : stats ? (
        <>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: 20 },
  heroTitle: { marginTop: 6, marginBottom: 4, color: colors.white, fontFamily: fonts.display, fontSize: 26, letterSpacing: -0.6 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16 },
});
