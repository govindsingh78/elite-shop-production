import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import PagedList from "@/components/PagedList";
import { RequestStatusPill } from "@/components/CategoryRequestBits";
import { SellerStatusPill } from "@/components/SellerBits";
import { Button, Card, Chip, EmptyState, Row, SelectField, T, TextField } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { formatDate } from "@/lib/format";
import { colors } from "@/theme";

const TABS = [
  { key: "pending", label: "Waiting" },
  { key: "approved", label: "Added" },
  { key: "declined", label: "Declined" },
  { key: "all", label: "All" },
];

/** Admin: brands sellers asked for. Add them (as asked, renamed, or as one already in the store) or decline. */
export default function BrandRequestsAdminScreen() {
  const { request } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState("pending");
  const [counts, setCounts] = useState(null);
  const [brands, setBrands] = useState([]);
  // Bumped after an answer: other sellers waiting on the same brand were answered too.
  const [version, setVersion] = useState(0);

  // Every brand, for pointing a seller to one that already exists.
  const loadBrands = useCallback(() => {
    request("/brands").then((list) => setBrands(Array.isArray(list) ? list : [])).catch(() => {});
  }, [request]);
  useEffect(() => { loadBrands(); }, [loadBrands]);

  return (
    <PagedList
      deps={[status, version]}
      fetchPage={async (page) => {
        const result = await request("/admin/brand-requests", { query: { status, page } });
        setCounts(result.counts);
        return result;
      }}
      header={(
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
          {TABS.map((tab) => {
            const count = counts?.[tab.key];
            return <Chip key={tab.key} label={count ? `${tab.label} · ${count}` : tab.label} active={status === tab.key} onPress={() => setStatus(tab.key)} />;
          })}
        </ScrollView>
      )}
      renderItem={(item) => (
        <RequestCard
          item={item}
          brands={brands}
          onAnswered={(result) => {
            toast(result.message);
            loadBrands();
            setVersion((current) => current + 1);
          }}
        />
      )}
      empty={<EmptyState icon="ribbon-outline" title={status === "pending" ? "No requests waiting" : "Nothing here yet"} message={status === "pending" ? "You’re all caught up." : undefined} />}
    />
  );
}

function RequestCard({ item, brands, onAnswered }) {
  const { request } = useAuth();
  // "add" (as asked, or renamed), "existing" (one already in the store) or "decline".
  const [mode, setMode] = useState(null);
  const [name, setName] = useState(item.name);
  const [existingId, setExistingId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const answer = async (path, body) => {
    setSaving(true);
    setError("");
    try {
      onAnswered(await request(`/admin/brand-requests/${item.id}/${path}`, { method: "POST", body }));
    } catch (answerError) {
      setError(answerError.message);
    } finally {
      setSaving(false);
    }
  };

  const submit = () => {
    if (mode === "add") answer("approve", { name: name.trim() });
    else if (mode === "existing") {
      if (existingId) answer("approve", { brand_id: Number(existingId) });
      else setError("Choose the brand they should use.");
    } else answer("decline", { note: note.trim() });
  };

  const open = (next) => {
    setMode(next);
    setError("");
  };

  return (
    <Card style={{ marginBottom: 10 }}>
      <Row justify="space-between" align="flex-start">
        <View style={{ flex: 1 }}>
          <T variant="title">{item.name}</T>
          <T variant="small">{formatDate(item.created_at)}</T>
        </View>
        <RequestStatusPill status={item.status} />
      </Row>
      <Row gap={6} style={{ marginTop: 8, flexWrap: "wrap" }}>
        <T variant="small" style={{ flexShrink: 1 }}>Asked by {item.seller ? `${item.seller.name} · ${item.seller.email}` : "a seller who has left"}</T>
        {item.seller ? <SellerStatusPill status={item.seller.seller_status} /> : null}
      </Row>
      {item.note ? <T variant="body" style={{ marginTop: 8 }}>“{item.note}”</T> : null}
      {item.also_waiting > 0 ? <T variant="small" color={colors.warning} style={{ marginTop: 6 }}>{item.also_waiting} other {item.also_waiting === 1 ? "seller" : "sellers"} asked for this too. They’ll all get your answer.</T> : null}
      {item.status === "approved" && item.brand ? <T variant="body" style={{ marginTop: 8 }}>Added as <T variant="strong">{item.brand.name}</T>{item.reviewer ? ` by ${item.reviewer}` : ""} on {formatDate(item.reviewed_at)}.</T> : null}
      {item.status === "declined" ? <T variant="body" style={{ marginTop: 8 }}>Declined{item.reviewer ? ` by ${item.reviewer}` : ""}: {item.admin_note}</T> : null}

      {item.status === "pending" && !mode ? (
        <Row gap={8} style={{ marginTop: 12, flexWrap: "wrap" }}>
          <Button title="Add" icon="add" small block={false} onPress={() => open("add")} />
          <Button title="Use existing" variant="outline" small block={false} onPress={() => open("existing")} />
          <Button title="Decline" variant="danger" small block={false} onPress={() => open("decline")} />
        </Row>
      ) : null}

      {mode ? (
        <View style={{ marginTop: 14 }}>
          {mode === "add" ? (
            <>
              <TextField label="Brand name" maxLength={60} autoCapitalize="none" value={name} onChangeText={setName} />
              <T variant="small" style={{ marginTop: -6, marginBottom: 10 }}>It goes live straight away. Fix the spelling or capitals here if you need to.</T>
            </>
          ) : null}
          {mode === "existing" ? (
            <SelectField
              label="Which brand should they use?"
              value={existingId}
              searchable
              options={brands.map((brand) => ({ value: String(brand.id), label: `${brand.name}${brand.status === 1 ? "" : " (blocked: will be switched on)"}` }))}
              onChange={setExistingId}
            />
          ) : null}
          {mode === "decline" ? (
            <TextField label="Why aren’t you adding it? (the seller sees this)" multiline maxLength={300} placeholder="e.g. Please share proof that you’re authorised to sell this brand." value={note} onChangeText={setNote} />
          ) : null}
          {error ? <T variant="small" color={colors.danger} style={{ marginBottom: 8 }}>{error}</T> : null}
          <Row gap={8}>
            <Button
              title={mode === "add" ? "Add & tell the seller" : mode === "existing" ? "Use this & tell them" : "Decline & tell them"}
              variant={mode === "decline" ? "danger" : "primary"}
              small
              block={false}
              loading={saving}
              onPress={submit}
            />
            <Button title="Cancel" variant="ghost" small block={false} onPress={() => setMode(null)} />
          </Row>
        </View>
      ) : null}
    </Card>
  );
}
