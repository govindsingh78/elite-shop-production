import React from "react";
import { Linking, Pressable } from "react-native";
import { router } from "expo-router";
import { Notice, Pill, T } from "@/components/ui";
import { BRAND } from "@/lib/config";
import { colors } from "@/theme";

/** A seller account's standing, as the admin sees it. */
export const SELLER_STATUSES = {
  pending: { label: "Awaiting approval", color: colors.warning, background: colors.warningSoft },
  approved: { label: "Active", color: colors.success, background: colors.successSoft },
  deactivated: { label: "Deactivated", color: colors.danger, background: colors.dangerSoft },
  rejected: { label: "Declined", color: colors.danger, background: colors.dangerSoft },
};

export const SellerStatusPill = ({ status }) => {
  const config = SELLER_STATUSES[status] || { label: status, color: colors.muted, background: colors.lineSoft };
  return <Pill label={config.label} color={config.color} background={config.background} />;
};

/** What the admin can do with a seller in each status; actions with a `reason` ask for one (the seller sees it). */
export const sellerActions = (status) => ({
  pending: [
    { status: "approved", label: "Approve", icon: "checkmark-circle-outline", variant: "primary" },
    { status: "rejected", label: "Decline", icon: "close-circle-outline", variant: "danger", reason: "Why are you declining this application?" },
  ],
  approved: [{ status: "deactivated", label: "Deactivate", icon: "ban-outline", variant: "danger", reason: "Why are you deactivating this seller?" }],
  deactivated: [{ status: "approved", label: "Reactivate", icon: "refresh-circle-outline", variant: "primary" }],
  rejected: [{ status: "approved", label: "Approve", icon: "checkmark-circle-outline", variant: "primary" }],
}[status] || []);

/** On the seller's dashboard: where their account stands, while it isn't approved. */
export function SellerAccountNotice({ account, style }) {
  if (!account || account.can_sell) return null;
  const reason = account.note ? `Reason: ${account.note.replace(/[.\s]+$/, "")}. ` : "";

  if (account.status === "pending") {
    return (
      <Pressable onPress={() => router.push("/vendor/business")} style={({ pressed }) => [style, pressed && { opacity: 0.85 }]}>
        <Notice
          tone="warning"
          title="Your seller account is waiting for approval"
          message={account.business_details_added
            ? "Thanks for adding your business details. We’ll let you know as soon as our team approves you — then you can list products."
            : "Add your business and GST details so our team can verify you. Tap to add them. We’ll let you know once you’re approved."}
        />
      </Pressable>
    );
  }

  return (
    <Notice
      tone="error"
      style={style}
      title={account.status === "rejected" ? "Your seller application wasn’t approved" : "Your seller account is deactivated"}
      message={account.status === "rejected"
        ? `${reason}Call us if you have questions or want us to look again.`
        : `${reason}Your products are hidden from the store and you can’t change products or orders. You can still see your orders, earnings and invoices.`}
    >
      <Pressable onPress={() => Linking.openURL(`tel:${BRAND.supportPhones[0].tel}`).catch(() => {})} hitSlop={6} style={{ marginTop: 6, alignSelf: "flex-start" }}>
        <T variant="strong" color={colors.danger}>Call {BRAND.supportPhones[0].label}</T>
      </Pressable>
    </Notice>
  );
}
