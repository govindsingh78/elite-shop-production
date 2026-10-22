import React from "react";
import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tabBarOptions } from "@/lib/navigation";

function icon(name) {
  return function TabIcon({ color, focused }) {
    return <Ionicons name={focused ? name : `${name}-outline`} size={23} color={color} />;
  };
}

export default function VendorTabs() {
  return (
    <Tabs screenOptions={tabBarOptions}>
      <Tabs.Screen name="index" options={{ title: "Dashboard", headerTitle: "Seller hub", tabBarIcon: icon("speedometer") }} />
      <Tabs.Screen name="products" options={{ title: "Products", headerTitle: "My products", tabBarIcon: icon("pricetags") }} />
      <Tabs.Screen name="orders" options={{ title: "Orders", headerTitle: "My orders", tabBarIcon: icon("receipt") }} />
      <Tabs.Screen name="more" options={{ title: "More", headerTitle: "Account", tabBarIcon: icon("ellipsis-horizontal-circle") }} />
    </Tabs>
  );
}
