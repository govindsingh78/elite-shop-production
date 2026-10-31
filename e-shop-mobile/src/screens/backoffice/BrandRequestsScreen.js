import React, { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { BrandRequestFields, brandRequestPayload, emptyBrandRequest } from "@/components/BrandRequestBits";
import { RequestStatusPill } from "@/components/CategoryRequestBits";
import { Button, Card, Loader, Notice, Row, Screen, T } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { confirmAction } from "@/lib/confirm";
import { formatDate } from "@/lib/format";
import { colors } from "@/theme";

/** Seller: ask for a brand the store doesn't have yet, and see what our team said. */
export default function BrandRequestsScreen() {
  const { request } = useAuth();
  const toast = useToast();
  const [requests, setRequests] = useState(null);
  const [maxPending, setMaxPending] = useState(5);
  const [draft, setDraft] = useState(emptyBrandRequest);
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    request("/vendor/brand-requests")
      .then((data) => {
        setRequests(data.requests);
        setMaxPending(data.max_pending);
      })
      .catch((loadError) => setError(loadError.message));
  }, [request]);

  const waiting = (requests || []).filter((item) => item.status === "pending").length;

  const send = async () => {
    if (!draft.name.trim()) {
      setErrors({ name: "Enter the brand you need." });
      return;
    }
    setSending(true);
    setErrors({});
    try {
      const result = await request("/vendor/brand-requests", { method: "POST", body: brandRequestPayload(draft) });
      toast(result.message);
      setRequests((current) => [result.request, ...(current || [])]);
      setDraft(emptyBrandRequest());
    } catch (sendError) {
      setErrors(Object.keys(sendError.fieldErrors || {}).length ? sendError.fieldErrors : { name: sendError.message });
    } finally {
      setSending(false);
    }
  };

  const withdraw = (item) => confirmAction({
    title: "Withdraw this request?",
    message: `You asked for “${item.name}”.`,
    confirmLabel: "Withdraw",
    onConfirm: async () => {
      try {
        const result = await request(`/vendor/brand-requests/${item.id}`, { method: "DELETE" });
        toast(result.message);
        setRequests((current) => current.filter((each) => each.id !== item.id));
      } catch (withdrawError) {
        toast(withdrawError.message, "error");
      }
    },
  });

  return (
    <Screen keyboard>
      <T variant="body" style={{ marginBottom: 14 }}>Can’t find your brand when you list a product? Ask us to add it, and we’ll let you know as soon as it’s ready.</T>
      <Card>
        <T variant="h3" style={{ marginBottom: 12 }}>Ask for a brand</T>
        {waiting >= maxPending ? (
          <T variant="body">You have {maxPending} requests waiting. We’ll get to them soon, and you can ask for more once they’re answered.</T>
        ) : (
          <>
            <BrandRequestFields value={draft} errors={errors} onChange={(next) => { setDraft(next); setErrors({}); }} />
            <Button title="Send request" icon="send-outline" loading={sending} onPress={send} />
          </>
        )}
      </Card>

      <T variant="h3" style={{ marginTop: 22, marginBottom: 10 }}>Your requests</T>
      {error ? <Notice tone="error" message={error} /> : null}
      {!requests && !error ? <Loader /> : null}
      {requests && !requests.length ? <T variant="body">You haven’t asked for any brands yet.</T> : null}
      {(requests || []).map((item) => (
        <Card key={item.id} style={{ marginBottom: 10 }}>
          <Row justify="space-between" align="flex-start">
            <View style={{ flex: 1 }}>
              <T variant="title">{item.name}</T>
              <T variant="small">Asked {formatDate(item.created_at)}</T>
            </View>
            <RequestStatusPill status={item.status} />
          </Row>
          {item.note ? <T variant="small" style={{ marginTop: 6 }}>“{item.note}”</T> : null}
          {item.status === "approved" && item.brand ? (
            <Pressable onPress={() => router.push("/vendor/product-form")} style={{ marginTop: 8 }}>
              <T variant="body">Added as <T variant="strong">{item.brand.name}</T>. <T variant="strong" color={colors.tealDark}>List a product →</T></T>
            </Pressable>
          ) : null}
          {item.status === "declined" ? <T variant="body" style={{ marginTop: 8 }}>Not added{item.admin_note ? `: ${item.admin_note}` : "."}</T> : null}
          {item.status === "pending" ? (
            <Pressable onPress={() => withdraw(item)} hitSlop={8} style={{ marginTop: 8, alignSelf: "flex-start" }}>
              <T variant="strong" color={colors.danger}>Withdraw</T>
            </Pressable>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
