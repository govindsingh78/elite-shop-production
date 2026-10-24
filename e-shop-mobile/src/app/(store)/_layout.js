import React from "react";
import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { tabBarOptions } from "@/lib/navigation";
import { colors, fonts } from "@/theme";

function icon(name) {
  return function TabIcon({ color, focused }) {
    return <Ionicons name={focused ? name : `${name}-outline`} size={23} color={color} />;
  };
}

export default function StoreTabs() {
  const { count } = useCart();
  const { count: saved } = useWishlist();
  const badgeStyle = { backgroundColor: colors.teal, color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 11 };
  return (
    <Tabs screenOptions={tabBarOptions}>
      <Tabs.Screen name="index" options={{ title: "Home", headerShown: false, tabBarIcon: icon("home") }} />
      <Tabs.Screen name="shop" options={{ title: "Shop", headerShown: false, tabBarIcon: icon("grid") }} />
      <Tabs.Screen
        name="wishlist"
        options={{ title: "Wishlist", headerTitle: "Your wishlist", tabBarIcon: icon("heart"), tabBarBadge: saved > 0 ? saved : undefined, tabBarBadgeStyle: badgeStyle }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Bag",
          headerTitle: "Shopping bag",
          tabBarIcon: icon("bag-handle"),
          tabBarBadge: count > 0 ? count : undefined,
          tabBarBadgeStyle: badgeStyle,
        }}
      />
      <Tabs.Screen name="account" options={{ title: "Account", headerShown: false, tabBarIcon: icon("person") }} />
    </Tabs>
  );
}
