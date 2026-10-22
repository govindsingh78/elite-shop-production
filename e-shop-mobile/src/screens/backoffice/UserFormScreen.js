import React, { useEffect, useState } from "react";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { Button, Card, Loader, Notice, Screen, SelectField, T, TextField } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { confirmAction } from "@/lib/confirm";
import { ROLES } from "@/screens/backoffice/UsersScreen";

export default function UserFormScreen() {
  const { id } = useLocalSearchParams();
  const { request, user: me } = useAuth();
  const toast = useToast();
  const editing = !!id;
  const [values, setValues] = useState({ name: "", email: "", role: "customer", password: "", password_confirmation: "" });
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editing) return;
    request(`/admin/users/${id}`)
      .then((user) => setValues((current) => ({ ...current, name: user.name, email: user.email, role: user.role })))
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, [editing, id, request]);

  const change = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const save = async () => {
    setSaving(true);
    setError("");
    const body = { name: values.name.trim(), email: values.email.trim(), role: values.role };
    if (values.password) Object.assign(body, { password: values.password, password_confirmation: values.password_confirmation });
    try {
      await request(editing ? `/admin/users/${id}` : "/admin/users", { method: editing ? "PUT" : "POST", body });
      toast(editing ? "User updated" : "User created");
      router.back();
    } catch (saveError) {
      setErrors(saveError.fieldErrors || {});
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = () => confirmAction({
    title: `Delete ${values.name}?`,
    message: "Their account is removed. Orders they placed are kept.",
    onConfirm: async () => {
      try {
        await request(`/admin/users/${id}`, { method: "DELETE" });
        toast("User deleted");
        router.back();
      } catch (deleteError) {
        toast(deleteError.message, "error");
      }
    },
  });

  if (loading) return <Loader />;
  const isMe = editing && String(me?.id) === String(id);

  return (
    <>
      <Stack.Screen options={{ title: editing ? "Edit user" : "New user" }} />
      <Screen keyboard footer={<Button title={editing ? "Save changes" : "Create user"} icon="checkmark" loading={saving} onPress={save} />}>
        {error ? <Notice tone="error" message={error} style={{ marginBottom: 12 }} /> : null}
        <Card style={{ marginBottom: 12 }}>
          <TextField label="Name" value={values.name} onChangeText={(text) => change("name", text)} error={errors.name} />
          <TextField label="Email" keyboardType="email-address" autoCapitalize="none" value={values.email} onChangeText={(text) => change("email", text)} error={errors.email} />
          <SelectField label="Role" value={values.role} options={Object.entries(ROLES).map(([value, config]) => ({ value, label: config.label }))} onChange={(value) => change("role", value)} error={errors.role} />
          <T variant="small">Customers shop, sellers manage their own products and orders, admins run the whole store.</T>
        </Card>
        <Card style={{ marginBottom: 16 }}>
          <T variant="h3" style={{ marginBottom: 12 }}>{editing ? "Reset password (optional)" : "Password"}</T>
          <TextField label="Password" secure hint="At least 8 characters" value={values.password} onChangeText={(text) => change("password", text)} error={errors.password} />
          <TextField label="Confirm password" secure value={values.password_confirmation} onChangeText={(text) => change("password_confirmation", text)} error={errors.password_confirmation} />
        </Card>
        {editing && !isMe ? <Button title="Delete user" variant="danger" icon="trash-outline" onPress={remove} /> : null}
      </Screen>
    </>
  );
}
