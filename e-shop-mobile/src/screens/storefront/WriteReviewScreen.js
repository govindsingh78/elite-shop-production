import React, { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { StarPicker } from "@/components/ReviewBits";
import { Button, Card, EmptyState, Loader, Notice, Screen, T, TextField } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { confirmAction } from "@/lib/confirm";
import { useLoad } from "@/lib/useLoad";

/** Write or edit the customer's review of one product. Only customers who received it may review. */
export default function WriteReviewScreen() {
  const { productId, title } = useLocalSearchParams();
  const { isCustomer, request } = useAuth();
  const { data, loading, error } = useLoad(
    () => (isCustomer ? request(`/customer/reviews/${productId}`) : Promise.resolve(null)),
    [productId, isCustomer, request],
  );

  if (!isCustomer) {
    return <Screen><EmptyState icon="star-outline" title="Sign in to review" message="Reviews come from customers who’ve received the piece." actionLabel="Sign in" onAction={() => router.push("/login")} /></Screen>;
  }
  if (loading) return <Loader />;
  if (error) return <Screen><Notice tone="error" message={error} /></Screen>;
  if (!data?.can_review) {
    return <Screen><EmptyState icon="time-outline" title="Not just yet" message={data?.reason || "You can review this piece once it has been delivered."} actionLabel="Back" onAction={() => router.back()} /></Screen>;
  }
  // Mounted once the review has loaded, so the fields start from it.
  return <ReviewForm productId={productId} productTitle={title} existing={data.review} />;
}

function ReviewForm({ productId, productTitle, existing }) {
  const { request } = useAuth();
  const toast = useToast();
  const [values, setValues] = useState({ rating: existing?.rating || 0, title: existing?.title || "", comment: existing?.comment || "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const change = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const save = async () => {
    if (!values.rating) {
      setErrors({ rating: "Choose a star rating" });
      return;
    }
    setSaving(true);
    try {
      const data = await request(`/customer/reviews/${productId}`, { method: "PUT", body: values });
      toast(data.message);
      router.back();
    } catch (saveError) {
      setErrors({ ...(saveError.fieldErrors || {}), general: saveError.fieldErrors?.rating ? undefined : saveError.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = () => confirmAction({
    title: "Delete your review?",
    message: "You can write a new one any time.",
    confirmLabel: "Delete",
    onConfirm: async () => {
      try {
        const data = await request(`/customer/reviews/${productId}`, { method: "DELETE" });
        toast(data.message, "info");
        router.back();
      } catch (deleteError) {
        toast(deleteError.message, "error");
      }
    },
  });

  return (
    <Screen keyboard footer={<Button title={existing ? "Save changes" : "Post review"} icon="checkmark" loading={saving} onPress={save} />}>
      {errors.general ? <Notice tone="error" message={errors.general} style={{ marginBottom: 12 }} /> : null}
      <Card>
        <T variant="label">Reviewing</T>
        <T variant="h3" style={{ marginTop: 2, marginBottom: 14 }} numberOfLines={2}>{productTitle}</T>
        <StarPicker value={values.rating} onChange={(rating) => change("rating", rating)} error={errors.rating} />
      </Card>
      <Card style={{ marginTop: 12 }}>
        <TextField label="Headline (optional)" placeholder="e.g. Beautiful fabric, true to size" maxLength={120} value={values.title} onChangeText={(text) => change("title", text)} error={errors.title} />
        <TextField label="Your review (optional)" placeholder="How does it look, feel and fit? Would you recommend it?" multiline maxLength={2000} value={values.comment} onChangeText={(text) => change("comment", text)} error={errors.comment} hint={`${values.comment.length}/2000`} />
        <T variant="small">Your first name and last initial are shown with your review, marked as a verified purchase.</T>
      </Card>
      {existing ? <Button title="Delete review" variant="danger" icon="trash-outline" onPress={remove} style={{ marginTop: 12 }} /> : null}
    </Screen>
  );
}
