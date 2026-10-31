import React, { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { DiyaRow, Embers, HangingLantern, SkySparkles, Toran } from "@/components/Diwali";
import { formatWholePrice } from "@/lib/format";
import { fonts, radius } from "@/theme";

const SLIDE_MS = 6500;
const native = Platform.OS !== "web";
const CREAM = "#fff3d6";
const GOLD = "#f2c25b";
const TONES = {
  maroon: ["#8a1b47", "#4f0d29", "#1c0610"],
  forest: ["#23695a", "#123a30", "#06140f"],
  aubergine: ["#5a2f86", "#2d1652", "#0f0820"],
  terracotta: ["#9c4318", "#5a220c", "#1e0b04"],
};

/** One colour of night sky, glowing behind the windows. */
function Sky({ tone }) {
  const [inner, middle, outer] = TONES[tone];
  const id = `sky-${tone}`;
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id={id} cx="60%" cy="68%" r="80%"><Stop offset="0" stopColor={inner} /><Stop offset="0.46" stopColor={middle} /><Stop offset="1" stopColor={outer} /></RadialGradient>
      </Defs>
      <Rect width="100" height="100" fill={`url(#${id})`} />
    </Svg>
  );
}

/** One lit window, the photo filling it. A white background melts into the light. */
function Window({ item, width, height, asleep }) {
  const arch = { borderTopLeftRadius: width / 2, borderTopRightRadius: width / 2 };
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={item.price != null ? `${item.title}, ${formatWholePrice(item.price)}` : item.title} onPress={item.open}
      style={({ pressed }) => [{ width, height }, pressed && styles.pressed]}>
      <View style={[styles.windowLine, arch]}>
        <View style={[styles.glass, { borderTopLeftRadius: width / 2 - 5, borderTopRightRadius: width / 2 - 5 }]}>
          <LinearGradient colors={["#ffefcb", "#fffaf0", "#f6d296"]} locations={[0, 0.62, 1]} style={StyleSheet.absoluteFill} />
          {item.image && !asleep ? <Image source={{ uri: item.image }} resizeMode="cover" style={[StyleSheet.absoluteFill, styles.photo]} /> : null}
        </View>
      </View>
      <Text style={styles.price} numberOfLines={1}>{item.price != null ? formatWholePrice(item.price) : item.title}</Text>
    </Pressable>
  );
}

/** The largest window stands in the middle. */
function Windows({ items, width, height, asleep }) {
  const count = items.length;
  const gap = 10;
  const space = width - gap * (count - 1);
  const side = count === 3 ? space / 3.34 : space / Math.max(count, 1);
  const [first, second, third] = items;
  const ordered = third ? [second, first, third] : items;
  return (
    <View style={[styles.windows, { height, gap }]}>
      {ordered.map((item) => {
        const large = count === 3 && item === first;
        const single = count === 1;
        return (
          <Window key={item.key} item={item} asleep={asleep} width={single ? Math.min(space, height * 0.72) : large ? side * 1.34 : side} height={large || count < 3 ? height : height - 24} />
        );
      })}
    </View>
  );
}

function Slide({ slide, index, scrollX, width, height, windowsHeight, loading, reserve, asleep }) {
  // Pages slide across as normal; the windows travel a little further, which gives the slider its depth.
  const drift = (distance) => scrollX.interpolate({ inputRange: [(index - 1) * width, index * width, (index + 1) * width], outputRange: [distance, 0, -distance], extrapolate: "clamp" });
  const items = loading ? [{ key: "a", title: "" }, { key: "b", title: "" }, { key: "c", title: "" }] : slide.windows;
  return (
    <View style={{ width, height, paddingHorizontal: 16, paddingTop: reserve }}>
      <Animated.View style={[styles.copy, { transform: [{ translateX: drift(width * 0.08) }] }]}>
        <View>
          <Text style={styles.eyebrow} numberOfLines={1}>{slide.eyebrow}</Text>
          {slide.title ? <Text style={styles.title} numberOfLines={1}>{slide.title}</Text> : null}
          <Text style={[styles.title, styles.accent]} numberOfLines={1} adjustsFontSizeToFit>{slide.accent}</Text>
          {slide.note ? <Text style={styles.note} numberOfLines={2}>{slide.note}</Text> : null}
        </View>
        <Pressable accessibilityRole="link" onPress={slide.open} style={({ pressed }) => [styles.ctaWrap, pressed && styles.pressed]}>
          <LinearGradient colors={["#ffe6a8", GOLD, "#dc9a38"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cta}>
            <Text style={styles.ctaText}>{slide.action}</Text>
            <Ionicons name="arrow-forward" size={16} color="#2a0a18" />
          </LinearGradient>
        </Pressable>
      </Animated.View>
      {items.length ? (
        <Animated.View style={{ marginTop: 16, transform: [{ translateX: drift(width * 0.26) }] }}>
          <Windows items={items} width={width - 32} height={windowsHeight} asleep={asleep} />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** The home banner: a night sky, with each slide's products in lit arched windows. Swipes, and moves on by itself. */
export default function HomeHero({ slides, loading, season, width, top, header, focused }) {
  const [scrollX] = useState(() => new Animated.Value(0));
  const [progress] = useState(() => new Animated.Value(0));
  const [active, setActive] = useState(0);
  const [held, setHeld] = useState(false);
  const [calm, setCalm] = useState(false);
  // Photos wait until their slide is next, so the screen doesn't fetch every slide's up front.
  const [furthest, setFurthest] = useState(0);
  const list = useRef(null);
  const count = slides.length;
  const hasWindows = loading || slides.some((slide) => slide.windows.length);

  const windowsHeight = Math.min(290, Math.max(220, width * 0.64));
  const reserve = season ? 52 : 10;
  const copyHeight = 196;
  const slideHeight = reserve + copyHeight + (hasWindows ? 16 + windowsHeight + 26 : 0);
  const footHeight = (count > 1 ? 18 : 0) + (season ? 64 : 18);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setCalm).catch(() => {});
  }, []);

  const goTo = useCallback((index) => list.current?.scrollToOffset({ offset: index * width, animated: true }), [width]);

  // The bar along the active segment doubles as the timer for the next slide.
  useEffect(() => {
    progress.setValue(0);
    if (count < 2 || calm || held || !focused) return undefined;
    const run = Animated.timing(progress, { toValue: 1, duration: SLIDE_MS, easing: Easing.linear, useNativeDriver: false });
    run.start(({ finished }) => {
      if (finished) goTo((active + 1) % count);
    });
    return () => run.stop();
  }, [active, calm, count, focused, goTo, held, progress]);

  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
    useNativeDriver: native,
    listener: (event) => {
      const index = Math.round(event.nativeEvent.contentOffset.x / width);
      if (index >= 0 && index < count) {
        setActive(index);
        setFurthest((seen) => Math.max(seen, index));
      }
    },
  });

  return (
    <View style={styles.hero}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: TONES[slides[0]?.tone || "maroon"][1] }]} />
      {slides.map((slide, index) => (
        <Animated.View key={slide.key} pointerEvents="none" style={[StyleSheet.absoluteFill, {
          opacity: count > 1 ? scrollX.interpolate({ inputRange: [(index - 1) * width, index * width, (index + 1) * width], outputRange: [0, 1, 0], extrapolate: "clamp" }) : 1,
        }]}><Sky tone={slide.tone} /></Animated.View>
      ))}
      {season ? <><SkySparkles width={width} /><Embers /></> : null}

      <View style={{ paddingTop: top }}>{header}</View>

      <View>
        <Animated.FlatList
          ref={list}
          horizontal
          pagingEnabled
          data={slides}
          extraData={furthest}
          keyExtractor={(slide) => slide.key}
          showsHorizontalScrollIndicator={false}
          scrollEnabled={count > 1}
          removeClippedSubviews={false}
          initialNumToRender={count}
          getItemLayout={(data, index) => ({ length: width, offset: width * index, index })}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onScrollBeginDrag={() => setHeld(true)}
          onMomentumScrollEnd={() => setHeld(false)}
          onScrollEndDrag={() => setHeld(false)}
          renderItem={({ item, index }) => <Slide slide={item} index={index} scrollX={scrollX} width={width} height={slideHeight} windowsHeight={windowsHeight} loading={loading} reserve={reserve} asleep={index > furthest + 1} />}
        />
        {season ? <View style={styles.toran} pointerEvents="none"><Toran width={width} height={46} /></View> : null}
        {season ? <HangingLantern width={width} /> : null}
      </View>

      <View style={{ height: footHeight }}>
        {count > 1 ? (
          <View style={styles.segments}>
            {slides.map((slide, index) => (
              <Pressable key={slide.key} accessibilityRole="button" accessibilityLabel={`Show ${slide.tab}`} hitSlop={10} onPress={() => goTo(index)} style={styles.segment}>
                <Animated.View style={[styles.segmentFill, {
                  width: index < active || (index === active && calm) ? "100%" : index === active ? progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) : "0%",
                }]} />
              </Pressable>
            ))}
          </View>
        ) : null}
        {season ? <View style={styles.diyas} pointerEvents="none"><DiyaRow width={width} /></View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { overflow: "hidden" },
  pressed: { opacity: 0.85 },
  toran: { position: "absolute", top: 0, left: 0 },
  copy: { height: 196, justifyContent: "space-between" },
  eyebrow: { marginBottom: 8, color: "#f6d58e", fontFamily: fonts.medium, fontSize: 13.5 },
  title: { color: CREAM, fontFamily: fonts.serif, fontSize: 50, lineHeight: 54 },
  accent: { color: GOLD, fontFamily: fonts.serifItalic },
  note: { marginTop: 6, color: "rgba(255,243,214,0.76)", fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  ctaWrap: { alignSelf: "flex-start", overflow: "hidden", borderRadius: radius.pill },
  cta: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 22, paddingVertical: 13 },
  ctaText: { color: "#2a0a18", fontFamily: fonts.semi, fontSize: 15 },
  windows: { flexDirection: "row", alignItems: "flex-end", justifyContent: "center" },
  windowLine: { flex: 1, overflow: "hidden", borderWidth: 1, borderBottomWidth: 1, borderColor: "rgba(242,194,91,0.85)", padding: 4 },
  glass: { flex: 1, overflow: "hidden", backgroundColor: "#fff6e3" },
  photo: { width: "100%", height: "100%", mixBlendMode: "multiply" },
  price: { marginTop: 7, color: GOLD, fontFamily: fonts.semi, fontSize: 13.5, textAlign: "center" },
  segments: { flexDirection: "row", gap: 5, paddingHorizontal: 16 },
  segment: { flex: 1, overflow: "hidden", height: 3, borderRadius: 2, backgroundColor: "rgba(255,243,214,0.22)" },
  segmentFill: { height: "100%", backgroundColor: GOLD },
  diyas: { position: "absolute", right: 0, bottom: 0, left: 0 },
});
