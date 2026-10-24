import React, { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { IconButton } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { useWishlist } from "@/context/WishlistContext";
import { colors } from "@/theme";

export const HEART = "#d64c3b";

/** Heart toggle. `overlay` sits on a product image; `header` is the round button in the product screen's header. */
export default function WishlistButton({ product, variant = "overlay" }) {
  const { isSaved, toggle } = useWishlist();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const saved = isSaved(product.id);
  const label = saved ? `Remove ${product.title} from your wishlist` : `Save ${product.title} to your wishlist`;

  const press = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const nowSaved = await toggle(product);
      toast(nowSaved ? "Saved to your wishlist" : "Removed from your wishlist", nowSaved ? "success" : "info");
    } catch (error) {
      toast(error.message || "Couldn’t update your wishlist", "error");
    } finally {
      setBusy(false);
    }
  };

  if (variant === "header") {
    return <IconButton icon={saved ? "heart" : "heart-outline"} label={label} color={saved ? HEART : colors.emerald} size={38} onPress={press} />;
  }

  return (
    <Pressable
      onPress={press}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ selected: saved, busy }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.overlay, pressed && { transform: [{ scale: 0.9 }] }]}
    >
      <Ionicons name={saved ? "heart" : "heart-outline"} size={19} color={saved ? HEART : colors.emerald} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { position: "absolute", top: 10, right: 10, width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: "rgba(255,255,255,0.94)" },
});
