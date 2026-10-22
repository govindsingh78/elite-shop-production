import React, { useState } from "react";
import { Button, Card, Notice, Screen, T, TextField } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

export default function ProfileScreen() {
  const { request, user, updateUser } = useAuth();
  const toast = useToast();
  const [values, setValues] = useState({ name: user?.name || "", phone: user?.phone || "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const result = await request("/customer/profile", { method: "PUT", body: values });
      updateUser(result.user);
      toast("Profile updated");
    } catch (saveError) {
      setErrors(saveError.fieldErrors || {});
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen keyboard>
      {error ? <Notice tone="error" message={error} style={{ marginBottom: 12 }} /> : null}
      <Card>
        <TextField label="Full name" value={values.name} onChangeText={(name) => setValues((current) => ({ ...current, name }))} error={errors.name} />
        <TextField label="Phone" keyboardType="phone-pad" value={values.phone} onChangeText={(phone) => setValues((current) => ({ ...current, phone }))} error={errors.phone} />
        <TextField label="Email" value={user?.email || ""} editable={false} hint="Contact support to change your sign-in email." />
        <Button title="Save profile" icon="checkmark" loading={saving} onPress={save} />
      </Card>
      <T variant="small" center style={{ marginTop: 16 }}>Delivery names and numbers are saved per address.</T>
    </Screen>
  );
}
