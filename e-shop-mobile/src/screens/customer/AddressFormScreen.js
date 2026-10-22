import React, { useEffect, useState } from "react";
import { Stack, router, useLocalSearchParams } from "expo-router";
import AddressFields, { EMPTY_ADDRESS } from "@/components/AddressFields";
import { Button, Card, Loader, Notice, Screen, SwitchRow } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

export default function AddressFormScreen() {
  const { id } = useLocalSearchParams();
  const { request, user } = useAuth();
  const toast = useToast();
  const editing = !!id;
  const [values, setValues] = useState({ ...EMPTY_ADDRESS, full_name: user?.name || "", phone: user?.phone || "", is_default: false });
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editing) return;
    request("/customer/addresses").then((list) => {
      const address = list.find((item) => String(item.id) === String(id));
      if (address) setValues({ ...EMPTY_ADDRESS, ...address, is_default: !!address.is_default });
      else setError("This address could not be found.");
    }).catch((loadError) => setError(loadError.message)).finally(() => setLoading(false));
  }, [editing, id, request]);

  const change = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const save = async () => {
    setSaving(true);
    setError("");
    const body = {
      label: values.label, full_name: values.full_name, phone: values.phone, address: values.address,
      city: values.city, state: values.state, postal_code: values.postal_code, country: values.country, is_default: !!values.is_default,
    };
    try {
      await request(editing ? `/customer/addresses/${id}` : "/customer/addresses", { method: editing ? "PUT" : "POST", body });
      toast(editing ? "Address updated" : "Address saved");
      router.back();
    } catch (saveError) {
      setErrors(saveError.fieldErrors || {});
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <>
      <Stack.Screen options={{ title: editing ? "Edit address" : "New address" }} />
      <Screen keyboard footer={<Button title={editing ? "Save changes" : "Save address"} icon="checkmark" loading={saving} onPress={save} />}>
        {error ? <Notice tone="error" message={error} style={{ marginBottom: 12 }} /> : null}
        <Card>
          <AddressFields values={values} errors={errors} onChange={change} showLabel />
          <SwitchRow label="Use as my default address" value={!!values.is_default} onValueChange={(value) => change("is_default", value)} />
        </Card>
      </Screen>
    </>
  );
}
