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
      <Stack.Screen name="business" options={{ title: "Business & GST" }} />
      <Stack.Screen name="category-requests" options={{ title: "Category requests" }} />
      <Stack.Screen name="brand-requests" options={{ title: "Brand requests" }} />
      <Stack.Screen name="invoices" options={{ title: "Invoices" }} />
    </Stack>
  );
}
