import React from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import NotificationsRow from "@/components/NotificationsRow";
import SupportCard from "@/components/SupportCard";
import { Card, ListRow, Row, Screen, T } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { BRAND, SITE_URL } from "@/lib/config";
import { confirmAction } from "@/lib/confirm";
import { initials } from "@/lib/format";
import { colors, fonts } from "@/theme";

/** Account menu for the seller hub and the admin panel. */
export default function MoreScreen({ portal }) {
  const { user, signOut } = useAuth();

  const askSignOut = () => confirmAction({
    title: "Sign out?",
    message: "You can sign back in any time.",
    confirmLabel: "Sign out",
    onConfirm: async () => {
      await signOut();
      router.replace("/");
    },
  });

  return (
    <Screen>
      <Card>
        <Row gap={14}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials(user?.name)}</Text></View>
          <View style={{ flex: 1 }}>
            <T variant="h3" numberOfLines={1}>{user?.name}</T>
            <T variant="small" numberOfLines={1}>{user?.email}</T>
            <T variant="label" color={portal === "admin" ? "#5b43a6" : colors.goldDeep} style={{ marginTop: 4 }}>{portal === "admin" ? "Store admin" : "Seller"}</T>
          </View>
        </Row>
      </Card>

      <Card style={{ marginTop: 14 }}>
        {portal === "admin" ? (
          <>
            <ListRow icon="people-outline" title="Users" subtitle="Customers, sellers and staff" onPress={() => router.push("/admin/users")} />
            <ListRow icon="shield-checkmark-outline" title="Security" subtitle="Sign-in log, locked accounts, blocked addresses" onPress={() => router.push("/admin/security")} />
            <ListRow icon="pulse-outline" title="Server & health" subtitle="Disk space, problems and speed" onPress={() => router.push("/admin/server")} />
            <ListRow icon="storefront-outline" title="Sellers" subtitle="Approve new sellers, deactivate accounts" onPress={() => router.push("/admin/sellers")} />
            <ListRow icon="pricetags-outline" title="Category requests" subtitle="Categories sellers asked for" onPress={() => router.push("/admin/category-requests")} />
            <ListRow icon="pie-chart-outline" title="Commissions" subtitle="Seller earnings and payouts" onPress={() => router.push("/admin/commissions")} />
            <ListRow icon="albums-outline" title="Catalog" subtitle="Categories, brands and shipping" onPress={() => router.push("/admin/catalog")} />
          </>
        ) : (
          <>
            <ListRow icon="wallet-outline" title="Earnings" subtitle="What you’ve earned and been paid" onPress={() => router.push("/vendor/earnings")} />
            <ListRow icon="briefcase-outline" title="Business & GST" subtitle="GSTIN and address for your invoices" onPress={() => router.push("/vendor/business")} />
            <ListRow icon="add-circle-outline" title="Add a product" subtitle="List something new" onPress={() => router.push("/vendor/product-form")} />
            <ListRow icon="pricetags-outline" title="Category requests" subtitle="Ask us to add a category you need" onPress={() => router.push("/vendor/category-requests")} />
          </>
        )}
        <NotificationsRow />
        <ListRow
          icon="cloud-upload-outline"
          title="Bulk upload"
          subtitle="Add many products from a spreadsheet, on the website"
          right={<Ionicons name="open-outline" size={18} color={colors.muted} />}
          onPress={() => Linking.openURL(`${SITE_URL}${portal === "admin" ? "/admin/bulk-products" : "/vendor/products/bulk"}`)}
        />
        <ListRow icon="storefront-outline" title="View the store" subtitle="See Elitezaar as shoppers do" onPress={() => router.push("/")} />
        <ListRow icon="information-circle-outline" title="About Elitezaar" subtitle="Our story and what we promise" onPress={() => router.push("/about")} />
        <ListRow icon="refresh-circle-outline" title="Return & refund policy" subtitle="Returns, refunds and cancellations" onPress={() => router.push("/return-policy")} />
        <ListRow icon="document-text-outline" title="Terms & conditions" subtitle="The terms for shopping and selling" onPress={() => router.push("/terms")} />
        <ListRow icon="lock-closed-outline" title="Privacy policy" subtitle="How we use and protect your data" onPress={() => router.push("/privacy")} />
        <ListRow icon="key-outline" title="Password & sign-in" onPress={() => router.push("/change-password")} />
        <ListRow icon="log-out-outline" title="Sign out" danger onPress={askSignOut} last />
      </Card>
      {portal === "vendor" ? <SupportCard audience="seller" style={{ marginTop: 14 }} /> : null}
      <T variant="small" center style={{ marginTop: 18 }}>{BRAND.name} · {BRAND.supportEmail}</T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 54, height: 54, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: colors.emerald },
  avatarText: { color: colors.white, fontFamily: fonts.display, fontSize: 19 },
});
