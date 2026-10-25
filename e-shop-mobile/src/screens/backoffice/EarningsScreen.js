import React from "react";
import { router } from "expo-router";
import { EarningsStats, HowEarningsWork, PayoutRow, PendingNotice, SalesList, formatRate } from "@/components/EarningsBits";
import SupportCard from "@/components/SupportCard";
import { Card, Loader, Notice, Screen, T } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useLoad } from "@/lib/useLoad";

/** Seller hub: what the seller earned, Elitezaar's commission, payouts received and what's still due. */
export default function EarningsScreen() {
  const { request } = useAuth();
  const { data, loading, refreshing, error, reload } = useLoad(() => request("/vendor/earnings"), [request], { refocus: true });

  if (loading) return <Loader />;
  if (!data) return <Screen><Notice tone="error" message={error || "Your earnings couldn’t be loaded."} /></Screen>;
  const { summary } = data;

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <T variant="body" style={{ marginBottom: 14 }}>Elitezaar’s commission on your sales is {formatRate(summary.effective_rate)}. Here’s what you’ve earned and been paid.</T>
      <EarningsStats figures={summary} perspective="seller" />
      <PendingNotice figures={summary} perspective="seller" style={{ marginTop: 12 }} />

      <Card style={{ marginTop: 14 }}>
        <T variant="h3" style={{ marginBottom: 10 }}>How earnings work</T>
        <HowEarningsWork perspective="seller" />
      </Card>

      <Card style={{ marginTop: 14 }}>
        <T variant="h3">Payouts received</T>
        {data.payouts.length
          ? data.payouts.map((payout, index) => <PayoutRow key={payout.id} payout={payout} last={index === data.payouts.length - 1} />)
          : <T variant="body" style={{ marginTop: 6 }}>No payouts yet. They appear here once Elitezaar pays you.</T>}
      </Card>

      <Card style={{ marginTop: 14 }}>
        <T variant="h3">Your sales</T>
        <SalesList
          firstPage={data.items}
          fetchPage={async (page) => (await request("/vendor/earnings", { query: { page } })).items}
          onItemPress={(item) => router.push(`/vendor/order/${item.order_id}`)}
        />
      </Card>

      <SupportCard audience="seller" style={{ marginTop: 14 }} />
    </Screen>
  );
}
