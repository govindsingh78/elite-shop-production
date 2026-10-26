import React from "react";
import { StyleSheet, View } from "react-native";
import PagedList from "@/components/PagedList";
import { Button, Card, EmptyState, Notice, Pill, Stat, T } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { confirmAction } from "@/lib/confirm";
import { formatDateTime, timeAgo } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { colors, radius, shadow } from "@/theme";

const OUTCOMES = {
  success: { label: "Signed in", color: colors.success, background: colors.successSoft },
  failed: { label: "Wrong password", color: colors.warning, background: colors.warningSoft },
  blocked: { label: "Turned away", color: colors.danger, background: colors.dangerSoft },
};
const PORTALS = { admin: "Admin", vendor: "Seller", customer: "Shopper" };

/** Admin: who's blocked (with unblocking) and the latest sign-in attempts. Blocking by hand is on the website. */
export default function SecurityScreen() {
  const { request } = useAuth();
  const toast = useToast();
  const { data, error, reload } = useLoad(() => request("/admin/security"), [request], { refocus: true });
  const active = data?.blocks.filter((block) => block.active) || [];

  const unblock = (block) => confirmAction({
    title: `Unblock ${block.value}?`,
    message: block.type === "account" ? "They can sign in again straight away." : "This address can sign in (and use the store) again.",
    confirmLabel: "Unblock",
    destructive: false,
    onConfirm: async () => {
      try {
        toast((await request(`/admin/security/blocks/${block.id}`, { method: "DELETE" })).message);
        reload();
      } catch (unblockError) {
        toast(unblockError.message, "error");
      }
    },
  });

  return (
    <PagedList
      fetchPage={(page) => request("/admin/security/attempts", { query: { page } })}
      header={(
        <View>
          {error ? <Notice tone="error" message={error} style={{ marginBottom: 12 }} /> : null}
          {data ? (
            <>
              <T variant="small" style={{ marginBottom: 12 }}>
                {data.rules.max_failures} wrong passwords in a row lock an account for {data.rules.block_hours} hours; an address making {data.rules.ip_max_failures} wrong attempts within an hour can’t sign in for {data.rules.block_hours} hours.
              </T>
              <View style={styles.stats}>
                <Stat icon="close-circle-outline" label="Wrong passwords · 24 h" value={data.stats.failed} tone={data.stats.failed ? "gold" : "emerald"} />
                <Stat icon="lock-closed-outline" label="Blocked now" value={data.stats.blocked_now} tone={data.stats.blocked_now ? "danger" : "emerald"} />
              </View>
              <T variant="h3" style={{ marginTop: 18, marginBottom: 8 }}>Blocked now</T>
              {active.length ? active.map((block) => (
                <Card key={block.id} style={{ marginBottom: 10 }}>
                  <T variant="title">{block.value}</T>
                  <T variant="small">{block.type === "account" ? "Account" : block.scope === "all" ? "Address · whole store" : "Address · sign-in"} · {block.reason}</T>
                  <T variant="small">{block.blocked_until ? `Until ${formatDateTime(block.blocked_until)}` : "Until unblocked"}</T>
                  <Button title="Unblock" icon="lock-open-outline" variant="outline" small block={false} style={{ marginTop: 10 }} onPress={() => unblock(block)} />
                </Card>
              )) : <Card><T variant="body">Nothing is blocked right now.</T></Card>}
              <T variant="h3" style={{ marginTop: 18, marginBottom: 8 }}>Sign-in log</T>
            </>
          ) : null}
        </View>
      )}
      renderItem={(attempt) => {
        const outcome = OUTCOMES[attempt.outcome] || OUTCOMES.failed;
        return (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <T variant="title" numberOfLines={1}>{attempt.email || "—"}</T>
              <T variant="small">{PORTALS[attempt.portal] || "—"}{attempt.method === "google" ? " · Google" : ""} · {attempt.ip}</T>
              <T variant="small" numberOfLines={1}>{attempt.device || "Unknown device"} · {timeAgo(attempt.created_at) || "just now"}</T>
            </View>
            <Pill label={outcome.label} color={outcome.color} background={outcome.background} />
          </View>
        );
      }}
      empty={<EmptyState icon="shield-checkmark-outline" title="No sign-ins yet" />}
    />
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.lg, padding: 14, backgroundColor: colors.white, ...shadow.card },
});
