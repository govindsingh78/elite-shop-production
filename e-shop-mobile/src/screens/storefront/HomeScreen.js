import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Animated, Easing, FlatList, Image, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BrandLogo from "@/components/BrandLogo";
import { DiwaliLettering, Toran } from "@/components/Diwali";
import HomeHero from "@/components/HomeHero";
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
const CREAM = "#fff3d6";
const GOLD = "#f2c25b";
const GOLD_SOFT = "#f6d58e";
const SHELF_TONES = [["#7d1840", "#3a0a20"], ["#23695a", "#123a30"], ["#5a2f86", "#2d1652"]];
const BUDGET_TONES = [["#240612", "#7d1840"], ["#0a211b", "#23695a"], ["#170b2c", "#5a2f86"], ["#301206", "#9c4318"]];
const SLIDE_TONES = ["forest", "aubergine", "terracotta", "forest"];
const NEW_ARRIVALS = 8;
const SHELF_PRODUCTS = 3;
const HERO_WINDOWS = 3;
const HERO_COLLECTIONS = 4;
const BUDGETS = [500, 1000, 2000, 5000];

const openCategory = (category) => router.push({ pathname: "/shop", params: { category: category.slug } });
const openProduct = (product) => () => router.push(`/product/${product.id}`);
const openBestPrices = () => router.push({ pathname: "/shop", params: { sort: "price_asc" } });
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
  const hero = take(unique([...featured.slice(0, 1), ...everyCollection, ...featured, ...latest]).filter((product) => product.image), HERO_WINDOWS).slice(0, HERO_WINDOWS);
  const arrivals = take(latest, NEW_ARRIVALS).slice(0, NEW_ARRIVALS);
  const shelves = categories.filter((category) => category.total > 0).map((category) => ({ category, products: take(category.products, SHELF_PRODUCTS) }));
  const everything = unique([...latest, ...featured, ...categories.flatMap((category) => category.products)]);
  const deals = everything.filter((product) => discountOf(product) > 0).sort((a, b) => discountOf(b) - discountOf(a));
  // A budget is only offered if something is in it, and shows the piece that sits closest to its limit.
  const budgets = BUDGETS.map((limit, index) => ({
    limit,
    product: everything.filter((product) => product.image && Number(product.price) < limit && Number(product.price) >= (BUDGETS[index - 1] || 0)).sort((a, b) => Number(b.price) - Number(a.price))[0],
  })).filter((budget) => budget.product);

  return { hero, arrivals, shelves, deals, budgets };
}

const productWindow = (product, index) => ({ key: String(product.id), image: productImageUrl(product.image, index === 0 ? "large" : "small"), title: product.title, price: product.price, open: openProduct(product) });

/** The banner's slides: the season first, then each collection, then the best offers. */
function planSlides(plan, categories, season, loading) {
  const opening = {
    key: "edit",
    tone: season ? "maroon" : "forest",
    tab: season ? "Diwali edit" : "The edit",
    eyebrow: season ? (season.festivalDays ? season.greeting : `The Diwali edit · ${season.countdown}`) : "New this season",
    title: season ? "Diwali gifts," : "Good things,",
    accent: "chosen well.",
    action: season ? "Shop the festive edit" : "Shop everything",
    open: () => router.push("/shop"),
    windows: (plan?.hero || []).map(productWindow),
  };
  if (loading || !plan) return [opening];

  const shownFirst = new Set(plan.hero.map((product) => product.id));
  const collectionSlides = categories.filter((category) => category.total > 0 && category.products.some((product) => product.image)).slice(0, HERO_COLLECTIONS).map((category, index) => {
    const pictured = category.products.filter((product) => product.image);
    const fresh = [...pictured.filter((product) => !shownFirst.has(product.id)), ...pictured.filter((product) => shownFirst.has(product.id))];
    const banner = categoryBannerUrl(category.banner);
    const windows = fresh.slice(0, HERO_WINDOWS).map(productWindow);
    if (banner) windows[0] = { key: "banner", image: banner, title: category.name, open: () => openCategory(category) };
    return {
      key: `collection-${category.id}`,
      tone: SLIDE_TONES[index % SLIDE_TONES.length],
      tab: category.name,
      eyebrow: `Collection · ${category.total} ${category.total === 1 ? "piece" : "pieces"}`,
      title: "",
      accent: category.name,
      note: `Our newest pieces in ${category.name}, each one checked by our team before it reaches you.`,
      action: `Explore ${category.name}`,
      open: () => openCategory(category),
      windows,
    };
  });

  const offers = plan.deals.filter((product) => product.image).slice(0, HERO_WINDOWS);
  const offerSlide = offers.length ? [{
    key: "offers",
    tone: "maroon",
    tab: "Offers",
    eyebrow: season ? "Diwali offers" : "On offer now",
    title: `Up to ${discountOf(plan.deals[0])}%`,
    accent: "off.",
    action: "See the best prices",
    open: openBestPrices,
    windows: offers.map(productWindow),
  }] : [];

  return [opening, ...collectionSlides, ...offerSlide];
}

export default function HomeScreen() {
  const { data, loading, refreshing, error, reload } = useLoad(loadHome, []);
  const { count } = useCart();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cardWidth = Math.min(200, (width - 32 - 14) / 2.15);
  const [season] = useState(diwaliSeason);
  const emptyStore = !loading && data?.total === 0;
  const plan = useMemo(() => (data ? planHome(data) : null), [data]);
  const slides = useMemo(() => planSlides(plan, data?.categories || [], season, loading), [plan, data, season, loading]);

  const [focused, setFocused] = useState(true);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));

  const header = (
    <View style={styles.topBar}>
      <BrandLogo size={width < 360 ? 30 : 36} light slogan={width >= 360} />
      <View style={styles.topActions}>
        {/* The mic opens the shop and starts listening; each tap is a new request. */}
        {voiceAvailable() ? <IconButton icon="mic-outline" label="Search by voice" color={CREAM} background="rgba(255,243,214,0.14)" onPress={() => router.push({ pathname: "/shop", params: { voice: String(Date.now()) } })} /> : null}
        <IconButton icon="search" label="Search" color={CREAM} background="rgba(255,243,214,0.14)" onPress={() => router.push("/shop")} />
        <IconButton icon="bag-handle-outline" label="Shopping bag" color={CREAM} background="rgba(255,243,214,0.14)" badge={count} onPress={() => router.push("/cart")} />
      </View>
    </View>
  );

  return (
    <Screen padded={false} refreshing={refreshing} onRefresh={reload}>
      {/* The banner runs up behind the clock and battery, so they turn light while this screen is showing. */}
      {focused ? <StatusBar style="light" /> : null}
      <HomeHero slides={slides} loading={loading} season={season} width={width} top={insets.top + 8} header={header} focused={focused} />
      <TrustRibbon online={data?.online} />

      <View style={styles.page}>
        {error ? <Notice tone="warning" title="We couldn’t load the latest pieces" message={error} style={styles.notice} /> : null}
        {emptyStore ? <StartSelling style={styles.notice} /> : null}
      </View>

      <CategoryNav categories={data?.categories || []} />
      <ProductRail title="Just landed" products={plan?.arrivals || []} width={cardWidth} loading={loading} />
      <Budgets budgets={plan?.budgets || []} season={season} width={width} />
      {(plan?.shelves || []).map((shelf, index) => <CategoryShelf key={shelf.category.id} {...shelf} index={index} width={cardWidth} />)}
      {emptyStore || loading ? null : <OffersBand products={plan?.deals || []} season={season} width={width} cardWidth={cardWidth} />}

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

/** Why shop with us, in one slowly moving line. */
function TrustRibbon({ online }) {
  const [offset] = useState(() => new Animated.Value(0));
  const [rowWidth, setRowWidth] = useState(0);

  useEffect(() => {
    if (!rowWidth) return undefined;
    let loop = null;
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!active || reduce) return;
      loop = Animated.loop(Animated.timing(offset, { toValue: -rowWidth, duration: rowWidth * 28, easing: Easing.linear, useNativeDriver: Platform.OS !== "web" }));
      loop.start();
    }).catch(() => {});
    return () => {
      active = false;
      loop?.stop();
    };
  }, [offset, rowWidth]);

  const items = [
    online && ["phone-portrait-outline", "UPI & net banking"],
    ["cash-outline", "Cash on delivery"],
    ["navigate-outline", "Live order tracking"],
    ["shield-checkmark-outline", "Checked by our team"],
  ].filter(Boolean);

  return (
    <View style={styles.ribbon} accessible accessibilityLabel={items.map(([, label]) => label).join(", ")}>
      <Animated.View style={[styles.ribbonTrack, { transform: [{ translateX: offset }] }]}>
        {/* Copies, so the line never runs out. */}
        {[0, 1, 2].map((copy) => (
          <View key={copy} style={styles.ribbonRow} onLayout={copy === 0 ? (event) => setRowWidth(event.nativeEvent.layout.width) : undefined}>
            {items.map(([icon, label]) => (
              <View key={label} style={styles.ribbonItem}>
                <Ionicons name={icon} size={15} color="#2a0a18" />
                <Text style={styles.ribbonText} numberOfLines={1}>{label}</Text>
              </View>
            ))}
          </View>
        ))}
      </Animated.View>
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
              {image ? <Image source={{ uri: image }} style={[StyleSheet.absoluteFill, { mixBlendMode: "multiply" }]} resizeMode="cover" /> : <Text style={styles.catnavLetter}>{category.name.charAt(0)}</Text>}
            </View>
            <Text style={styles.catnavName} numberOfLines={1}>{category.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function Rail({ products, width, onDark }) {
  return (
    <FlatList horizontal data={products} keyExtractor={(item) => String(item.id)} showsHorizontalScrollIndicator={false}
      snapToInterval={width + 14} snapToAlignment="start" decelerationRate="fast"
      contentContainerStyle={styles.rail} renderItem={({ item }) => <ProductCard product={item} width={width} onDark={onDark} />} />
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

/** Gifts by what you'd like to spend: each a small lit window on a dark tile. */
function Budgets({ budgets, season, width }) {
  if (budgets.length < 2) return null;
  const tileWidth = (width - 32 - 12) / 2;
  const arch = Math.min(84, tileWidth * 0.36);
  return (
    <View style={styles.block}>
      <View style={styles.titleRow}><Text style={styles.title}>{season ? "Gifts for every budget" : "Something for every budget"}</Text></View>
      <View style={styles.budgets}>
        {budgets.map(({ limit, product }, index) => (
          <Pressable key={limit} accessibilityRole="link" accessibilityLabel={`Under ${formatWholePrice(limit)}`} onPress={() => router.push({ pathname: "/shop", params: { max_price: String(limit - 1) } })}
            style={({ pressed }) => [styles.budget, { width: tileWidth }, pressed && styles.pressed]}>
            <LinearGradient colors={BUDGET_TONES[index % BUDGET_TONES.length]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={styles.budgetCopy}>
              <Text style={styles.budgetLabel}>Under</Text>
              <Text style={styles.budgetValue} numberOfLines={1}>{formatWholePrice(limit)}</Text>
            </View>
            <View style={[styles.budgetArch, { width: arch, height: arch * 1.34, borderTopLeftRadius: arch / 2, borderTopRightRadius: arch / 2 }]}>
              <Image source={{ uri: productImageUrl(product.image) }} style={[StyleSheet.absoluteFill, { mixBlendMode: "multiply" }]} resizeMode="cover" />
            </View>
          </Pressable>
        ))}
      </View>
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
        style={({ pressed }) => [styles.band, banner && styles.bandPhoto, pressed && styles.pressed]}>
        {banner ? (
          <>
            <Image source={{ uri: banner }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <LinearGradient colors={["rgba(10,24,19,0)", "rgba(10,24,19,0.68)"]} start={{ x: 0, y: 0.3 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
          </>
        ) : <LinearGradient colors={SHELF_TONES[index % SHELF_TONES.length]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}
        <View style={{ flex: 1 }}>
          <Text style={styles.bandName} numberOfLines={2}>{category.name}</Text>
          <Text style={styles.bandCount}>{pieces}</Text>
        </View>
        <Text style={[styles.link, styles.bandLink]}>View all</Text>
      </Pressable>
      <Rail products={products} width={width} />
    </View>
  );
}

/** The days left, ticking. */
function Countdown({ to }) {
  const [left, setLeft] = useState(() => to - Date.now());
  useEffect(() => {
    const timer = setInterval(() => setLeft(to - Date.now()), 1000);
    return () => clearInterval(timer);
  }, [to]);
  if (left <= 0) return null;
  const parts = [["Days", Math.floor(left / 86400000)], ["Hours", Math.floor(left / 3600000) % 24], ["Mins", Math.floor(left / 60000) % 60], ["Secs", Math.floor(left / 1000) % 60]];
  return (
    <View style={styles.countdown} accessible accessibilityLabel={`${parts[0][1]} days to Diwali`}>
      {parts.map(([label, value]) => (
        <View key={label} style={styles.countdownPart}>
          <Text style={styles.countdownValue}>{String(value).padStart(2, "0")}</Text>
          <Text style={styles.countdownLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

/** The festival's own moment on the screen: the greeting, the days left and the best prices. Deep green the rest of the year. */
function OffersBand({ products, season, width, cardWidth }) {
  if (!season && !products.length) return null;
  return (
    <View style={styles.offers}>
      <LinearGradient colors={season ? ["#8a1b47", "#4f0d29", "#1c0610"] : ["#23695a", "#123a30", "#06140f"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {season ? <Toran width={width} height={46} /> : null}
      <View style={styles.offersCopy}>
        {season ? <DiwaliLettering width={Math.min(280, width - 32)} /> : <Text style={styles.offersTitle}>Best prices right now</Text>}
        <Text style={styles.offersLine}>{season ? "Light up someone’s year with a gift they’ll keep." : "Marked-down prices, with the biggest savings first."}</Text>
        {season ? <Countdown to={season.diwaliAt} /> : null}
        <Pressable accessibilityRole="link" onPress={openBestPrices} style={({ pressed }) => [styles.offersCtaWrap, pressed && styles.pressed]}>
          <LinearGradient colors={["#ffe6a8", GOLD, "#dc9a38"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.offersCta}>
            <Text style={styles.offersCtaText}>{season ? "Shop the Diwali offers" : "See the best prices"}</Text>
            <Ionicons name="arrow-forward" size={16} color="#2a0a18" />
          </LinearGradient>
        </Pressable>
      </View>
      {products.length ? <Rail products={products} width={cardWidth} onDark /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 10 },
  topActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  pressed: { opacity: 0.85 },
  page: { paddingHorizontal: 16 },
  notice: { marginTop: 16 },
  cta: { flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 10, borderRadius: radius.pill, paddingHorizontal: 22, paddingVertical: 13, backgroundColor: colors.ink },
  ctaText: { color: colors.white, fontFamily: fonts.semi, fontSize: 15 },
  ribbon: { overflow: "hidden", backgroundColor: GOLD },
  ribbonTrack: { flexDirection: "row", alignSelf: "flex-start" },
  ribbonRow: { flexDirection: "row" },
  ribbonItem: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 16, paddingVertical: 9 },
  ribbonText: { color: "#2a0a18", fontFamily: fonts.medium, fontSize: 13 },
  catnav: { flexGrow: 1, justifyContent: "center", gap: 14, paddingHorizontal: 16, paddingTop: 26 },
  catnavItem: { alignItems: "center", gap: 8, width: 84 },
  catnavImage: { alignItems: "center", justifyContent: "center", overflow: "hidden", width: 76, height: 94, borderTopLeftRadius: 38, borderTopRightRadius: 38, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, backgroundColor: TILE },
  catnavLetter: { color: BRONZE, fontFamily: fonts.serif, fontSize: 30 },
  catnavName: { color: colors.ink, fontFamily: fonts.medium, fontSize: 13.5 },
  block: { marginTop: 34 },
  titleRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 14, paddingHorizontal: 16 },
  title: { flexShrink: 1, color: colors.ink, fontFamily: fonts.serif, fontSize: 32, lineHeight: 36 },
  link: { color: colors.ink, fontFamily: fonts.medium, fontSize: 14, textDecorationLine: "underline" },
  rail: { gap: 14, paddingHorizontal: 16 },
  skeleton: { height: 250, borderRadius: 12, backgroundColor: TILE },
  budgets: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 16 },
  budget: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", overflow: "hidden", minHeight: 132, borderRadius: 14, paddingLeft: 14, paddingRight: 10 },
  budgetCopy: { flexShrink: 1, paddingBottom: 14 },
  budgetLabel: { color: GOLD_SOFT, fontFamily: fonts.medium, fontSize: 13 },
  budgetValue: { color: CREAM, fontFamily: fonts.serif, fontSize: 28, lineHeight: 34 },
  budgetArch: { overflow: "hidden", borderWidth: 1, borderBottomWidth: 0, borderColor: "rgba(242,194,91,0.7)", backgroundColor: "#fff6e3" },
  band: { flexDirection: "row", alignItems: "flex-end", gap: 12, overflow: "hidden", marginBottom: 14, marginHorizontal: 16, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 15 },
  bandPhoto: { minHeight: 170 },
  bandName: { color: CREAM, fontFamily: fonts.serif, fontSize: 30, lineHeight: 34 },
  bandCount: { color: "rgba(255,243,214,0.72)", fontFamily: fonts.medium, fontSize: 13 },
  bandLink: { color: GOLD_SOFT },
  offers: { overflow: "hidden", marginTop: 40, paddingBottom: 28 },
  offersCopy: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 20 },
  offersTitle: { color: CREAM, fontFamily: fonts.serif, fontSize: 36, lineHeight: 40 },
  offersLine: { marginTop: 8, marginBottom: 16, color: "rgba(255,243,214,0.78)", fontFamily: fonts.medium, fontSize: 15, lineHeight: 21 },
  offersCtaWrap: { alignSelf: "flex-start", overflow: "hidden", borderRadius: radius.pill },
  offersCta: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 22, paddingVertical: 13 },
  offersCtaText: { color: "#2a0a18", fontFamily: fonts.semi, fontSize: 15 },
  countdown: { flexDirection: "row", gap: 8, marginBottom: 18 },
  countdownPart: { flex: 1, alignItems: "center", borderWidth: 1, borderColor: "rgba(242,194,91,0.42)", borderRadius: 10, paddingVertical: 8, backgroundColor: "rgba(0,0,0,0.2)" },
  countdownValue: { color: CREAM, fontFamily: fonts.serif, fontSize: 26, lineHeight: 30 },
  countdownLabel: { color: GOLD_SOFT, fontFamily: fonts.medium, fontSize: 11 },
  brands: { alignItems: "center", marginTop: 38, paddingHorizontal: 16 },
  brandsLabel: { marginBottom: 10, color: "#8b938d", fontFamily: fonts.medium, fontSize: 13.5 },
  brandList: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, columnGap: 22 },
  brand: { color: colors.ink, fontFamily: fonts.serif, fontSize: 21, lineHeight: 28 },
  seller: { alignItems: "center", gap: 10, marginTop: 40, borderTopWidth: 1, borderTopColor: "#e7e1d7", paddingHorizontal: 24, paddingTop: 30 },
  sellerTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 30, lineHeight: 34, textAlign: "center" },
  sellerCopy: { marginBottom: 6, color: "#5a665f", fontFamily: fonts.medium, fontSize: 14.5, lineHeight: 21, textAlign: "center" },
});
