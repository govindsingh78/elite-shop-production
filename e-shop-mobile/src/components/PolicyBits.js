import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, Card, T } from "@/components/ui";
import { POLICY_ROUTES, RETURN_POLICY, usePolicy } from "@/lib/policy";
import { colors, fonts, radius } from "@/theme";

const ICONS = { calendar: "calendar-outline", refund: "refresh-circle-outline", shield: "shield-checkmark-outline", support: "headset-outline", card: "card-outline" };

/** The policy's key points. */
export function PolicyHighlights({ policy, style }) {
  return (
    <View style={[styles.highlights, style]}>
      {policy.highlights.map((highlight) => (
        <View key={highlight.title} style={styles.highlight}>
          <View style={styles.highlightIcon}><Ionicons name={ICONS[highlight.icon] || "shield-checkmark-outline"} size={20} color={colors.emerald} /></View>
          <View style={{ flex: 1 }}>
            <T variant="strong">{highlight.title}</T>
            <T variant="small">{highlight.text}</T>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Every section, numbered, as cards. `after(section)` can add something below a section (e.g. contact buttons). */
export function PolicySections({ policy, after }) {
  return policy.sections.map((section, index) => (
    <React.Fragment key={section.id}>
      <Card style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionNumber}>{String(index + 1).padStart(2, "0")}</Text>
          <T variant="h3" style={{ flex: 1 }}>{section.title}</T>
        </View>
        {section.blocks.map((block, blockIndex) => {
          if (block.type === "list") {
            return (
              <View key={blockIndex}>
                {block.items.map((item) => (
                  <View key={item} style={styles.bullet}>
                    <View style={styles.bulletDot} />
                    <T variant="body" style={styles.flexText}>{item}</T>
                  </View>
                ))}
              </View>
            );
          }
          if (block.type === "steps") {
            return (
              <View key={blockIndex}>
                {block.items.map((item, step) => (
                  <View key={item} style={styles.step}>
                    <View style={styles.stepBadge}><Text style={styles.stepNumber}>{step + 1}</Text></View>
                    <T variant="body" style={styles.flexText}>{item}</T>
                  </View>
                ))}
              </View>
            );
          }
          if (block.type === "note") {
            return <View key={blockIndex} style={styles.note}><T variant="body" color="#6e5a3a">{block.text}</T></View>;
          }
          if (block.type === "link") {
            return (
              <Pressable key={blockIndex} onPress={() => router.push(POLICY_ROUTES[block.to] || "/")} accessibilityRole="link" style={({ pressed }) => [styles.link, pressed && { opacity: 0.7 }]}>
                <Text style={styles.linkText}>{block.text}</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.emerald} />
              </Pressable>
            );
          }
          return <T key={blockIndex} variant="body" style={styles.paragraph}>{block.text}</T>;
        })}
      </Card>
      {after ? after(section) : null}
    </React.Fragment>
  ));
}

/** Checkout card: the key points and a link to the full policy. */
export function PolicySummaryCard({ style }) {
  const { policy } = usePolicy(RETURN_POLICY);
  return (
    <Card style={style}>
      <View style={styles.summaryHead}>
        <View style={styles.highlightIcon}><Ionicons name="refresh-circle-outline" size={20} color={colors.emerald} /></View>
        <View style={{ flex: 1 }}>
          <T variant="h3">Returns &amp; refunds</T>
          <T variant="small">{policy ? policy.highlights.slice(0, 2).map((highlight) => highlight.title).join(" · ") : "Easy returns on eligible items"}</T>
        </View>
      </View>
      {policy ? <PolicyHighlights policy={policy} style={{ marginTop: 12 }} /> : null}
      <Button title="Read the full policy" variant="outline" icon="document-text-outline" small onPress={() => router.push("/return-policy")} style={{ marginTop: 12 }} />
    </Card>
  );
}

/** The "I agree" tick shoppers must give before ordering. The policy name opens the full text. */
export function PolicyConsent({ checked, onChange, error }) {
  return (
    <Pressable onPress={() => onChange(!checked)} accessibilityRole="checkbox" accessibilityState={{ checked }} style={styles.consent} hitSlop={4}>
      <Ionicons name={checked ? "checkbox" : "square-outline"} size={22} color={error ? colors.danger : colors.emerald} />
      <Text style={[styles.consentText, error && { color: colors.danger }]}>
        I have read and agree to the{" "}
        <Text style={styles.consentLink} onPress={() => router.push("/terms")}>Terms &amp; Conditions</Text>
        {" "}and the{" "}
        <Text style={styles.consentLink} onPress={() => router.push("/return-policy")}>Return &amp; Refund Policy</Text>
      </Text>
    </Pressable>
  );
}

/** "By creating an account, you agree to our Terms & Conditions." */
export function TermsNote({ action = "creating an account", style }) {
  return (
    <Text style={[styles.termsNote, style]}>
      By {action}, you agree to our{" "}
      <Text style={styles.consentLink} onPress={() => router.push("/terms")}>Terms &amp; Conditions</Text>.
    </Text>
  );
}

const styles = StyleSheet.create({
  highlights: { gap: 10 },
  highlight: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  highlightIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: colors.mint },
  section: { marginBottom: 12 },
  sectionHead: { flexDirection: "row", alignItems: "baseline", gap: 10, marginBottom: 8 },
  sectionNumber: { color: colors.gold, fontFamily: fonts.display, fontSize: 16 },
  paragraph: { marginBottom: 8 },
  flexText: { flex: 1 },
  bullet: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  bulletDot: { width: 6, height: 6, marginTop: 9, borderRadius: 3, backgroundColor: colors.teal },
  step: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 8, borderRadius: radius.md, padding: 12, backgroundColor: colors.paper },
  stepBadge: { width: 26, height: 26, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: colors.emerald },
  stepNumber: { color: colors.white, fontFamily: fonts.heading, fontSize: 13 },
  note: { marginTop: 2, borderLeftWidth: 3, borderLeftColor: colors.gold, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.goldSoft },
  summaryHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  consent: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  consentText: { flex: 1, color: colors.text, fontFamily: fonts.bodySemi, fontSize: 15 },
  consentLink: { color: colors.tealDark, fontFamily: fonts.bodyBold, textDecorationLine: "underline" },
  link: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", marginTop: 4, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.mint },
  linkText: { color: colors.emerald, fontFamily: fonts.bodyBold, fontSize: 15 },
  termsNote: { marginTop: 12, color: colors.muted, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, textAlign: "center" },
});
