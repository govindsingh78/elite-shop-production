import React from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { RatingSummary, ReviewItem } from "@/components/ReviewBits";
import { Button, Card, SectionHeader, T } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { useLoad } from "@/lib/useLoad";

/** Ratings & reviews on the product screen: summary, the latest reviews and the right "write" button for this shopper. */
export default function ProductReviewsSection({ productId, productTitle }) {
  const { isCustomer, request } = useAuth();
  // Reloads when the screen regains focus, e.g. after writing a review.
  const { data } = useLoad(async () => {
    const [list, mine] = await Promise.all([
      api(`/storefront/products/${productId}/reviews`),
      isCustomer ? request(`/customer/reviews/${productId}`).catch(() => null) : Promise.resolve(null),
    ]);
    return { ...list, mine };
  }, [productId, isCustomer, request], { refocus: true });

  if (!data) return null;
  const { summary, mine } = data;
  const others = data.reviews.data.filter((review) => review.id !== mine?.review?.id).slice(0, 3);
  const writeReview = () => router.push({ pathname: "/write-review", params: { productId: String(productId), title: productTitle } });

  return (
    <View style={{ marginTop: 26 }}>
      <SectionHeader eyebrow="What customers say" title="Ratings & reviews" actionLabel={summary.count > 3 ? "See all" : undefined} onAction={() => router.push(`/reviews/${productId}`)} />
      <Card><RatingSummary summary={summary} /></Card>

      {mine?.review ? <ReviewItem review={mine.review} mine onEdit={writeReview} /> : null}
      {others.map((review) => <ReviewItem key={review.id} review={review} />)}
      {!summary.count && !mine?.review ? <T variant="small" style={{ marginTop: 10 }}>No reviews yet. Customers who buy this piece can be the first to review it.</T> : null}

      <View style={{ marginTop: 12, gap: 10 }}>
        {!isCustomer ? (
          <Button title="Sign in to review" variant="outline" icon="star-outline" onPress={() => router.push("/login")} />
        ) : mine?.review ? (
          <Button title="Edit your review" variant="outline" icon="create-outline" onPress={writeReview} />
        ) : mine?.can_review ? (
          <Button title="Write a review" icon="star-outline" onPress={writeReview} />
        ) : mine?.reason ? (
          <T variant="small">{mine.reason}</T>
        ) : null}
        {summary.count > 3 ? <Button title={`See all ${summary.count} reviews`} variant="ghost" onPress={() => router.push(`/reviews/${productId}`)} /> : null}
      </View>
    </View>
  );
}
