import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card, EmptyState, ListRow, Loader, Notice, Pill, Row, Screen, Segmented, SelectField, SwitchRow, T, TextField } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { confirmAction } from "@/lib/confirm";
import { formatPrice } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { colors } from "@/theme";

const KINDS = {
  categories: { path: "/categories", singular: "category", icon: "albums-outline", hasPrice: false },
  brands: { path: "/brands", singular: "brand", icon: "pricetag-outline", hasPrice: false },
  shipping: { path: "/shipping-methods", singular: "shipping method", icon: "car-outline", hasPrice: true },
};

/** Admin: categories, brands and shipping methods. */
export default function CatalogScreen() {
  const { request } = useAuth();
  const toast = useToast();
  const [kind, setKind] = useState("categories");
  const [editing, setEditing] = useState(null);
  const config = KINDS[kind];
  const { data, refreshing, error, reload } = useLoad(async () => ({ kind, rows: await request(config.path) }), [kind, request]);
  // Rows from the previous tab are not shown while the new tab loads.
  const loading = data?.kind !== kind && !error;
  const rows = data?.kind === kind ? data.rows : null;

  const remove = (row) => confirmAction({
    title: `Delete “${row.name}”?`,
    message: kind === "shipping" ? "Shoppers will no longer see this delivery option."
      : kind === "categories" ? "Only empty categories can be deleted — move any products or subcategories out first."
        : `Products using this ${config.singular} keep their details, but you should move them to another ${config.singular}.`,
    onConfirm: async () => {
      try {
        await request(`${config.path}/${row.id}`, { method: "DELETE" });
        toast(`Deleted ${row.name}`);
        setEditing(null);
        reload();
      } catch (deleteError) {
        toast(deleteError.message, "error");
      }
    },
  });

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={reload}
      footer={<Button title={`Add ${config.singular}`} icon="add" onPress={() => setEditing({ name: "", price: "", status: true, parent_id: null })} />}
    >
      <Segmented options={[{ value: "categories", label: "Categories" }, { value: "brands", label: "Brands" }, { value: "shipping", label: "Shipping" }]} value={kind} onChange={setKind} style={{ marginBottom: 14 }} />
      {error ? <Notice tone="error" message={error} style={{ marginBottom: 12 }} /> : null}
      {loading ? <Loader /> : !rows?.length ? (
        <EmptyState icon={config.icon} title={`No ${kind === "shipping" ? "shipping methods" : kind} yet`} message={`Add your first ${config.singular}.`} />
      ) : (
        <Card>
          {rows.map((row, index) => (
            <ListRow
              key={row.id}
              icon={row.parent_id ? "return-down-forward-outline" : config.icon}
              title={row.name}
              subtitle={config.hasPrice ? (Number(row.price) > 0 ? formatPrice(row.price) : "Free") : kind === "categories" ? categorySubtitle(row) : row.slug ? `/${row.slug}` : undefined}
              right={Number(row.status) === 1 ? <Pill label="Active" /> : <Pill label="Hidden" color={colors.muted} background={colors.lineSoft} />}
              onPress={() => setEditing({ ...row, price: row.price != null ? String(row.price) : "", status: Number(row.status) === 1 })}
              last={index === rows.length - 1}
            />
          ))}
        </Card>
      )}

      {editing ? (
        <EditSheet
        kind={kind}
        row={editing}
        parents={kind === "categories" ? (rows || []).filter((item) => !item.parent_id && item.id !== editing.id) : []}
        onClose={() => setEditing(null)}
        onDelete={editing?.id ? () => remove(editing) : undefined}
        onSaved={(message) => { toast(message); setEditing(null); reload(); }}
        />
      ) : null}
    </Screen>
  );
}

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

/** "In Kids · 4 products" for a subcategory, "2 subcategories · 9 products" for a main category. */
function categorySubtitle(row) {
  const products = plural(Number(row.products_count || 0), "product", "products");
  if (row.parent_id) return `In ${row.parent_name} · ${products}`;
  return row.children_count ? `${plural(Number(row.children_count), "subcategory", "subcategories")} · ${products}` : products;
}

/** Mounted only while editing, so its fields always start from the chosen row. */
function EditSheet({ kind, row, parents, onClose, onDelete, onSaved }) {
  const { request } = useAuth();
  const insets = useSafeAreaInsets();
  const config = KINDS[kind];
  const [values, setValues] = useState({ name: row.name || "", price: row.price || "", status: row.status !== false, parent_id: row.parent_id ? String(row.parent_id) : "" });
  const isCategory = kind === "categories";
  // A main category with subcategories of its own can't become a subcategory (one level deep).
  const keepsTopLevel = isCategory && Number(row.children_count) > 0;
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setError("");
    const body = config.hasPrice
      ? { name: values.name.trim(), price: values.price || 0, status: values.status }
      : { name: values.name.trim(), status: values.status ? 1 : 0, ...(isCategory ? { parent_id: values.parent_id ? Number(values.parent_id) : null } : {}) };
    try {
      await request(row?.id ? `${config.path}/${row.id}` : config.path, { method: row?.id ? "PUT" : "POST", body });
      onSaved(row?.id ? `Saved ${values.name.trim()}` : `Added ${values.name.trim()}`);
    } catch (saveError) {
      setErrors(saveError.fieldErrors || {});
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />
        <T variant="h2" style={{ marginBottom: 14 }}>{row?.id ? `Edit ${config.singular}` : `New ${config.singular}`}</T>
        {error ? <Notice tone="error" message={error} style={{ marginBottom: 12 }} /> : null}
        <TextField label="Name" value={values.name} onChangeText={(name) => setValues((current) => ({ ...current, name }))} error={errors.name} autoFocus={!row?.id} />
        {isCategory && !keepsTopLevel ? (
          <SelectField
            label="Parent category"
            value={values.parent_id}
            options={[{ value: "", label: "None — main category" }, ...parents.map((parent) => ({ value: String(parent.id), label: parent.name }))]}
            onChange={(parent_id) => setValues((current) => ({ ...current, parent_id }))}
            error={errors.parent_id}
          />
        ) : null}
        {keepsTopLevel ? <T variant="small" style={{ marginTop: -4, marginBottom: 12 }}>Has its own subcategories, so it stays a main category.</T> : null}
        {config.hasPrice ? <TextField label="Price (₹)" keyboardType="decimal-pad" hint="0 for free delivery" value={values.price} onChangeText={(price) => setValues((current) => ({ ...current, price }))} error={errors.price} /> : null}
        <SwitchRow label="Active" hint={kind === "shipping" ? "Offered at checkout" : "Visible on the store"} value={values.status} onValueChange={(status) => setValues((current) => ({ ...current, status }))} />
        <Row gap={10} style={{ marginTop: 6 }}>
          {onDelete ? <Button title="Delete" variant="danger" icon="trash-outline" block={false} onPress={onDelete} /> : null}
          <View style={{ flex: 1 }}><Button title="Save" icon="checkmark" loading={saving} disabled={!values.name.trim()} onPress={save} /></View>
        </Row>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(10,31,25,0.45)" },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 10, backgroundColor: colors.white },
  handle: { width: 42, height: 5, alignSelf: "center", marginBottom: 14, borderRadius: 3, backgroundColor: colors.line },
});
