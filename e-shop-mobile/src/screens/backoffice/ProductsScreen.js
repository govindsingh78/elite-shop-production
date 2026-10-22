import React, { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Stack, router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import PagedList from "@/components/PagedList";
import { Chip, EmptyState, IconButton, Pill, T } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { productImageUrl } from "@/lib/config";
import { formatPrice } from "@/lib/format";
import { PORTALS } from "@/lib/portals";
import { colors, fonts, radius, shadow } from "@/theme";

const STATUS_FILTERS = [{ value: "", label: "All" }, { value: "1", label: "Live" }, { value: "0", label: "Hidden" }];

export default function ProductsScreen({ portal: portalKey }) {
  const portal = PORTALS[portalKey];
  const { request } = useAuth();
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [total, setTotal] = useState(null);
  const formPath = `${portal.home}/product-form`;

  return (
    <>
      <Stack.Screen options={{ headerRight: () => <View style={{ marginRight: 12 }}><IconButton icon="add" label="Add product" size={36} background={colors.emerald} color={colors.white} onPress={() => router.push(formPath)} /></View> }} />
      <PagedList
        deps={[search, status]}
        onTotal={setTotal}
        fetchPage={(page) => request(portal.products, { query: { search, status, page } })}
        header={(
          <View>
            <View style={styles.search}>
              <Ionicons name="search" size={18} color={colors.muted} />
              <TextInput value={searchDraft} onChangeText={setSearchDraft} onSubmitEditing={() => setSearch(searchDraft.trim())} placeholder="Search title, SKU or barcode" placeholderTextColor={colors.faint} returnKeyType="search" style={styles.searchInput} />
              {searchDraft ? <Pressable onPress={() => { setSearchDraft(""); setSearch(""); }}><Ionicons name="close-circle" size={18} color={colors.faint} /></Pressable> : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
              {STATUS_FILTERS.map((filter) => <Chip key={filter.label} label={filter.label} active={status === filter.value} onPress={() => setStatus(filter.value)} />)}
            </ScrollView>
            {total !== null ? <T variant="label" style={{ marginBottom: 10 }}>{total} product{total === 1 ? "" : "s"}</T> : null}
          </View>
        )}
        renderItem={(product) => <ProductRow product={product} showVendor={portalKey === "admin"} onPress={() => router.push({ pathname: formPath, params: { id: String(product.id) } })} />}
        empty={<EmptyState icon="pricetags-outline" title={search || status ? "No matching products" : "No products yet"} message={portalKey === "vendor" ? "List your first product — it takes a minute." : "Add products to start selling."} actionLabel="Add a product" onAction={() => router.push(formPath)} />}
      />
    </>
  );
}

function ProductRow({ product, onPress, showVendor }) {
  const image = productImageUrl(product.image);
  const lowStock = product.qty != null && product.qty <= 5;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
      <View style={styles.thumb}>
        {image ? <Image source={{ uri: image }} style={styles.thumbImage} /> : <Text style={styles.thumbLetter}>{product.title.charAt(0)}</Text>}
      </View>
      <View style={{ flex: 1 }}>
        <T variant="title" numberOfLines={2}>{product.title}</T>
        <T variant="small" numberOfLines={1}>SKU {product.sku}{product.category?.name ? ` · ${product.category.name}` : ""}{showVendor && product.vendor?.name ? ` · ${product.vendor.name}` : ""}</T>
        <View style={styles.rowBottom}>
          <Text style={styles.price}>{formatPrice(product.price)}</Text>
          {product.status ? <Pill label="Live" /> : <Pill label="Hidden" color={colors.muted} background={colors.lineSoft} />}
          {product.qty != null ? <Pill label={`${product.qty} in stock`} color={lowStock ? colors.danger : colors.tealDark} background={lowStock ? colors.dangerSoft : colors.tealSoft} /> : null}
          {product.is_featured === "yes" ? <Pill label="Featured" color={colors.goldDeep} background={colors.goldSoft} /> : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: 10, height: 48, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 16, backgroundColor: colors.white },
  searchInput: { flex: 1, height: "100%", color: colors.text, fontFamily: fonts.bodySemi, fontSize: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.lg, padding: 12, backgroundColor: colors.white, ...shadow.card },
  thumb: { width: 64, height: 76, alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: 12, backgroundColor: colors.mint },
  thumbImage: { width: "100%", height: "100%" },
  thumbLetter: { color: colors.emerald, fontFamily: fonts.display, fontSize: 24 },
  rowBottom: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 6 },
  price: { marginRight: 2, color: colors.ink, fontFamily: fonts.heading, fontSize: 15 },
});
