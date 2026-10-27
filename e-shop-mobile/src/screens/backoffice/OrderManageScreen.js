import React, { useState } from "react";
import { View } from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { AddressBlock, MilestoneBar, OrderItemRow, OrderStatusPill, PaymentStatusPill, TrackingTimeline } from "@/components/OrderBits";
import { Button, Card, Divider, EmptyState, KeyValue, Loader, Notice, Row, Screen, SelectField, T, TextField } from "@/components/ui";
import InvoiceLinks from "@/components/InvoiceLinks";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { confirmAction } from "@/lib/confirm";
import { formatDate, formatPrice, ORDER_STATUSES, PAYMENT_STATUSES, paymentMethodLabel } from "@/lib/format";
import { PORTALS } from "@/lib/portals";
import { TRACKING_STATUS_KEYS, TRACKING_STATUSES } from "@/lib/tracking";
import { useLoad } from "@/lib/useLoad";

const toOptions = (map) => Object.entries(map).map(([value, config]) => ({ value, label: config.label }));
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Order fulfilment for admins and vendors: status, shipping details and live tracking updates. */
export default function OrderManageScreen({ portal: portalKey }) {
  const portal = PORTALS[portalKey];
  const { id } = useLocalSearchParams();
  const { request } = useAuth();
  const toast = useToast();
  const base = `${portal.orders}/${id}`;
  const { data: order, setData: setOrder, loading, refreshing, error, reload } = useLoad(() => request(base), [base, request]);

  const [update, setUpdate] = useState({ status: "", location: "", description: "" });
  const [posting, setPosting] = useState(false);
  const [issuing, setIssuing] = useState(false);

  if (loading) return <Loader />;
  if (error && !order) return <Screen><EmptyState icon="alert-circle-outline" title="Order unavailable" message={error} /></Screen>;

  // Vendors may change shipping only when every item in the order is theirs.
  const canManage = portalKey === "admin" || order.can_manage_shipping;
  const amount = portalKey === "vendor" && !order.can_manage_shipping ? order.vendor_subtotal : order.total;

  // Admins can issue invoices early, e.g. for orders that shipped before invoices existed.
  const issueInvoices = async () => {
    setIssuing(true);
    try {
      const result = await request(`/admin/orders/${order.id}/invoices`, { method: "POST" });
      setOrder((current) => ({ ...current, invoice_links: result.invoice_links }));
      toast(result.message);
    } catch (issueError) {
      toast(issueError.message, "error");
    } finally {
      setIssuing(false);
    }
  };

  const postUpdate = async () => {
    if (!update.status) {
      toast("Choose a tracking status first.", "error");
      return;
    }
    setPosting(true);
    try {
      const result = await request(`${base}/tracking`, {
        method: "POST",
        body: { status: update.status, location: update.location || null, description: update.description || TRACKING_STATUSES[update.status].note, event_at: new Date().toISOString() },
      });
      setOrder(result.data);
      setUpdate({ status: "", location: "", description: "" });
      toast("Tracking update posted");
    } catch (postError) {
      toast(postError.message, "error");
    } finally {
      setPosting(false);
    }
  };

  const deleteEvent = (event) => confirmAction({
    title: "Remove this update?",
    message: `${TRACKING_STATUSES[event.status]?.label || event.status} will be removed from the customer’s timeline.`,
    confirmLabel: "Remove",
    onConfirm: async () => {
      try {
        const result = await request(`${base}/tracking/${event.id}`, { method: "DELETE" });
        setOrder(result.data);
        toast("Update removed");
      } catch (deleteError) {
        toast(deleteError.message, "error");
      }
    },
  });

  const deleteOrder = () => confirmAction({
    title: `Delete order #${order.id}?`,
    message: "This permanently removes the order and its tracking history.",
    onConfirm: async () => {
      try {
        await request(base, { method: "DELETE" });
        toast("Order deleted");
        router.back();
      } catch (deleteError) {
        toast(deleteError.message, "error");
      }
    },
  });

  return (
    <>
      <Stack.Screen options={{ title: `Order #${order.id}` }} />
      <Screen keyboard refreshing={refreshing} onRefresh={reload}>
        <Card>
          <Row justify="space-between" align="flex-start">
            <View style={{ flex: 1 }}>
              <T variant="label">Placed {formatDate(order.created_at)}</T>
              <T variant="h1" style={{ marginTop: 4 }}>{formatPrice(amount)}</T>
              {portalKey === "vendor" && !order.can_manage_shipping ? <T variant="small">Your items in this order</T> : null}
            </View>
            <View style={{ alignItems: "flex-end", gap: 6 }}>
              <OrderStatusPill status={order.status} />
              <PaymentStatusPill status={order.payment_status} />
            </View>
          </Row>
          <View style={{ marginTop: 18 }}><MilestoneBar order={order} /></View>
        </Card>

        <Card style={{ marginTop: 12 }}>
          <T variant="h3" style={{ marginBottom: 8 }}>Customer</T>
          <AddressBlock order={order} />
          <Divider />
          <KeyValue label="Payment" value={paymentMethodLabel(order.payment_method)} last={!order.notes} />
          {order.notes && portalKey === "admin" ? <T variant="small" style={{ marginTop: 6 }}>Note: {order.notes}</T> : null}
          {order.policy_accepted_at && portalKey === "admin" ? <T variant="small" style={{ marginTop: 6 }}>Accepted Return &amp; Refund Policy v{order.policy_version} on {formatDate(order.policy_accepted_at)}</T> : null}
        </Card>

        <Card style={{ marginTop: 12 }}>
          <T variant="h3">Items</T>
          {(order.items || []).map((item, index, list) => <OrderItemRow key={item.id} item={item} last={index === list.length - 1} />)}
          {order.total != null ? (
            <>
              <KeyValue label="Subtotal" value={formatPrice(order.subtotal)} />
              <KeyValue label="Delivery" value={Number(order.shipping_amount) > 0 ? formatPrice(order.shipping_amount) : "Free"} />
              <KeyValue label="Total" value={formatPrice(order.total)} strong last={!(Number(order.tax_total) > 0)} />
              {Number(order.tax_total) > 0 ? <KeyValue label="Includes GST" value={formatPrice(order.tax_total)} last /> : null}
            </>
          ) : <KeyValue label="Your items" value={formatPrice(order.vendor_subtotal)} strong last />}
          {order.billing_gstin ? <T variant="small" style={{ marginTop: 8 }}>Bill to {order.billing_name} · GSTIN {order.billing_gstin}</T> : null}
        </Card>

        <InvoiceLinks invoices={order.invoice_links} emptyText={portalKey === "vendor" ? "Issued automatically when the order ships, one for your items." : "Issued automatically when the order ships: one per seller, and one from Elitezaar for its own products and delivery."} style={{ marginTop: 12 }} />
        {portalKey === "admin" && !order.invoice_links?.length && !["pending", "cancelled"].includes(order.status) ? (
          <Button title="Issue invoices now" icon="document-text-outline" variant="outline" small block={false} loading={issuing} onPress={issueInvoices} style={{ marginTop: 10 }} />
        ) : null}

        {!canManage ? (
          <Notice tone="info" title="Shipping is handled by the store team" message="This order includes items from other sellers, so the store team manages its shipping and tracking." style={{ marginTop: 12 }} />
        ) : (
          <UpdateOrderCard key={`${order.id}-${order.updated_at}`} order={order} portal={portal} base={base} onSaved={setOrder} />
        )}

        <Card style={{ marginTop: 12 }}>
          <T variant="h3" style={{ marginBottom: 14 }}>Live tracking</T>
          {canManage ? (
            <View style={{ marginBottom: 8 }}>
              <SelectField
                label="New update"
                placeholder="Choose a status…"
                value={update.status}
                options={TRACKING_STATUS_KEYS.map((key) => ({ value: key, label: TRACKING_STATUSES[key].label }))}
                onChange={(value) => setUpdate((current) => ({ ...current, status: value, description: TRACKING_STATUSES[value].note }))}
              />
              <TextField label="Location (optional)" placeholder="e.g. Mumbai hub" value={update.location} onChangeText={(text) => setUpdate((current) => ({ ...current, location: text }))} />
              <TextField label="Message for the customer" multiline value={update.description} onChangeText={(text) => setUpdate((current) => ({ ...current, description: text }))} />
              <Button title="Post update" variant="teal" icon="navigate-outline" loading={posting} onPress={postUpdate} />
              <Divider />
            </View>
          ) : null}
          <TrackingTimeline events={order.tracking_events || []} onDelete={canManage ? deleteEvent : undefined} />
        </Card>

        {portalKey === "admin" ? <Button title="Delete order" variant="danger" icon="trash-outline" onPress={deleteOrder} style={{ marginTop: 16 }} /> : null}
      </Screen>
    </>
  );
}

/** Status and shipping details. Re-mounted (via key) whenever the server copy of the order changes. */
function UpdateOrderCard({ order, portal, base, onSaved }) {
  const { request } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(() => ({
    status: order.status,
    payment_status: order.payment_status,
    tracking_number: order.tracking_number || "",
    courier_name: order.courier_name || "",
    estimated_delivery_date: order.estimated_delivery_date ? String(order.estimated_delivery_date).slice(0, 10) : "",
    notes: order.notes || "",
  }));
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (name) => (value) => setForm((current) => ({ ...current, [name]: value }));

  const saveOrder = async () => {
    if (form.estimated_delivery_date && !DATE_PATTERN.test(form.estimated_delivery_date)) {
      setFormErrors({ estimated_delivery_date: "Use the format YYYY-MM-DD." });
      return;
    }
    setSaving(true);
    setFormErrors({});
    const body = {
      status: form.status,
      tracking_number: form.tracking_number || null,
      courier_name: form.courier_name || null,
      estimated_delivery_date: form.estimated_delivery_date || null,
      ...(portal.canEditPayment ? { payment_status: form.payment_status, notes: form.notes || null } : {}),
    };
    try {
      const result = await request(base, { method: "PUT", body });
      toast("Order updated — the customer sees it right away");
      onSaved(result.data);
    } catch (saveError) {
      setFormErrors(saveError.fieldErrors || {});
      toast(saveError.message, "error");
      setSaving(false);
    }
  };

  return (
    <Card style={{ marginTop: 12 }}>
      <T variant="h3" style={{ marginBottom: 12 }}>Update order</T>
      <SelectField label="Order status" value={form.status} options={toOptions(ORDER_STATUSES)} onChange={set("status")} error={formErrors.status} />
      {portal.canEditPayment ? (
        <SelectField label="Payment status" value={form.payment_status} options={toOptions(PAYMENT_STATUSES)} onChange={set("payment_status")} error={formErrors.payment_status} />
      ) : null}
      <Row gap={10} align="flex-start">
        <TextField label="Courier" placeholder="e.g. Delhivery" value={form.courier_name} onChangeText={set("courier_name")} error={formErrors.courier_name} style={{ flex: 1 }} />
        <TextField label="Tracking no." autoCapitalize="characters" value={form.tracking_number} onChangeText={set("tracking_number")} error={formErrors.tracking_number} style={{ flex: 1 }} />
      </Row>
      <TextField label="Expected delivery" placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" value={form.estimated_delivery_date} onChangeText={set("estimated_delivery_date")} error={formErrors.estimated_delivery_date} />
      {portal.canEditPayment ? <TextField label="Internal notes" multiline value={form.notes} onChangeText={set("notes")} error={formErrors.notes} /> : null}
      <Button title="Save order" icon="checkmark" loading={saving} onPress={saveOrder} />
    </Card>
  );
}
