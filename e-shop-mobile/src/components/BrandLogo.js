import React, { useId } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { colors, fonts } from "@/theme";

/** The Elitezaar mark: a bold "Z" in a gold shopfront arch. Same artwork as the website's favicon. */
export function BrandMark({ size = 40 }) {
  // Unique gradient ids: on the web every SVG shares one document, and a hidden screen's logo would otherwise claim them.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const tile = `ezTile${uid}`;
  const gold = `ezGold${uid}`;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityLabel="Elitezaar">
      <Defs>
        <LinearGradient id={tile} x1="6" y1="4" x2="42" y2="46" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#1f5a4a" />
          <Stop offset="0.55" stopColor="#123a30" />
          <Stop offset="1" stopColor="#0a1f19" />
        </LinearGradient>
        <LinearGradient id={gold} x1="12" y1="4" x2="36" y2="40" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#f6e3b8" />
          <Stop offset="1" stopColor="#c99a5b" />
        </LinearGradient>
      </Defs>
      <Rect width="48" height="48" rx="13" fill={`url(#${tile})`} />
      <Rect x="0.75" y="0.75" width="46.5" height="46.5" rx="12.25" fill="none" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="1.5" />
      <Path d="M13 39.5V21.5a11 11 0 0 1 22 0v18" fill="none" stroke={`url(#${gold})`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M18.6 20.5h10.8L18.6 32.5h10.8" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M39.5 4.5c.4 2.1 1.4 3.1 3.5 3.5-2.1.4-3.1 1.4-3.5 3.5-.4-2.1-1.4-3.1-3.5-3.5 2.1-.4 3.1-1.4 3.5-3.5Z" fill={`url(#${gold})`} />
    </Svg>
  );
}

/** Mark, wordmark and slogan. `light` is for dark backgrounds. */
export default function BrandLogo({ size = 40, light = false, slogan = true }) {
  return (
    <View style={styles.row}>
      <BrandMark size={size} />
      <View>
        <Text style={[styles.word, { fontSize: size * 0.56, color: light ? colors.white : colors.ink }]}>
          Elite<Text style={[styles.zaar, { color: light ? "#9fd9df" : colors.tealDark }]}>zaar</Text>
          <Text style={[styles.dot, { fontSize: size * 0.28, color: light ? colors.goldLight : "#b8874c" }]}>.com</Text>
        </Text>
        {slogan ? <Text style={[styles.slogan, { color: light ? "#d3b894" : "#8a7a5e" }]}>EVERYDAY, ELEVATED.</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  word: { fontFamily: fonts.display, letterSpacing: -0.8 },
  zaar: { fontFamily: fonts.medium, letterSpacing: -0.5 },
  dot: { fontFamily: fonts.semi, letterSpacing: 0 },
  slogan: { marginTop: 1, fontFamily: fonts.bodyBold, fontSize: 9.5, letterSpacing: 2 },
});
