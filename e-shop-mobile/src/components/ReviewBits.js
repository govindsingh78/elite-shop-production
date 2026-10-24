import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Card, T } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { colors, fonts, radius } from "@/theme";

export const STAR_GOLD = "#e3a53c";
const LABELS = { 1: "Poor", 2: "Fair", 3: "Good", 4: "Very good", 5: "Excellent" };

/** Read-only stars, with half stars for averages. */
export function Stars({ value = 0, size = 15 }) {
  return (
    <View style={styles.stars} accessibilityRole="image" accessibilityLabel={`${Number(value).toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons key={n} name={value >= n ? "star" : value >= n - 0.5 ? "star-half" : "star-outline"} size={size} color={value >= n - 0.5 ? STAR_GOLD : colors.line} />
      ))}
    </View>
  );
}

/** Five tappable stars for writing a review. */
export function StarPicker({ value, onChange, error }) {
  return (
    <View>
      <View style={styles.picker} accessibilityRole="radiogroup" accessibilityLabel="Your rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => onChange(n)} hitSlop={4} accessibilityRole="radio" accessibilityState={{ checked: value === n }} accessibilityLabel={`${n} star${n > 1 ? "s" : ""}, ${LABELS[n]}`}
            style={({ pressed }) => pressed && { transform: [{ scale: 0.9 }] }}>
            <Ionicons name={n <= value ? "star" : "star-outline"} size={38} color={n <= value ? STAR_GOLD : error ? colors.danger : colors.faint} />
          </Pressable>
        ))}
      </View>
      <Text style={[styles.pickerLabel, error && { color: colors.danger }]}>{error || LABELS[value] || "Tap a star to rate"}</Text>
    </View>
  );
}

/** Average, total and the 5→1 star breakdown. */
export function RatingSummary({ summary }) {
  return (
    <View style={styles.summary}>
      <View style={styles.score}>
        <Text style={styles.average}>{summary.count ? summary.average.toFixed(1) : "–"}</Text>
        <Stars value={summary.average} size={14} />
        <T variant="small" style={{ marginTop: 4 }}>{summary.count ? `${summary.count} ${summary.count === 1 ? "review" : "reviews"}` : "No reviews yet"}</T>
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        {[5, 4, 3, 2, 1].map((rating) => {
          const total = summary.distribution?.[rating] || 0;
          const percent = summary.count ? (total / summary.count) * 100 : 0;
          return (
            <View key={rating} style={styles.barRow}>
              <Text style={styles.barLabel}>{rating}</Text>
              <Ionicons name="star" size={11} color={STAR_GOLD} />
              <View style={styles.bar}><View style={[styles.barFill, { width: `${percent}%` }]} /></View>
              <Text style={styles.barCount}>{total}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** One review. The customer's own review is marked and shows if it was hidden. */
export function ReviewItem({ review, mine = false, onEdit }) {
  return (
    <Card style={[styles.review, mine && styles.reviewMine]}>
      <View style={styles.reviewHead}>
        <Stars value={review.rating} size={14} />
        {mine ? <Text style={styles.mineBadge}>Your review</Text> : null}
      </View>
      {review.title ? <T variant="h3" style={{ marginTop: 8 }}>{review.title}</T> : null}
      {review.comment ? <T variant="body" style={{ marginTop: 4 }}>{review.comment}</T> : null}
      {mine && review.status === "hidden" ? <T variant="small" color={colors.warning} style={{ marginTop: 6 }}>Hidden by our team, so only you can see it.</T> : null}
      <View style={styles.reviewFoot}>
        <Text style={styles.author}>{review.author}</Text>
        {review.verified ? <Text style={styles.verified}>✓ Verified purchase</Text> : null}
        <T variant="small">{formatDate(review.created_at)}</T>
        {mine && onEdit ? <Pressable onPress={onEdit} hitSlop={6} style={{ marginLeft: "auto" }}><Text style={styles.edit}>Edit</Text></Pressable> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  stars: { flexDirection: "row", gap: 1 },
  picker: { flexDirection: "row", gap: 6 },
  pickerLabel: { marginTop: 6, color: colors.goldDeep, fontFamily: fonts.bodyBold, fontSize: 15 },
  summary: { flexDirection: "row", alignItems: "center", gap: 18 },
  score: { alignItems: "center", minWidth: 92 },
  average: { color: colors.ink, fontFamily: fonts.display, fontSize: 40, lineHeight: 44 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  barLabel: { width: 10, color: colors.body, fontFamily: fonts.bodyBold, fontSize: 13 },
  bar: { flex: 1, height: 7, overflow: "hidden", borderRadius: 4, backgroundColor: colors.lineSoft },
  barFill: { height: "100%", borderRadius: 4, backgroundColor: STAR_GOLD },
  barCount: { width: 22, color: colors.muted, fontFamily: fonts.bodySemi, fontSize: 12, textAlign: "right" },
  review: { marginTop: 10 },
  reviewMine: { borderWidth: 1, borderColor: "#cfe3da", backgroundColor: "#f6fbf8" },
  reviewHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mineBadge: { overflow: "hidden", borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 2, color: colors.tealDark, backgroundColor: colors.tealSoft, fontFamily: fonts.bodyBold, fontSize: 12 },
  reviewFoot: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 10 },
  author: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 14 },
  verified: { color: colors.success, fontFamily: fonts.bodyBold, fontSize: 13 },
  edit: { color: colors.tealDark, fontFamily: fonts.bodyBold, fontSize: 14 },
});
