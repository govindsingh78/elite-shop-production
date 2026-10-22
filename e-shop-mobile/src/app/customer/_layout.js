import React from "react";
import { Stack } from "expo-router";
import { stackHeader } from "@/lib/navigation";

export default function CustomerLayout() {
  return (
    <Stack screenOptions={stackHeader}>
      <Stack.Screen name="orders/index" options={{ title: "My orders" }} />
      <Stack.Screen name="orders/[id]" options={{ title: "Order" }} />
      <Stack.Screen name="addresses" options={{ title: "Addresses" }} />
      <Stack.Screen name="address-form" options={{ title: "Address" }} />
      <Stack.Screen name="profile" options={{ title: "Profile" }} />
    </Stack>
  );
}
