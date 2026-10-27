import React, { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, router, useFocusEffect } from "expo-router";
import PagedList from "@/components/PagedList";
import { Button, Chip, EmptyState, IconButton, Pill, Row, T } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { formatPrice } from "@/lib/format";
import { colors, fonts, radius, shadow } from "@/theme";

const TABS = [["active", "Active"], ["scheduled", "Scheduled"], ["expired", "Expired"], ["paused", "Paused"], ["all", "All"]];
const COUPON_STATES = {
  active: { label: "Active", color: colors.success, background: colors.successSoft },
  scheduled: { label: "Scheduled", color: colors.warning, background: colors.warningSoft },
  expired: { label: "Expired", color: colors.danger, background: colors.dangerSoft },
  paused: { label: "Paused", color: colors.muted, background: colors.lineSoft },
  used_up: { label: "Used up", color: colors.danger, background: colors.dangerSoft },
};

/** Admin: coupon codes, by state, with how often they've been used; tap one to edit it. */
export default function CouponsScreen() {
  const { request } = useAuth();
  const toast = useToast();
  const [state, setState] = useState("active");
  const [counts, setCounts] = useState(null);
  // Bumped after a change (here, or on the coupon form), so the list reloads.
  const [version, setVersion] = useState(0);
  const firstFocus = useRef(true);
  useFocusEffect(useCallback(() => {
    if (firstFocus.current) firstFocus.current = false;
    else setVersion((current) => current + 1);
  }, []));

  const setStatus = async (coupon, status) => {
    try {
      toast((await request(`/admin/coupons/${coupon.id}/status`, { method: "PATCH", body: { status } })).message);
      setVersion((current) => current + 1);
    } catch (statusError) {
      toast(statusError.message, "error");
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerRight: () => <View style={{ marginRight: 12 }}><IconButton icon="add" label="New coupon" size={36} background={colors.emerald} color={colors.white} onPress={() => router.push("/admin/coupon-form")} /></View> }} />
      <PagedList
        deps={[state, version]}
        fetchPage={async (page) => {
          const result = await request("/admin/coupons", { query: { state, page } });
          setCounts(result.counts);
          return result;
        }}
        header={(
          <View>
            <T variant="body" style={{ marginBottom: 4 }}>Codes for a percentage or amount off. Listed ones show as offers on the products they cover; shoppers apply them at checkout.</T>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
              {TABS.map(([key, label]) => <Chip key={key} label={counts?.[key] ? `${label} · ${counts[key]}` : label} active={state === key} onPress={() => setState(key)} />)}
            </ScrollView>
          </View>
        )}
        renderItem={(coupon) => {
          const config = COUPON_STATES[coupon.state] || COUPON_STATES.active;
          return (
            <Pressable onPress={() => router.push({ pathname: "/admin/coupon-form", params: { id: String(coupon.id) } })} style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}>
              <Row justify="space-between" align="flex-start">
                <View style={styles.code}><Text style={styles.codeText}>{coupon.code}</Text><Text style={styles.headline}>{coupon.headline}</Text></View>
                <Pill label={config.label} color={config.color} background={config.background} />
              </Row>
              <T variant="title" style={{ marginTop: 10 }}>{coupon.title}</T>
              <T variant="small" style={{ marginTop: 4 }}>{coupon.conditions.join(" ")}</T>
              <T variant="small" style={{ marginTop: 6 }}>
                {coupon.usage_limit ? `${coupon.uses} of ${coupon.usage_limit} used` : `Used ${coupon.uses} ${coupon.uses === 1 ? "time" : "times"}`}
                {coupon.discount_given > 0 ? ` · ${formatPrice(coupon.discount_given)} off in all` : ""} · {coupon.funded_by === "store" ? "Elitezaar pays" : "Sellers pay"}
              </T>
              <Row gap={8} style={{ marginTop: 10 }}>
                {coupon.status
                  ? <Button title="Pause" icon="pause-outline" variant="outline" small block={false} onPress={() => setStatus(coupon, false)} />
                  : <Button title="Switch on" icon="play-outline" small block={false} onPress={() => setStatus(coupon, true)} />}
              </Row>
            </Pressable>
          );
        }}
        empty={<EmptyState icon="pricetags-outline" title={state === "active" ? "No coupons running" : "Nothing here"} message={state === "active" ? "Create one with the + button." : undefined} actionLabel="New coupon" onAction={() => router.push("/admin/coupon-form")} />}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 10, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.lg, padding: 14, backgroundColor: colors.white, ...shadow.card },
  code: { alignItems: "center", borderWidth: 1.5, borderStyle: "dashed", borderColor: "#9cc0ff", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#eef4ff" },
  codeText: { color: "#1d4fd0", fontFamily: fonts.bodyBold, fontSize: 16, letterSpacing: 0.8 },
  headline: { color: colors.body, fontFamily: fonts.bodySemi, fontSize: 12 },
});
