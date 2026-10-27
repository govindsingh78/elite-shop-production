import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, Card, Chip, Loader, Notice, Row, Screen, Segmented, SwitchRow, T, TextField } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { confirmAction } from "@/lib/confirm";
import { useLoad } from "@/lib/useLoad";
import { colors, fonts, radius } from "@/theme";

const EMPTY = {
  code: "", title: "", description: "", terms: "", type: "percent", value: "", max_discount: "", min_order: "", starts_on: "", ends_on: "",
  usage_limit: "", per_customer_limit: "1", first_order_only: false, show_on_product: true, funded_by: "store", status: true,
  covers: "all", category_ids: [], products: [],
};
const text = (value) => (value == null ? "" : String(value));
const asForm = (coupon) => ({
  ...EMPTY,
  code: coupon.code, title: coupon.title, description: text(coupon.description), terms: text(coupon.terms), type: coupon.type, value: text(coupon.value),
  max_discount: text(coupon.max_discount), min_order: text(coupon.min_order), starts_on: text(coupon.starts_on), ends_on: text(coupon.ends_on),
  usage_limit: text(coupon.usage_limit), per_customer_limit: text(coupon.per_customer_limit), first_order_only: coupon.first_order_only,
  show_on_product: coupon.show_on_product, funded_by: coupon.funded_by, status: coupon.status,
  covers: coupon.category_ids.length || coupon.product_ids.length ? "select" : "all", category_ids: coupon.category_ids, products: coupon.products || [],
});
const number = (value) => (value === "" ? null : Number(value));
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Admin: create or edit a coupon — the same choices as on the website. */
export default function CouponFormScreen() {
  const { id } = useLocalSearchParams();
  const { request } = useAuth();
  // A new coupon still needs the categories, from the list.
  const { data, error } = useLoad(() => (id ? request(`/admin/coupons/${id}`) : request("/admin/coupons", { query: { state: "all" } })), [id, request]);

  if (error) return <Screen><Notice tone="error" message={error} /></Screen>;
  if (!data) return <Screen><Loader /></Screen>;

  return <CouponForm key={id || "new"} coupon={id ? data.coupon : null} categories={data.categories} />;
}

function CouponForm({ coupon, categories }) {
  const { request } = useAuth();
  const toast = useToast();
  const [values, setValues] = useState(coupon ? asForm(coupon) : EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [results, setResults] = useState([]);
  const set = (name) => (value) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };
  const mains = categories.filter((category) => !category.parent_id);
  const toggleCategory = (categoryId) => setValues((current) => ({
    ...current,
    category_ids: current.category_ids.includes(categoryId) ? current.category_ids.filter((each) => each !== categoryId) : [...current.category_ids, categoryId],
  }));

  const findProducts = async () => {
    try {
      setResults((await request("/admin/coupons/products", { query: { search: productSearch } })).products);
    } catch (findError) {
      toast(findError.message, "error");
    }
  };

  const save = async () => {
    const dateErrors = Object.fromEntries(["starts_on", "ends_on"].filter((key) => values[key] && !DATE.test(values[key])).map((key) => [key, "Use the format YYYY-MM-DD."]));
    if (Object.keys(dateErrors).length) {
      setErrors(dateErrors);
      return;
    }
    setSaving(true);
    setErrors({});
    const select = values.covers === "select";
    try {
      const result = await request(coupon ? `/admin/coupons/${coupon.id}` : "/admin/coupons", {
        method: coupon ? "PUT" : "POST",
        body: {
          code: values.code, title: values.title, description: values.description || null, terms: values.terms || null, type: values.type, value: number(values.value),
          max_discount: values.type === "percent" ? number(values.max_discount) : null, min_order: number(values.min_order), starts_on: values.starts_on || null, ends_on: values.ends_on || null,
          usage_limit: number(values.usage_limit), per_customer_limit: number(values.per_customer_limit), first_order_only: values.first_order_only,
          show_on_product: values.show_on_product, funded_by: values.funded_by, status: values.status,
          category_ids: select ? values.category_ids : [], product_ids: select ? values.products.map((product) => product.id) : [],
        },
      });
      toast(result.message);
      router.back();
    } catch (saveError) {
      setErrors(saveError.fieldErrors || {});
      toast(saveError.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = () => confirmAction({
    title: `Delete ${coupon.code}?`,
    message: "Shoppers won’t be able to use it.",
    onConfirm: async () => {
      try {
        toast((await request(`/admin/coupons/${coupon.id}`, { method: "DELETE" })).message);
        router.back();
      } catch (deleteError) {
        toast(deleteError.message, "error");
      }
    },
  });

  return (
    <Screen keyboard footer={<Button title={coupon ? "Save coupon" : "Create coupon"} icon="checkmark" loading={saving} onPress={save} />}>
      <Card>
        <T variant="h3" style={{ marginBottom: 12 }}>The offer</T>
        <TextField label="Code" autoCapitalize="characters" maxLength={20} placeholder="AW30" value={values.code} onChangeText={(value) => set("code")(value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} error={errors.code} />
        <TextField label="Title" maxLength={120} placeholder="Flat 30% Off On Select Fashion" value={values.title} onChangeText={set("title")} error={errors.title} />
        <TextField label="Short description (optional)" maxLength={255} placeholder="On shirts, kurtas and more" value={values.description} onChangeText={set("description")} />
        <Segmented options={[{ value: "percent", label: "% off" }, { value: "flat", label: "₹ off" }]} value={values.type} onChange={set("type")} style={{ marginBottom: 12 }} />
        <Row gap={10}>
          <TextField label={values.type === "percent" ? "Percentage" : "Amount (₹)"} keyboardType="decimal-pad" value={values.value} onChangeText={set("value")} error={errors.value} style={{ flex: 1 }} />
          {values.type === "percent" ? <TextField label="Up to (₹)" keyboardType="number-pad" placeholder="No cap" value={values.max_discount} onChangeText={set("max_discount")} error={errors.max_discount} style={{ flex: 1 }} /> : null}
        </Row>
        <TextField label="Minimum purchase (₹)" keyboardType="number-pad" placeholder="None" value={values.min_order} onChangeText={set("min_order")} error={errors.min_order} />
      </Card>

      <Card style={{ marginTop: 14 }}>
        <T variant="h3" style={{ marginBottom: 12 }}>When and how often</T>
        <Row gap={10}>
          <TextField label="First day" placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" value={values.starts_on} onChangeText={set("starts_on")} error={errors.starts_on} style={{ flex: 1 }} />
          <TextField label="Last day" placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" value={values.ends_on} onChangeText={set("ends_on")} error={errors.ends_on} style={{ flex: 1 }} />
        </Row>
        <Row gap={10}>
          <TextField label="Uses in all" keyboardType="number-pad" placeholder="No limit" value={values.usage_limit} onChangeText={set("usage_limit")} style={{ flex: 1 }} />
          <TextField label="Per customer" keyboardType="number-pad" placeholder="No limit" value={values.per_customer_limit} onChangeText={set("per_customer_limit")} style={{ flex: 1 }} />
        </Row>
        <SwitchRow label="First order only" value={values.first_order_only} onValueChange={set("first_order_only")} />
        <SwitchRow label="Show on product pages" hint="Under “Offers and discounts”" value={values.show_on_product} onValueChange={set("show_on_product")} />
        <SwitchRow label="Switched on" value={values.status} onValueChange={set("status")} />
      </Card>

      <Card style={{ marginTop: 14 }}>
        <T variant="h3" style={{ marginBottom: 12 }}>Works on</T>
        <Segmented options={[{ value: "all", label: "Everything" }, { value: "select", label: "Select" }]} value={values.covers} onChange={set("covers")} />
        {values.covers === "select" ? (
          <View style={{ marginTop: 12 }}>
            <T variant="label" style={{ marginBottom: 8 }}>Categories</T>
            {mains.map((main) => (
              <View key={main.id} style={{ marginBottom: 8 }}>
                <View style={styles.chips}>
                  <Chip label={`${main.name} (all)`} active={values.category_ids.includes(main.id)} onPress={() => toggleCategory(main.id)} />
                  {categories.filter((child) => child.parent_id === main.id).map((child) => (
                    <Chip key={child.id} label={child.name} active={values.category_ids.includes(child.id)} onPress={() => toggleCategory(child.id)} />
                  ))}
                </View>
              </View>
            ))}
            <T variant="label" style={{ marginTop: 6, marginBottom: 8 }}>Products</T>
            <Row gap={8}>
              <TextField placeholder="Name or SKU" value={productSearch} onChangeText={setProductSearch} onSubmitEditing={findProducts} style={{ flex: 1, marginBottom: 0 }} />
              <Button title="Find" variant="outline" small block={false} onPress={findProducts} />
            </Row>
            {results.filter((product) => !values.products.some((chosen) => chosen.id === product.id)).map((product) => (
              <Pressable key={product.id} onPress={() => setValues((current) => ({ ...current, products: [...current.products, product] }))} style={styles.result}>
                <T variant="body" style={{ flex: 1, fontSize: 15 }} numberOfLines={1}>{product.title}</T>
                <Ionicons name="add-circle-outline" size={20} color={colors.tealDark} />
              </Pressable>
            ))}
            <View style={[styles.chips, { marginTop: 8 }]}>
              {values.products.map((product) => (
                <Pressable key={product.id} onPress={() => setValues((current) => ({ ...current, products: current.products.filter((each) => each.id !== product.id) }))} style={styles.chosen}>
                  <Text style={styles.chosenText} numberOfLines={1}>{product.title}</Text>
                  <Ionicons name="close" size={14} color={colors.emerald} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </Card>

      <Card style={{ marginTop: 14 }}>
        <T variant="h3" style={{ marginBottom: 12 }}>Who pays for the discount</T>
        <Segmented options={[{ value: "store", label: "Elitezaar" }, { value: "seller", label: "The seller" }]} value={values.funded_by} onChange={set("funded_by")} />
        <T variant="small" style={{ marginTop: 8 }}>{values.funded_by === "store" ? "Sellers are paid as if there were no coupon; it comes out of Elitezaar’s commission." : "Sellers earn on the discounted price."}</T>
        <TextField label="Extra terms (optional)" multiline maxLength={3000} placeholder="e.g. Can’t be combined with other offers." value={values.terms} onChangeText={set("terms")} style={{ marginTop: 14 }} />
      </Card>

      {coupon && coupon.uses === 0 ? <Button title="Delete coupon" icon="trash-outline" variant="danger" onPress={remove} style={{ marginTop: 14 }} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  result: { flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: colors.lineSoft, paddingVertical: 10 },
  chosen: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%", borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.mint },
  chosenText: { color: colors.emerald, fontFamily: fonts.bodySemi, fontSize: 13 },
});
