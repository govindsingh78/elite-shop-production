import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, Card, EmptyState, KeyValue, Notice, QuantityStepper, Row, Screen, T } from "@/components/ui";
import { useCart } from "@/context/CartContext";
import { productImageUrl } from "@/lib/config";
import { formatPrice } from "@/lib/format";
import { colors, fonts, radius, shadow } from "@/theme";

export default function CartScreen() {
  const { items, count, subtotal, updateQuantity, removeItem } = useCart();

  if (!items.length) {
    return (
      <Screen>
        <EmptyState icon="bag-handle-outline" title="Your bag is waiting" message="Find something you’ll love wearing again and again." actionLabel="Explore the collection" onAction={() => router.push("/shop")} />
        <Button title="Track an order" variant="outline" icon="navigate-outline" onPress={() => router.push("/account")} block={false} style={{ alignSelf: "center" }} />
      </Screen>
    );
  }

  return (
    <Screen
      footer={(
        <View>
          <Row justify="space-between" style={{ marginBottom: 10 }}>
            <T variant="body">Subtotal · {count} {count === 1 ? "item" : "items"}</T>
            <T variant="price" style={{ fontSize: 20 }}>{formatPrice(subtotal)}</T>
          </Row>
          <Button title="Checkout securely" icon="lock-closed-outline" onPress={() => router.push("/checkout")} />
        </View>
      )}
    >
      {items.map((item) => {
        const image = productImageUrl(item.image);
        const maxed = item.qtyAvailable != null && item.quantity >= item.qtyAvailable;
        return (
          <View key={item.key} style={styles.item}>
            <Pressable onPress={() => router.push(`/product/${item.id}`)} style={styles.thumb}>
              {image ? <Image source={{ uri: image }} style={styles.thumbImage} /> : <Text style={styles.thumbLetter}>{item.title.charAt(0)}</Text>}
            </Pressable>
            <View style={{ flex: 1 }}>
              <Row align="flex-start" gap={8}>
                <Pressable onPress={() => router.push(`/product/${item.id}`)} style={{ flex: 1 }}>
                  <T variant="title" numberOfLines={2}>{item.title}</T>
                  {item.size ? <T variant="small" color={colors.text}>Size <T variant="strong">{item.size}</T></T> : null}
                  {item.sku ? <T variant="small">SKU {item.sku}</T> : null}
                </Pressable>
                <Pressable onPress={() => removeItem(item.key)} hitSlop={10} accessibilityLabel={`Remove ${item.title}`}>
                  <Ionicons name="trash-outline" size={19} color={colors.muted} />
                </Pressable>
              </Row>
              <Row justify="space-between" style={{ marginTop: 10 }}>
                <QuantityStepper compact value={item.quantity} max={item.qtyAvailable ?? 999} onChange={(value) => updateQuantity(item.key, value)} />
                <View style={{ alignItems: "flex-end" }}>
                  <T variant="price">{formatPrice(item.price * item.quantity)}</T>
                  {item.quantity > 1 ? <T variant="small">{formatPrice(item.price)} each</T> : null}
                </View>
              </Row>
              {maxed ? <T variant="small" color={colors.warning} style={{ marginTop: 6 }}>That’s all we have in stock{item.size ? ` in ${item.size}` : ""}.</T> : null}
            </View>
          </View>
        );
      })}

      <Card style={{ marginTop: 6 }}>
        <T variant="h3" style={{ marginBottom: 4 }}>Order summary</T>
        <KeyValue label="Subtotal" value={formatPrice(subtotal)} />
        <KeyValue label="Delivery" value="Chosen at checkout" />
        <KeyValue label="Estimated total" value={formatPrice(subtotal)} strong last />
      </Card>
      <Notice tone="info" message="Secure checkout, with live tracking from packing to your doorstep." style={{ marginTop: 12 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: "row", gap: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.lg, padding: 12, backgroundColor: colors.white, ...shadow.card },
  thumb: { width: 84, height: 100, alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: 14, backgroundColor: colors.mint },
  thumbImage: { width: "100%", height: "100%" },
  thumbLetter: { color: colors.emerald, fontFamily: fonts.display, fontSize: 30 },
});
