import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { OrderCard } from "@/components/OrderBits";
import PagedList from "@/components/PagedList";
import { Chip, EmptyState, T } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { ORDER_STATUSES } from "@/lib/format";
import { PORTALS } from "@/lib/portals";
import { colors, fonts, radius } from "@/theme";

const FILTERS = [{ value: "", label: "All" }, ...Object.entries(ORDER_STATUSES).map(([value, config]) => ({ value, label: config.label }))];

export default function StaffOrdersScreen({ portal: portalKey }) {
  const portal = PORTALS[portalKey];
  const params = useLocalSearchParams();
  const { request } = useAuth();
  const [status, setStatus] = useState(params.status || "");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(null);

  // The dashboard's order queue links here with a status filter.
  const [seenStatus, setSeenStatus] = useState(params.status);
  if (params.status !== seenStatus) {
    setSeenStatus(params.status);
    if (params.status !== undefined) setStatus(params.status);
  }

  return (
    <PagedList
      deps={[status, search]}
      onTotal={setTotal}
      fetchPage={(page) => request(portal.orders, { query: { status, search, page } })}
      header={(
        <View>
          <View style={styles.search}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput value={searchDraft} onChangeText={setSearchDraft} onSubmitEditing={() => setSearch(searchDraft.trim())} placeholder={portalKey === "admin" ? "Order #, customer, email or tracking no." : "Order #, customer or tracking no."} placeholderTextColor={colors.faint} returnKeyType="search" style={styles.searchInput} />
            {searchDraft ? <Pressable onPress={() => { setSearchDraft(""); setSearch(""); }}><Ionicons name="close-circle" size={18} color={colors.faint} /></Pressable> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
            {FILTERS.map((filter) => <Chip key={filter.value || "all"} label={filter.label} active={status === filter.value} onPress={() => setStatus(filter.value)} />)}
          </ScrollView>
          {total !== null ? <T variant="label" style={{ marginBottom: 10 }}>{total} order{total === 1 ? "" : "s"}</T> : null}
        </View>
      )}
      renderItem={(order) => (
        <OrderCard
          order={order}
          showCustomer
          amount={portalKey === "vendor" ? order.vendor_subtotal : undefined}
          onPress={() => router.push(`${portal.home}/order/${order.id}`)}
        />
      )}
      empty={<EmptyState icon="receipt-outline" title={status || search ? "No matching orders" : "No orders yet"} message={portalKey === "vendor" ? "Orders for your products will appear here." : "New orders will appear here."} />}
    />
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: 10, height: 48, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 16, backgroundColor: colors.white },
  searchInput: { flex: 1, height: "100%", color: colors.text, fontFamily: fonts.bodySemi, fontSize: 16 },
});
