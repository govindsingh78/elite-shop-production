import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { productImageUrl } from "@/lib/config";
import { discountOf, formatWholePrice } from "@/lib/format";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/context/ToastContext";
import WishlistButton from "@/components/WishlistButton";
import { colors, fonts } from "@/theme";

/** Storefront product tile with a wishlist heart and a quick "add to bag" button. */
export default function ProductCard({ product, width, onDark }) {
  const { addItem } = useCart();
  const toast = useToast();
  const image = productImageUrl(product.image);
  const discount = discountOf(product);
  const soldOut = product.qty !== null && product.qty !== undefined && Number(product.qty) <= 0;
  const lowStock = !soldOut && product.qty != null && Number(product.qty) <= 3;
  // Products with a choice of sizes are added from their page; a single size, like "Free Size", needs no choosing.
  const sizes = product.sizes || [];
  const onlySize = sizes.length === 1 && sizes[0].in_stock ? sizes[0] : null;
  const inStockSizes = sizes.filter((size) => size.in_stock).map((size) => size.name);

  const quickAdd = () => {
    if (soldOut) return;
    if (sizes.length && !onlySize) {
      router.push(`/product/${product.id}`);
      return;
    }
    addItem(product, 1, onlySize);
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
        <WishlistButton product={product} />
        <Pressable onPress={quickAdd} disabled={soldOut} hitSlop={6} accessibilityLabel={sizes.length && !onlySize ? `Choose a size for ${product.title}` : `Add ${product.title} to bag`} style={({ pressed }) => [styles.quick, soldOut && { opacity: 0.4 }, pressed && { transform: [{ scale: 0.92 }] }]}>
          <Ionicons name="bag-add-outline" size={18} color={colors.white} />
        </Pressable>
      </View>
      <View style={styles.meta}>
        <Text style={[styles.brand, onDark && styles.brandOnDark]} numberOfLines={1}>{product.brand?.name || product.category?.name || "Elitezaar"}</Text>
        <Text style={[styles.title, onDark && styles.onDark]} numberOfLines={2}>{product.title}</Text>
        {inStockSizes.length > 1 ? (
          <Text style={styles.sizes} numberOfLines={1}>{inStockSizes.slice(0, 4).join(" · ")}{inStockSizes.length > 4 ? ` +${inStockSizes.length - 4}` : ""}</Text>
        ) : null}
        {Number(product.reviews_count) > 0 ? (
          <View style={styles.rating}>
            <Ionicons name="star" size={12} color="#e3a53c" />
            <Text style={styles.ratingValue}>{Number(product.reviews_avg_rating).toFixed(1)}</Text>
            <Text style={styles.ratingCount}>({product.reviews_count})</Text>
          </View>
        ) : null}
        <View style={styles.priceRow}>
          <Text style={[styles.price, onDark && styles.onDark]}>{formatWholePrice(product.price)}</Text>
          {discount > 0 ? <Text style={[styles.compare, onDark && styles.compareOnDark]}>{formatWholePrice(product.compare_price)}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1 },
  media: { aspectRatio: 0.8, overflow: "hidden", borderRadius: 12, backgroundColor: "#f1ece3" },
  image: { width: "100%", height: "100%", mixBlendMode: "multiply" },
  fallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.emeraldLight },
  fallbackText: { color: "rgba(255,255,255,0.25)", fontFamily: fonts.display, fontSize: 64 },
  badges: { position: "absolute", top: 10, left: 10, gap: 6, alignItems: "flex-start" },
  badge: { overflow: "hidden", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, fontFamily: fonts.semi, fontSize: 11.5 },
  badgeSale: { color: colors.white, backgroundColor: "#a8492f" },
  badgeLight: { color: "#7a4a1f", backgroundColor: "#fff3e3" },
  badgeMuted: { color: colors.white, backgroundColor: "rgba(15,36,29,0.75)" },
  quick: { position: "absolute", right: 10, bottom: 10, width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: colors.emerald },
  meta: { paddingHorizontal: 2, paddingTop: 10 },
  brand: { color: "#8f5e2f", fontFamily: fonts.medium, fontSize: 12 },
  title: { marginTop: 2, color: colors.text, fontFamily: fonts.medium, fontSize: 14, lineHeight: 19 },
  sizes: { marginTop: 2, color: colors.muted, fontFamily: fonts.bodySemi, fontSize: 12.5, letterSpacing: 0.3 },
  rating: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  ratingValue: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 13 },
  ratingCount: { color: colors.muted, fontFamily: fonts.body, fontSize: 12.5 },
  priceRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 6, marginTop: 4 },
  price: { color: colors.ink, fontFamily: fonts.semi, fontSize: 15 },
  compare: { color: "#8b938d", fontFamily: fonts.medium, fontSize: 12.5, textDecorationLine: "line-through" },
  onDark: { color: "#fff3d6" },
  brandOnDark: { color: "#f6d58e" },
  compareOnDark: { color: "rgba(255,243,214,0.55)" },
});
