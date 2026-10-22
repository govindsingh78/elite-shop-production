import React, { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Button, Notice, Screen, T, TextField } from "@/components/ui";
import { api } from "@/lib/api";

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams();
  const [email, setEmail] = useState(params.email || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api("/forgot-password", { method: "POST", body: { email: email.trim() } });
      setMessage(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen keyboard>
      <T variant="h1">Forgot your password?</T>
      <T variant="body" style={{ marginTop: 6, marginBottom: 18 }}>Enter the email you sign in with and we’ll send you a link to choose a new password.</T>
      {message ? <Notice tone="success" message={message} style={{ marginBottom: 14 }} /> : null}
      {error ? <Notice tone="error" message={error} style={{ marginBottom: 14 }} /> : null}
      <TextField label="Email" keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={email} onChangeText={setEmail} onSubmitEditing={submit} icon="mail-outline" />
      <Button title="Send reset link" icon="paper-plane-outline" loading={loading} disabled={!email.trim()} onPress={submit} />
      <T variant="small" center style={{ marginTop: 16 }}>The link opens on the Elitezaar website, where you can set your new password.</T>
    </Screen>
  );
}
