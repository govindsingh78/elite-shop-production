import React, { useState } from "react";
import { ScrollView } from "react-native";
import { router } from "expo-router";
import { OrderCard } from "@/components/OrderBits";
import PagedList from "@/components/PagedList";
import { Chip, EmptyState } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { ORDER_STATUSES } from "@/lib/format";

const FILTERS = [{ value: "", label: "All" }, ...Object.entries(ORDER_STATUSES).map(([value, config]) => ({ value, label: config.label }))];

export default function CustomerOrdersScreen() {
  const { request } = useAuth();
  const [status, setStatus] = useState("");

  return (
    <PagedList
      deps={[status]}
      fetchPage={(page) => request("/customer/orders", { query: { status, page } })}
      header={(
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 14 }}>
          {FILTERS.map((filter) => <Chip key={filter.value || "all"} label={filter.label} active={status === filter.value} onPress={() => setStatus(filter.value)} />)}
        </ScrollView>
      )}
      renderItem={(order) => <OrderCard order={order} onPress={() => router.push(`/customer/orders/${order.id}`)} />}
      empty={<EmptyState icon="receipt-outline" title={status ? "No orders with this status" : "No orders yet"} message="When you place an order it shows up here, with live tracking." actionLabel="Start shopping" onAction={() => router.push("/shop")} />}
    />
  );
}
