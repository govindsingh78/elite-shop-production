import React from "react";
import { View } from "react-native";
import { Row, TextField } from "@/components/ui";

export const EMPTY_ADDRESS = { label: "Home", full_name: "", phone: "", address: "", city: "", state: "", postal_code: "", country: "India" };

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
      <Row gap={10} align="flex-start">
        <TextField label="City" style={{ flex: 1 }} {...bind("city")} />
        <TextField label="State" style={{ flex: 1 }} {...bind("state")} />
      </Row>
      <Row gap={10} align="flex-start">
        <TextField label="PIN code" keyboardType="number-pad" style={{ flex: 1 }} autoComplete="postal-code" {...bind("postal_code")} />
        <TextField label="Country" style={{ flex: 1 }} {...bind("country")} />
      </Row>
    </View>
  );
}
