import React, { useState } from "react";
import { Button, Card, Loader, Notice, Screen, SelectField, T, TextField } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useLoad } from "@/lib/useLoad";

/** A seller's business and GST details, printed on the invoices issued for their sales. */
export default function BusinessScreen() {
  const { request } = useAuth();
  const { data, loading, error } = useLoad(() => request("/vendor/business"), [request]);

  if (loading) return <Loader />;
  if (error || !data) return <Screen><Notice tone="error" message={error || "Couldn’t load your details."} /></Screen>;

  // Mounted once the details arrive, so the form starts from them.
  return <BusinessForm initial={data.business} states={data.states} />;
}

function BusinessForm({ initial, states }) {
  const { request } = useAuth();
  const toast = useToast();
  const [values, setValues] = useState({
    legal_name: initial.legal_name || "",
    gstin: initial.gstin || "",
    business_address: initial.business_address || "",
    business_state: initial.business_state || "",
    pickup_pincode: initial.pickup_pincode || "",
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const change = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const result = await request("/vendor/business", {
        method: "PUT",
        body: { ...values, gstin: values.gstin.trim().toUpperCase(), business_state: values.business_state || null, pickup_pincode: values.pickup_pincode || null },
      });
      setValues((current) => ({ ...current, gstin: result.business.gstin || "", business_state: result.business.business_state || "", pickup_pincode: result.business.pickup_pincode || "" }));
      toast(result.message);
    } catch (saveError) {
      setErrors(saveError.fieldErrors || {});
      toast(saveError.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen keyboard footer={<Button title="Save details" icon="checkmark" loading={saving} onPress={save} />}>
      <Notice
        tone={values.gstin ? "success" : "warning"}
        message={values.gstin
          ? "With a GSTIN, your invoices are tax invoices showing GST (CGST + SGST in your state, IGST elsewhere)."
          : "Without a GSTIN, your invoices are bills of supply and no GST is charged on your products. Most online sellers need to register; ask your accountant."}
        style={{ marginBottom: 12 }}
      />
      <Card>
        <T variant="small" style={{ marginBottom: 12 }}>These details appear on the invoices Elitezaar issues for your sales.</T>
        <TextField label="Legal name" placeholder={initial.name} value={values.legal_name} onChangeText={(text) => change("legal_name", text)} error={errors.legal_name} hint={`As registered. Your store name (${initial.name}) shows too.`} />
        <TextField label="GSTIN" autoCapitalize="characters" maxLength={15} placeholder="e.g. 08ABCDE1234F1Z5" value={values.gstin} onChangeText={(text) => change("gstin", text.toUpperCase())} error={errors.gstin} />
        <TextField label="Registered business address" multiline value={values.business_address} onChangeText={(text) => change("business_address", text)} error={errors.business_address} />
        <SelectField
          label="State"
          searchable
          value={values.business_state}
          placeholder={values.gstin ? "From the GSTIN" : "Choose…"}
          options={states.map((state) => ({ value: state.code, label: state.name }))}
          onChange={(value) => change("business_state", value)}
          error={errors.business_state}
        />
      </Card>
      <Card style={{ marginTop: 12 }}>
        <TextField
          label="Pickup PIN code"
          keyboardType="number-pad"
          maxLength={6}
          placeholder="e.g. 302016"
          hint="Where couriers collect your parcels. Shoppers see delivery dates worked out from here (only your state is shown)."
          value={values.pickup_pincode}
          onChangeText={(text) => change("pickup_pincode", text.replace(/\D/g, ""))}
          error={errors.pickup_pincode}
        />
      </Card>
    </Screen>
  );
}
