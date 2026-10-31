import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, Card, Loader, Notice, Pill, Row, Screen, SelectField, SwitchRow, T, TextField } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { productImageUrl, SITE_URL } from "@/lib/config";
import { confirmAction } from "@/lib/confirm";
import { APPROVAL_STATUSES } from "@/lib/format";
import { PORTALS } from "@/lib/portals";
import { colors, fonts, radius } from "@/theme";

// Phone photos are often 3–8 MB, more than the server accepts per file. Shrinking to at most 1600px and
// re-saving as JPEG (usually 200–500 KB) makes uploads fit, and keeps them quick on mobile data.
const MAX_PHOTO_SIDE = 1600;

async function preparePhoto(asset) {
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width || 0, asset.height || 0) > MAX_PHOTO_SIDE) {
    context.resize(asset.width >= asset.height ? { width: MAX_PHOTO_SIDE, height: null } : { width: null, height: MAX_PHOTO_SIDE });
  }
  const image = await context.renderAsync();
  return image.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
}

const GST_RATE_OPTIONS = [{ value: "", label: "Same as category" }, ...[0, 3, 5, 12, 18, 28, 40].map((rate) => ({ value: String(rate), label: `${rate}%` }))];

const EMPTY = { title: "", price: "", compare_price: "", sku: "", barcode: "", qty: "", category_id: "", brand_id: "", short_description: "", description: "", status: true, is_featured: false, hasSizes: false, sizes: [], hsn_code: "", gst_rate: "" };

/** Create or edit a product. Vendors manage their own listings, which an admin reviews before they go live; only admins can feature a product. */
export default function ProductFormScreen({ portal: portalKey }) {
  const portal = PORTALS[portalKey];
  const { id } = useLocalSearchParams();
  const { request } = useAuth();
  const toast = useToast();
  const editing = !!id;

  const [values, setValues] = useState(EMPTY);
  // sellerRestriction: why a seller can't save products yet (waiting for approval, or deactivated).
  const [options, setOptions] = useState({ categories: [], brands: [], sizes: [], sellerRestriction: null });
  const [existingImages, setExistingImages] = useState([]);
  const [review, setReview] = useState(null);
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
      setOptions({ categories: optionData.categories || [], brands: optionData.brands || [], sizes: optionData.sizes || [], sellerRestriction: optionData.seller_restriction || null });
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
          hsn_code: product.hsn_code || "",
          gst_rate: product.gst_rate == null ? "" : String(Number(product.gst_rate)),
          hasSizes: (product.sizes || []).length > 0,
          sizes: (product.sizes || []).map((size) => ({ size_id: size.size_id, qty: size.qty == null ? "" : String(size.qty) })),
        });
        setExistingImages([...new Set([product.image, ...(product.images || []).map((image) => image.image)].filter(Boolean))]);
        setReview({ id: product.id, vendor_id: product.vendor_id, vendor: product.vendor, approval_status: product.approval_status || "approved", review_note: product.review_note });
      }
    }).catch((loadError) => setError(loadError.message)).finally(() => setLoading(false));
  }, [editing, id, portal, request]);

  const change = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  // Sizes: values.sizes holds [{size_id, qty}] for the ticked sizes, kept in the shop's size order.
  const toggleSize = (sizeId) => setValues((current) => {
    const ticked = current.sizes.some((row) => row.size_id === sizeId);
    const order = options.sizes.map((size) => size.id);
    const sizes = ticked ? current.sizes.filter((row) => row.size_id !== sizeId) : [...current.sizes, { size_id: sizeId, qty: "" }];
    return { ...current, sizes: sizes.sort((a, b) => order.indexOf(a.size_id) - order.indexOf(b.size_id)) };
  });
  const setSizeQty = (sizeId, qty) => setValues((current) => ({
    ...current,
    sizes: current.sizes.map((row) => (row.size_id === sizeId ? { ...row, qty: qty.replace(/[^0-9]/g, "") } : row)),
  }));

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 6, quality: 0.8 });
    if (result.canceled) return;
    setUploading(true);
    for (const [index, asset] of result.assets.entries()) {
      try {
        const photo = await preparePhoto(asset);
        const form = new FormData();
        if (Platform.OS === "web") {
          form.append("image", await (await fetch(photo.uri)).blob(), `product-${Date.now()}-${index + 1}.jpg`);
        } else {
          // Since SDK 57 the global fetch is expo/fetch, which only sends Blob-like files: React Native's
          // `{ uri, name, type }` parts make it throw before the request starts.
          form.append("image", new File(photo.uri));
        }
        const uploaded = await request("/temp-images", { method: "POST", form });
        setUploads((current) => [...current, { id: uploaded.data.id, uri: photo.uri, thumb: `${SITE_URL}/${uploaded.data.thumb_path}` }]);
      } catch (uploadError) {
        // "failed to upload" and 413 come from the server's size limits.
        const tooLarge = uploadError.status === 413 || /failed to upload|too large/i.test(uploadError.message || "");
        toast(tooLarge ? "That photo is too large to upload. Please try a smaller one." : uploadError.message || "Couldn’t upload that photo.", "error");
      }
    }
    setUploading(false);
  };

  const save = async () => {
    if (values.hasSizes && !values.sizes.length) {
      setError("Tick at least one size, or switch off “Sold in sizes”.");
      return;
    }
    setSaving(true);
    setError("");
    const body = {
      title: values.title.trim(),
      price: values.price,
      compare_price: values.compare_price === "" ? null : values.compare_price,
      sku: values.sku.trim(),
      barcode: values.barcode.trim() || null,
      // A product sold in sizes gets its stock from them; an empty size list makes it a one-size product.
      qty: values.hasSizes || values.qty === "" ? null : Number(values.qty),
      sizes: values.hasSizes ? values.sizes.map((row) => ({ size_id: row.size_id, qty: row.qty === "" ? null : Number(row.qty) })) : [],
      category_id: values.category_id ? Number(values.category_id) : null,
      brand_id: values.brand_id ? Number(values.brand_id) : null,
      short_description: values.short_description || null,
      description: values.description || null,
      status: values.status ? 1 : 0,
      is_featured: values.is_featured ? "yes" : "no",
      gallery: uploads.map((upload) => upload.id),
      // Blank = the category's GST.
      hsn_code: values.hsn_code.trim() || null,
      gst_rate: values.gst_rate === "" ? null : Number(values.gst_rate),
    };
    try {
      const result = await request(editing ? `${portal.products}/${id}` : portal.products, { method: editing ? "PUT" : "POST", body });
      const sentForReview = portalKey === "vendor" && result.data?.approval_status === "pending";
      toast(sentForReview ? (editing ? "Saved and sent for review" : "Submitted for review") : editing ? "Product updated" : "Product created");
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

  // Categories carry a "Kids › Toys" label for subcategories.
  const toOptions = (list) => list.map((item) => ({ value: String(item.id), label: item.label || item.name }));
  const isVendor = portalKey === "vendor";
  // Shown in the stock box: the sizes' total, or blank while any size's stock isn't tracked.
  const sizeTotal = values.sizes.some((row) => row.qty === "") ? "" : String(values.sizes.reduce((sum, row) => sum + Number(row.qty || 0), 0));
  const sizeErrors = [...new Set(Object.entries(errors).filter(([key, message]) => key.startsWith("sizes") && message).map(([, message]) => message))];
  const saveTitle = !editing ? (isVendor ? "Submit for review" : "Publish product") : isVendor && review?.approval_status === "rejected" ? "Save & resubmit" : "Save changes";

  return (
    <>
      <Stack.Screen options={{ title: editing ? "Edit product" : "New product" }} />
      <Screen keyboard footer={<Button title={saveTitle} icon="checkmark" loading={saving} disabled={uploading || Boolean(options.sellerRestriction)} onPress={save} />}>
        {error ? <Notice tone="error" message={error} style={{ marginBottom: 12 }} /> : null}
        {!isVendor && review && (review.vendor_id || review.approval_status !== "approved") ? (
          <ReviewCard product={review} onDone={(message) => { toast(message); router.back(); }} />
        ) : null}
        {options.sellerRestriction ? <Notice tone="warning" message={options.sellerRestriction} style={styles.card} /> : null}
        {isVendor && !options.sellerRestriction ? <SellerReviewNotice status={editing ? review?.approval_status : "new"} note={review?.review_note} /> : null}

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
          {isVendor ? (
            <Pressable onPress={() => router.push("/vendor/category-requests")} hitSlop={6} style={{ marginTop: -6, marginBottom: 12 }}>
              <T variant="small">Can’t find the right category? <T variant="strong" color={colors.tealDark} style={{ fontSize: 14 }}>Ask us to add it</T></T>
            </Pressable>
          ) : null}
          <SelectField label="Brand" value={values.brand_id} options={toOptions(options.brands)} onChange={(value) => change("brand_id", value)} error={errors.brand_id} />
          {isVendor ? (
            <Pressable onPress={() => router.push("/vendor/brand-requests")} hitSlop={6} style={{ marginTop: -6, marginBottom: 12 }}>
              <T variant="small">Can’t find your brand? <T variant="strong" color={colors.tealDark} style={{ fontSize: 14 }}>Ask us to add it</T></T>
            </Pressable>
          ) : null}
        </Card>

        <Card style={styles.card}>
          <T variant="h3" style={{ marginBottom: 12 }}>Price & stock</T>
          <Row gap={10} align="flex-start">
            <TextField label="Price (₹)" keyboardType="decimal-pad" value={values.price} onChangeText={(text) => change("price", text)} error={errors.price} style={{ flex: 1 }} />
            <TextField label="Compare at (₹)" keyboardType="decimal-pad" value={values.compare_price} onChangeText={(text) => change("compare_price", text)} error={errors.compare_price} style={{ flex: 1 }} hint="Shows a discount" />
          </Row>
          <Row gap={10} align="flex-start">
            <TextField label="SKU" autoCapitalize="characters" value={values.sku} onChangeText={(text) => change("sku", text)} error={errors.sku} style={{ flex: 1 }} />
            <TextField label="Stock qty" keyboardType="number-pad" value={values.hasSizes ? sizeTotal : values.qty} onChangeText={(text) => change("qty", text.replace(/[^0-9]/g, ""))} error={errors.qty} style={{ flex: 1 }} hint={values.hasSizes ? "Added up from sizes" : "Blank = unlimited"} editable={!values.hasSizes} />
          </Row>
          <TextField label="Barcode (optional)" value={values.barcode} onChangeText={(text) => change("barcode", text)} error={errors.barcode} />
          <Row gap={10} align="flex-start">
            <TextField label="HSN code" keyboardType="number-pad" maxLength={8} placeholder="From category" value={values.hsn_code} onChangeText={(text) => change("hsn_code", text.replace(/[^0-9]/g, ""))} error={errors.hsn_code} style={{ flex: 1 }} />
            <SelectField label="GST rate" value={values.gst_rate} options={GST_RATE_OPTIONS} onChange={(value) => change("gst_rate", value)} error={errors.gst_rate} style={{ flex: 1 }} />
          </Row>
          <T variant="small" style={{ marginTop: -6, marginBottom: 6 }}>Leave these to use the category’s GST. Prices include GST.</T>
        </Card>

        <Card style={styles.card}>
          <SwitchRow label="Sold in sizes" hint="e.g. Free Size, S, M, L, XL — shoppers pick one" value={values.hasSizes} onValueChange={(value) => change("hasSizes", value)} />
          {values.hasSizes ? (
            <View style={{ marginTop: 6 }}>
              <T variant="small" style={{ marginBottom: 10 }}>Tick each size you sell and enter how many you have. Leave stock blank if you don’t track it.</T>
              {options.sizes.map((size) => {
                const row = values.sizes.find((item) => item.size_id === size.id);
                return (
                  <View key={size.id} style={[styles.sizeRow, row && styles.sizeRowOn]}>
                    <Pressable onPress={() => toggleSize(size.id)} style={styles.sizeName} accessibilityRole="checkbox" accessibilityState={{ checked: !!row }} accessibilityLabel={`Size ${size.name}`} hitSlop={6}>
                      <Ionicons name={row ? "checkbox" : "square-outline"} size={22} color={row ? colors.emerald : colors.muted} />
                      <T variant="title">{size.name}</T>
                    </Pressable>
                    <TextInput
                      value={row?.qty ?? ""}
                      onChangeText={(text) => setSizeQty(size.id, text)}
                      editable={!!row}
                      keyboardType="number-pad"
                      placeholder={row ? "Stock" : "—"}
                      placeholderTextColor={colors.faint}
                      accessibilityLabel={`Stock for size ${size.name}`}
                      style={[styles.sizeStock, !row && styles.sizeStockOff]}
                    />
                  </View>
                );
              })}
              {!options.sizes.length ? <T variant="small">No sizes have been set up yet.</T> : null}
              {sizeErrors.map((message) => <T key={message} variant="small" color={colors.danger} style={{ marginTop: 6 }}>{message}</T>)}
              <T variant="small" style={{ marginTop: 8 }}>{isVendor ? "Need a size that isn’t listed? Ask the Elitezaar team to add it." : "Add more sizes (like UK 8 or 32) under More › Catalog › Sizes."}</T>
            </View>
          ) : null}
        </Card>

        <Card style={styles.card}>
          <SwitchRow label="Live on the store" hint={isVendor && review?.approval_status !== "approved" ? "Goes live once our team approves it" : "Hidden products can’t be bought"} value={values.status} onValueChange={(value) => change("status", value)} />
          {portalKey === "admin" ? <SwitchRow label="Featured" hint="Shown in Editor’s picks on the home page" value={values.is_featured} onValueChange={(value) => change("is_featured", value)} /> : null}
        </Card>

        {editing ? <Button title="Delete product" variant="danger" icon="trash-outline" onPress={remove} /> : null}
      </Screen>
    </>
  );
}

const REVIEW_COPY = {
  pending: "Hidden from shoppers until you approve it. Check the photos and details below first.",
  approved: "Approved — visible in the store while it’s switched on. Reject it to take it down.",
  rejected: "Sent back to the seller with your note. Approve it if it’s fine after all.",
};

/** Admin approve / reject box for a seller’s listing. A rejection needs a note the seller will see. */
function ReviewCard({ product, onDone }) {
  const { request } = useAuth();
  const [note, setNote] = useState(product.approval_status === "rejected" ? product.review_note || "" : "");
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const status = APPROVAL_STATUSES[product.approval_status] || APPROVAL_STATUSES.approved;

  const submit = async (decision) => {
    setSaving(decision);
    setError("");
    try {
      const result = await request(`/admin/products/${product.id}/review`, { method: "PATCH", body: { decision, note: note.trim() || null } });
      onDone(result.message || "Review saved");
    } catch (reviewError) {
      setError(reviewError.fieldErrors?.note || reviewError.message);
      setSaving("");
    }
  };

  return (
    <Card style={[styles.card, styles.review, { borderColor: status.background }]}>
      <Row justify="space-between" align="flex-start" gap={10}>
        <View style={{ flex: 1 }}>
          <T variant="eyebrow">Seller listing</T>
          <T variant="h3" style={{ marginTop: 3 }} numberOfLines={1}>{product.vendor?.name || "Store listing"}</T>
        </View>
        <Pill label={status.label} color={status.color} background={status.background} />
      </Row>
      <T variant="small" style={{ marginTop: 6, marginBottom: 12 }}>{REVIEW_COPY[product.approval_status] || REVIEW_COPY.approved}</T>
      <TextField label="Note to the seller" hint="Required to reject" value={note} onChangeText={(text) => { setNote(text); setError(""); }} error={error} multiline maxLength={500} />
      <Row gap={10}>
        {product.approval_status !== "approved" ? <Button title="Approve" icon="checkmark-circle-outline" loading={saving === "approved"} disabled={!!saving} onPress={() => submit("approved")} style={{ flex: 1 }} /> : null}
        <Button title={product.approval_status === "rejected" ? "Update note" : "Reject"} variant="danger" icon="close-circle-outline" loading={saving === "rejected"} disabled={!!saving} onPress={() => submit("rejected")} style={{ flex: 1 }} />
      </Row>
    </Card>
  );
}

/** Where a seller’s listing stands. `status` is "new" while creating. */
function SellerReviewNotice({ status, note }) {
  if (status === "new") return <Notice tone="info" message="New listings are checked by the Elitezaar team before they appear in the store." style={styles.card} />;
  if (status === "pending") return <Notice tone="warning" title="In review" message="Shoppers can’t see this listing until our team approves it." style={styles.card} />;
  if (status === "rejected") return <Notice tone="error" title="Changes needed" message={`${note || "Our team asked for changes to this listing."}
Update it and save to send it for review again.`} style={styles.card} />;
  return <Notice tone="info" message="Changing the title, descriptions, category, brand or photos sends this listing back for a quick review. Price and stock changes apply straight away." style={styles.card} />;
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  review: { borderWidth: 1.5 },
  photo: { width: 88, height: 104, borderRadius: radius.md, backgroundColor: colors.mint },
  sizeRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.white },
  sizeRowOn: { borderColor: colors.emerald },
  sizeName: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 36 },
  sizeStock: { width: 96, height: 40, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: 10, color: colors.ink, fontFamily: fonts.bodySemi, fontSize: 16, backgroundColor: colors.white },
  sizeStockOff: { backgroundColor: colors.cream, borderColor: colors.lineSoft },
  addPhoto: { alignItems: "center", justifyContent: "center", gap: 2, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.emerald },
  photoRemove: { position: "absolute", top: 5, right: 5, width: 22, height: 22, alignItems: "center", justifyContent: "center", borderRadius: 11, backgroundColor: "rgba(15,36,29,0.8)" },
});
