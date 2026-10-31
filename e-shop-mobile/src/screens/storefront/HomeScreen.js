import React, { useMemo, useState } from "react";
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import BrandLogo from "@/components/BrandLogo";
import ProductCard from "@/components/ProductCard";
import StartSelling from "@/components/StartSelling";
import { IconButton, Notice, Screen } from "@/components/ui";
import { useCart } from "@/context/CartContext";
import { api } from "@/lib/api";
import { categoryBannerUrl, productImageUrl } from "@/lib/config";
import { diwaliSeason } from "@/lib/festive";
import { discountOf, formatWholePrice } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { voiceAvailable } from "@/lib/voice";
import { colors, fonts, radius } from "@/theme";

const BRONZE = "#8f5e2f";
const TILE = "#f1ece3";
const SHELF_TONES = ["#efe6d8", "#e2e8e0", "#f0e1d9"];
const NEW_ARRIVALS = 4;
const SHELF_PRODUCTS = 3;
const DEALS = 4;

const openCategory = (category) => router.push({ pathname: "/shop", params: { category: category.slug } });
const unique = (products) => [...new Map(products.map((product) => [product.id, product])).values()];

async function loadHome() {
  const [latest, featured, payments, collections] = await Promise.all([
    api("/storefront/products"),
    api("/storefront/products", { query: { featured: "yes" } }).catch(() => null),
    api("/storefront/payment-methods").catch(() => ({ cod: true, online: false })),
    api("/storefront/home-categories").catch(() => null),
  ]);

  return {
    latest: latest.products?.data || [],
    total: Number(latest.products?.total || 0),
    brands: latest.brands || [],
    featured: featured?.products?.data || [],
    online: !!payments?.online,
    // Every main collection, with its banner, piece count and newest products.
    categories: collections?.categories || [],
  };
}

/**
 * What each part of the screen shows. A small catalogue would otherwise show the same few products over and over, so each
 * part takes products nothing above it has shown, and only falls back to repeats when it has nothing new.
 */
function planHome({ latest, featured, categories }) {
  const shown = new Set();
  const take = (products, count) => {
    const ordered = [...products.filter((product) => !shown.has(product.id)), ...products.filter((product) => shown.has(product.id))];
    ordered.slice(0, count).forEach((product) => shown.add(product.id));
    return ordered;
  };

  // One from each collection, so the first thing shoppers see is the whole range. A featured product leads.
  const everyCollection = categories.flatMap((category) => category.products.slice(0, 1));
  const hero = take(unique([...featured.slice(0, 1), ...everyCollection, ...featured, ...latest]).filter((product) => product.image), 3).slice(0, 3);
  const arrivals = take(latest, NEW_ARRIVALS).slice(0, NEW_ARRIVALS);
  const shelves = categories.filter((category) => category.total > 0).map((category) => ({ category, products: take(category.products, SHELF_PRODUCTS) }));
  const onOffer = unique([...latest, ...featured, ...categories.flatMap((category) => category.products)])
    .filter((product) => discountOf(product) > 0).sort((a, b) => discountOf(b) - discountOf(a));

  return { hero, arrivals, shelves, deals: take(onOffer, DEALS).slice(0, DEALS) };
}

export default function HomeScreen() {
  const { data, loading, refreshing, error, reload } = useLoad(loadHome, []);
  const { count } = useCart();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(200, (width - 32 - 14) / 2.15);
  const [season] = useState(diwaliSeason);
  const emptyStore = !loading && data?.total === 0;
  const plan = useMemo(() => (data ? planHome(data) : null), [data]);

  return (
    <Screen safeTop padded={false} refreshing={refreshing} onRefresh={reload}>
      <View style={styles.topBar}>
        <BrandLogo size={38} />
        <View style={styles.topActions}>
          {/* The mic opens the shop and starts listening; each tap is a new request. */}
          {voiceAvailable() ? <IconButton icon="mic-outline" label="Search by voice" onPress={() => router.push({ pathname: "/shop", params: { voice: String(Date.now()) } })} /> : null}
          <IconButton icon="search" label="Search" onPress={() => router.push("/shop")} />
          <IconButton icon="bag-handle-outline" label="Shopping bag" badge={count} onPress={() => router.push("/cart")} />
        </View>
      </View>

      <Hero products={plan?.hero || []} loading={loading} season={season} width={width} />
      <TrustRow online={data?.online} />

      <View style={styles.page}>
        {error ? <Notice tone="warning" title="We couldn’t load the latest pieces" message={error} style={styles.notice} /> : null}
        {emptyStore ? <StartSelling style={styles.notice} /> : null}
      </View>

      <CategoryNav categories={data?.categories || []} />
      <ProductRail title="Just landed" products={plan?.arrivals || []} width={cardWidth} loading={loading} />
      {(plan?.shelves || []).map((shelf, index) => <CategoryShelf key={shelf.category.id} {...shelf} index={index} width={cardWidth} />)}
      <ProductRail title="Best prices right now" products={plan?.deals || []} width={cardWidth} />

      {data?.brands?.length ? (
        <View style={styles.brands}>
          <Text style={styles.brandsLabel}>Shop by brand</Text>
          <View style={styles.brandList}>
            {data.brands.map((brand) => (
              <Pressable key={brand.id} accessibilityRole="link" onPress={() => router.push({ pathname: "/shop", params: { brand: String(brand.id) } })}>
                <Text style={styles.brand}>{brand.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {emptyStore ? null : (
        <View style={styles.seller}>
          <Text style={styles.sellerTitle}>Have something worth selling?</Text>
          <Text style={styles.sellerCopy}>Open your Elitezaar store in under a minute, and run it from your phone.</Text>
          <Pressable accessibilityRole="link" onPress={() => router.push("/vendor-register")} style={({ pressed }) => [styles.cta, { alignSelf: "center" }, pressed && styles.pressed]}>
            <Text style={styles.ctaText}>Become a seller</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.white} />
          </Pressable>
          <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: "/login", params: { portal: "vendor" } })} hitSlop={8}>
            <Text style={styles.link}>Already selling? Sign in</Text>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

/** The words, then the store's real products. */
function Hero({ products, loading, season, width }) {
  const height = Math.min(340, (width - 32) * 0.84);
  const [first, ...rest] = products;
  const eyebrow = season ? (season.festivalDays ? season.greeting : `The Diwali edit · ${season.countdown}`) : "New this season";
  return (
    <View style={styles.hero}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.heroTitle}>{season ? "Diwali gifts," : "Good things,"}</Text>
      <Text style={[styles.heroTitle, styles.heroAccent]}>chosen well.</Text>
      <Text style={styles.heroCopy}>Thoughtfully picked pieces from independent sellers. Every listing is checked by our team, and every order is tracked to your door.</Text>
      <Pressable accessibilityRole="link" onPress={() => router.push("/shop")} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
        <Text style={styles.ctaText}>{season ? "Shop the festive edit" : "Shop everything"}</Text>
        <Ionicons name="arrow-forward" size={16} color={colors.white} />
      </Pressable>
      {loading ? (
        <View style={[styles.mosaic, { height }]}>
          <View style={[styles.tile, styles.tileLarge]} />
          <View style={styles.tileColumn}><View style={styles.tile} /><View style={styles.tile} /></View>
        </View>
      ) : first ? (
        <View style={[styles.mosaic, { height }]}>
          <Tile product={first} large />
          {rest.length ? <View style={styles.tileColumn}>{rest.map((product) => <Tile key={product.id} product={product} />)}</View> : null}
        </View>
      ) : null}
    </View>
  );
}

function Tile({ product, large }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`${product.title}, ${formatWholePrice(product.price)}`} onPress={() => router.push(`/product/${product.id}`)}
      style={({ pressed }) => [styles.tile, large && styles.tileLarge, pressed && styles.pressed]}>
      <Image source={{ uri: productImageUrl(product.image, large ? "large" : "small") }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <Text style={styles.tilePrice}>{formatWholePrice(product.price)}</Text>
    </Pressable>
  );
}

function TrustRow({ online }) {
  return (
    <View style={styles.trust}>
      {[
        online && ["phone-portrait-outline", "UPI & net banking"],
        ["cash-outline", "Cash on delivery"],
        ["navigate-outline", "Live order tracking"],
        ["shield-checkmark-outline", "Checked by our team"],
      ].filter(Boolean).map(([icon, label]) => (
        <View key={label} style={styles.trustItem}>
          <Ionicons name={icon} size={16} color={BRONZE} />
          <Text style={styles.trustText} numberOfLines={1}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Every collection with something in it, one tap away. */
function CategoryNav({ categories }) {
  const live = categories.filter((category) => category.total > 0);
  if (!live.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catnav}>
      {live.map((category) => {
        const image = categoryBannerUrl(category.banner) || productImageUrl(category.products.find((product) => product.image)?.image);
        return (
          <Pressable key={category.id} accessibilityRole="link" onPress={() => openCategory(category)} style={styles.catnavItem}>
            <View style={styles.catnavImage}>
              {image ? <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <Text style={styles.catnavLetter}>{category.name.charAt(0)}</Text>}
            </View>
            <Text style={styles.catnavName} numberOfLines={1}>{category.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function Rail({ products, width }) {
  return (
    <FlatList horizontal data={products} keyExtractor={(item) => String(item.id)} showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail} renderItem={({ item }) => <ProductCard product={item} width={width} />} />
  );
}

function ProductRail({ title, products, width, loading }) {
  if (!loading && !products.length) return null;
  return (
    <View style={styles.block}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        {loading ? null : (
          <Pressable accessibilityRole="link" onPress={() => router.push("/shop")} hitSlop={8}><Text style={styles.link}>View all</Text></Pressable>
        )}
      </View>
      {loading ? (
        <View style={[styles.rail, { flexDirection: "row" }]}>{[0, 1].map((key) => <View key={key} style={[styles.skeleton, { width }]} />)}</View>
      ) : <Rail products={products} width={width} />}
    </View>
  );
}

/** A collection: its banner, leading to all its pieces, with its newest ones under it. A band of colour until it has a banner. */
function CategoryShelf({ category, products, index, width }) {
  const banner = categoryBannerUrl(category.banner);
  const pieces = `${category.total} ${category.total === 1 ? "piece" : "pieces"}`;
  return (
    <View style={styles.block}>
      <Pressable accessibilityRole="link" accessibilityLabel={`${category.name}: view all ${pieces}`} onPress={() => openCategory(category)}
        style={({ pressed }) => [styles.band, { backgroundColor: SHELF_TONES[index % SHELF_TONES.length] }, banner && styles.bandPhoto, pressed && styles.pressed]}>
        {banner ? (
          <>
            <Image source={{ uri: banner }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <LinearGradient colors={["rgba(10,24,19,0)", "rgba(10,24,19,0.68)"]} start={{ x: 0, y: 0.3 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
          </>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={[styles.bandName, banner && styles.onPhoto]} numberOfLines={2}>{category.name}</Text>
          <Text style={[styles.bandCount, banner && styles.onPhoto]}>{pieces}</Text>
        </View>
        <Text style={[styles.link, banner && styles.onPhoto]}>View all</Text>
      </Pressable>
      <Rail products={products} width={width} />
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 10 },
  topActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  pressed: { opacity: 0.85 },
  page: { paddingHorizontal: 16 },
  notice: { marginTop: 16 },
  hero: { paddingHorizontal: 16, paddingTop: 10 },
  eyebrow: { marginBottom: 6, color: BRONZE, fontFamily: fonts.medium, fontSize: 13.5 },
  heroTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 48, lineHeight: 50 },
  heroAccent: { color: BRONZE, fontFamily: fonts.serifItalic },
  heroCopy: { marginTop: 10, marginBottom: 16, color: "#5a665f", fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  cta: { flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 10, borderRadius: radius.pill, paddingHorizontal: 22, paddingVertical: 13, backgroundColor: colors.ink },
  ctaText: { color: colors.white, fontFamily: fonts.semi, fontSize: 15 },
  mosaic: { flexDirection: "row", gap: 10, marginTop: 18 },
  tile: { flex: 1, overflow: "hidden", borderRadius: 14, backgroundColor: TILE },
  tileLarge: { flex: 3 },
  tileColumn: { flex: 2, gap: 10 },
  tilePrice: { position: "absolute", bottom: 8, left: 8, overflow: "hidden", borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, color: colors.ink, backgroundColor: "rgba(255,255,255,0.92)", fontFamily: fonts.semi, fontSize: 13 },
  trust: { flexDirection: "row", flexWrap: "wrap", rowGap: 10, marginTop: 18, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#e7e1d7", paddingHorizontal: 16, paddingVertical: 12 },
  trustItem: { flexDirection: "row", alignItems: "center", gap: 7, width: "50%", paddingRight: 8 },
  trustText: { flexShrink: 1, color: "#5a665f", fontFamily: fonts.medium, fontSize: 13 },
  catnav: { flexGrow: 1, justifyContent: "center", gap: 16, paddingHorizontal: 16, paddingTop: 22 },
  catnavItem: { alignItems: "center", gap: 8, width: 78 },
  catnavImage: { alignItems: "center", justifyContent: "center", overflow: "hidden", width: 72, height: 72, borderRadius: 36, backgroundColor: TILE },
  catnavLetter: { color: BRONZE, fontFamily: fonts.serif, fontSize: 30 },
  catnavName: { color: colors.ink, fontFamily: fonts.medium, fontSize: 13.5 },
  block: { marginTop: 34 },
  titleRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 14, paddingHorizontal: 16 },
  title: { flexShrink: 1, color: colors.ink, fontFamily: fonts.serif, fontSize: 32, lineHeight: 36 },
  link: { color: colors.ink, fontFamily: fonts.medium, fontSize: 14, textDecorationLine: "underline" },
  rail: { gap: 14, paddingHorizontal: 16 },
  skeleton: { height: 250, borderRadius: 12, backgroundColor: TILE },
  band: { flexDirection: "row", alignItems: "flex-end", gap: 12, overflow: "hidden", marginBottom: 14, marginHorizontal: 16, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 15 },
  bandPhoto: { minHeight: 170 },
  bandName: { color: colors.ink, fontFamily: fonts.serif, fontSize: 30, lineHeight: 34 },
  bandCount: { color: "#5a665f", fontFamily: fonts.medium, fontSize: 13 },
  onPhoto: { color: colors.white },
  brands: { alignItems: "center", marginTop: 38, paddingHorizontal: 16 },
  brandsLabel: { marginBottom: 10, color: "#8b938d", fontFamily: fonts.medium, fontSize: 13.5 },
  brandList: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, columnGap: 22 },
  brand: { color: colors.ink, fontFamily: fonts.serif, fontSize: 21, lineHeight: 28 },
  seller: { alignItems: "center", gap: 10, marginTop: 40, borderTopWidth: 1, borderTopColor: "#e7e1d7", paddingHorizontal: 24, paddingTop: 30 },
  sellerTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 30, lineHeight: 34, textAlign: "center" },
  sellerCopy: { marginBottom: 6, color: "#5a665f", fontFamily: fonts.medium, fontSize: 14.5, lineHeight: 21, textAlign: "center" },
});
