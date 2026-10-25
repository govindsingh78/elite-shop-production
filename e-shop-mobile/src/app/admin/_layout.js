import React from "react";
import { Stack } from "expo-router";
import { stackHeader } from "@/lib/navigation";

export default function AdminLayout() {
  return (
    <Stack screenOptions={stackHeader}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="product-form" options={{ title: "Product" }} />
      <Stack.Screen name="order/[id]" options={{ title: "Order" }} />
      <Stack.Screen name="users" options={{ title: "Users" }} />
      <Stack.Screen name="user-form" options={{ title: "User" }} />
      <Stack.Screen name="commissions" options={{ title: "Commissions" }} />
      <Stack.Screen name="commission/[id]" options={{ title: "Seller" }} />
    </Stack>
  );
}
