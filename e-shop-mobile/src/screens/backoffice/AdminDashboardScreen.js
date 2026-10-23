import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { OrderCard } from "@/components/OrderBits";
import { Loader, Notice, Screen, SectionHeader, Stat, T } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { firstName, ORDER_STATUSES } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { colors, fonts, radius, shadow } from "@/theme";

const QUICK_ACTIONS = [
  ["add-circle-outline", "Add product", "/admin/product-form"],
  ["receipt-outline", "Orders", "/admin/orders"],
  ["albums-outline", "Catalog", "/admin/catalog"],
  ["people-outline", "Users", "/admin/users"],
];

export default function AdminDashboardScreen() {
  const { request, user } = useAuth();
  const { data, loading, refreshing, error, reload } = useLoad(async () => {
    const total = (path, query) => request(path, { query }).then((page) => Number(page.total || 0));
    const [orders, users, productPage, pending, processing, shipped] = await Promise.all([
      request("/admin/orders"),
      total("/admin/users"),
      request("/admin/products"),
      total("/admin/orders", { status: "pending" }),
      total("/admin/orders", { status: "processing" }),
      total("/admin/orders", { status: "shipped" }),
    ]);
    return {
      orders: Number(orders.total || 0),
      recent: (orders.data || []).slice(0, 5),
      users,
      products: Number(productPage.total || 0),
      awaitingReview: Number(productPage.approval_counts?.pending || 0),
      queue: { pending, processing, shipped },
    };
  }, [request], { refocus: true });

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <LinearGradient colors={["#26394b", "#101a24"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <T variant="eyebrow" color="#a99bf0">Store control</T>
        <Text style={styles.heroTitle}>Good to see you, {firstName(user?.name)}</Text>
        <T variant="body" color="#c3cdd8">{data ? `${data.queue.pending + data.queue.processing} order${data.queue.pending + data.queue.processing === 1 ? "" : "s"} need fulfilment.` : "Everything your store needs, in one place."}</T>
      </LinearGradient>

      <View style={styles.actions}>
        {QUICK_ACTIONS.map(([icon, label, path]) => (
          <Pressable key={label} onPress={() => router.push(path)} style={({ pressed }) => [styles.action, pressed && { opacity: 0.8 }]}>
            <View style={styles.actionIcon}><Ionicons name={icon} size={21} color={colors.emerald} /></View>
            <Text style={styles.actionText}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {error ? <Notice tone="error" message={error} style={{ marginTop: 14 }} /> : null}
      {loading ? <Loader /> : data ? (
        <>
          {data.awaitingReview ? (
            <Pressable onPress={() => router.push({ pathname: "/admin/products", params: { approval: "pending" } })} style={({ pressed }) => [{ marginTop: 14 }, pressed && { opacity: 0.85 }]}>
              <Notice tone="warning" title={`${data.awaitingReview} seller product${data.awaitingReview === 1 ? "" : "s"} awaiting review`} message="They stay hidden from shoppers until you approve them. Tap to review." />
            </Pressable>
          ) : null}
          <View style={styles.stats}>
            <Stat icon="receipt-outline" label="Orders" value={data.orders} tone="teal" style={styles.stat} />
            <Stat icon="pricetags-outline" label="Products" value={data.products} style={styles.stat} />
            <Stat icon="people-outline" label="Users" value={data.users} tone="gold" style={styles.stat} />
          </View>

          <SectionHeader eyebrow="Fulfilment" title="Order queue" style={{ marginTop: 22 }} />
          <View style={styles.queue}>
            {Object.entries(data.queue).map(([status, count]) => (
              <Pressable key={status} onPress={() => router.push({ pathname: "/admin/orders", params: { status } })} style={[styles.queueItem, { backgroundColor: ORDER_STATUSES[status].background }]}>
                <Text style={[styles.queueCount, { color: ORDER_STATUSES[status].color }]}>{count}</Text>
                <Text style={[styles.queueLabel, { color: ORDER_STATUSES[status].color }]}>{ORDER_STATUSES[status].label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={{ marginTop: 22 }}>
            <SectionHeader eyebrow="Latest" title="Recent orders" actionLabel="All orders" onAction={() => router.push("/admin/orders")} />
            {data.recent.length ? data.recent.map((order) => (
              <OrderCard key={order.id} order={order} showCustomer onPress={() => router.push(`/admin/order/${order.id}`)} />
            )) : <T variant="body">No orders yet.</T>}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: 20 },
  heroTitle: { marginTop: 6, marginBottom: 4, color: colors.white, fontFamily: fonts.display, fontSize: 25, letterSpacing: -0.6 },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  action: { flex: 1, alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.lg, paddingVertical: 14, backgroundColor: colors.white, ...shadow.card },
  actionIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: colors.mint },
  actionText: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 13 },
  stats: { flexDirection: "row", gap: 10, marginTop: 16 },
  stat: { minWidth: 0 },
  queue: { flexDirection: "row", gap: 10 },
  queueItem: { flex: 1, alignItems: "center", borderRadius: radius.lg, paddingVertical: 16 },
  queueCount: { fontFamily: fonts.display, fontSize: 26 },
  queueLabel: { fontFamily: fonts.bodyBold, fontSize: 13 },
});
