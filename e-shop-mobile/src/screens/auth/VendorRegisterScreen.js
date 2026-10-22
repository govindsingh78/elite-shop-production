import React, { useState } from "react";
import { Pressable } from "react-native";
import { router } from "expo-router";
import AuthHero from "@/components/AuthHero";
import { Button, Notice, Row, Screen, T, TextField } from "@/components/ui";
import { api } from "@/lib/api";
import { colors } from "@/theme";

export default function VendorRegisterScreen() {
  const [values, setValues] = useState({ name: "", email: "", password: "", password_confirmation: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
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
      const result = await api("/vendor/register", { method: "POST", body: { ...values, email: values.email.trim() } });
      setDone(result.message || "Your seller account is ready.");
    } catch (registerError) {
      setErrors(registerError.fieldErrors || {});
      setError(registerError.message);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <Screen>
        <AuthHero portal="vendor" compact />
        <Notice tone="success" title="Welcome aboard!" message={done} style={{ marginBottom: 16 }} />
        <Button title="Sign in to the seller hub" icon="log-in-outline" onPress={() => router.replace({ pathname: "/login", params: { portal: "vendor", email: values.email.trim() } })} />
      </Screen>
    );
  }

  return (
    <Screen keyboard>
      <AuthHero portal="vendor" />
      <T variant="eyebrow">Become a seller</T>
      <T variant="h1" style={{ marginTop: 4 }}>Start selling on Elitezaar</T>
      <T variant="body" style={{ marginTop: 4, marginBottom: 18 }}>Create your seller account — it takes less than a minute.</T>
      {error ? <Notice tone="error" message={error} style={{ marginBottom: 14 }} /> : null}
      <TextField label="Store or your name" value={values.name} onChangeText={(text) => change("name", text)} error={errors.name} icon="storefront-outline" />
      <TextField label="Email" keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={values.email} onChangeText={(text) => change("email", text)} error={errors.email} icon="mail-outline" />
      <TextField label="Password" secure hint="At least 8 characters" value={values.password} onChangeText={(text) => change("password", text)} error={errors.password} icon="lock-closed-outline" />
      <TextField label="Confirm password" secure value={values.password_confirmation} onChangeText={(text) => change("password_confirmation", text)} error={errors.password_confirmation} icon="lock-closed-outline" />
      <Button title="Create seller account" icon="storefront-outline" loading={loading} onPress={submit} />
      <Row gap={6} style={{ justifyContent: "center", marginTop: 18 }}>
        <T variant="body">Already selling?</T>
        <Pressable onPress={() => router.replace({ pathname: "/login", params: { portal: "vendor" } })}><T variant="strong" color={colors.emerald}>Sign in</T></Pressable>
      </Row>
    </Screen>
  );
}
