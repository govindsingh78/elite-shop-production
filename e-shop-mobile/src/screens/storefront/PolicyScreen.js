import React from "react";
import { StyleSheet, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { PolicyHighlights, PolicySections } from "@/components/PolicyBits";
import SupportCard from "@/components/SupportCard";
import { Card, Loader, Notice, Screen, T } from "@/components/ui";
import { usePolicy } from "@/lib/policy";
import { colors, fonts, radius } from "@/theme";

/** A store policy (returns, terms…) from the same source as the website: hero, key points, numbered sections. */
export default function PolicyScreen({ slug, eyebrow, heading, accent }) {
  const { policy, error } = usePolicy(slug);

  if (error) return <Screen><Notice tone="error" message={error} /></Screen>;
  if (!policy) return <Loader />;

  return (
    <Screen>
      <LinearGradient colors={["#1f4a3d", "#0a1f19"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <T variant="eyebrow" color={colors.goldLight}>{eyebrow}</T>
        <Text style={styles.title}>{heading}<Text style={{ color: colors.teal }}>{accent}</Text></Text>
        <T variant="body" color="#c3d0c8">{policy.intro}</T>
        <Text style={styles.updated}>Last updated {policy.updated}</Text>
      </LinearGradient>

      <Card style={styles.block}>
        <PolicyHighlights policy={policy} />
      </Card>

      <PolicySections policy={policy} after={(section) => (section.contact ? <SupportCard style={{ marginBottom: 12 }} /> : null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: 22 },
  title: { marginTop: 8, marginBottom: 10, color: colors.white, fontFamily: fonts.display, fontSize: 30, lineHeight: 34, letterSpacing: -0.8 },
  updated: { alignSelf: "flex-start", marginTop: 14, overflow: "hidden", borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5, color: colors.goldLight, backgroundColor: "rgba(255,255,255,0.08)", fontFamily: fonts.bodyBold, fontSize: 13 },
  block: { marginTop: 14, marginBottom: 12 },
});
