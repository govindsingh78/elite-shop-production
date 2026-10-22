import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, Card, Loader, Notice, Row, Screen, SelectField, SwitchRow, T, TextField } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { productImageUrl, SITE_URL } from "@/lib/config";
import { confirmAction } from "@/lib/confirm";
import { PORTALS } from "@/lib/portals";
import { colors, radius } from "@/theme";

const EMPTY = { title: "", price: "", compare_price: "", sku: "", barcode: "", qty: "", category_id: "", brand_id: "", short_description: "", description: "", status: true, is_featured: false };

/** Create or edit a product. Vendors manage their own listings; only admins can feature a product. */
export default function ProductFormScreen({ portal: portalKey }) {
  const portal = PORTALS[portalKey];
  const { id } = useLocalSearchParams();
  const { request } = useAuth();
  const toast = useToast();
  const editing = !!id;

  const [values, setValues] = useState(EMPTY);
  const [options, setOptions] = useState({ categories: [], brands: [] });
  const [existingImages, setExistingImages] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      request(portal.productOptions),
      editing ? request(`${portal.products}/${id}`) : Promise.resolve(null),
    ]).then(([optionData, product]) => {
      setOptions({ categories: optionData.categories || [], brands: optionData.brands || [] });
      if (product) {
        setValues({
          title: product.title || "",
          price: product.price != null ? String(product.price) : "",
          compare_price: product.compare_price != null ? String(product.compare_price) : "",
          sku: product.sku || "",
          barcode: product.barcode || "",
          qty: product.qty != null ? String(product.qty) : "",
          category_id: product.category_id ? String(product.category_id) : "",
          brand_id: product.brand_id ? String(product.brand_id) : "",
          short_description: product.short_description || "",
          description: product.description || "",
          status: !!product.status,
          is_featured: product.is_featured === "yes",
        });
        setExistingImages([...new Set([product.image, ...(product.images || []).map((image) => image.image)].filter(Boolean))]);
      }
    }).catch((loadError) => setError(loadError.message)).finally(() => setLoading(false));
  }, [editing, id, portal, request]);

  const change = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 6, quality: 0.8 });
    if (result.canceled) return;
    setUploading(true);
    for (const asset of result.assets) {
      try {
        const form = new FormData();
        const name = asset.fileName || `product-${Date.now()}.jpg`;
        if (Platform.OS === "web") {
          form.append("image", await (await fetch(asset.uri)).blob(), name);
        } else {
          form.append("image", { uri: asset.uri, name: /\.(jpe?g|png|gif)$/i.test(name) ? name : `${name}.jpg`, type: asset.mimeType || "image/jpeg" });
        }
        const uploaded = await request("/temp-images", { method: "POST", form });
        setUploads((current) => [...current, { id: uploaded.data.id, uri: asset.uri, thumb: `${SITE_URL}/${uploaded.data.thumb_path}` }]);
      } catch (uploadError) {
        toast(uploadError.message, "error");
      }
    }
    setUploading(false);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    const body = {
      title: values.title.trim(),
      price: values.price,
      compare_price: values.compare_price === "" ? null : values.compare_price,
      sku: values.sku.trim(),
      barcode: values.barcode.trim() || null,
      qty: values.qty === "" ? null : Number(values.qty),
      category_id: values.category_id ? Number(values.category_id) : null,
      brand_id: values.brand_id ? Number(values.brand_id) : null,
      short_description: values.short_description || null,
      description: values.description || null,
      status: values.status ? 1 : 0,
      is_featured: values.is_featured ? "yes" : "no",
      gallery: uploads.map((upload) => upload.id),
    };
    try {
      await request(editing ? `${portal.products}/${id}` : portal.products, { method: editing ? "PUT" : "POST", body });
      toast(editing ? "Product updated" : "Product created");
      router.back();
    } catch (saveError) {
      setErrors(saveError.fieldErrors || {});
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = () => confirmAction({
    title: "Delete this product?",
    message: "It will be removed from the store. Past orders keep their details.",
    onConfirm: async () => {
      try {
        await request(`${portal.products}/${id}`, { method: "DELETE" });
        toast("Product deleted");
        router.back();
      } catch (deleteError) {
        toast(deleteError.message, "error");
      }
    },
  });

  if (loading) return <Loader />;

  const toOptions = (list) => list.map((item) => ({ value: String(item.id), label: item.name }));

  return (
    <>
      <Stack.Screen options={{ title: editing ? "Edit product" : "New product" }} />
      <Screen keyboard footer={<Button title={editing ? "Save changes" : "Publish product"} icon="checkmark" loading={saving} disabled={uploading} onPress={save} />}>
        {error ? <Notice tone="error" message={error} style={{ marginBottom: 12 }} /> : null}

        <Card style={styles.card}>
          <T variant="h3" style={{ marginBottom: 4 }}>Photos</T>
          <T variant="small" style={{ marginBottom: 12 }}>The first photo is the cover. JPG, PNG or GIF.</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {existingImages.map((image) => <Image key={image} source={{ uri: productImageUrl(image) }} style={styles.photo} />)}
            {uploads.map((upload) => (
              <View key={upload.id}>
                <Image source={{ uri: upload.uri }} style={styles.photo} />
                <Pressable onPress={() => setUploads((current) => current.filter((item) => item.id !== upload.id))} style={styles.photoRemove} hitSlop={6}>
                  <Ionicons name="close" size={14} color={colors.white} />
                </Pressable>
              </View>
            ))}
            <Pressable onPress={pickImages} disabled={uploading} style={[styles.photo, styles.addPhoto]}>
              {uploading ? <ActivityIndicator color={colors.emerald} /> : <><Ionicons name="camera-outline" size={24} color={colors.emerald} /><T variant="small" color={colors.emerald}>Add</T></>}
            </Pressable>
          </ScrollView>
        </Card>

        <Card style={styles.card}>
          <T variant="h3" style={{ marginBottom: 12 }}>Details</T>
          <TextField label="Title" value={values.title} onChangeText={(text) => change("title", text)} error={errors.title} />
          <TextField label="Short description" value={values.short_description} onChangeText={(text) => change("short_description", text)} error={errors.short_description} multiline />
          <TextField label="Description" value={values.description} onChangeText={(text) => change("description", text)} error={errors.description} multiline />
          <SelectField label="Category" value={values.category_id} options={toOptions(options.categories)} onChange={(value) => change("category_id", value)} error={errors.category_id} />
          <SelectField label="Brand" value={values.brand_id} options={toOptions(options.brands)} onChange={(value) => change("brand_id", value)} error={errors.brand_id} />
        </Card>

        <Card style={styles.card}>
          <T variant="h3" style={{ marginBottom: 12 }}>Price & stock</T>
          <Row gap={10} align="flex-start">
            <TextField label="Price (₹)" keyboardType="decimal-pad" value={values.price} onChangeText={(text) => change("price", text)} error={errors.price} style={{ flex: 1 }} />
            <TextField label="Compare at (₹)" keyboardType="decimal-pad" value={values.compare_price} onChangeText={(text) => change("compare_price", text)} error={errors.compare_price} style={{ flex: 1 }} hint="Shows a discount" />
          </Row>
          <Row gap={10} align="flex-start">
            <TextField label="SKU" autoCapitalize="characters" value={values.sku} onChangeText={(text) => change("sku", text)} error={errors.sku} style={{ flex: 1 }} />
            <TextField label="Stock qty" keyboardType="number-pad" value={values.qty} onChangeText={(text) => change("qty", text.replace(/[^0-9]/g, ""))} error={errors.qty} style={{ flex: 1 }} hint="Blank = unlimited" />
          </Row>
          <TextField label="Barcode (optional)" value={values.barcode} onChangeText={(text) => change("barcode", text)} error={errors.barcode} />
        </Card>

        <Card style={styles.card}>
          <SwitchRow label="Live on the store" hint="Hidden products can’t be bought" value={values.status} onValueChange={(value) => change("status", value)} />
          {portalKey === "admin" ? <SwitchRow label="Featured" hint="Shown in Editor’s picks on the home page" value={values.is_featured} onValueChange={(value) => change("is_featured", value)} /> : null}
        </Card>

        {editing ? <Button title="Delete product" variant="danger" icon="trash-outline" onPress={remove} /> : null}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  photo: { width: 88, height: 104, borderRadius: radius.md, backgroundColor: colors.mint },
  addPhoto: { alignItems: "center", justifyContent: "center", gap: 2, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.emerald },
  photoRemove: { position: "absolute", top: 5, right: 5, width: 22, height: 22, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "rgba(15,36,29,0.8)" },
});
