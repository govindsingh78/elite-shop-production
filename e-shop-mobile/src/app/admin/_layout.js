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
      <Stack.Screen name="server" options={{ title: "Server & health" }} />
      <Stack.Screen name="security" options={{ title: "Security" }} />
      <Stack.Screen name="sellers" options={{ title: "Sellers" }} />
      <Stack.Screen name="category-requests" options={{ title: "Category requests" }} />
      <Stack.Screen name="brand-requests" options={{ title: "Brand requests" }} />
      <Stack.Screen name="reviews" options={{ title: "Reviews" }} />
      <Stack.Screen name="invoices" options={{ title: "GST & invoices" }} />
      <Stack.Screen name="gst" options={{ title: "GST settings" }} />
      <Stack.Screen name="delivery" options={{ title: "Delivery areas" }} />
      <Stack.Screen name="coupons" options={{ title: "Coupons" }} />
      <Stack.Screen name="coupon-form" options={{ title: "Coupon" }} />
      <Stack.Screen name="seller/[id]" options={{ title: "Seller" }} />
      <Stack.Screen name="commissions" options={{ title: "Commissions" }} />
      <Stack.Screen name="commission/[id]" options={{ title: "Seller" }} />
    </Stack>
  );
}
