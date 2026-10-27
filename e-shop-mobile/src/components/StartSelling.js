import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, T } from "@/components/ui";
import { colors, fonts, radius } from "@/theme";

const POINTS = ["Open your store in under a minute", "List products from your phone", "Track orders and earnings in your seller hub"];

/**
 * "Start selling your products — become our first seller today", in place of an empty store or collection.
 * `collection` is the collection's name when only that one is empty. (Sellers and admins never see the store
 * tabs: they're taken to their own hub, which has its own "Start selling" prompt.)
 */
export default function StartSelling({ collection, onBrowseAll, style }) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.icon}><Ionicons name="storefront-outline" size={28} color={colors.white} /></View>
      <T variant="eyebrow" center>{collection ? "New collection" : "Opening soon"}</T>
      <T variant="h1" center style={{ marginTop: 6 }}>{collection ? `Nothing in ${collection} yet` : "Start selling your products"}</T>
      <T variant="body" center style={{ marginTop: 8, maxWidth: 340 }}>
        {collection
          ? `Sell ${collection.toLowerCase()} on Elitezaar? Become the first seller in this collection today.`
          : "Become our first seller today. Open your Elitezaar store in under a minute, and your products will appear right here for shoppers."}
      </T>
      <Button title="Become a seller" icon="storefront-outline" onPress={() => router.push("/vendor-register")} style={{ marginTop: 20, alignSelf: "stretch" }} />
      <Pressable onPress={() => router.push({ pathname: "/login", params: { portal: "vendor" } })} hitSlop={8} style={{ marginTop: 14 }}>
        <T variant="strong" color={colors.tealDark}>Already selling? Sign in</T>
      </Pressable>
      <View style={styles.points}>
        {POINTS.map((point) => (
          <View key={point} style={styles.point}>
            <Ionicons name="checkmark-circle" size={16} color={colors.emerald} />
            <Text style={styles.pointText}>{point}</Text>
          </View>
        ))}
      </View>
      {collection && onBrowseAll ? (
        <Pressable onPress={onBrowseAll} hitSlop={8} style={{ marginTop: 16 }}>
          <T variant="small">Browse all products →</T>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: "center", borderWidth: 1, borderColor: "#eadfcc", borderRadius: radius.xl, paddingHorizontal: 20, paddingVertical: 28, backgroundColor: "#fffaf1" },
  icon: { width: 60, height: 60, alignItems: "center", justifyContent: "center", marginBottom: 14, borderRadius: 30, backgroundColor: colors.emerald },
  points: { alignSelf: "stretch", gap: 8, marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#efe6d6" },
  point: { flexDirection: "row", alignItems: "center", gap: 8 },
  pointText: { flex: 1, color: colors.body, fontFamily: fonts.body, fontSize: 14 },
});
