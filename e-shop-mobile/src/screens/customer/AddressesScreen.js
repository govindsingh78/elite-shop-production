import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Button, Card, EmptyState, Loader, Notice, Pill, Row, Screen, T } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { confirmAction } from "@/lib/confirm";
import { useLoad } from "@/lib/useLoad";
import { colors } from "@/theme";

export default function AddressesScreen() {
  const { request } = useAuth();
  const toast = useToast();
  const { data: addresses, loading, refreshing, error, reload, setData } = useLoad(() => request("/customer/addresses"), [request], { refocus: true });

  const makeDefault = async (address) => {
    try {
      await request(`/customer/addresses/${address.id}/default`, { method: "PATCH" });
      setData((current) => current.map((item) => ({ ...item, is_default: item.id === address.id })));
      toast("Default address updated");
    } catch (updateError) {
      toast(updateError.message, "error");
    }
  };

  const remove = (address) => confirmAction({
    title: "Remove this address?",
    message: `${address.label}: ${address.address}, ${address.city}`,
    confirmLabel: "Remove",
    onConfirm: async () => {
      try {
        await request(`/customer/addresses/${address.id}`, { method: "DELETE" });
        toast("Address removed");
        reload();
      } catch (deleteError) {
        toast(deleteError.message, "error");
      }
    },
  });

  return (
    <Screen
      refreshing={refreshing}
      onRefresh={reload}
      footer={<Button title="Add a new address" icon="add" onPress={() => router.push("/customer/address-form")} />}
    >
      {error ? <Notice tone="error" message={error} style={{ marginBottom: 12 }} /> : null}
      {loading ? <Loader /> : !addresses?.length ? (
        <EmptyState icon="location-outline" title="No saved addresses" message="Add one to check out faster." />
      ) : addresses.map((address) => (
        <Card key={address.id} style={{ marginBottom: 12 }}>
          <Row justify="space-between">
            <T variant="h3">{address.label || "Address"}</T>
            {address.is_default ? <Pill label="Default" /> : null}
          </Row>
          <T variant="title" style={{ marginTop: 6 }}>{address.full_name}</T>
          <T variant="body">{address.address}</T>
          <T variant="body">{address.city}, {address.state} {address.postal_code}</T>
          <T variant="small">{address.country} · {address.phone}</T>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
            <Button title="Edit" small block={false} variant="outline" icon="create-outline" onPress={() => router.push({ pathname: "/customer/address-form", params: { id: String(address.id) } })} />
            {!address.is_default ? <Button title="Make default" small block={false} variant="outline" icon="star-outline" onPress={() => makeDefault(address)} /> : null}
            {addresses.length > 1 ? <Button title="Remove" small block={false} variant="danger" icon="trash-outline" onPress={() => remove(address)} /> : null}
          </View>
        </Card>
      ))}
      {addresses?.length === 1 ? <T variant="small" center color={colors.muted}>You need at least one delivery address on your account.</T> : null}
    </Screen>
  );
}
