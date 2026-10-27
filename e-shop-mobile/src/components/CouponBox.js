import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { T } from "@/components/ui";
import { checkCoupon, fetchOffers, saveCode, savedCode } from "@/lib/coupons";
import { formatPrice } from "@/lib/format";
import { colors, fonts, radius } from "@/theme";

const BLUE = "#2563eb";

/**
 * Checkout's coupon box (as on the website): type a code or pick one of the offers for this bag; a code saved from a
 * product's offers is applied when checkout opens. `applied` is the API's answer ({ code, discount, message }); it's
 * checked again when the bag or the email changes, and dropped (with the reason) if it no longer works.
 */
export default function CouponBox({ items, email, token, applied, onApplied, style }) {
  const [code, setCode] = useState("");
  const [offers, setOffers] = useState([]);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState("");
  const productKey = items.map((item) => item.id).join(",");
  const bagKey = items.map((item) => `${item.id}x${item.quantity}`).join(",");
  const latest = useRef({ applied, onApplied, items });
  useEffect(() => {
    latest.current = { applied, onApplied, items };
  });

  useEffect(() => {
    let active = true;
    fetchOffers(productKey.split(",").map(Number)).then((list) => active && setOffers(list));
    return () => {
      active = false;
    };
  }, [productKey]);

  useEffect(() => {
    let active = true;
    savedCode().then((saved) => {
      if (!active || !saved || latest.current.applied) return;
      checkCoupon(saved, latest.current.items, { email, token })
        .then((result) => active && latest.current.onApplied(result))
        .catch(() => saveCode(""));
    });
    return () => {
      active = false;
    };
    // Only when checkout opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A different bag or buyer can change the discount, or whether the code works at all (after typing stops).
  useEffect(() => {
    const current = latest.current.applied;
    if (!current) return undefined;
    let active = true;
    const timer = setTimeout(() => {
      checkCoupon(current.code, latest.current.items, { email, token })
        .then((result) => active && latest.current.onApplied(result))
        .catch((checkError) => {
          if (!active) return;
          latest.current.onApplied(null);
          saveCode("");
          setError(`${current.code} was removed: ${checkError.message}`);
        });
    }, 700);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [bagKey, email, token]);

  const apply = async (value) => {
    const wanted = value.trim().toUpperCase();
    if (!wanted) return;
    setChecking(wanted);
    setError("");
    try {
      const result = await checkCoupon(wanted, items, { email, token });
      onApplied(result);
      saveCode(result.code);
      setCode("");
    } catch (applyError) {
      setError(applyError.message);
    } finally {
      setChecking("");
    }
  };

  return (
    <View style={[styles.box, style]}>
      <T variant="strong" style={{ marginBottom: 10 }}>Coupons & offers</T>
      {applied ? (
        <View style={styles.applied}>
          <View style={styles.tick}><Ionicons name="checkmark" size={14} color={colors.white} /></View>
          <View style={{ flex: 1 }}>
            <T variant="strong">{applied.code} applied</T>
            <T variant="small" color={colors.success}>{applied.message}</T>
          </View>
          <Pressable onPress={() => { onApplied(null); saveCode(""); setError(""); }} hitSlop={8}><T variant="strong" color={colors.danger} style={{ fontSize: 14 }}>Remove</T></Pressable>
        </View>
      ) : (
        <View style={[styles.field, error && { borderColor: colors.danger }]}>
          <TextInput
            value={code}
            onChangeText={(text) => { setCode(text.toUpperCase().replace(/\s/g, "")); setError(""); }}
            onSubmitEditing={() => apply(code)}
            placeholder="Enter coupon code"
            placeholderTextColor={colors.faint}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            accessibilityLabel="Coupon code"
            style={styles.input}
          />
          <Pressable onPress={() => apply(code)} disabled={!code.trim() || Boolean(checking)} hitSlop={6} style={styles.applyButton}>
            {checking && checking === code.trim() ? <ActivityIndicator size="small" color={BLUE} /> : <Text style={[styles.applyText, !code.trim() && { color: colors.faint }]}>Apply</Text>}
          </Pressable>
        </View>
      )}
      {error ? <T variant="small" color={colors.danger} style={{ marginTop: 6 }}>{error}</T> : null}
      {!applied && offers.length ? offers.map((offer) => (
        <View key={offer.code} style={styles.offer}>
          <View style={{ flex: 1 }}>
            <Text style={styles.offerCode}>{offer.code}</Text>
            <T variant="small" color={colors.body} numberOfLines={2}>{offer.title}</T>
            {offer.min_order ? <T variant="small">On {formatPrice(offer.min_order)} or more</T> : null}
          </View>
          <Pressable onPress={() => apply(offer.code)} disabled={Boolean(checking)} hitSlop={6} style={styles.offerApply}>
            {checking === offer.code ? <ActivityIndicator size="small" color={BLUE} /> : <Text style={styles.applyText}>Apply</Text>}
          </Pressable>
        </View>
      )) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginBottom: 14, borderWidth: 1, borderStyle: "dashed", borderColor: "#cfe1d9", borderRadius: radius.md, padding: 12, backgroundColor: "#fbfdfc" },
  applied: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: radius.sm, padding: 10, backgroundColor: colors.successSoft },
  tick: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.success },
  field: { flexDirection: "row", alignItems: "center", height: 46, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.white },
  input: { flex: 1, height: "100%", paddingHorizontal: 12, color: colors.text, fontFamily: fonts.bodyBold, fontSize: 15, letterSpacing: 0.8 },
  applyButton: { minWidth: 72, height: "100%", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  applyText: { color: BLUE, fontFamily: fonts.bodyBold, fontSize: 14 },
  offer: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10, borderTopWidth: 1, borderTopColor: colors.lineSoft, paddingTop: 10 },
  offerCode: { color: BLUE, fontFamily: fonts.bodyBold, fontSize: 14, letterSpacing: 0.8 },
  offerApply: { minWidth: 64, alignItems: "center", borderWidth: 1, borderColor: "#9cc0ff", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
});
