import React from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import BrandLogo from "@/components/BrandLogo";
import SupportCard from "@/components/SupportCard";
import { Button, Card, Chip, Screen, SectionHeader, T } from "@/components/ui";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";
import { colors, fonts, radius } from "@/theme";

const PROMISES = [
  ["shield-checkmark-outline", "Every listing reviewed", "Products from our sellers are checked by the Elitezaar team before they appear in the store."],
  ["storefront-outline", "Independent sellers", "We are home to independent brands and makers, so every order supports a real business."],
  ["navigate-outline", "Tracked to your door", "Follow your order from packing to delivery, with live updates in your account."],
  ["card-outline", "Pay your way", "UPI, net banking or cash on delivery. Online payments are processed securely by Razorpay."],
];

const STEPS = [
  ["Discover", "Browse collections picked for everyday wear, from wardrobe staples to the finishing touches."],
  ["Order", "Check out as a guest or with an account, and pay online or in cash when it arrives."],
  ["Track", "Watch your order move from our sellers to your door, and call us if you need a hand."],
];

/** About Elitezaar: who we are, what we promise, and how to reach us. */
export default function AboutScreen() {
  const { data: categories } = useLoad(() => api("/storefront/categories"), []);

  return (
    <Screen>
      <LinearGradient colors={["#1f4a3d", "#0a1f19"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <BrandLogo light size={44} />
        <T variant="eyebrow" color={colors.goldLight} style={{ marginTop: 22 }}>Our story</T>
        <Text style={styles.heroTitle}>Good things, <Text style={{ color: colors.teal }}>chosen well.</Text></Text>
        <T variant="body" color="#c3d0c8">Elitezaar is an online marketplace for considered everyday style: clothing, accessories and more from independent sellers, brought together in one carefully kept store.</T>
      </LinearGradient>

      <Card style={styles.section}>
        <T variant="eyebrow">Who we are</T>
        <T variant="h2" style={{ marginTop: 6, marginBottom: 10 }}>A store you can trust, made of sellers you’ll love.</T>
        <T variant="body">Shopping online should feel as considered as a good local shop. Instead of an endless aisle, Elitezaar keeps a curated edit: pieces chosen to be worn on repeat, from sellers who care about what they make.</T>
        <T variant="body" style={{ marginTop: 10 }}>Every seller runs their own store with us, and every product they list is reviewed by our team before shoppers can see it. You get the variety of a marketplace with the care of a boutique.</T>
      </Card>

      <View style={styles.quote}>
        <Text style={styles.quoteText}>“Fewer, better things, chosen with care and delivered with it too.”</Text>
        <T variant="eyebrow" color={colors.goldDeep} style={{ marginTop: 10 }}>The Elitezaar promise</T>
      </View>

      <SectionHeader eyebrow="Why Elitezaar" title="What we promise" style={styles.sectionHeader} />
      {PROMISES.map(([icon, title, copy]) => (
        <Card key={title} style={styles.promise}>
          <View style={styles.promiseIcon}><Ionicons name={icon} size={22} color={colors.emerald} /></View>
          <View style={{ flex: 1 }}>
            <T variant="h3">{title}</T>
            <T variant="small" style={{ marginTop: 3 }}>{copy}</T>
          </View>
        </Card>
      ))}

      <SectionHeader eyebrow="How it works" title="From our sellers to your door" style={styles.sectionHeader} />
      <View style={styles.steps}>
        {STEPS.map(([title, copy], index) => (
          <View key={title} style={[styles.step, index < STEPS.length - 1 && styles.stepLine]}>
            <Text style={styles.stepNumber}>{String(index + 1).padStart(2, "0")}</Text>
            <View style={{ flex: 1 }}>
              <T variant="h3">{title}</T>
              <T variant="small" style={{ marginTop: 3 }}>{copy}</T>
            </View>
          </View>
        ))}
      </View>

      {categories?.length ? (
        <>
          <SectionHeader eyebrow="Our collections" title="Find your edit" actionLabel="All products" onAction={() => router.push("/shop")} style={styles.sectionHeader} />
          <View style={styles.chips}>
            {categories.map((category) => (
              <Chip key={category.id} label={category.name} icon="pricetags-outline" onPress={() => router.push({ pathname: "/shop", params: { category: category.slug } })} />
            ))}
          </View>
        </>
      ) : null}

      <LinearGradient colors={["#3d4a2a", "#14271f"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, styles.section]}>
        <T variant="eyebrow" color={colors.goldLight}>For sellers</T>
        <Text style={styles.panelTitle}>Grow your brand with us</Text>
        <T variant="body" color="#c9d3c7">Open your Elitezaar store, list your products and manage orders and shipping from one simple seller hub.</T>
        <Button title="Become a seller" variant="gold" icon="sparkles-outline" onPress={() => router.push("/vendor-register")} style={{ marginTop: 16 }} />
      </LinearGradient>

      <Button title="Start shopping" icon="bag-handle-outline" onPress={() => router.push("/shop")} style={styles.section} />

      <SupportCard style={styles.section} />

      <T variant="small" center style={styles.credits}>
        Country, state and city lists in our address forms come from the{" "}
        <Text style={styles.link} onPress={() => Linking.openURL("https://github.com/dr5hn/countries-states-cities-database")}>Countries States Cities Database</Text>
        {" "}© its contributors, used under the{" "}
        <Text style={styles.link} onPress={() => Linking.openURL("https://opendatacommons.org/licenses/odbl/1-0/")}>Open Database License</Text>.
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xl, padding: 22 },
  heroTitle: { marginTop: 8, marginBottom: 10, color: colors.white, fontFamily: fonts.display, fontSize: 30, lineHeight: 34, letterSpacing: -0.8 },
  section: { marginTop: 16 },
  sectionHeader: { marginTop: 26 },
  quote: { marginTop: 16, borderLeftWidth: 3, borderLeftColor: colors.gold, borderRadius: radius.md, paddingHorizontal: 18, paddingVertical: 16, backgroundColor: colors.goldSoft },
  quoteText: { color: colors.ink, fontFamily: fonts.heading, fontSize: 19, lineHeight: 25 },
  promise: { flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 10 },
  promiseIcon: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.mint },
  steps: { borderRadius: radius.lg, paddingHorizontal: 18, paddingVertical: 6, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.lineSoft },
  step: { flexDirection: "row", gap: 14, paddingVertical: 14 },
  stepLine: { borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  stepNumber: { width: 42, color: colors.gold, fontFamily: fonts.display, fontSize: 26, letterSpacing: -0.6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  panelTitle: { marginTop: 6, marginBottom: 8, color: colors.white, fontFamily: fonts.display, fontSize: 24, letterSpacing: -0.6 },
  credits: { marginTop: 20, paddingHorizontal: 8, lineHeight: 18 },
  link: { color: colors.tealDark, textDecorationLine: "underline" },
});
