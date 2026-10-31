import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import AuthHero from "@/components/AuthHero";
import { BRANDS_AT_SIGN_UP, BrandRequestFields, brandRequestPayload, emptyBrandRequest } from "@/components/BrandRequestBits";
import { AT_SIGN_UP, CategoryRequestFields, emptyRequest, requestPayload } from "@/components/CategoryRequestBits";
import { TermsNote } from "@/components/PolicyBits";
import { Button, Card, Notice, Row, Screen, T, TextField } from "@/components/ui";
import { api } from "@/lib/api";
import { colors } from "@/theme";

export default function VendorRegisterScreen() {
  const [values, setValues] = useState({ name: "", email: "", password: "", password_confirmation: "" });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [loading, setLoading] = useState(false);
  // Categories the store doesn't have yet, for our team to add (rows left blank aren't sent).
  const [requests, setRequests] = useState([]);
  const [brandRequests, setBrandRequests] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api("/storefront/categories").then(setCategories).catch(() => {});
  }, []);

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
    // Errors come back by position among the requests sent ("category_requests.0.name"): map them to their rows.
    const sent = requests.map((request, row) => ({ request, row })).filter(({ request }) => request.name.trim());
    const sentBrands = brandRequests.map((request, row) => ({ request, row })).filter(({ request }) => request.name.trim());
    try {
      const result = await api("/vendor/register", { method: "POST", body: { ...values, email: values.email.trim(), category_requests: sent.map(({ request }) => requestPayload(request)), brand_requests: sentBrands.map(({ request }) => brandRequestPayload(request)) } });
      setDone(result.message || "Your seller account is ready.");
    } catch (registerError) {
      setErrors(Object.fromEntries(Object.entries(registerError.fieldErrors || {}).map(([field, message]) => {
        const [, kind, position, part] = field.match(/^(category|brand)_requests\.(\d+)\.(\w+)$/) || [];
        if (position === undefined) return [field, message];
        return [kind === "brand" ? `brandRequest.${sentBrands[position]?.row}.${part}` : `request.${sent[position]?.row}.${part}`, message];
      })));
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
      <Card flat style={{ marginBottom: 18 }}>
        <T variant="h3">Can’t find your category?</T>
        <T variant="small" style={{ marginTop: 2, marginBottom: requests.length ? 12 : 0 }}>Ask us to add a category or subcategory you’ll sell in. Optional — you can also ask later from your seller hub.</T>
        {requests.map((request, row) => (
          <View key={row} style={row ? { borderTopWidth: 1, borderTopColor: colors.lineSoft, paddingTop: 12 } : null}>
            <CategoryRequestFields
              value={request}
              categories={categories}
              errors={{ name: errors[`request.${row}.name`], parent_id: errors[`request.${row}.parent_id`], note: errors[`request.${row}.note`] }}
              onChange={(next) => {
                setRequests((current) => current.map((item, index) => (index === row ? next : item)));
                setErrors((current) => ({ ...current, [`request.${row}.name`]: undefined, [`request.${row}.parent_id`]: undefined, [`request.${row}.note`]: undefined }));
              }}
              onRemove={() => { setRequests((current) => current.filter((_, index) => index !== row)); setErrors({}); }}
            />
          </View>
        ))}
        {errors.category_requests ? <T variant="small" color={colors.danger}>{errors.category_requests}</T> : null}
        {requests.length < AT_SIGN_UP ? (
          <Button title="Ask for a category" icon="add" variant="outline" small block={false} onPress={() => setRequests((current) => [...current, emptyRequest()])} style={{ marginTop: 12, alignSelf: "flex-start" }} />
        ) : null}
      </Card>
      <Card flat style={{ marginBottom: 18 }}>
        <T variant="h3">Can’t find your brand?</T>
        <T variant="small" style={{ marginTop: 2, marginBottom: brandRequests.length ? 12 : 0 }}>Ask us to add a brand you sell, or your own label. Optional — you can also ask later from your seller hub.</T>
        {brandRequests.map((request, row) => (
          <View key={row} style={row ? { borderTopWidth: 1, borderTopColor: colors.lineSoft, paddingTop: 12 } : null}>
            <BrandRequestFields
              value={request}
              errors={{ name: errors[`brandRequest.${row}.name`], note: errors[`brandRequest.${row}.note`] }}
              onChange={(next) => {
                setBrandRequests((current) => current.map((item, index) => (index === row ? next : item)));
                setErrors((current) => ({ ...current, [`brandRequest.${row}.name`]: undefined, [`brandRequest.${row}.note`]: undefined }));
              }}
              onRemove={() => { setBrandRequests((current) => current.filter((_, index) => index !== row)); setErrors({}); }}
            />
          </View>
        ))}
        {errors.brand_requests ? <T variant="small" color={colors.danger}>{errors.brand_requests}</T> : null}
        {brandRequests.length < BRANDS_AT_SIGN_UP ? (
          <Button title="Ask for a brand" icon="add" variant="outline" small block={false} onPress={() => setBrandRequests((current) => [...current, emptyBrandRequest()])} style={{ marginTop: 12, alignSelf: "flex-start" }} />
        ) : null}
      </Card>
      <Button title="Create seller account" icon="storefront-outline" loading={loading} onPress={submit} />
      <TermsNote />
      <Row gap={6} style={{ justifyContent: "center", marginTop: 18 }}>
        <T variant="body">Already selling?</T>
        <Pressable onPress={() => router.replace({ pathname: "/login", params: { portal: "vendor" } })}><T variant="strong" color={colors.emerald}>Sign in</T></Pressable>
      </Row>
    </Screen>
  );
}
