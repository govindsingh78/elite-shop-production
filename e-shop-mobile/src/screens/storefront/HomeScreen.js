import React, { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import BrandLogo from "@/components/BrandLogo";
import { DiwaliGreeting, Toran } from "@/components/Diwali";
import ProductCard from "@/components/ProductCard";
import { Button, Chip, IconButton, Notice, Screen, SectionHeader, T } from "@/components/ui";
import { useCart } from "@/context/CartContext";
import { api } from "@/lib/api";
import { productImageUrl } from "@/lib/config";
import { diwaliSeason } from "@/lib/festive";
import { discountOf } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { colors, fonts, radius, shadow } from "@/theme";

// The banner photos have text printed on their right half, so each slide shows only the left part.
// aspect = width / height of the photo; visible = the share of its width the slide may show.
const HERO_HEIGHT = 380;
const HERO_SLIDES = [
  { image: require("../../../assets/images/banner-1.jpg"), aspect: 1954 / 1303, visible: 0.5, eyebrow: "The new edit", title: "Clean lines,\neasy fits" },
  { image: require("../../../assets/images/banner-2.jpg"), aspect: 1800 / 894, visible: 0.5, eyebrow: "Just landed", title: "Fresh pieces,\nevery week" },
];

const heroImageFrame = (slide, slideWidth) => {
  const width = Math.max(slideWidth / slide.visible, HERO_HEIGHT * slide.aspect);
  const height = width / slide.aspect;
  return { position: "absolute", left: 0, top: (HERO_HEIGHT - height) / 2, width, height };
};

async function loadHome() {
  const [latest, featured, payments, categories] = await Promise.all([
    api("/storefront/products"),
    api("/storefront/products", { query: { featured: "yes" } }).catch(() => null),
    api("/storefront/payment-methods").catch(() => ({ cod: true, online: false })),
    api("/storefront/categories").catch(() => []),
  ]);
  // A cover photo and piece count for the first few collections.
  const covers = Object.fromEntries(await Promise.all((categories || []).slice(0, 6).map((category) =>
    api("/storefront/products", { query: { category_id: category.id } })
      .then((data) => [category.id, { total: Number(data.products?.total || 0), image: productImageUrl((data.products?.data || []).find((item) => item.image)?.image) }])
      .catch(() => [category.id, null]))));

  return {
    latest: latest.products?.data || [],
    total: Number(latest.products?.total || 0),
    brands: latest.brands || [],
    featured: featured?.products?.data || [],
    online: !!payments?.online,
    categories: categories || [],
    covers,
  };
}

export default function HomeScreen() {
  const { data, loading, refreshing, error, reload } = useLoad(loadHome, []);
  const { count } = useCart();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(200, (width - 32 - 14) / 2.15);
  const [season] = useState(diwaliSeason);

  const offers = useMemo(() => (data?.latest || []).filter((product) => discountOf(product) > 0).sort((a, b) => discountOf(b) - discountOf(a)), [data]);

  return (
    <Screen safeTop padded={false} refreshing={refreshing} onRefresh={reload}>
      <View style={styles.topBar}>
        <BrandLogo size={38} />
        <View style={styles.topActions}>
          <IconButton icon="search" label="Search" onPress={() => router.push("/shop")} />
          <IconButton icon="bag-handle-outline" label="Shopping bag" badge={count} onPress={() => router.push("/cart")} />
        </View>
      </View>

      {season ? <Toran width={width} style={styles.toran} /> : null}
      <HeroSlider categories={data?.categories || []} season={season} />

      <View style={styles.stats}>
        {[[data?.total, "Pieces"], [data?.categories?.length, "Collections"], [data?.brands?.length, "Brands"]].map(([value, label]) => (
          <View key={label} style={styles.statItem}>
            <Text style={styles.statValue}>{loading ? "—" : value ?? 0}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trust}>
        {[
          data?.online && ["phone-portrait-outline", "UPI & net banking"],
          ["cash-outline", "Cash on delivery"],
          ["navigate-outline", "Live order tracking"],
          ["cube-outline", "Carefully packed"],
        ].filter(Boolean).map(([icon, label]) => (
          <View key={label} style={styles.trustItem}>
            <View style={styles.trustIcon}><Ionicons name={icon} size={17} color={colors.emerald} /></View>
            <Text style={styles.trustText}>{label}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.section}>
        {error ? <Notice tone="warning" title="We couldn’t load the latest pieces" message={error} /> : null}

        {data?.categories?.length ? (
          <View style={styles.block}>
            <SectionHeader eyebrow="Shop by collection" title="Find your edit" actionLabel="All" onAction={() => router.push("/shop")} />
            <View style={styles.collections}>
              {data.categories.slice(0, 6).map((category, index) => {
                const cover = data.covers[category.id];
                const wide = index === 0 && data.categories.length % 2 === 1;
                return (
                  <Pressable key={category.id} onPress={() => router.push({ pathname: "/shop", params: { category: category.slug } })} style={[styles.collection, wide && styles.collectionWide]}>
                    {cover?.image ? <Image source={{ uri: cover.image }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : (
                      <View style={[StyleSheet.absoluteFill, styles.collectionFallback]}><Text style={styles.collectionLetter}>{category.name.charAt(0)}</Text></View>
                    )}
                    <LinearGradient colors={["rgba(10,31,25,0)", "rgba(10,31,25,0.85)"]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0.35 }} end={{ x: 0, y: 1 }} />
                    <View style={styles.collectionCopy}>
                      <Text style={styles.collectionCount}>{cover ? `${cover.total} ${cover.total === 1 ? "piece" : "pieces"}` : "Collection"}</Text>
                      <Text style={styles.collectionName}>{category.name}</Text>
                      <Text style={styles.collectionCta}>Shop now →</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <ProductRail eyebrow="Just landed" title="New this week" products={data?.latest?.slice(0, 8) || []} width={cardWidth} loading={loading} />
        <ProductRail eyebrow="Editor’s picks" title="Chosen by our team" products={data?.featured || []} width={cardWidth} />
        {offers.length ? (
          <View style={[styles.block, styles.offers]}>
            <SectionHeader eyebrow="Limited time" title="Offers you’ll love" />
            <FlatList horizontal data={offers} keyExtractor={(item) => String(item.id)} showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 14 }} renderItem={({ item }) => <ProductCard product={item} width={cardWidth} />} />
          </View>
        ) : null}

        {data?.brands?.length ? (
          <View style={styles.block}>
            <SectionHeader eyebrow="Labels" title="Shop by brand" />
            <View style={styles.brandList}>
              {data.brands.map((brand) => (
                <Chip key={brand.id} label={brand.name} icon="pricetag-outline" onPress={() => router.push({ pathname: "/shop", params: { brand: String(brand.id) } })} />
              ))}
            </View>
          </View>
        ) : null}

        <View style={[styles.block, styles.how]}>
          <T variant="eyebrow">How it works</T>
          <T variant="h2" style={{ marginTop: 4, marginBottom: 14 }}>Shopping, made simple</T>
          {[
            ["sparkles-outline", "Pick your pieces", "Browse collections and add what you love to your bag."],
            ["card-outline", "Pay your way", data?.online ? "UPI, net banking or cash on delivery." : "Cash on delivery, with online payments coming soon."],
            ["navigate-outline", "Track it live", "Follow every step from packing to your doorstep."],
          ].map(([icon, title, copy], index) => (
            <View key={title} style={styles.step}>
              <Text style={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</Text>
              <View style={{ flex: 1 }}>
                <Row icon={icon} title={title} />
                <T variant="small" style={{ marginTop: 2 }}>{copy}</T>
              </View>
            </View>
          ))}
        </View>

        <LinearGradient colors={["#1f4a3d", "#0a1f19"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.seller}>
          <Text style={styles.sellerBadge}>FOR SELLERS</Text>
          <Text style={styles.sellerTitle}>Sell on Elitezaar</Text>
          <Text style={styles.sellerCopy}>Open your store in under a minute. List products, ship orders and track sales from your phone.</Text>
          <Button title="Become a seller" variant="gold" icon="storefront-outline" onPress={() => router.push("/vendor-register")} style={{ marginTop: 16 }} />
          <Pressable onPress={() => router.push({ pathname: "/login", params: { portal: "vendor" } })} style={{ marginTop: 12, alignSelf: "center" }}>
            <Text style={styles.sellerLink}>Already selling? Sign in to the seller hub</Text>
          </Pressable>
        </LinearGradient>
      </View>
    </Screen>
  );
}

function Row({ icon, title }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Ionicons name={icon} size={17} color={colors.tealDark} />
      <T variant="title">{title}</T>
    </View>
  );
}

function ProductRail({ eyebrow, title, products, width, loading }) {
  if (loading) {
    return (
      <View style={styles.block}>
        <SectionHeader eyebrow={eyebrow} title={title} />
        <View style={{ flexDirection: "row", gap: 14 }}>{[0, 1].map((key) => <View key={key} style={[styles.skeleton, { width }]} />)}</View>
      </View>
    );
  }
  if (!products.length) return null;
  return (
    <View style={styles.block}>
      <SectionHeader eyebrow={eyebrow} title={title} actionLabel="Shop all" onAction={() => router.push("/shop")} />
      <FlatList horizontal data={products} keyExtractor={(item) => String(item.id)} showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 14 }} renderItem={({ item }) => <ProductCard product={item} width={width} />} />
    </View>
  );
}

/**
 * Full-width photo slider with a caption per slide; the photo slides link to the first collections.
 * In the Diwali season a "Happy Diwali" card leads it.
 */
function HeroSlider({ categories, season }) {
  const { width } = useWindowDimensions();
  const slideWidth = width - 32;
  const [active, setActive] = useState(0);
  const listRef = useRef(null);
  const slides = useMemo(() => (season ? [{ festive: true }, ...HERO_SLIDES] : HERO_SLIDES), [season]);

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((current) => {
        const next = (current + 1) % slides.length;
        listRef.current?.scrollToOffset({ offset: next * (slideWidth + 12), animated: true });
        return next;
      });
    }, 5500);
    return () => clearInterval(timer);
  }, [slideWidth, slides.length]);

  return (
    <View>
      <FlatList
        ref={listRef}
        horizontal
        data={slides}
        keyExtractor={(_, index) => String(index)}
        showsHorizontalScrollIndicator={false}
        snapToInterval={slideWidth + 12}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        onMomentumScrollEnd={(event) => setActive(Math.round(event.nativeEvent.contentOffset.x / (slideWidth + 12)))}
        renderItem={({ item, index }) => {
          if (item.festive) {
            return (
              <View style={[styles.hero, { width: slideWidth }]}>
                <DiwaliGreeting width={slideWidth} height={HERO_HEIGHT} />
                <LinearGradient colors={["rgba(20,4,10,0)", "rgba(20,4,10,0)", "rgba(20,4,10,0.7)"]} locations={[0, 0.7, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
                <View style={styles.heroCopy}>
                  <View style={styles.festiveChip}>
                    <Ionicons name="sparkles" size={13} color="#f6d58e" />
                    <Text style={styles.festiveChipText}>{season.countdown}</Text>
                  </View>
                  <Button title="Shop the festive edit" variant="light" small block={false} iconRight="arrow-forward" onPress={() => router.push("/shop")} />
                </View>
              </View>
            );
          }
          const category = categories[HERO_SLIDES.indexOf(item)];
          return (
            <View style={[styles.hero, { width: slideWidth }]}>
              <Image source={item.image} style={heroImageFrame(item, slideWidth)} resizeMode="cover" />
              <LinearGradient colors={["rgba(8,26,21,0.05)", "rgba(8,26,21,0.85)"]} start={{ x: 0, y: 0.3 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
              <View style={styles.heroCopy}>
                <Text style={styles.heroEyebrow}>{String(index + 1).padStart(2, "0")} — {item.eyebrow}</Text>
                <Text style={styles.heroTitle}>{item.title}</Text>
                <Button
                  title={category ? `Shop ${category.name}` : "Shop the collection"}
                  variant="light"
                  small
                  block={false}
                  iconRight="arrow-forward"
                  onPress={() => router.push(category ? { pathname: "/shop", params: { category: category.slug } } : "/shop")}
                />
              </View>
            </View>
          );
        }}
      />
      <View style={styles.heroDots}>
        {slides.map((slide, index) => <View key={index} style={[styles.heroDot, index === active && styles.heroDotActive]} />)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14 },
  topActions: { flexDirection: "row", gap: 10 },
  hero: { height: HERO_HEIGHT, justifyContent: "flex-end", overflow: "hidden", borderRadius: radius.xl, backgroundColor: colors.emerald },
  heroCopy: { padding: 22 },
  heroEyebrow: { color: "#e7cfa6", fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 2.2, textTransform: "uppercase" },
  heroTitle: { marginTop: 8, marginBottom: 16, color: colors.white, fontFamily: fonts.heading, fontSize: 30, lineHeight: 33, letterSpacing: -0.8 },
  toran: { marginTop: -10, marginBottom: 2 },
  festiveChip: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, marginBottom: 12, borderWidth: 1, borderColor: "rgba(242,194,91,0.45)", borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 5, backgroundColor: "rgba(36,5,15,0.55)" },
  festiveChipText: { color: "#f6d58e", fontFamily: fonts.bodyBold, fontSize: 13, letterSpacing: 0.6 },
  heroDots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 12 },
  heroDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.line },
  heroDotActive: { width: 24, backgroundColor: colors.emerald },
  stats: { flexDirection: "row", marginHorizontal: 16, marginTop: 18, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.lg, paddingVertical: 14, backgroundColor: colors.white, ...shadow.card },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { color: colors.ink, fontFamily: fonts.display, fontSize: 22 },
  statLabel: { marginTop: 2, color: colors.muted, fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase" },
  trust: { gap: 10, paddingHorizontal: 16, paddingVertical: 16 },
  trustItem: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.pill, paddingVertical: 6, paddingLeft: 6, paddingRight: 14, backgroundColor: colors.white },
  trustIcon: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: colors.mint },
  trustText: { color: colors.text, fontFamily: fonts.bodySemi, fontSize: 14 },
  section: { paddingHorizontal: 16 },
  block: { marginTop: 22 },
  collections: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  collection: { width: "47.9%", height: 190, justifyContent: "flex-end", overflow: "hidden", borderRadius: radius.lg, backgroundColor: colors.emerald },
  collectionWide: { width: "100%", height: 210 },
  collectionFallback: { alignItems: "center", justifyContent: "center", backgroundColor: colors.emeraldLight },
  collectionLetter: { color: "rgba(255,255,255,0.14)", fontFamily: fonts.display, fontSize: 110 },
  collectionCopy: { padding: 14 },
  collectionCount: { color: "#d3b894", fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase" },
  collectionName: { color: colors.white, fontFamily: fonts.display, fontSize: 22, letterSpacing: -0.4 },
  collectionCta: { marginTop: 2, color: "#9fd9df", fontFamily: fonts.bodyBold, fontSize: 13 },
  offers: { marginHorizontal: -16, paddingHorizontal: 16, paddingVertical: 20, backgroundColor: "#fbf1e6" },
  brandList: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  how: { borderRadius: radius.xl, padding: 20, backgroundColor: colors.white, ...shadow.card },
  step: { flexDirection: "row", gap: 14, paddingVertical: 10 },
  stepNumber: { width: 34, color: colors.teal, fontFamily: fonts.display, fontSize: 22 },
  seller: { marginTop: 24, borderRadius: radius.xl, padding: 22 },
  sellerBadge: { alignSelf: "flex-start", overflow: "hidden", borderWidth: 1, borderColor: "rgba(224,164,88,0.55)", borderRadius: 30, paddingHorizontal: 10, paddingVertical: 3, color: "#e0a458", fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.8 },
  sellerTitle: { marginTop: 12, color: colors.white, fontFamily: fonts.display, fontSize: 26, letterSpacing: -0.6 },
  sellerCopy: { marginTop: 6, color: "#b8c8be", fontFamily: fonts.body, fontSize: 16, lineHeight: 22 },
  sellerLink: { color: "#d3b894", fontFamily: fonts.bodySemi, fontSize: 14 },
  skeleton: { height: 260, borderRadius: radius.lg, backgroundColor: colors.lineSoft },
});
