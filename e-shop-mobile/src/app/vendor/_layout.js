import React from "react";
import { Stack } from "expo-router";
import { stackHeader } from "@/lib/navigation";

export default function VendorLayout() {
  return (
    <Stack screenOptions={stackHeader}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="product-form" options={{ title: "Product" }} />
      <Stack.Screen name="order/[id]" options={{ title: "Order" }} />
      <Stack.Screen name="earnings" options={{ title: "Earnings" }} />
    </Stack>
  );
}
