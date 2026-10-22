import React from "react";
import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { tabBarOptions } from "@/lib/navigation";

function icon(name) {
  return function TabIcon({ color, focused }) {
    return <Ionicons name={focused ? name : `${name}-outline`} size={23} color={color} />;
  };
}

export default function AdminTabs() {
  return (
    <Tabs screenOptions={tabBarOptions}>
      <Tabs.Screen name="index" options={{ title: "Dashboard", headerTitle: "Admin", tabBarIcon: icon("speedometer") }} />
      <Tabs.Screen name="orders" options={{ title: "Orders", tabBarIcon: icon("receipt") }} />
      <Tabs.Screen name="products" options={{ title: "Products", tabBarIcon: icon("pricetags") }} />
      <Tabs.Screen name="catalog" options={{ title: "Catalog", tabBarIcon: icon("albums") }} />
      <Tabs.Screen name="more" options={{ title: "More", headerTitle: "Account", tabBarIcon: icon("ellipsis-horizontal-circle") }} />
    </Tabs>
  );
}
