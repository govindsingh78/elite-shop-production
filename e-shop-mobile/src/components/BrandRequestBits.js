import React from "react";
import { Pressable, View } from "react-native";
import { T, TextField } from "@/components/ui";
import { colors } from "@/theme";

/** How many a seller can ask for on the sign-up form (more later, from the seller hub). */
export const BRANDS_AT_SIGN_UP = 3;

export const emptyBrandRequest = () => ({ name: "", note: "" });

/** One request as the API takes it. */
export const brandRequestPayload = ({ name, note }) => ({ name: name.trim(), note: note.trim() || null });

/** One brand to ask for: its name, written the way the brand writes it, and an optional note. */
export function BrandRequestFields({ value, onChange, errors = {}, onRemove }) {
  const set = (field) => (next) => onChange({ ...value, [field]: next });

  return (
    <View>
      <TextField label="Brand you need" placeholder="e.g. Loom Craft" maxLength={60} autoCapitalize="none" value={value.name} onChangeText={set("name")} error={errors.name} icon="ribbon-outline" />
      <TextField label="What do you sell under it? (optional)" placeholder="e.g. My own label of handloom sarees" maxLength={300} value={value.note} onChangeText={set("note")} error={errors.note} />
      {onRemove ? (
        <Pressable onPress={onRemove} hitSlop={8} style={{ alignSelf: "flex-start", marginBottom: 8 }}>
          <T variant="strong" color={colors.danger}>Remove</T>
        </Pressable>
      ) : null}
    </View>
  );
}
