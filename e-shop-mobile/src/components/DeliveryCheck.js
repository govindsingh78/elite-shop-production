import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { T } from "@/components/ui";
import { api } from "@/lib/api";
import { readJson, writeJson } from "@/lib/storage";
import { colors, fonts, radius } from "@/theme";

const STORAGE_KEY = "elitezaar.deliveryPincode";

/**
 * "Delivery to" on the product screen: a PIN code tells the shopper whether we deliver there and roughly when, from
 * where this product ships (the same check as the website). The last PIN code is remembered and checked on every product.
 */
export default function DeliveryCheck({ productId, style }) {
  const [pincode, setPincode] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const check = useCallback(async (value) => {
    setChecking(true);
    setError("");
    try {
      const data = await api("/storefront/delivery", { query: { pincode: value, product: productId } });
      setResult(data);
      writeJson(STORAGE_KEY, data.pincode);
    } catch (checkError) {
      setResult(null);
      setError(checkError.fieldErrors?.pincode || checkError.message);
    } finally {
      setChecking(false);
    }
  }, [productId]);

  // A PIN code checked before is checked for this product straight away.
  useEffect(() => {
    let active = true;
    readJson(STORAGE_KEY, "").then((saved) => {
      if (active && saved) {
        setPincode(saved);
        check(saved);
      }
    });
    return () => {
      active = false;
    };
  }, [check]);

  const submit = () => {
    if (pincode.length !== 6) {
      setResult(null);
      setError("Enter a 6-digit PIN code, like 302016.");
      return;
    }
    check(pincode);
  };

  return (
    <View style={[styles.box, style]}>
      <T variant="h3">Delivery to</T>
      <T variant="small" style={{ marginTop: 2, marginBottom: 10 }}>Enter your PIN code to check delivery info</T>
      <View style={[styles.field, error && styles.fieldError]}>
        <TextInput
          value={pincode}
          onChangeText={(text) => { setPincode(text.replace(/\D/g, "").slice(0, 6)); setError(""); }}
          onSubmitEditing={submit}
          placeholder="Enter PIN code"
          placeholderTextColor={colors.faint}
          keyboardType="number-pad"
          autoComplete="postal-code"
          textContentType="postalCode"
          maxLength={6}
          returnKeyType="done"
          accessibilityLabel="PIN code"
          style={styles.input}
        />
        <Pressable onPress={submit} disabled={checking} hitSlop={8} accessibilityRole="button" style={styles.checkButton}>
          {checking ? <ActivityIndicator size="small" color={colors.tealDark} /> : <Text style={styles.checkText}>CHECK</Text>}
        </Pressable>
      </View>
      {error ? <T variant="small" color={colors.danger} style={{ marginTop: 6 }}>{error}</T> : null}
      {result ? (
        <View style={[styles.result, result.deliverable ? styles.ok : styles.no]}>
          <View style={[styles.icon, { backgroundColor: result.deliverable ? colors.success : colors.danger }]}>
            <Ionicons name={result.deliverable ? "checkmark" : "close"} size={14} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            {result.deliverable ? (
              <>
                <T variant="strong">{result.label}</T>
                <T variant="small" color={colors.body}>{result.message}</T>
                <T variant="small">To {result.pincode}{result.to ? ` · ${result.to}` : ""} · {result.window}</T>
              </>
            ) : <T variant="body" color={colors.danger} style={{ fontSize: 15 }}>{result.message}</T>}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 18, borderTopWidth: 1, borderTopColor: colors.lineSoft, paddingTop: 16 },
  field: { flexDirection: "row", alignItems: "center", height: 50, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.white },
  fieldError: { borderColor: colors.danger },
  input: { flex: 1, height: "100%", paddingHorizontal: 14, color: colors.text, fontFamily: fonts.bodySemi, fontSize: 16, letterSpacing: 1 },
  checkButton: { minWidth: 76, alignItems: "center", justifyContent: "center", paddingHorizontal: 14, height: "100%" },
  checkText: { color: "#c4502f", fontFamily: fonts.bodyBold, fontSize: 13, letterSpacing: 1.2 },
  result: { flexDirection: "row", gap: 10, marginTop: 12, borderRadius: radius.md, padding: 12 },
  ok: { backgroundColor: colors.successSoft },
  no: { backgroundColor: colors.dangerSoft },
  icon: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: 12, marginTop: 1 },
});
