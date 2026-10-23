import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import PagedList from "@/components/PagedList";
import ProductCard from "@/components/ProductCard";
import { Button, Chip, EmptyState, OptionSheet, Row, T, TextField } from "@/components/ui";
import { api } from "@/lib/api";
import { formatPriceShort } from "@/lib/format";
import { colors, fonts, radius, shadow } from "@/theme";

const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

export default function ShopScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState(params.category || "");
  const [brand, setBrand] = useState(params.brand || "");
  const [search, setSearch] = useState(params.q || "");
  const [searchDraft, setSearchDraft] = useState(params.q || "");
  const [sort, setSort] = useState("newest");
  const [price, setPrice] = useState({ min: "", max: "" });
  const [meta, setMeta] = useState({ total: null, brands: [], range: { min: 0, max: 0 }, category: null });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  // Links from the home screen (collections, brands) arrive as new params on this tab.
  const [seenParams, setSeenParams] = useState({ category: params.category, brand: params.brand, q: params.q });
  if (params.category !== seenParams.category || params.brand !== seenParams.brand || params.q !== seenParams.q) {
    setSeenParams({ category: params.category, brand: params.brand, q: params.q });
    if (params.category !== undefined) setCategory(params.category);
    if (params.brand !== undefined) setBrand(params.brand);
    if (params.q !== undefined) {
      setSearch(params.q);
      setSearchDraft(params.q);
    }
  }

  useEffect(() => {
    api("/storefront/categories").then(setCategories).catch(() => {});
  }, []);

  const fetchPage = async (page) => {
    const data = await api("/storefront/products", {
      query: {
        category_slug: category || undefined,
        brand_id: brand || undefined,
        search: search || undefined,
        sort: sort !== "newest" ? sort : undefined,
        min_price: price.min || undefined,
        max_price: price.max || undefined,
        page,
      },
    });
    setMeta({
      total: Number(data.products?.total || 0),
      brands: data.brands || [],
      range: { min: Number(data.price_range?.min || 0), max: Number(data.price_range?.max || 0) },
      category: data.category,
    });
    return data.products;
  };

  const activeFilters = (brand ? 1 : 0) + (price.min || price.max ? 1 : 0);
  const showEverything = () => {
    setCategory("");
    setBrand("");
    setPrice({ min: "", max: "" });
    setSearch("");
    setSearchDraft("");
  };

  // Categories arrive as a tree: this tab's top-level category, and the subcategory when one is open.
  const topCategory = categories.find((item) => item.slug === category || item.children?.some((child) => child.slug === category));
  const activeChild = topCategory?.children?.find((child) => child.slug === category);
  const familyTop = topCategory || meta.category?.parent || meta.category;
  const subcategories = topCategory?.children || meta.category?.subcategories || [];
  const parentName = activeChild ? topCategory.name : meta.category?.parent?.name;
  const heading = (category && (activeChild?.name || topCategory?.name || meta.category?.name)) || "Shop all";

  const header = (
    <View>
      <View style={[styles.top, { paddingTop: insets.top + 10 }]}>
        <T variant="eyebrow">{category ? (parentName ? `${parentName} collection` : "The collection") : "Everyday, elevated"}</T>
        <T variant="display" style={{ marginTop: 4 }}>{heading}<Text style={{ color: colors.teal }}>.</Text></T>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            value={searchDraft}
            onChangeText={setSearchDraft}
            onSubmitEditing={() => setSearch(searchDraft.trim())}
            placeholder="Search by name or SKU"
            placeholderTextColor={colors.faint}
            returnKeyType="search"
            style={styles.searchInput}
          />
          {searchDraft ? (
            <Pressable onPress={() => { setSearchDraft(""); setSearch(""); }} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.faint} /></Pressable>
          ) : null}
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="All" active={!category} onPress={() => setCategory("")} />
        {categories.map((item) => <Chip key={item.id} label={item.name} active={category === item.slug || topCategory?.id === item.id} onPress={() => setCategory(item.slug)} />)}
      </ScrollView>
      {category && familyTop && subcategories.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subChips}>
          <SubChip label={`All ${familyTop.name}`} active={category === familyTop.slug} onPress={() => setCategory(familyTop.slug)} />
          {subcategories.map((child) => <SubChip key={child.id} label={child.name} active={category === child.slug} onPress={() => setCategory(child.slug)} />)}
        </ScrollView>
      ) : null}
      <View style={styles.toolbar}>
        <T variant="strong" style={{ flex: 1 }}>{meta.total === null ? "Finding pieces…" : `${meta.total} ${meta.total === 1 ? "piece" : "pieces"}`}</T>
        <Pressable onPress={() => setFiltersOpen(true)} style={styles.toolButton}>
          <Ionicons name="options-outline" size={17} color={colors.emerald} />
          <Text style={styles.toolText}>Filter{activeFilters ? ` (${activeFilters})` : ""}</Text>
        </Pressable>
        <Pressable onPress={() => setSortOpen(true)} style={styles.toolButton}>
          <Ionicons name="swap-vertical" size={17} color={colors.emerald} />
          <Text style={styles.toolText}>Sort</Text>
        </Pressable>
      </View>
      {search ? (
        <View style={styles.activeSearch}>
          <Chip label={`“${search}” ×`} active onPress={() => { setSearch(""); setSearchDraft(""); }} />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <PagedList
        deps={[category, brand, search, sort, price.min, price.max]}
        fetchPage={fetchPage}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentStyle={styles.list}
        header={header}
        renderItem={(item) => <View style={styles.cell}><ProductCard product={item} /></View>}
        empty={<EmptyState icon="search-outline" title="No pieces found" message="Try another collection, brand or search phrase." actionLabel="Show everything" onAction={showEverything} />}
      />

      <OptionSheet visible={sortOpen} title="Sort by" options={SORTS} value={sort} onClose={() => setSortOpen(false)} onSelect={(value) => { setSort(value); setSortOpen(false); }} />
      {filtersOpen ? (
        <FilterSheet
          onClose={() => setFiltersOpen(false)}
          brands={meta.brands}
          range={meta.range}
          brand={brand}
          price={price}
          onApply={(next) => { setBrand(next.brand); setPrice(next.price); setFiltersOpen(false); }}
        />
      ) : null}
    </View>
  );
}

/** Subcategory filter under the collection chips, e.g. All Kids · Toys · Clothing. */
function SubChip({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.subChip, active && styles.subChipActive, pressed && { opacity: 0.8 }]}>
      <Text style={[styles.subChipText, active && { color: colors.goldDeep }]}>{label}</Text>
    </Pressable>
  );
}

/** Mounted only while open, so it always starts from the filters currently applied. */
function FilterSheet({ onClose, brands, range, brand, price, onApply }) {
  const insets = useSafeAreaInsets();
  const [draftBrand, setDraftBrand] = useState(brand);
  const [draftPrice, setDraftPrice] = useState(price);

  const apply = () => {
    const swapped = draftPrice.min && draftPrice.max && Number(draftPrice.min) > Number(draftPrice.max);
    onApply({ brand: draftBrand, price: swapped ? { min: draftPrice.max, max: draftPrice.min } : draftPrice });
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />
        <Row justify="space-between">
          <T variant="h2">Refine</T>
          <Pressable onPress={() => { setDraftBrand(""); setDraftPrice({ min: "", max: "" }); }}><T variant="strong" color={colors.goldDeep}>Clear all</T></Pressable>
        </Row>
        <T variant="label" style={styles.sheetLabel}>Brand</T>
        <View style={styles.brandWrap}>
          <Chip label="All brands" active={!draftBrand} onPress={() => setDraftBrand("")} />
          {brands.map((item) => <Chip key={item.id} label={item.name} active={draftBrand === String(item.id)} onPress={() => setDraftBrand(String(item.id))} />)}
        </View>
        <T variant="label" style={styles.sheetLabel}>Price{range.max > range.min ? ` · ${formatPriceShort(range.min)} – ${formatPriceShort(range.max)}` : ""}</T>
        <Row gap={10} align="flex-start">
          <TextField placeholder={range.min ? String(Math.floor(range.min)) : "Min"} keyboardType="number-pad" value={draftPrice.min} onChangeText={(min) => setDraftPrice((current) => ({ ...current, min: min.replace(/[^0-9]/g, "") }))} style={{ flex: 1 }} icon="arrow-down" />
          <TextField placeholder={range.max ? String(Math.ceil(range.max)) : "Max"} keyboardType="number-pad" value={draftPrice.max} onChangeText={(max) => setDraftPrice((current) => ({ ...current, max: max.replace(/[^0-9]/g, "") }))} style={{ flex: 1 }} icon="arrow-up" />
        </Row>
        <Button title="Show results" onPress={apply} style={{ marginTop: 6 }} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  list: { paddingHorizontal: 0, paddingTop: 0 },
  top: { paddingHorizontal: 16 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 16, height: 48, backgroundColor: colors.white, ...shadow.card },
  searchInput: { flex: 1, height: "100%", color: colors.text, fontFamily: fonts.bodySemi, fontSize: 16 },
  chips: { gap: 8, paddingHorizontal: 16, paddingVertical: 14 },
  subChips: { gap: 8, paddingHorizontal: 16, paddingBottom: 14 },
  subChip: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.white },
  subChipActive: { borderColor: "#c79a66", backgroundColor: colors.goldSoft },
  subChipText: { color: colors.text, fontFamily: fonts.semi, fontSize: 14 },
  toolbar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  toolButton: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 8, backgroundColor: colors.white },
  toolText: { color: colors.emerald, fontFamily: fonts.semi, fontSize: 14 },
  activeSearch: { flexDirection: "row", paddingHorizontal: 16, marginBottom: 12 },
  column: { gap: 14, paddingHorizontal: 16 },
  cell: { flex: 1, maxWidth: "50%", marginBottom: 20 },
  backdrop: { flex: 1, backgroundColor: "rgba(10,31,25,0.45)" },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 10, backgroundColor: colors.white },
  handle: { width: 42, height: 5, alignSelf: "center", marginBottom: 14, borderRadius: 3, backgroundColor: colors.line },
  sheetLabel: { marginTop: 18, marginBottom: 10 },
  brandWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
