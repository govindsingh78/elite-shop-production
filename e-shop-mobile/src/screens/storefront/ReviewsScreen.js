import React, { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import PagedList from "@/components/PagedList";
import { RatingSummary, ReviewItem } from "@/components/ReviewBits";
import { Card, EmptyState } from "@/components/ui";
import { api } from "@/lib/api";

/** Every published review of a product, newest first. */
export default function ReviewsScreen() {
  const { id } = useLocalSearchParams();
  const [summary, setSummary] = useState(null);

  const fetchPage = async (page) => {
    const data = await api(`/storefront/products/${id}/reviews`, { query: { page } });
    setSummary(data.summary);
    return data.reviews;
  };

  return (
    <PagedList
      deps={[id]}
      fetchPage={fetchPage}
      header={summary ? <Card style={{ marginBottom: 4 }}><RatingSummary summary={summary} /></Card> : null}
      renderItem={(review) => <ReviewItem review={review} />}
      empty={<EmptyState icon="star-outline" title="No reviews yet" message="Customers who buy this piece can be the first to review it." />}
    />
  );
}
