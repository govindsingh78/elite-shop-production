import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import BrandLogo from "@/components/BrandLogo";
import { colors, fonts, radius } from "@/theme";

/** Portal-specific welcome panel, the same wording as the website's sign-in pages. */
export const PORTAL_COPY = {
  customer: {
    badge: "Shopper account",
    heading: "Your wardrobe, beautifully organised.",
    perks: [["navigate-outline", "Track every order", "Live status from placed to delivered."], ["flash-outline", "Faster checkout", "Saved delivery addresses, ready to go."], ["card-outline", "Pay your way", "UPI, net banking or cash on delivery."]],
    gradient: ["#1f4a3d", "#0f241d"],
    accent: colors.teal,
  },
  vendor: {
    badge: "Seller hub",
    heading: "Grow your brand with Elitezaar.",
    perks: [["pricetags-outline", "List in minutes", "Products, photos and stock from your phone."], ["cube-outline", "Ship with confidence", "Manage orders and post live tracking updates."], ["stats-chart-outline", "See what sells", "Sales, low-stock alerts and recent orders."]],
    gradient: ["#3d4a2a", "#14271f"],
    accent: "#e0a458",
  },
  admin: {
    badge: "Store control",
    heading: "Everything your store needs, in one place.",
    perks: [["albums-outline", "Catalog & sellers", "Products, categories, brands and vendors."], ["navigate-outline", "Orders & tracking", "Fulfil orders and keep customers updated."], ["people-outline", "Customers & payments", "Accounts, roles and payment status."]],
    gradient: ["#26394b", "#101a24"],
    accent: "#a99bf0",
  },
};

export default function AuthHero({ portal = "customer", compact }) {
  const copy = PORTAL_COPY[portal];
  return (
    <LinearGradient colors={copy.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <BrandLogo light size={36} />
      <Text style={[styles.badge, { color: copy.accent, borderColor: copy.accent }]}>{copy.badge.toUpperCase()}</Text>
      <Text style={styles.heading}>{copy.heading}</Text>
      {!compact ? copy.perks.map(([icon, title, text]) => (
        <View key={title} style={styles.perk}>
          <View style={styles.perkIcon}><Ionicons name={icon} size={16} color="#d3b894" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.perkTitle}>{title}</Text>
            <Text style={styles.perkText}>{text}</Text>
          </View>
        </View>
      )) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: 22, marginBottom: 20 },
  badge: { alignSelf: "flex-start", marginTop: 18, borderWidth: 1, borderRadius: 30, paddingHorizontal: 10, paddingVertical: 3, fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.6, overflow: "hidden" },
  heading: { marginTop: 12, marginBottom: 6, color: "#f7f3e9", fontFamily: fonts.heading, fontSize: 24, lineHeight: 28, letterSpacing: -0.4 },
  perk: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 },
  perkIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: "rgba(255,255,255,0.08)" },
  perkTitle: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: 15 },
  perkText: { color: "#a9bbb0", fontFamily: fonts.body, fontSize: 14 },
});
