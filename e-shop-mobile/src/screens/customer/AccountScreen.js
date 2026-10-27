import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import AuthHero from "@/components/AuthHero";
import SupportCard from "@/components/SupportCard";
import { MilestoneBar, OrderCard, OrderStatusPill } from "@/components/OrderBits";
import { Button, Card, ListRow, Loader, Notice, Row, Screen, SectionHeader, Stat, T } from "@/components/ui";
import NotificationsRow from "@/components/NotificationsRow";
import { useAuth } from "@/context/AuthContext";
import { confirmAction } from "@/lib/confirm";
import { firstName, formatPriceShort, initials } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { trackingLabel } from "@/lib/tracking";
import { colors, fonts, radius } from "@/theme";

export default function AccountScreen() {
  const { isCustomer, portal } = useAuth();
  if (isCustomer) return <CustomerDashboard />;
  if (portal === "vendor" || portal === "admin") return <StaffNotice portal={portal} />;
  return <GuestAccount />;
}

function GuestAccount() {
  return (
    <Screen safeTop>
      <AuthHero portal="customer" />
      <Button title="Sign in" icon="log-in-outline" onPress={() => router.push("/login")} />
      <Button title="Create an account" variant="outline" icon="person-add-outline" onPress={() => router.push("/register")} style={{ marginTop: 10 }} />
      <Card style={{ marginTop: 22 }}>
        <T variant="label" style={{ marginBottom: 4 }}>Other portals</T>
        <ListRow icon="storefront-outline" title="Seller hub" subtitle="Manage your products and orders" onPress={() => router.push({ pathname: "/login", params: { portal: "vendor" } })} />
        <ListRow icon="sparkles-outline" title="Become a seller" subtitle="Open your Elitezaar store" onPress={() => router.push("/vendor-register")} />
        <ListRow icon="shield-checkmark-outline" title="Store admin" subtitle="Authorised staff only" onPress={() => router.push({ pathname: "/login", params: { portal: "admin" } })} last />
      </Card>
      <Card style={{ marginTop: 16 }}>
        <ListRow icon="information-circle-outline" title="About Elitezaar" subtitle="Our story and what we promise" onPress={() => router.push("/about")} />
        <ListRow icon="refresh-circle-outline" title="Return & refund policy" subtitle="Returns, refunds and cancellations" onPress={() => router.push("/return-policy")} />
        <ListRow icon="document-text-outline" title="Terms & conditions" subtitle="The terms for shopping and selling" onPress={() => router.push("/terms")} />
        <ListRow icon="lock-closed-outline" title="Privacy policy" subtitle="How we use and protect your data" onPress={() => router.push("/privacy")} last />
      </Card>
      <SupportCard style={{ marginTop: 16 }} />
    </Screen>
  );
}

function StaffNotice({ portal }) {
  const { signOut, user } = useAuth();
  return (
    <Screen safeTop>
      <AuthHero portal={portal} compact />
      <Notice tone="info" title={`Signed in as ${user?.name}`} message={`You’re using the ${portal === "admin" ? "admin" : "seller"} portal. Shopper accounts are separate.`} />
      <Button title={portal === "admin" ? "Open admin dashboard" : "Open seller hub"} icon="speedometer-outline" onPress={() => router.replace(`/${portal}`)} style={{ marginTop: 16 }} />
      <Button title="Sign out" variant="outline" icon="log-out-outline" onPress={signOut} style={{ marginTop: 10 }} />
    </Screen>
  );
}

function CustomerDashboard() {
  const { request, signOut, user } = useAuth();
  const { data, loading, refreshing, error, reload } = useLoad(() => request("/customer/dashboard"), [request], { refocus: true });

  const askSignOut = () => confirmAction({ title: "Sign out?", message: "Your bag stays saved on this phone.", confirmLabel: "Sign out", onConfirm: signOut });
  const activeOrder = data?.recent_orders?.find((order) => ["pending", "processing", "shipped"].includes(order.status));
  const stats = data?.stats;
  const address = data?.default_address;

  return (
    <Screen safeTop refreshing={refreshing} onRefresh={reload}>
      <LinearGradient colors={["#1f4a3d", "#0f241d"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Row gap={14}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials(user?.name)}</Text></View>
          <View style={{ flex: 1 }}>
            <T variant="eyebrow" color="#e0b77d">My account</T>
            <T variant="h2" color={colors.white} numberOfLines={1}>Hello, {firstName(user?.name)}</T>
            <T variant="small" color="#a9bbb0" numberOfLines={1}>{user?.email}</T>
          </View>
        </Row>
      </LinearGradient>

      {error ? <Notice tone="error" message={error} style={{ marginTop: 14 }} /> : null}
      {loading ? <Loader /> : stats ? (
        <>
          <View style={styles.stats}>
            <Stat icon="receipt-outline" label="Orders" value={stats.total_orders} />
            <Stat icon="time-outline" label="In progress" value={stats.active_orders} tone="teal" />
            <Stat icon="checkmark-done-outline" label="Delivered" value={stats.delivered_orders} tone="emerald" />
            <Stat icon="wallet-outline" label="Total spent" value={formatPriceShort(stats.total_spent)} tone="gold" />
          </View>

          {activeOrder ? (
            <Card style={{ marginTop: 16 }} onPress={() => router.push(`/customer/orders/${activeOrder.id}`)}>
              <Row justify="space-between" style={{ marginBottom: 14 }}>
                <View>
                  <T variant="label">On its way</T>
                  <T variant="h3">Order #{activeOrder.id}</T>
                </View>
                <OrderStatusPill status={activeOrder.status} />
              </Row>
              <MilestoneBar order={{ ...activeOrder, tracking_events: activeOrder.latest_tracking_event ? [activeOrder.latest_tracking_event] : [] }} />
              {activeOrder.latest_tracking_event ? (
                <T variant="small" style={{ marginTop: 12 }}>
                  Latest: {trackingLabel(activeOrder.latest_tracking_event.status)}{activeOrder.latest_tracking_event.location ? ` · ${activeOrder.latest_tracking_event.location}` : ""}
                </T>
              ) : null}
            </Card>
          ) : null}

          <View style={{ marginTop: 22 }}>
            <SectionHeader eyebrow="History" title="Recent orders" actionLabel={data.recent_orders.length ? "View all" : undefined} onAction={() => router.push("/customer/orders")} />
            {data.recent_orders.length ? data.recent_orders.slice(0, 3).map((order) => (
              <OrderCard key={order.id} order={order} onPress={() => router.push(`/customer/orders/${order.id}`)} />
            )) : (
              <Card><T variant="body">No orders yet.</T><Button title="Start shopping" small block={false} onPress={() => router.push("/shop")} style={{ marginTop: 12 }} /></Card>
            )}
          </View>

          {address ? (
            <Card style={{ marginTop: 10 }} onPress={() => router.push("/customer/addresses")}>
              <Row justify="space-between">
                <T variant="label">Default delivery address</T>
                <T variant="strong" color={colors.tealDark} style={{ fontSize: 14 }}>Manage</T>
              </Row>
              <T variant="title" style={{ marginTop: 6 }}>{address.full_name} · {address.label}</T>
              <T variant="body">{address.address}, {address.city}, {address.state} {address.postal_code}</T>
            </Card>
          ) : null}
        </>
      ) : null}

      <Card style={{ marginTop: 16 }}>
        <ListRow icon="receipt-outline" title="My orders" subtitle="Track deliveries and view past orders" onPress={() => router.push("/customer/orders")} />
        <NotificationsRow />
        <ListRow icon="location-outline" title="Addresses" subtitle={`${stats?.saved_addresses ?? "Your"} saved address${stats?.saved_addresses === 1 ? "" : "es"}`} onPress={() => router.push("/customer/addresses")} />
        <ListRow icon="person-outline" title="Profile" subtitle="Name and phone number" onPress={() => router.push("/customer/profile")} />
        <ListRow icon="key-outline" title="Password & sign-in" onPress={() => router.push("/change-password")} />
        <ListRow icon="information-circle-outline" title="About Elitezaar" subtitle="Our story and what we promise" onPress={() => router.push("/about")} />
        <ListRow icon="refresh-circle-outline" title="Return & refund policy" subtitle="Returns, refunds and cancellations" onPress={() => router.push("/return-policy")} />
        <ListRow icon="document-text-outline" title="Terms & conditions" subtitle="The terms for shopping and selling" onPress={() => router.push("/terms")} />
        <ListRow icon="lock-closed-outline" title="Privacy policy" subtitle="How we use and protect your data" onPress={() => router.push("/privacy")} />
        <ListRow icon="log-out-outline" title="Sign out" danger onPress={askSignOut} last />
      </Card>
      <SupportCard style={{ marginTop: 16 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: 20 },
  avatar: { width: 56, height: 56, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: "#e0b77d" },
  avatarText: { color: colors.ink, fontFamily: fonts.display, fontSize: 20 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16 },
});
