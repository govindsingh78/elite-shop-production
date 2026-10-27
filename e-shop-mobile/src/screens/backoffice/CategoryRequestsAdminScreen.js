import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import PagedList from "@/components/PagedList";
import { RequestStatusPill, requestPlace } from "@/components/CategoryRequestBits";
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

/** Admin: categories sellers asked for. Add them (as asked, renamed, moved, or as one already in the store) or decline. */
export default function CategoryRequestsAdminScreen() {
  const { request } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState("pending");
  const [counts, setCounts] = useState(null);
  const [categories, setCategories] = useState([]);
  // Bumped after an answer: other sellers waiting on the same category were answered too.
  const [version, setVersion] = useState(0);

  // Every category (main collections, each followed by its subcategories).
  const loadCategories = useCallback(() => {
    request("/categories").then((list) => setCategories(Array.isArray(list) ? list : [])).catch(() => {});
  }, [request]);
  useEffect(() => { loadCategories(); }, [loadCategories]);

  return (
    <PagedList
      deps={[status, version]}
      fetchPage={async (page) => {
        const result = await request("/admin/category-requests", { query: { status, page } });
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
          categories={categories}
          onAnswered={(result) => {
            toast(result.message);
            loadCategories();
            setVersion((current) => current + 1);
          }}
        />
      )}
      empty={<EmptyState icon="pricetags-outline" title={status === "pending" ? "No requests waiting" : "Nothing here yet"} message={status === "pending" ? "You’re all caught up." : undefined} />}
    />
  );
}

function RequestCard({ item, categories, onAnswered }) {
  const { request } = useAuth();
  // "add" (as asked, or renamed/moved), "existing" (one already in the store) or "decline".
  const [mode, setMode] = useState(null);
  const [name, setName] = useState(item.name);
  const [parentId, setParentId] = useState(item.parent_id ? String(item.parent_id) : "");
  const [existingId, setExistingId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const mainCollections = categories.filter((category) => !category.parent_id);

  const answer = async (path, body) => {
    setSaving(true);
    setError("");
    try {
      onAnswered(await request(`/admin/category-requests/${item.id}/${path}`, { method: "POST", body }));
    } catch (answerError) {
      setError(answerError.message);
    } finally {
      setSaving(false);
    }
  };

  const submit = () => {
    if (mode === "add") answer("approve", { name: name.trim(), parent_id: parentId ? Number(parentId) : null });
    else if (mode === "existing") {
      if (existingId) answer("approve", { category_id: Number(existingId) });
      else setError("Choose the category they should use.");
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
          <T variant="small">{requestPlace(item)} · {formatDate(item.created_at)}</T>
        </View>
        <RequestStatusPill status={item.status} />
      </Row>
      <Row gap={6} style={{ marginTop: 8, flexWrap: "wrap" }}>
        <T variant="small" style={{ flexShrink: 1 }}>Asked by {item.seller ? `${item.seller.name} · ${item.seller.email}` : "a seller who has left"}</T>
        {item.seller ? <SellerStatusPill status={item.seller.seller_status} /> : null}
      </Row>
      {item.note ? <T variant="body" style={{ marginTop: 8 }}>“{item.note}”</T> : null}
      {item.also_waiting > 0 ? <T variant="small" color={colors.warning} style={{ marginTop: 6 }}>{item.also_waiting} other {item.also_waiting === 1 ? "seller" : "sellers"} asked for this too. They’ll all get your answer.</T> : null}
      {item.status === "approved" && item.category ? <T variant="body" style={{ marginTop: 8 }}>Added as <T variant="strong">{item.category.label}</T>{item.reviewer ? ` by ${item.reviewer}` : ""} on {formatDate(item.reviewed_at)}.</T> : null}
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
              <TextField label="Category name" maxLength={60} value={name} onChangeText={setName} />
              <SelectField
                label="Where it goes"
                value={parentId}
                options={[{ value: "", label: "A new main collection" }, ...mainCollections.map((category) => ({ value: String(category.id), label: `Under ${category.name}` }))]}
                onChange={setParentId}
              />
              <T variant="small" style={{ marginTop: -6, marginBottom: 10 }}>It goes live straight away. You can set its own HSN code and GST rate later on the website.</T>
            </>
          ) : null}
          {mode === "existing" ? (
            <SelectField
              label="Which category should they use?"
              value={existingId}
              searchable
              options={categories.map((category) => ({
                value: String(category.id),
                label: `${category.parent_name ? `${category.parent_name} › ${category.name}` : category.name}${category.status === 1 ? "" : " (hidden: will be switched on)"}`,
              }))}
              onChange={setExistingId}
            />
          ) : null}
          {mode === "decline" ? (
            <TextField label="Why aren’t you adding it? (the seller sees this)" multiline maxLength={300} placeholder="e.g. Please use Kids › Clothing for school uniforms." value={note} onChangeText={setNote} />
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
