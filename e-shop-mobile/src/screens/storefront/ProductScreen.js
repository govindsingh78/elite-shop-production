import React, { useMemo, useState } from "react";
import { FlatList, Image, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import ProductCard from "@/components/ProductCard";
import { Button, Card, EmptyState, IconButton, KeyValue, Loader, QuantityStepper, Row, Screen, SectionHeader, T } from "@/components/ui";
import WishlistButton from "@/components/WishlistButton";
import ProductReviewsSection from "@/components/ProductReviewsSection";
import { Stars } from "@/components/ReviewBits";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/context/ToastContext";
import { api } from "@/lib/api";
import { productImageUrl } from "@/lib/config";
import { discountOf, formatPrice } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { colors, fonts, radius } from "@/theme";

export default function ProductScreen() {
  const { id } = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const { addItem, count } = useCart();
  const toast = useToast();
  const [quantity, setQuantity] = useState(1);
  const [slide, setSlide] = useState(0);

  const { data, loading, error, reload, refreshing } = useLoad(async () => {
    const result = await api(`/storefront/products/${id}`);
    const product = result.data;
    const related = await api("/storefront/products", { query: { category_id: product.category_id } })
      .then((list) => (list.products?.data || []).filter((item) => item.id !== product.id).slice(0, 6))
      .catch(() => []);
    return { product, related };
  }, [id]);

  const product = data?.product;
  const images = useMemo(() => (product ? [...new Set([product.image, ...(product.images || []).map((image) => image.image)].filter(Boolean))] : []), [product]);

  const headerRight = () => (
    <Row gap={8}>
      {product ? <WishlistButton product={product} variant="header" /> : null}
      <IconButton icon="bag-handle-outline" label="Shopping bag" badge={count} size={38} onPress={() => router.push("/cart")} />
    </Row>
  );

  if (loading) return <><Stack.Screen options={{ title: "" }} /><Loader /></>;
  if (error || !product) {
    return (
      <Screen>
        <EmptyState icon="alert-circle-outline" title="Product unavailable" message={error || "This piece may have sold out or been removed."} actionLabel="Back to the shop" onAction={() => router.replace("/shop")} />
      </Screen>
    );
  }

  const available = product.qty == null ? null : Number(product.qty);
  const soldOut = available !== null && available <= 0;
  const discount = discountOf(product);
  const galleryWidth = width - 32;

  const add = (goToBag) => {
    addItem(product, quantity);
    if (goToBag) router.push("/cart");
    else toast(`${quantity} × ${product.title} added to your bag`);
  };

  return (
    <>
      <Stack.Screen options={{ title: "", headerRight }} />
      <Screen
        refreshing={refreshing}
        onRefresh={reload}
        footer={(
          <Row gap={10}>
            {!soldOut ? <QuantityStepper value={quantity} onChange={setQuantity} max={available ?? 999} /> : null}
            <View style={{ flex: 1 }}>
              <Button title={soldOut ? "Sold out" : "Add to bag"} icon="bag-add-outline" disabled={soldOut} onPress={() => add(false)} />
            </View>
          </Row>
        )}
      >
        <View>
          <FlatList
            horizontal
            pagingEnabled
            data={images.length ? images : [null]}
            keyExtractor={(item, index) => `${item}-${index}`}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => setSlide(Math.round(event.nativeEvent.contentOffset.x / galleryWidth))}
            renderItem={({ item }) => (
              <View style={[styles.gallery, { width: galleryWidth }]}>
                {item ? <Image source={{ uri: productImageUrl(item, "large") }} style={styles.galleryImage} resizeMode="cover" /> : (
                  <View style={styles.galleryFallback}><Text style={styles.galleryLetter}>{product.title.charAt(0)}</Text></View>
                )}
              </View>
            )}
          />
          {discount > 0 ? <Text style={styles.sale}>−{discount}% off</Text> : null}
          {images.length > 1 ? (
            <View style={styles.dots}>{images.map((image, index) => <View key={image} style={[styles.dot, index === slide && styles.dotActive]} />)}</View>
          ) : null}
        </View>

        <View style={{ marginTop: 18 }}>
          <T variant="eyebrow">{[product.brand?.name, product.category?.name].filter(Boolean).join(" · ") || "Elitezaar"}</T>
          <T variant="h1" style={{ marginTop: 6 }}>{product.title}</T>
          {Number(product.reviews_count) > 0 ? (
            <Row gap={6} style={{ marginTop: 6 }}>
              <Stars value={Number(product.reviews_avg_rating)} size={14} />
              <T variant="strong">{Number(product.reviews_avg_rating).toFixed(1)}</T>
              <T variant="small">· {product.reviews_count} {Number(product.reviews_count) === 1 ? "review" : "reviews"}</T>
            </Row>
          ) : null}
          <Row gap={10} style={{ marginTop: 10, flexWrap: "wrap" }} align="baseline">
            <Text style={styles.price}>{formatPrice(product.price)}</Text>
            {discount > 0 ? <Text style={styles.compare}>{formatPrice(product.compare_price)}</Text> : null}
            {discount > 0 ? <Text style={styles.save}>You save {formatPrice(product.compare_price - product.price)}</Text> : null}
          </Row>
          <T variant="small" style={{ marginTop: 2 }}>Inclusive of all taxes</T>
          <Row gap={8} style={{ marginTop: 12 }}>
            <Ionicons name={soldOut ? "close-circle" : "checkmark-circle"} size={18} color={soldOut ? colors.danger : colors.success} />
            <T variant="strong" color={soldOut ? colors.danger : colors.success}>
              {soldOut ? "Sold out" : available !== null && available <= 5 ? `Only ${available} left — order soon` : "In stock, ready to ship"}
            </T>
          </Row>
          {product.short_description ? <T variant="body" style={{ marginTop: 14, fontSize: 17, lineHeight: 24 }}>{product.short_description}</T> : null}
        </View>

        {!soldOut ? (
          <Button title="Buy now" variant="teal" icon="flash-outline" onPress={() => add(true)} style={{ marginTop: 18 }} />
        ) : null}

        <View style={styles.perks}>
          {[["cash-outline", "Cash on delivery"], ["navigate-outline", "Live tracking"], ["shield-checkmark-outline", "Secure checkout"]].map(([icon, label]) => (
            <View key={label} style={styles.perk}>
              <Ionicons name={icon} size={20} color={colors.emerald} />
              <Text style={styles.perkText}>{label}</Text>
            </View>
          ))}
        </View>

        <Card style={{ marginTop: 18 }}>
          <T variant="h3" style={{ marginBottom: 8 }}>About this piece</T>
          <T variant="body">{product.description || product.short_description || "More details about this piece are coming soon."}</T>
        </Card>

        <Card style={{ marginTop: 12 }}>
          <T variant="h3" style={{ marginBottom: 4 }}>Details</T>
          {product.brand?.name ? <KeyValue label="Brand" value={product.brand.name} /> : null}
          {product.category?.name ? <KeyValue label="Collection" value={[product.category.parent?.name, product.category.name].filter(Boolean).join(" › ")} /> : null}
          <KeyValue label="SKU" value={product.sku} last />
        </Card>

        <ProductReviewsSection productId={product.id} productTitle={product.title} />

        {data.related.length ? (
          <View style={{ marginTop: 26 }}>
            <SectionHeader eyebrow="More from this collection" title="You may also like" />
            <FlatList horizontal data={data.related} keyExtractor={(item) => String(item.id)} showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 14 }} renderItem={({ item }) => <ProductCard product={item} width={168} />} />
          </View>
        ) : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  gallery: { aspectRatio: 0.85, overflow: "hidden", borderRadius: radius.xl, backgroundColor: "#eef1ec" },
  galleryImage: { width: "100%", height: "100%" },
  galleryFallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.emeraldLight },
  galleryLetter: { color: "rgba(255,255,255,0.2)", fontFamily: fonts.display, fontSize: 140 },
  sale: { position: "absolute", top: 14, left: 14, overflow: "hidden", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, color: colors.white, backgroundColor: "#c0533a", fontFamily: fonts.bodyBold, fontSize: 13 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 12 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.line },
  dotActive: { width: 22, backgroundColor: colors.emerald },
  price: { color: colors.ink, fontFamily: fonts.display, fontSize: 28, letterSpacing: -0.5 },
  compare: { color: colors.faint, fontFamily: fonts.body, fontSize: 17, textDecorationLine: "line-through" },
  save: { overflow: "hidden", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, color: colors.success, backgroundColor: colors.successSoft, fontFamily: fonts.bodyBold, fontSize: 13 },
  perks: { flexDirection: "row", gap: 8, marginTop: 18 },
  perk: { flex: 1, alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.md, paddingVertical: 12, backgroundColor: colors.white },
  perkText: { color: colors.text, fontFamily: fonts.bodySemi, fontSize: 13, textAlign: "center" },
});
