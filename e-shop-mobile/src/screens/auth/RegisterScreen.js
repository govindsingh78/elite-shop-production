import React, { useState } from "react";
import { Pressable } from "react-native";
import { router } from "expo-router";
import AddressFields, { EMPTY_ADDRESS } from "@/components/AddressFields";
import AuthHero from "@/components/AuthHero";
import { Button, Card, Notice, Row, Screen, T, TextField } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { api } from "@/lib/api";
import { firstName } from "@/lib/format";
import { colors } from "@/theme";

/** Customer sign-up. A delivery address is mandatory and becomes the default (same rule as the website). */
export default function RegisterScreen() {
  const { startSession } = useAuth();
  const toast = useToast();
  const [values, setValues] = useState({ name: "", email: "", password: "", password_confirmation: "", ...EMPTY_ADDRESS });
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
      const { full_name: _unused, ...payload } = values;
      const result = await api("/customer/register", { method: "POST", body: { ...payload, email: values.email.trim() } });
      await startSession(result.token, result.user, "customer");
      toast(`Welcome to Elitezaar, ${firstName(result.user.name)}!`);
      if (router.canDismiss()) router.dismissAll();
      router.replace("/account");
    } catch (registerError) {
      setErrors(registerError.fieldErrors || {});
      setError(registerError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen keyboard>
      <AuthHero portal="customer" compact />
      <T variant="eyebrow">Join Elitezaar</T>
      <T variant="h1" style={{ marginTop: 4, marginBottom: 16 }}>Create your account</T>
      {error ? <Notice tone="error" message={error} style={{ marginBottom: 14 }} /> : null}

      <Card style={{ marginBottom: 14 }}>
        <T variant="h3" style={{ marginBottom: 12 }}>About you</T>
        <TextField label="Full name" autoComplete="name" value={values.name} onChangeText={(text) => change("name", text)} error={errors.name} />
        <TextField label="Email" keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={values.email} onChangeText={(text) => change("email", text)} error={errors.email} />
        <TextField label="Password" secure hint="At least 8 characters" value={values.password} onChangeText={(text) => change("password", text)} error={errors.password} />
        <TextField label="Confirm password" secure value={values.password_confirmation} onChangeText={(text) => change("password_confirmation", text)} error={errors.password_confirmation} />
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <T variant="h3">Delivery address</T>
        <T variant="small" style={{ marginBottom: 12 }}>We’ll use this as your default. You can add more later.</T>
        <AddressFields values={values} errors={errors} onChange={change} showName={false} showLabel />
      </Card>

      <Button title="Create account" icon="person-add-outline" loading={loading} onPress={submit} />
      <Row gap={6} style={{ justifyContent: "center", marginTop: 18 }}>
        <T variant="body">Already have an account?</T>
        <Pressable onPress={() => router.replace("/login")}><T variant="strong" color={colors.emerald}>Sign in</T></Pressable>
      </Row>
    </Screen>
  );
}
