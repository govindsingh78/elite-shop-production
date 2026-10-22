import React, { useCallback, useEffect, useState } from "react";
import { Linking, Platform, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { WebView } from "react-native-webview";
import { Button, EmptyState, Loader, Notice, Screen, T } from "@/components/ui";
import { useCart } from "@/context/CartContext";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { colors } from "@/theme";

/** Razorpay's checkout, configured to open straight on the chosen method (same as the website). */
const methodDisplay = (method) => ({
  display: {
    blocks: {
      chosen: method === "upi"
        ? { name: "Pay using UPI", instruments: [{ method: "upi" }] }
        : { name: "Pay using net banking", instruments: [{ method: "netbanking" }] },
    },
    sequence: ["block.chosen"],
    preferences: { show_default_blocks: false },
  },
});

const checkoutHtml = (options) => `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>body{margin:0;background:#f6f5ef;font-family:-apple-system,Roboto,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;color:#4f5f57}</style>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script></head>
<body><p>Opening secure payment…</p><script>
function send(message){ window.ReactNativeWebView.postMessage(JSON.stringify(message)); }
try {
  var options = ${JSON.stringify(options)};
  options.handler = function (result) { send({ type: "success", result: result }); };
  options.modal = { ondismiss: function () { send({ type: "dismissed" }); }, escape: false };
  var checkout = new Razorpay(options);
  checkout.on("payment.failed", function (failure) { send({ type: "failed", message: failure.error && failure.error.description }); });
  checkout.open();
} catch (error) { send({ type: "error", message: "We couldn’t load the secure payment window." }); }
</script></body></html>`;

export default function PaymentScreen() {
  const { orderId, token, method } = useLocalSearchParams();
  const { lastOrder, setLastOrder } = useCart();
  const [session, setSession] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState("starting");
  const [message, setMessage] = useState("");

  const paymentRequest = useCallback((action, body = {}) =>
    api(`/orders/${orderId}/payment/${action}`, { method: "POST", body: { ...body, payment_token: token } }), [orderId, token]);

  useEffect(() => {
    paymentRequest("start")
      .then((data) => { setSession(data); setStatus("paying"); })
      .catch((error) => { setMessage(error.message); setStatus("failed"); });
  }, [paymentRequest]);

  const finish = (order) => {
    if (order) setLastOrder(order);
    router.replace("/order-confirmation");
  };

  const onMessage = async (event) => {
    let payload;
    try { payload = JSON.parse(event.nativeEvent.data); } catch { return; }
    if (payload.type === "success") {
      setStatus("verifying");
      try {
        const verified = await paymentRequest("verify", payload.result);
        finish(verified.data);
      } catch (error) {
        setMessage(error.message);
        setStatus("failed");
      }
    } else if (payload.type === "dismissed") {
      setMessage("Payment wasn’t completed. Your order is saved — try again or switch to cash on delivery.");
      setStatus("failed");
    } else {
      setMessage(payload.message || "The payment failed. Please try again.");
      setStatus("failed");
    }
  };

  const payOnDelivery = async () => {
    setStatus("verifying");
    try {
      const result = await paymentRequest("cod");
      finish(result.data);
    } catch (error) {
      setMessage(error.message);
      setStatus("failed");
    }
  };

  // UPI apps open through intent/upi:// links, which the in-app browser hands to the phone.
  const allowNavigation = (request) => {
    if (/^(https?|about|data|blob):/i.test(request.url)) return true;
    Linking.openURL(request.url).catch(() => {});
    return false;
  };

  if (Platform.OS === "web") {
    return <Screen><EmptyState icon="phone-portrait-outline" title="Open the app to pay" message="Online payments run inside the Elitezaar mobile app." /></Screen>;
  }

  if (status === "starting" || status === "verifying") return <Loader label={status === "verifying" ? "Confirming your payment…" : "Preparing secure payment…"} />;

  if (status === "failed") {
    return (
      <Screen>
        <Notice tone="warning" title="Payment not completed" message={message} />
        <View style={styles.summary}>
          <T variant="label">Order #{orderId}</T>
          <T variant="h1" style={{ marginTop: 6 }}>{formatPrice(lastOrder?.total ?? (session ? session.amount / 100 : 0))}</T>
          <T variant="small">Nothing has been charged for this attempt unless your bank confirms it.</T>
        </View>
        {session ? <Button title="Try again" icon="refresh" onPress={() => { setAttempt((value) => value + 1); setStatus("paying"); }} /> : null}
        <Button title="Pay on delivery instead" variant="outline" icon="cash-outline" onPress={payOnDelivery} style={{ marginTop: 10 }} />
        <Button title="Decide later" variant="ghost" onPress={() => finish(null)} style={{ marginTop: 4 }} />
      </Screen>
    );
  }

  const options = {
    key: session.key_id,
    order_id: session.razorpay_order_id,
    amount: session.amount,
    currency: session.currency,
    name: "Elitezaar",
    description: `Order #${session.order_id}`,
    prefill: session.prefill,
    notes: { order_id: String(session.order_id) },
    theme: { color: colors.emerald },
    config: methodDisplay(method),
  };

  return (
    <View style={styles.flex}>
      <WebView
        key={attempt}
        originWhitelist={["*"]}
        source={{ html: checkoutHtml(options), baseUrl: "https://checkout.razorpay.com" }}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={allowNavigation}
        setSupportMultipleWindows={false}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        renderLoading={() => <Loader label="Opening secure payment…" />}
        style={styles.flex}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.cream },
  summary: { alignItems: "center", marginVertical: 24 },
});
