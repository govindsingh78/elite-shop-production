import React, { useState } from "react";
import { router } from "expo-router";
import { PhoneSignInCard } from "@/components/PhoneSignIn";
import { Button, Notice, Screen, T, TextField } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

/** Password & sign-in, shared by customers, vendors and admins. Other devices are signed out by the API. */
export default function ChangePasswordScreen() {
  const { request } = useAuth();
  const toast = useToast();
  const [values, setValues] = useState({ current_password: "", password: "", password_confirmation: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const change = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const submit = async () => {
    setError("");
    if (values.password !== values.password_confirmation) {
      setErrors({ password_confirmation: "Passwords do not match." });
      return;
    }
    setLoading(true);
    try {
      const result = await request("/change-password", { method: "POST", body: values });
      toast(result.message || "Password changed");
      router.back();
    } catch (changeError) {
      setErrors(changeError.fieldErrors || {});
      setError(changeError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen keyboard>
      <T variant="body" style={{ marginBottom: 18 }}>Choose a strong password you don’t use anywhere else. You’ll stay signed in on this phone; other devices will be signed out.</T>
      {error ? <Notice tone="error" message={error} style={{ marginBottom: 14 }} /> : null}
      <TextField label="Current password" secure value={values.current_password} onChangeText={(text) => change("current_password", text)} error={errors.current_password} />
      <TextField label="New password" secure hint="At least 8 characters, different from your current one" value={values.password} onChangeText={(text) => change("password", text)} error={errors.password} />
      <TextField label="Confirm new password" secure value={values.password_confirmation} onChangeText={(text) => change("password_confirmation", text)} error={errors.password_confirmation} />
      <Button title="Update password" icon="key-outline" loading={loading} onPress={submit} />
      <PhoneSignInCard style={{ marginTop: 28 }} />
    </Screen>
  );
}
