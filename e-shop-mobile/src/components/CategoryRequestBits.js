import React from "react";
import { Pressable, View } from "react-native";
import { Pill, SelectField, T, TextField } from "@/components/ui";
import { colors } from "@/theme";

/** A category request's status, as sellers and admins see it. */
export const REQUEST_STATUSES = {
  pending: { label: "Waiting", color: colors.warning, background: colors.warningSoft },
  approved: { label: "Added", color: colors.success, background: colors.successSoft },
  declined: { label: "Not added", color: colors.danger, background: colors.dangerSoft },
};

/** How many a seller can ask for on the sign-up form (more later, from the seller hub). */
export const AT_SIGN_UP = 3;

export const emptyRequest = () => ({ name: "", parent_id: "", note: "" });

/** One request as the API takes it. */
export const requestPayload = ({ name, parent_id: parentId, note }) => ({
  name: name.trim(),
  parent_id: parentId ? Number(parentId) : null,
  note: note.trim() || null,
});

/** "under Kids", or "a new main collection". */
export const requestPlace = (request) => (request.parent_name ? `under ${request.parent_name}` : "a new main collection");

export function RequestStatusPill({ status }) {
  const config = REQUEST_STATUSES[status] || { label: status, color: colors.muted, background: colors.lineSoft };
  return <Pill label={config.label} color={config.color} background={config.background} />;
}

/**
 * One category to ask for: its name, where it goes (under a main collection, or a new main collection) and an
 * optional note, with what's already there so a category that exists is easy to spot. `categories` is the
 * storefront tree (main collections with their subcategories).
 */
export function CategoryRequestFields({ value, onChange, errors = {}, categories, onRemove }) {
  const parent = categories.find((category) => String(category.id) === String(value.parent_id));
  const existing = parent ? (parent.children || []).map((child) => child.name) : categories.map((category) => category.name);
  const set = (field) => (next) => onChange({ ...value, [field]: next });

  return (
    <View>
      <TextField label="Category you need" placeholder="e.g. Footwear" maxLength={60} value={value.name} onChangeText={set("name")} error={errors.name} icon="pricetag-outline" />
      <SelectField
        label="Where it goes"
        value={value.parent_id}
        options={[{ value: "", label: "A new main collection" }, ...categories.map((category) => ({ value: String(category.id), label: `Under ${category.name}` }))]}
        onChange={set("parent_id")}
        error={errors.parent_id}
      />
      <TextField label="What will you sell in it? (optional)" placeholder="e.g. School shoes for ages 3 to 12" maxLength={300} value={value.note} onChangeText={set("note")} error={errors.note} />
      {existing.length ? <T variant="small" style={{ marginTop: -6, marginBottom: 8 }}>{parent ? `Already in ${parent.name}: ` : "Main collections now: "}{existing.join(", ")}</T> : null}
      {onRemove ? (
        <Pressable onPress={onRemove} hitSlop={8} style={{ alignSelf: "flex-start", marginBottom: 8 }}>
          <T variant="strong" color={colors.danger}>Remove</T>
        </Pressable>
      ) : null}
    </View>
  );
}
