import React, { useEffect, useState } from "react";
import { Button, Card, Loader, Notice, Screen, SelectField, T, TextField } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

/** The usual GST rates, as offered in the forms. */
const GST_RATES = [0, 3, 5, 12, 18, 28, 40];
const RATE_OPTIONS = GST_RATES.map((rate) => ({ value: String(rate), label: `${rate}%` }));

const asForm = (settings) => ({
  legal_name: settings.legal_name || "",
  gstin: settings.gstin || "",
  address: settings.address || "",
  state_code: settings.state_code || "",
  invoice_prefix: settings.invoice_prefix || "EZ",
  default_rate: String(Number(settings.default_rate ?? 5)),
  default_rate_high: settings.default_rate_high == null ? "" : String(Number(settings.default_rate_high)),
  default_threshold: settings.default_threshold == null ? "" : String(Number(settings.default_threshold)),
  shipping_rate: String(Number(settings.shipping_rate ?? 18)),
});

/** Admin: the store's GST registration, invoice numbering and default rates. */
export default function GstSettingsScreen() {
  const { request } = useAuth();
  const toast = useToast();
  const [values, setValues] = useState(null);
  const [states, setStates] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    request("/admin/gst/settings")
      .then((data) => {
        setValues(asForm(data.settings));
        setStates(data.states);
      })
      .catch((loadError) => setError(loadError.message));
  }, [request]);

  const set = (name) => (value) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const data = await request("/admin/gst/settings", {
        method: "PUT",
        body: {
          ...values,
          gstin: values.gstin.trim().toUpperCase() || null,
          state_code: values.state_code || null,
          invoice_prefix: values.invoice_prefix.trim().toUpperCase(),
          default_rate: Number(values.default_rate),
          default_rate_high: values.default_rate_high === "" ? null : Number(values.default_rate_high),
          default_threshold: values.default_threshold === "" ? null : Number(values.default_threshold),
          shipping_rate: Number(values.shipping_rate),
        },
      });
      setValues(asForm(data.settings));
      toast(data.message);
    } catch (saveError) {
      setErrors(saveError.fieldErrors || {});
      toast(saveError.message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (error) return <Screen><Notice tone="error" message={error} /></Screen>;
  if (!values) return <Screen><Loader /></Screen>;

  return (
    <Screen keyboard>
      <T variant="body" style={{ marginBottom: 14 }}>Elitezaar’s registration for its own sales and delivery charges, and the rates products use unless their category or listing says otherwise.</T>
      <Card>
        <T variant="h3" style={{ marginBottom: 12 }}>Business details on invoices</T>
        <TextField label="Legal name" value={values.legal_name} onChangeText={set("legal_name")} error={errors.legal_name} />
        <TextField label="GSTIN" autoCapitalize="characters" maxLength={15} placeholder="Leave blank if not registered" hint="Without a GSTIN, Elitezaar’s invoices are bills of supply with no GST." value={values.gstin} onChangeText={set("gstin")} error={errors.gstin} />
        <TextField label="Registered address" multiline value={values.address} onChangeText={set("address")} error={errors.address} />
        <SelectField
          label="State"
          searchable
          value={values.state_code}
          placeholder={values.gstin ? "From the GSTIN" : "Choose…"}
          options={states.map((state) => ({ value: state.code, label: `${state.name} (${state.code})` }))}
          onChange={set("state_code")}
          error={errors.state_code}
        />
        <TextField
          label="Invoice number prefix"
          autoCapitalize="characters"
          maxLength={6}
          hint={`Numbers look like ${(values.invoice_prefix || "EZ").toUpperCase()}/2627/0001 and restart each April. Sellers’ invoices start S and their seller number.`}
          value={values.invoice_prefix}
          onChangeText={set("invoice_prefix")}
          error={errors.invoice_prefix}
        />
      </Card>

      <Card style={{ marginTop: 14 }}>
        <T variant="h3">Default GST rates</T>
        <T variant="small" style={{ marginTop: 2, marginBottom: 12 }}>Used for products whose category has no rate of its own. Prices include GST. Check rates with your accountant.</T>
        <SelectField label="Rate" value={values.default_rate} options={RATE_OPTIONS} onChange={set("default_rate")} error={errors.default_rate} />
        <SelectField label="Higher rate above a price per piece" value={values.default_rate_high} options={[{ value: "", label: "None" }, ...RATE_OPTIONS]} onChange={set("default_rate_high")} error={errors.default_rate_high} />
        {values.default_rate_high !== "" ? (
          <TextField label="…when a piece costs more than (₹, before GST)" keyboardType="number-pad" value={values.default_threshold} onChangeText={(text) => set("default_threshold")(text.replace(/[^0-9]/g, ""))} error={errors.default_threshold} />
        ) : null}
        <T variant="small" style={{ marginTop: -4, marginBottom: 12 }}>Clothing and footwear: 5%, or 18% above ₹2,500 a piece before GST.</T>
        <SelectField label="GST on delivery charges" value={values.shipping_rate} options={RATE_OPTIONS} onChange={set("shipping_rate")} error={errors.shipping_rate} />
        <T variant="small">Set HSN codes and rates for each category on the website (Categories); a product can override its category in its own form.</T>
      </Card>

      <Button title="Save GST settings" icon="checkmark-circle-outline" loading={saving} onPress={save} style={{ marginTop: 16 }} />
    </Screen>
  );
}
