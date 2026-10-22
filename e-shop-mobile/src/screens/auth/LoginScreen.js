import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import AuthHero from "@/components/AuthHero";
import { Button, Notice, Row, Screen, Segmented, T, TextField } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { firstName } from "@/lib/format";
import { colors } from "@/theme";

const TITLES = {
  customer: { eyebrow: "Welcome back", title: "Sign in to your account", subtitle: "Track orders, manage addresses and check out faster." },
  vendor: { eyebrow: "Partner portal", title: "Welcome back, seller", subtitle: "Manage your products and ship your orders." },
  admin: { eyebrow: "Store control", title: "Admin sign in", subtitle: "Authorised staff only." },
};

export default function LoginScreen() {
  const params = useLocalSearchParams();
  const { signIn } = useAuth();
  const toast = useToast();
  const [portal, setPortal] = useState(["vendor", "admin"].includes(params.portal) ? params.portal : "customer");
  const [email, setEmail] = useState(params.email || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const switchPortal = (next) => {
    setPortal(next);
    setError("");
    setFieldErrors({});
  };

  const submit = async () => {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const session = await signIn(portal, email, password);
      toast(`Welcome back, ${firstName(session.user?.name)}`);
      if (portal === "customer") {
        if (router.canGoBack()) router.back();
        else router.replace("/account");
      } else {
        // Vendors and admins switch into their own dashboard.
        if (router.canDismiss()) router.dismissAll();
        router.replace(`/${portal}`);
      }
    } catch (loginError) {
      setFieldErrors(loginError.fieldErrors || {});
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  };

  const copy = TITLES[portal];

  return (
    <Screen keyboard>
      <Segmented
        options={[{ value: "customer", label: "Shopper" }, { value: "vendor", label: "Seller" }, { value: "admin", label: "Admin" }]}
        value={portal}
        onChange={switchPortal}
        style={{ marginBottom: 16 }}
      />
      <AuthHero portal={portal} compact />
      <T variant="eyebrow">{copy.eyebrow}</T>
      <T variant="h1" style={{ marginTop: 4 }}>{copy.title}</T>
      <T variant="body" style={{ marginTop: 4, marginBottom: 18 }}>{copy.subtitle}</T>

      {error ? <Notice tone="error" message={error} style={{ marginBottom: 14 }} /> : null}
      <TextField label={portal === "vendor" ? "Seller email" : "Email address"} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" value={email} onChangeText={setEmail} error={fieldErrors.email} icon="mail-outline" />
      <TextField label="Password" secure autoComplete="password" textContentType="password" value={password} onChangeText={setPassword} onSubmitEditing={submit} error={fieldErrors.password} icon="lock-closed-outline" />
      <Pressable onPress={() => router.push({ pathname: "/forgot-password", params: { email } })} style={{ alignSelf: "flex-end", marginTop: -4, marginBottom: 16 }}>
        <T variant="strong" color={colors.tealDark}>Forgot password?</T>
      </Pressable>
      <Button title="Sign in" icon="log-in-outline" loading={loading} onPress={submit} />

      <View style={{ marginTop: 22, alignItems: "center", gap: 10 }}>
        {portal === "customer" ? (
          <Row gap={6}>
            <T variant="body">New to Elitezaar?</T>
            <Pressable onPress={() => router.push("/register")}><T variant="strong" color={colors.emerald}>Create an account</T></Pressable>
          </Row>
        ) : null}
        {portal === "vendor" ? (
          <Row gap={6}>
            <T variant="body">New to selling?</T>
            <Pressable onPress={() => router.push("/vendor-register")}><T variant="strong" color={colors.emerald}>Become a seller</T></Pressable>
          </Row>
        ) : null}
        {portal === "admin" ? <T variant="small" center>Activity in the admin area is logged.</T> : null}
      </View>
    </Screen>
  );
}
