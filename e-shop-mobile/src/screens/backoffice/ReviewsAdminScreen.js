import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import PagedList from "@/components/PagedList";
import { Stars } from "@/components/ReviewBits";
import { Button, Card, Chip, EmptyState, Pill, Row, T } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { confirmAction } from "@/lib/confirm";
import { formatDate } from "@/lib/format";
import { colors, fonts, radius } from "@/theme";

const STATUSES = [{ key: "", label: "All" }, { key: "published", label: "Published" }, { key: "hidden", label: "Hidden" }];
const RATINGS = [{ key: "", label: "Any rating" }, ...[5, 4, 3, 2, 1].map((rating) => ({ key: String(rating), label: `${rating}★` }))];

/** Admin: every customer review; hide or delete the ones that break the rules. */
export default function ReviewsAdminScreen() {
  const { request } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState("");
  const [rating, setRating] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  // Bumped after a change, so the list reloads.
  const [version, setVersion] = useState(0);

  const changeStatus = async (review, next) => {
    try {
      toast((await request(`/admin/reviews/${review.id}`, { method: "PATCH", body: { status: next } })).message);
      setVersion((current) => current + 1);
    } catch (changeError) {
      toast(changeError.message, "error");
    }
  };

  const remove = (review) => confirmAction({
    title: "Delete this review?",
    message: `The ${review.rating}-star review by ${review.user?.name || "a customer"} will be deleted. This can’t be undone.`,
    onConfirm: async () => {
      try {
        toast((await request(`/admin/reviews/${review.id}`, { method: "DELETE" })).message);
        setVersion((current) => current + 1);
      } catch (deleteError) {
        toast(deleteError.message, "error");
      }
    },
  });

  return (
    <PagedList
      deps={[status, rating, search, version]}
      fetchPage={(page) => request("/admin/reviews", { query: { status, rating, search, page } })}
      header={(
        <View>
          <T variant="body" style={{ marginBottom: 12 }}>Reviews go live as soon as verified buyers post them. Hide or delete any that break the rules.</T>
          <View style={styles.search}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput value={searchDraft} onChangeText={setSearchDraft} onSubmitEditing={() => setSearch(searchDraft.trim())} placeholder="Search review text or product" placeholderTextColor={colors.faint} returnKeyType="search" style={styles.searchInput} />
            {searchDraft ? <Pressable onPress={() => { setSearchDraft(""); setSearch(""); }} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.faint} /></Pressable> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {STATUSES.map((item) => <Chip key={item.key || "all"} label={item.label} active={status === item.key} onPress={() => setStatus(item.key)} />)}
            <View style={styles.divider} />
            {RATINGS.map((item) => <Chip key={item.key || "any"} label={item.label} active={rating === item.key} onPress={() => setRating(item.key)} />)}
          </ScrollView>
        </View>
      )}
      renderItem={(review) => (
        <Card style={{ marginBottom: 10 }}>
          <Row justify="space-between" align="flex-start">
            <View style={{ flex: 1 }}>
              {review.product ? (
                <Pressable onPress={() => router.push(`/product/${review.product.id}`)}><T variant="title" color={colors.tealDark} numberOfLines={2}>{review.product.title}</T></Pressable>
              ) : <T variant="title">—</T>}
              <Row gap={8} style={{ marginTop: 4 }}><Stars value={review.rating} size={14} /><T variant="small">{formatDate(review.created_at)}</T></Row>
            </View>
            {review.status === "hidden" ? <Pill label="Hidden" color={colors.muted} background={colors.lineSoft} /> : <Pill label="Published" color={colors.success} background={colors.successSoft} />}
          </Row>
          {review.title ? <T variant="strong" style={{ marginTop: 10 }}>{review.title}</T> : null}
          {review.comment ? <T variant="body" style={{ marginTop: review.title ? 2 : 10 }}>{review.comment}</T> : !review.title ? <T variant="small" style={{ marginTop: 10 }}>Rating only</T> : null}
          <T variant="small" style={{ marginTop: 10 }}>{review.user?.name || "—"}{review.user?.email ? ` · ${review.user.email}` : ""}</T>
          <Row gap={8} style={{ marginTop: 12 }}>
            {review.status === "hidden"
              ? <Button title="Publish" icon="eye-outline" variant="outline" small block={false} onPress={() => changeStatus(review, "published")} />
              : <Button title="Hide" icon="eye-off-outline" variant="outline" small block={false} onPress={() => changeStatus(review, "hidden")} />}
            <Button title="Delete" icon="trash-outline" variant="danger" small block={false} onPress={() => remove(review)} />
          </Row>
        </Card>
      )}
      empty={<EmptyState icon="star-outline" title="No reviews found" message={search || status || rating ? "Try another search or filter." : "Reviews appear here as buyers post them."} />}
    />
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: 10, height: 48, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 16, backgroundColor: colors.white },
  searchInput: { flex: 1, height: "100%", color: colors.text, fontFamily: fonts.bodySemi, fontSize: 16 },
  chips: { gap: 8, paddingVertical: 12 },
  divider: { width: 1, marginHorizontal: 4, backgroundColor: colors.line },
});
