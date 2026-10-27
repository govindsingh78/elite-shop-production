import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { Button, T } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { fetchOffers, saveCode } from "@/lib/coupons";
import { colors, fonts, radius } from "@/theme";

const TINTS = [["#fff8f1", "#fde8d8", "#f2e3d6"], ["#fdf6ff", "#f3e3fb", "#eadff3"], ["#f4fbf7", "#dff3ea", "#d9ece3"]];
const BLUE = "#2563eb";

/**
 * "Offers and discounts" on the product screen: the coupons that cover this product. Tapping a code keeps it for
 * checkout, which applies it; the share button sends the offer, and T&C shows the rules. Hidden when there are none.
 */
export default function ProductOffers({ productId, productTitle, style }) {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [offers, setOffers] = useState([]);
  const [saved, setSaved] = useState("");
  const [terms, setTerms] = useState(null);

  useEffect(() => {
    let active = true;
    fetchOffers([productId]).then((list) => active && setOffers(list));
    return () => {
      active = false;
    };
  }, [productId]);

  if (!offers.length) return null;

  const keep = (code) => {
    saveCode(code);
    setSaved(code);
    toast(`${code} saved — it’s applied at checkout`);
  };

  const share = (offer) => Share.share({ title: productTitle, message: `Use code ${offer.code} on Elitezaar: ${offer.title}` }).catch(() => {});

  return (
    <View style={[{ marginTop: 18 }, style]}>
      <T variant="h3" style={{ marginBottom: 10 }}>Offers and discounts</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
        {offers.map((offer, index) => {
          const [from, to, border] = TINTS[index % TINTS.length];
          return (
            <View key={offer.code} style={[styles.card, { backgroundColor: to, borderColor: border }]}>
              <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <View style={styles.top}>
                <View style={styles.badge}><Text style={styles.badgeText}>%</Text></View>
                <T variant="strong" numberOfLines={1} style={{ flex: 1, fontSize: 15 }}>{offer.title}</T>
                <Pressable onPress={() => setTerms(offer)} hitSlop={8}><Text style={styles.terms}>T&C ›</Text></Pressable>
              </View>
              <T variant="small" color={colors.body} numberOfLines={1} style={{ marginTop: 4 }}>{offer.description || offer.headline}</T>
              <View style={styles.perforation}>
                <View style={[styles.notch, { left: -21 }]} />
                <View style={[styles.notch, { right: -21 }]} />
              </View>
              <View style={styles.actions}>
                <Pressable onPress={() => keep(offer.code)} accessibilityRole="button" accessibilityLabel={`Use code ${offer.code}`} style={styles.code}>
                  <Text style={styles.codeText}>{saved === offer.code ? "Saved ✓" : offer.code}</Text>
                  <Ionicons name={saved === offer.code ? "checkmark" : "copy-outline"} size={15} color={colors.white} />
                </Pressable>
                <Pressable onPress={() => share(offer)} accessibilityRole="button" accessibilityLabel={`Share the ${offer.code} offer`} style={styles.share}>
                  <Ionicons name="share-social-outline" size={17} color={BLUE} />
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={Boolean(terms)} transparent animationType="slide" onRequestClose={() => setTerms(null)}>
        <Pressable style={styles.backdrop} onPress={() => setTerms(null)} />
        {terms ? (
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.handle} />
            <ScrollView>
              <Text style={styles.sheetCode}>{terms.code}</Text>
              <T variant="h2" style={{ marginTop: 10 }}>{terms.title}</T>
              {terms.description ? <T variant="body" style={{ marginTop: 4 }}>{terms.description}</T> : null}
              <T variant="label" style={{ marginTop: 16, marginBottom: 6 }}>Terms & conditions</T>
              {terms.conditions.map((line) => (
                <View key={line} style={styles.condition}><Text style={styles.bullet}>•</Text><T variant="body" style={{ flex: 1, fontSize: 15 }}>{line}</T></View>
              ))}
              {terms.terms ? <T variant="body" style={styles.extraTerms}>{terms.terms}</T> : null}
              <Button title={`Use code ${terms.code}`} icon="pricetag-outline" onPress={() => { keep(terms.code); setTerms(null); }} style={{ marginTop: 16 }} />
            </ScrollView>
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: 290, overflow: "hidden", borderWidth: 1, borderRadius: 14, padding: 12 },
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { width: 20, height: 20, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 2, borderColor: "#f6c445", backgroundColor: "#1f4ea8" },
  badgeText: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: 10 },
  terms: { color: BLUE, fontFamily: fonts.bodyBold, fontSize: 12 },
  perforation: { height: 0, marginTop: 12, borderTopWidth: 1.5, borderStyle: "dashed", borderColor: "rgba(29,47,40,0.18)" },
  notch: { position: "absolute", top: -8, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.cream },
  actions: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
  code: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, minWidth: 124, height: 36, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#9cc0ff", borderRadius: 6, paddingHorizontal: 14, backgroundColor: BLUE },
  codeText: { color: colors.white, fontFamily: fonts.bodyBold, fontSize: 14, letterSpacing: 0.8 },
  share: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#9cc0ff", borderRadius: 6, backgroundColor: colors.white },
  backdrop: { flex: 1, backgroundColor: "rgba(10,31,25,0.45)" },
  sheet: { maxHeight: "85%", borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 10, backgroundColor: colors.white },
  handle: { width: 42, height: 5, alignSelf: "center", marginBottom: 14, borderRadius: 3, backgroundColor: colors.line },
  sheetCode: { alignSelf: "flex-start", overflow: "hidden", borderWidth: 1.5, borderStyle: "dashed", borderColor: "#9cc0ff", borderRadius: 6, paddingHorizontal: 12, paddingVertical: 3, color: BLUE, backgroundColor: "#eef4ff", fontFamily: fonts.bodyBold, letterSpacing: 0.8 },
  condition: { flexDirection: "row", gap: 8, marginTop: 4 },
  bullet: { color: colors.muted, fontSize: 16, lineHeight: 22 },
  extraTerms: { marginTop: 12, borderRadius: radius.sm, padding: 10, backgroundColor: "#faf7f1", fontSize: 14 },
});
