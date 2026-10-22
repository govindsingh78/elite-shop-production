import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { productImageUrl } from "@/lib/config";
import { discountOf, formatPrice } from "@/lib/format";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/context/ToastContext";
import { colors, fonts, radius } from "@/theme";

/** Storefront product tile with a quick "add to bag" button. */
export default function ProductCard({ product, width }) {
  const { addItem } = useCart();
  const toast = useToast();
  const image = productImageUrl(product.image);
  const discount = discountOf(product);
  const soldOut = product.qty !== null && product.qty !== undefined && Number(product.qty) <= 0;
  const lowStock = !soldOut && product.qty != null && Number(product.qty) <= 3;

  const quickAdd = () => {
    if (soldOut) return;
    addItem(product, 1);
    toast(`${product.title} added to your bag`);
  };

  return (
    <Pressable onPress={() => router.push(`/product/${product.id}`)} style={({ pressed }) => [styles.card, width && { width }, pressed && { opacity: 0.88 }]}>
      <View style={styles.media}>
        {image ? <Image source={{ uri: image }} style={styles.image} resizeMode="cover" /> : (
          <View style={styles.fallback}><Text style={styles.fallbackText}>{product.title?.charAt(0) || "E"}</Text></View>
        )}
        <View style={styles.badges}>
          {discount > 0 ? <Text style={[styles.badge, styles.badgeSale]}>−{discount}%</Text> : null}
          {soldOut ? <Text style={[styles.badge, styles.badgeMuted]}>Sold out</Text> : lowStock ? <Text style={[styles.badge, styles.badgeLight]}>Only {product.qty} left</Text> : null}
        </View>
        <Pressable onPress={quickAdd} disabled={soldOut} hitSlop={6} accessibilityLabel={`Add ${product.title} to bag`} style={({ pressed }) => [styles.quick, soldOut && { opacity: 0.4 }, pressed && { transform: [{ scale: 0.92 }] }]}>
          <Ionicons name="bag-add-outline" size={18} color={colors.white} />
        </Pressable>
      </View>
      <View style={styles.meta}>
        <Text style={styles.brand} numberOfLines={1}>{product.brand?.name || product.category?.name || "Elitezaar"}</Text>
        <Text style={styles.title} numberOfLines={2}>{product.title}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatPrice(product.price)}</Text>
          {discount > 0 ? <Text style={styles.compare}>{formatPrice(product.compare_price)}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1 },
  media: { aspectRatio: 0.8, overflow: "hidden", borderRadius: radius.lg, backgroundColor: "#eef1ec" },
  image: { width: "100%", height: "100%" },
  fallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.emeraldLight },
  fallbackText: { color: "rgba(255,255,255,0.25)", fontFamily: fonts.display, fontSize: 64 },
  badges: { position: "absolute", top: 10, left: 10, gap: 6, alignItems: "flex-start" },
  badge: { overflow: "hidden", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, fontFamily: fonts.bodyBold, fontSize: 12 },
  badgeSale: { color: colors.white, backgroundColor: "#c0533a" },
  badgeLight: { color: "#7a4a1f", backgroundColor: "#fff3e3" },
  badgeMuted: { color: colors.white, backgroundColor: "rgba(15,36,29,0.75)" },
  quick: { position: "absolute", right: 10, bottom: 10, width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: colors.emerald },
  meta: { paddingHorizontal: 2, paddingTop: 10 },
  brand: { color: colors.goldDeep, fontFamily: fonts.bodyBold, fontSize: 11.5, letterSpacing: 1.2, textTransform: "uppercase" },
  title: { marginTop: 2, color: colors.text, fontFamily: fonts.bodySemi, fontSize: 15.5, lineHeight: 19 },
  priceRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 6, marginTop: 4 },
  price: { color: colors.ink, fontFamily: fonts.heading, fontSize: 15.5 },
  compare: { color: colors.faint, fontFamily: fonts.body, fontSize: 13, textDecorationLine: "line-through" },
});
