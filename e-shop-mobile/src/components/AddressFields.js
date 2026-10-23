import React from "react";
import { View } from "react-native";
import LocationFields from "@/components/LocationFields";
import { TextField } from "@/components/ui";
import { DEFAULT_COUNTRY, postalLabel } from "@/lib/geo";

export const EMPTY_ADDRESS = { label: "Home", full_name: "", phone: "", address: "", city: "", state: "", postal_code: "", country: DEFAULT_COUNTRY };

/**
 * Delivery address inputs. `names` maps our field names to the API's, e.g. checkout uses
 * customer_name/customer_phone while saved addresses use full_name/phone.
 */
export default function AddressFields({ values, errors = {}, onChange, names = {}, showName = true, showLabel = false }) {
  const field = (key) => names[key] || key;
  const bind = (key) => ({
    value: values[field(key)] ?? "",
    onChangeText: (text) => onChange(field(key), text),
    error: errors[field(key)],
  });

  return (
    <View>
      {showLabel ? <TextField label="Label" placeholder="Home, Work…" {...bind("label")} /> : null}
      {showName ? <TextField label="Full name" autoComplete="name" textContentType="name" {...bind("full_name")} /> : null}
      <TextField label="Phone" keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" {...bind("phone")} />
      <TextField label="Address" placeholder="House, street, area" multiline autoComplete="street-address" {...bind("address")} />
      <LocationFields
        values={{ country: values[field("country")], state: values[field("state")], city: values[field("city")] }}
        errors={{ country: errors[field("country")], state: errors[field("state")], city: errors[field("city")] }}
        onChange={(key, value) => onChange(field(key), value)}
      />
      <TextField label={postalLabel(values[field("country")])} keyboardType={postalLabel(values[field("country")]) === "PIN code" ? "number-pad" : "default"} autoComplete="postal-code" {...bind("postal_code")} />
    </View>
  );
}
