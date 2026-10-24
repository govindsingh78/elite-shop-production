import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import ProductCard from "@/components/ProductCard";
import { Button, Card, EmptyState, Screen, T } from "@/components/ui";
import { HEART } from "@/components/WishlistButton";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/context/ToastContext";
import { useWishlist } from "@/context/WishlistContext";
import { colors, fonts, radius } from "@/theme";

const canBuy = (item) => item.available !== false && item.qty !== 0;

/** Saved pieces, with "Move to bag". Guests are invited to sign in so the list follows them to the website. */
export default function WishlistScreen() {
  const { items, remove } = useWishlist();
  const { addItem } = useCart();
  const { isCustomer } = useAuth();
  const toast = useToast();

  const removeItem = (item) => remove(item.id).catch((error) => toast(error.message, "error"));
  const moveToBag = (item) => {
    addItem(item, 1);
    removeItem(item);
    toast(`${item.title} moved to your bag`);
  };

  const signInCard = !isCustomer ? (
    <Card style={styles.signIn}>
      <View style={styles.signInRow}>
        <View style={styles.signInIcon}><Ionicons name="heart" size={20} color={HEART} /></View>
        <View style={{ flex: 1 }}>
          <T variant="strong">Keep your wishlist everywhere</T>
          <T variant="small">Sign in to save these pieces to your account and see them on elitezaar.com too.</T>
        </View>
      </View>
      <Button title="Sign in" icon="log-in-outline" small onPress={() => router.push("/login")} style={{ marginTop: 12 }} />
    </Card>
  ) : null;

  if (!items.length) {
    return (
      <Screen>
        <EmptyState icon="heart-outline" title="Your wishlist is empty" message="Tap the heart on any piece to save it here, then move it to your bag when you’re ready." actionLabel="Explore the collection" onAction={() => router.push("/shop")} />
      </Screen>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => String(item.id)}
      numColumns={2}
      columnWrapperStyle={styles.column}
      contentContainerStyle={styles.list}
      style={{ backgroundColor: colors.cream }}
      ListHeaderComponent={(
        <View>
          {signInCard}
          <T variant="label" style={{ marginBottom: 12 }}>{items.length} saved</T>
        </View>
      )}
      renderItem={({ item }) => (
        <View style={styles.cell}>
          <ProductCard product={item} />
          {item.available === false ? <Text style={styles.unavailable}>No longer available</Text> : null}
          <View style={styles.actions}>
            <Pressable onPress={() => moveToBag(item)} disabled={!canBuy(item)} style={({ pressed }) => [styles.move, !canBuy(item) && styles.moveDisabled, pressed && { opacity: 0.85 }]}>
              <Text style={[styles.moveText, !canBuy(item) && { color: colors.muted }]}>{item.available === false ? "Unavailable" : item.qty === 0 ? "Sold out" : "Move to bag"}</Text>
            </Pressable>
            <Pressable onPress={() => removeItem(item)} hitSlop={6} accessibilityLabel={`Remove ${item.title} from your wishlist`} style={({ pressed }) => [styles.remove, pressed && { opacity: 0.7 }]}>
              <Ionicons name="trash-outline" size={17} color={colors.muted} />
            </Pressable>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 40 },
  column: { gap: 14 },
  cell: { flex: 1, maxWidth: "50%", marginBottom: 22 },
  signIn: { marginBottom: 16 },
  signInRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  signInIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: "#fdf1ee" },
  unavailable: { marginTop: 6, color: colors.danger, fontFamily: fonts.bodyBold, fontSize: 13 },
  actions: { flexDirection: "row", gap: 8, marginTop: 10 },
  move: { flex: 1, height: 38, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.emerald },
  moveDisabled: { backgroundColor: colors.lineSoft },
  moveText: { color: colors.white, fontFamily: fonts.semi, fontSize: 14 },
  remove: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
});
