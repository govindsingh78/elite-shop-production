import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Card, T } from "@/components/ui";
import { BRAND } from "@/lib/config";
import { colors, fonts, radius } from "@/theme";

const call = (tel) => Linking.openURL(`tel:${tel}`).catch(() => {});

/** Helpline card with tap-to-call numbers. `audience` picks the wording for customers or sellers. */
export default function SupportCard({ audience = "customer", orderId, style }) {
  const copy = audience === "seller"
    ? { title: "Seller support", text: "Questions about listings, orders or payouts? Our team is a call away." }
    : { title: "Need help?", text: orderId ? `Call our helpline and quote order #${orderId}.` : "Questions about an order, delivery or payment? Call our helpline." };

  return (
    <Card style={style}>
      <View style={styles.head}>
        <View style={styles.icon}><Ionicons name="headset-outline" size={20} color={colors.emerald} /></View>
        <View style={{ flex: 1 }}>
          <T variant="h3">{copy.title}</T>
          <T variant="small">{copy.text}</T>
        </View>
      </View>
      <View style={styles.phones}>
        {BRAND.supportPhones.map((phone) => (
          <Pressable key={phone.tel} onPress={() => call(phone.tel)} accessibilityRole="button" accessibilityLabel={`Call ${phone.label}`}
            style={({ pressed }) => [styles.phone, pressed && { opacity: 0.8 }]}>
            <Ionicons name="call" size={15} color={colors.white} />
            <Text style={styles.phoneText}>{phone.label}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={() => Linking.openURL(`mailto:${BRAND.supportEmail}`).catch(() => {})} style={styles.email}>
        <Ionicons name="mail-outline" size={15} color={colors.tealDark} />
        <T variant="strong" color={colors.tealDark} style={{ fontSize: 14 }}>{BRAND.supportEmail}</T>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: colors.mint },
  phones: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  phone: { flexGrow: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: colors.emerald },
  phoneText: { color: colors.white, fontFamily: fonts.semi, fontSize: 15 },
  email: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12 },
});
