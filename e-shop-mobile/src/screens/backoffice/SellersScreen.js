import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import PagedList from "@/components/PagedList";
import { SELLER_STATUSES, SellerStatusPill } from "@/components/SellerBits";
import { Chip, EmptyState, T } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { formatDate, initials } from "@/lib/format";
import { colors, fonts, radius, shadow } from "@/theme";

const TABS = [{ key: "", label: "All", count: "all" }, ...Object.entries(SELLER_STATUSES).map(([key, config]) => ({ key, label: config.label, count: key }))];

/** Admin: every seller, applications first; tap one to approve, decline, deactivate or reactivate it. */
export default function SellersScreen() {
  const { request } = useAuth();
  const params = useLocalSearchParams();
  const [status, setStatus] = useState(typeof params.status === "string" ? params.status : "");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [counts, setCounts] = useState(null);

  return (
    <PagedList
      deps={[status, search]}
      fetchPage={async (page) => {
        const result = await request("/admin/sellers", { query: { status, search, page } });
        setCounts(result.counts);
        return result;
      }}
      header={(
        <View>
          <View style={styles.search}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput value={searchDraft} onChangeText={setSearchDraft} onSubmitEditing={() => setSearch(searchDraft.trim())} placeholder="Name, email, phone or GSTIN" placeholderTextColor={colors.faint} returnKeyType="search" autoCapitalize="none" style={styles.searchInput} />
            {searchDraft ? <Pressable onPress={() => { setSearchDraft(""); setSearch(""); }}><Ionicons name="close-circle" size={18} color={colors.faint} /></Pressable> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
            {TABS.map((tab) => {
              const count = counts?.[tab.count];
              return <Chip key={tab.key || "all"} label={count ? `${tab.label} · ${count}` : tab.label} active={status === tab.key} onPress={() => setStatus(tab.key)} />;
            })}
          </ScrollView>
        </View>
      )}
      renderItem={(seller) => {
        const config = SELLER_STATUSES[seller.seller_status] || SELLER_STATUSES.approved;
        return (
          <Pressable onPress={() => router.push(`/admin/seller/${seller.id}`)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
            <View style={[styles.avatar, { backgroundColor: config.background }]}><Text style={[styles.avatarText, { color: config.color }]}>{initials(seller.name)}</Text></View>
            <View style={{ flex: 1 }}>
              <T variant="title" numberOfLines={1}>{seller.name}</T>
              <T variant="small" numberOfLines={1}>{seller.legal_name || seller.email}</T>
              <T variant="small">{seller.gstin ? `GSTIN ${seller.gstin}` : `Joined ${formatDate(seller.created_at)}`}</T>
              <View style={{ marginTop: 6, alignSelf: "flex-start" }}><SellerStatusPill status={seller.seller_status} /></View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.faint} />
          </Pressable>
        );
      }}
      empty={<EmptyState icon="storefront-outline" title={status === "pending" && !search ? "No applications waiting" : "No sellers found"} message={status === "pending" && !search ? "You’re all caught up." : undefined} />}
    />
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: 10, height: 48, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 16, backgroundColor: colors.white },
  searchInput: { flex: 1, height: "100%", color: colors.text, fontFamily: fonts.bodySemi, fontSize: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.lg, padding: 14, backgroundColor: colors.white, ...shadow.card },
  avatar: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 15 },
  avatarText: { fontFamily: fonts.heading, fontSize: 16 },
});
