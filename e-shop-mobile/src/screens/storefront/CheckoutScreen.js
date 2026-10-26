import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import AddressFields from "@/components/AddressFields";
import { PolicyConsent, PolicySummaryCard } from "@/components/PolicyBits";
import { Button, Card, EmptyState, KeyValue, Loader, Notice, Row, Screen, Segmented, SwitchRow, T, TextField } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/context/ToastContext";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { colors, fonts, radius } from "@/theme";

const POLICY_REQUIRED = "Please read and accept the Return & Refund Policy to place your order.";
const EMPTY_FORM = { customer_name: "", customer_email: "", customer_phone: "", address: "", city: "", state: "", postal_code: "", country: "India", notes: "" };

const PAYMENT_OPTIONS = [
  { value: "upi", title: "UPI", copy: "GPay, PhonePe, Paytm or any UPI app", icon: "phone-portrait-outline", online: true },
  { value: "netbanking", title: "Net banking", copy: "All major Indian banks", icon: "business-outline", online: true },
  { value: "cod", title: "Cash on delivery", copy: "Pay when your order arrives", icon: "cash-outline", online: false },
];

export default function CheckoutScreen() {
  const { isCustomer, user, signIn, startSession, request } = useAuth();
  const { items, subtotal, clearCart, setLastOrder } = useCart();
  const toast = useToast();

  const [shopper, setShopper] = useState("new");
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState("");

  const [form, setForm] = useState(EMPTY_FORM);
  const [createAccount, setCreateAccount] = useState(false);
  const [password, setPassword] = useState({ value: "", confirm: "" });

  const [addressBook, setAddressBook] = useState({ userId: null, list: null });
  const [addressChoice, setAddressChoice] = useState(null);
  const [saveNewAddress, setSaveNewAddress] = useState(true);

  const [shippingMethods, setShippingMethods] = useState([]);
  const [shippingId, setShippingId] = useState(null);
  const [onlineAvailable, setOnlineAvailable] = useState(false);
  const [payment, setPayment] = useState("cod");

  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [acceptPolicy, setAcceptPolicy] = useState(false);

  useEffect(() => {
    api("/storefront/shipping-methods").then((methods) => {
      setShippingMethods(methods || []);
      if (methods?.length) setShippingId(methods[0].id);
    }).catch(() => {});
    api("/storefront/payment-methods").then((methods) => setOnlineAvailable(!!methods?.online)).catch(() => {});
  }, []);

  // Signed-in customers pick from their saved addresses.
  const userId = isCustomer ? user?.id : null;
  useEffect(() => {
    if (!userId) return;
    const accountName = user?.name || "";
    const accountPhone = user?.phone || "";
    const applyList = (list) => {
      setAddressBook({ userId, list });
      const preferred = list.find((address) => address.is_default) || list[0];
      setAddressChoice(preferred ? preferred.id : "new");
      setForm((current) => ({ ...current, customer_name: current.customer_name || accountName, customer_phone: current.customer_phone || accountPhone }));
    };
    request("/customer/addresses").then((list) => applyList(list || [])).catch(() => applyList([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, request]);

  const addresses = isCustomer && addressBook.userId === user?.id ? addressBook.list : null;
  const shipping = shippingMethods.find((method) => method.id === shippingId);
  const total = subtotal + Number(shipping?.price || 0);
  const selectedAddress = addresses?.find((address) => address.id === addressChoice);
  const usingSaved = isCustomer && !!selectedAddress;
  const paymentOptions = useMemo(() => PAYMENT_OPTIONS.filter((option) => !option.online || onlineAvailable), [onlineAvailable]);

  const change = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
  };

  const doSignIn = async () => {
    if (!credentials.email || !credentials.password) {
      setSignInError("Enter your email and password.");
      return;
    }
    setSigningIn(true);
    setSignInError("");
    try {
      await signIn("customer", credentials.email, credentials.password);
      toast("Signed in — your saved addresses are ready");
    } catch (signInFailure) {
      setSignInError(signInFailure.message);
    } finally {
      setSigningIn(false);
    }
  };

  const placeOrder = async () => {
    setError("");
    setFieldErrors({});
    const customerAction = isCustomer ? "guest" : createAccount ? "register" : "guest";
    if (customerAction === "register" && password.value !== password.confirm) {
      setFieldErrors({ account_password_confirmation: "Passwords do not match." });
      setError("Passwords do not match.");
      return;
    }
    if (!acceptPolicy) {
      setFieldErrors({ accept_policy: POLICY_REQUIRED });
      setError(POLICY_REQUIRED);
      return;
    }

    const delivery = usingSaved
      ? {
        customer_name: selectedAddress.full_name, customer_phone: selectedAddress.phone, address: selectedAddress.address,
        city: selectedAddress.city, state: selectedAddress.state, postal_code: selectedAddress.postal_code, country: selectedAddress.country,
      }
      : {};

    const payload = {
      ...form,
      ...delivery,
      ...(isCustomer ? { customer_email: user?.email } : {}),
      customer_action: customerAction,
      ...(customerAction === "register" ? { account_password: password.value, account_password_confirmation: password.confirm } : {}),
      payment_method: payment === "cod" ? "cod" : "razorpay",
      shipping_method_id: shippingId || null,
      accept_policy: acceptPolicy,
      items: items.map(({ id, quantity, size_id: sizeId }) => ({ product_id: id, quantity, ...(sizeId ? { size_id: sizeId } : {}) })),
    };

    setPlacing(true);
    try {
      // The bearer token (when signed in) links the order to the customer's account.
      const data = isCustomer ? await request("/orders", { method: "POST", body: payload }) : await api("/orders", { method: "POST", body: payload });

      if (isCustomer && !usingSaved && saveNewAddress) {
        // The order is already placed, so a failure here must not block the confirmation.
        await request("/customer/addresses", {
          method: "POST",
          body: { label: "Home", full_name: form.customer_name, phone: form.customer_phone, address: form.address, city: form.city, state: form.state, postal_code: form.postal_code, country: form.country },
        }).catch(() => {});
      }
      if (data.customer_token && data.customer) await startSession(data.customer_token, data.customer, "customer");

      clearCart();
      setLastOrder(data.data);
      if (data.payment_token) {
        router.replace({ pathname: "/payment", params: { orderId: String(data.data.id), token: data.payment_token, method: payment } });
      } else {
        router.replace("/order-confirmation");
      }
    } catch (orderError) {
      setFieldErrors(orderError.fieldErrors || {});
      setError(orderError.message);
    } finally {
      setPlacing(false);
    }
  };

  if (!items.length) {
    return (
      <Screen>
        <EmptyState icon="bag-handle-outline" title="Your bag is empty" message="Add a few pieces before checking out." actionLabel="Browse the shop" onAction={() => router.replace("/shop")} />
      </Screen>
    );
  }

  return (
    <Screen
      keyboard
      footer={(
        <View>
          <PolicyConsent
            checked={acceptPolicy}
            onChange={(value) => { setAcceptPolicy(value); setFieldErrors((current) => ({ ...current, accept_policy: undefined })); }}
            error={fieldErrors.accept_policy}
          />
          <Row justify="space-between" style={{ marginBottom: 10 }}>
            <T variant="body">Total to pay</T>
            <T variant="price" style={{ fontSize: 21 }}>{formatPrice(total)}</T>
          </Row>
          <Button
            title={payment === "cod" ? "Place order" : `Pay ${formatPrice(total)}`}
            icon={payment === "cod" ? "checkmark-circle-outline" : "lock-closed-outline"}
            loading={placing}
            disabled={!isCustomer && shopper === "returning"}
            onPress={placeOrder}
          />
        </View>
      )}
    >
      {error ? <Notice tone="error" message={error} style={{ marginBottom: 14 }} /> : null}

      {/* 1. Who is ordering */}
      <Step number="1" title={isCustomer ? "Delivering to" : "Your details"}>
        {isCustomer ? (
          addresses === null ? <Loader /> : (
            <View>
              <T variant="small" style={{ marginBottom: 10 }}>Signed in as {user?.email}</T>
              {addresses.map((address) => (
                <Choice key={address.id} active={addressChoice === address.id} onPress={() => setAddressChoice(address.id)}
                  title={`${address.label || "Address"}${address.is_default ? " · Default" : ""}`}
                  copy={`${address.full_name}, ${address.address}, ${address.city}, ${address.state} ${address.postal_code}`} />
              ))}
              <Choice active={addressChoice === "new"} onPress={() => setAddressChoice("new")} title="Use a new address" copy="Deliver somewhere else" icon="add-circle-outline" />
              {addressChoice === "new" ? (
                <View style={{ marginTop: 6 }}>
                  <AddressFields values={form} errors={fieldErrors} onChange={change} names={{ full_name: "customer_name", phone: "customer_phone" }} />
                  <SwitchRow label="Save this address" hint="Use it again next time" value={saveNewAddress} onValueChange={setSaveNewAddress} />
                </View>
              ) : null}
            </View>
          )
        ) : (
          <View>
            <Segmented
              options={[{ value: "new", label: "New customer" }, { value: "returning", label: "I have an account" }]}
              value={shopper}
              onChange={setShopper}
              style={{ marginBottom: 16 }}
            />
            {shopper === "returning" ? (
              <View>
                {signInError ? <Notice tone="error" message={signInError} style={{ marginBottom: 12 }} /> : null}
                <TextField label="Email" keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={credentials.email} onChangeText={(email) => setCredentials((current) => ({ ...current, email }))} />
                <TextField label="Password" secure value={credentials.password} onChangeText={(value) => setCredentials((current) => ({ ...current, password: value }))} onSubmitEditing={doSignIn} />
                <Button title="Sign in & continue" icon="log-in-outline" loading={signingIn} onPress={doSignIn} />
                <Pressable onPress={() => router.push("/forgot-password")} style={{ alignSelf: "center", marginTop: 12 }}>
                  <T variant="strong" color={colors.tealDark}>Forgot password?</T>
                </Pressable>
              </View>
            ) : (
              <View>
                <TextField label="Full name" autoComplete="name" value={form.customer_name} onChangeText={(value) => change("customer_name", value)} error={fieldErrors.customer_name} />
                <TextField label="Email" keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={form.customer_email} onChangeText={(value) => change("customer_email", value)} error={fieldErrors.customer_email} hint="We’ll send your order updates here." />
                <AddressFields values={form} errors={fieldErrors} onChange={change} names={{ phone: "customer_phone" }} showName={false} />
                <SwitchRow label="Create an account" hint="Track orders and save addresses for next time" value={createAccount} onValueChange={setCreateAccount} />
                {createAccount ? (
                  <View>
                    <TextField label="Password" secure hint="At least 8 characters" value={password.value} onChangeText={(value) => setPassword((current) => ({ ...current, value }))} error={fieldErrors.account_password} />
                    <TextField label="Confirm password" secure value={password.confirm} onChangeText={(confirm) => setPassword((current) => ({ ...current, confirm }))} error={fieldErrors.account_password_confirmation} />
                  </View>
                ) : null}
              </View>
            )}
          </View>
        )}
      </Step>

      {/* 2. Delivery */}
      {shippingMethods.length ? (
        <Step number="2" title="Delivery method">
          {shippingMethods.map((method) => (
            <Choice key={method.id} active={shippingId === method.id} onPress={() => setShippingId(method.id)} title={method.name}
              right={<T variant="strong">{Number(method.price) > 0 ? formatPrice(method.price) : "Free"}</T>} />
          ))}
        </Step>
      ) : null}

      {/* 3. Payment */}
      <Step number={shippingMethods.length ? "3" : "2"} title="Payment">
        {paymentOptions.map((option) => (
          <Choice key={option.value} active={payment === option.value} onPress={() => setPayment(option.value)} title={option.title} copy={option.copy} icon={option.icon} />
        ))}
        {payment !== "cod" ? <T variant="small" style={{ marginTop: 4 }}>You’ll complete the payment securely with Razorpay after placing the order.</T> : null}
        <TextField label="Order notes (optional)" placeholder="Delivery instructions, gift note…" multiline value={form.notes} onChangeText={(value) => change("notes", value)} style={{ marginTop: 14 }} />
      </Step>

      <PolicySummaryCard style={{ marginBottom: 14 }} />

      {/* Summary */}
      <Card>
        <T variant="h3" style={{ marginBottom: 6 }}>Order summary</T>
        {items.map((item) => (
          <Row key={item.key} justify="space-between" style={{ paddingVertical: 6 }} align="flex-start">
            <T variant="body" style={{ flex: 1 }} numberOfLines={2}>{item.quantity} × {item.title}{item.size ? ` (Size ${item.size})` : ""}</T>
            <T variant="strong">{formatPrice(item.price * item.quantity)}</T>
          </Row>
        ))}
        <View style={styles.summaryLine} />
        <KeyValue label="Subtotal" value={formatPrice(subtotal)} />
        <KeyValue label="Delivery" value={shipping ? (Number(shipping.price) > 0 ? formatPrice(shipping.price) : "Free") : "Free"} />
        <KeyValue label="Total" value={formatPrice(total)} strong last />
      </Card>
      <Row gap={8} style={{ marginTop: 14, justifyContent: "center" }}>
        <Ionicons name="shield-checkmark-outline" size={16} color={colors.muted} />
        <T variant="small">Secure checkout · Prices confirmed when you order</T>
      </Row>
    </Screen>
  );
}

function Step({ number, title, children }) {
  return (
    <Card style={{ marginBottom: 14 }}>
      <Row gap={10} style={{ marginBottom: 14 }}>
        <View style={styles.stepBadge}><Text style={styles.stepNumber}>{number}</Text></View>
        <T variant="h3">{title}</T>
      </Row>
      {children}
    </Card>
  );
}

function Choice({ active, onPress, title, copy, icon, right }) {
  return (
    <Pressable onPress={onPress} style={[styles.choice, active && styles.choiceActive]}>
      <View style={[styles.radio, active && styles.radioActive]}>{active ? <View style={styles.radioDot} /> : null}</View>
      {icon ? <Ionicons name={icon} size={20} color={active ? colors.emerald : colors.muted} /> : null}
      <View style={{ flex: 1 }}>
        <T variant="title">{title}</T>
        {copy ? <T variant="small" numberOfLines={2}>{copy}</T> : null}
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stepBadge: { width: 28, height: 28, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: colors.emerald },
  stepNumber: { color: colors.white, fontFamily: fonts.heading, fontSize: 14 },
  choice: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 14, backgroundColor: colors.white },
  choiceActive: { borderColor: colors.emerald, backgroundColor: "#f3f9f6" },
  radio: { width: 20, height: 20, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.line, borderRadius: 10 },
  radioActive: { borderColor: colors.emerald },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.emerald },
  summaryLine: { height: 1, marginVertical: 8, backgroundColor: colors.lineSoft },
});
