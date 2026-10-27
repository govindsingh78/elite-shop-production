import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import PagedList from "@/components/PagedList";
import { Button, Card, Chip, EmptyState, Notice, Pill, Row, SelectField, Stat, T, TextField } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { confirmAction } from "@/lib/confirm";
import { formatDateTime, timeAgo } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { colors, fonts, radius, shadow } from "@/theme";

const OUTCOMES = {
  success: { label: "Signed in", color: colors.success, background: colors.successSoft },
  failed: { label: "Wrong password", color: colors.warning, background: colors.warningSoft },
  blocked: { label: "Turned away", color: colors.danger, background: colors.dangerSoft },
};
const PORTALS = { admin: "Admin", vendor: "Seller", customer: "Shopper" };
const METHODS = { google: "with Google", otp: "with an SMS code", password_change: "changing password" };
const DURATIONS = [{ value: "24", label: "24 hours" }, { value: "168", label: "7 days" }, { value: "720", label: "30 days" }, { value: "", label: "Until I unblock it" }];
const CHOICES = { accept_all: "Accept all", necessary_only: "Necessary only", custom: "Chose their own" };

/** Admin: sign-in security (blocks, blocking by hand, the sign-in log) and the cookie choices website visitors made. */
export default function SecurityScreen() {
  const { request } = useAuth();
  const toast = useToast();
  const { data, error, reload } = useLoad(() => request("/admin/security"), [request], { refocus: true });
  const consents = useLoad(() => request("/admin/consents"), [request]);
  const [filters, setFilters] = useState({ outcome: "", portal: "", search: "" });
  const [searchDraft, setSearchDraft] = useState("");
  const [showPast, setShowPast] = useState(false);
  // The address being blocked (from the log, or typed in); null while the sheet is closed.
  const [blocking, setBlocking] = useState(null);
  const [version, setVersion] = useState(0);
  const active = data?.blocks.filter((block) => block.active) || [];
  const past = data?.blocks.filter((block) => !block.active) || [];
  const stats = data?.stats;

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

  const set = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

  return (
    <>
      <PagedList
        deps={[filters.outcome, filters.portal, filters.search, version]}
        fetchPage={(page) => request("/admin/security/attempts", { query: { ...filters, page } })}
        header={(
          <View>
            {error ? <Notice tone="error" message={error} style={{ marginBottom: 12 }} /> : null}
            {data ? (
              <>
                <T variant="small" style={{ marginBottom: 12 }}>
                  Every sign-in is logged. {data.rules.max_failures} wrong passwords in a row lock an account for {data.rules.block_hours} hours (resetting the password unlocks it); an address making {data.rules.ip_max_failures} wrong attempts within an hour can’t sign in for {data.rules.block_hours} hours.
                </T>
                <View style={styles.stats}>
                  <Stat icon="close-circle-outline" label="Wrong passwords · 24 h" value={stats.failed} tone={stats.failed ? "gold" : "emerald"} />
                  <Stat icon="hand-left-outline" label="Turned away · 24 h" value={stats.refused} tone={stats.refused ? "gold" : "emerald"} />
                  <Stat icon="checkmark-circle-outline" label="Signed in · 24 h" value={stats.succeeded} />
                  <Stat icon="lock-closed-outline" label="Blocked now" value={stats.blocked_now} tone={stats.blocked_now ? "danger" : "emerald"} />
                </View>

                <Row justify="space-between" style={{ marginTop: 18, marginBottom: 8 }}>
                  <T variant="h3">Blocked now</T>
                  <Button title="Block an address" icon="ban-outline" variant="danger" small block={false} onPress={() => setBlocking("")} />
                </Row>
                {active.length ? active.map((block) => <BlockCard key={block.id} block={block} onUnblock={unblock} />) : <Card><T variant="body">Nothing is blocked right now.</T></Card>}
                {past.length ? (
                  <Pressable onPress={() => setShowPast(!showPast)} hitSlop={6} style={{ marginTop: 10 }}>
                    <T variant="strong" color={colors.tealDark} style={{ fontSize: 14 }}>{showPast ? "Hide" : "Show"} blocks that ended in the last 7 days ({past.length})</T>
                  </Pressable>
                ) : null}
                {showPast ? past.map((block) => <BlockCard key={block.id} block={block} />) : null}

                <CookieChoices data={consents.data} error={consents.error} />

                <T variant="h3" style={{ marginTop: 22, marginBottom: 4 }}>Sign-in log</T>
                <T variant="small" style={{ marginBottom: 10 }}>Every attempt to sign in to the website and the app, newest first.</T>
                <View style={styles.search}>
                  <Ionicons name="search" size={18} color={colors.muted} />
                  <TextInput value={searchDraft} onChangeText={setSearchDraft} onSubmitEditing={() => set("search", searchDraft.trim())} placeholder="Email or IP address" placeholderTextColor={colors.faint} returnKeyType="search" autoCapitalize="none" style={styles.searchInput} />
                  {searchDraft ? <Pressable onPress={() => { setSearchDraft(""); set("search", ""); }} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.faint} /></Pressable> : null}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  <Chip label="Everything" active={!filters.outcome} onPress={() => set("outcome", "")} />
                  {Object.entries(OUTCOMES).map(([key, outcome]) => <Chip key={key} label={outcome.label} active={filters.outcome === key} onPress={() => set("outcome", key)} />)}
                </ScrollView>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, { paddingTop: 0 }]}>
                  <Chip label="All portals" active={!filters.portal} onPress={() => set("portal", "")} />
                  {Object.entries(PORTALS).map(([key, label]) => <Chip key={key} label={label} active={filters.portal === key} onPress={() => set("portal", key)} />)}
                </ScrollView>
              </>
            ) : null}
          </View>
        )}
        renderItem={(attempt) => {
          const outcome = OUTCOMES[attempt.outcome] || OUTCOMES.failed;
          return (
            <View style={styles.row}>
              <Row justify="space-between" align="flex-start">
                <View style={{ flex: 1 }}>
                  <T variant="title" numberOfLines={1}>{attempt.email || "—"}</T>
                  <T variant="small">{PORTALS[attempt.portal] || "—"}{METHODS[attempt.method] ? ` ${METHODS[attempt.method]}` : ""} · {attempt.ip}</T>
                  <T variant="small" numberOfLines={1}>{attempt.device || "Unknown device"} · {formatDateTime(attempt.created_at)}</T>
                </View>
                <Pill label={outcome.label} color={outcome.color} background={outcome.background} />
              </Row>
              {attempt.outcome !== "success" ? (
                <Pressable onPress={() => setBlocking(attempt.ip)} hitSlop={6} style={{ marginTop: 8, alignSelf: "flex-start" }}>
                  <T variant="strong" color={colors.danger} style={{ fontSize: 14 }}>Block this address</T>
                </Pressable>
              ) : null}
            </View>
          );
        }}
        empty={<EmptyState icon="shield-checkmark-outline" title={filters.outcome || filters.portal || filters.search ? "No sign-ins match" : "No sign-ins yet"} />}
      />
      {blocking !== null ? (
        <BlockSheet
          ip={blocking}
          yourIp={data?.your_ip}
          onClose={() => setBlocking(null)}
          onBlocked={(message) => { toast(message); setBlocking(null); reload(); setVersion((current) => current + 1); }}
        />
      ) : null}
    </>
  );
}

function BlockCard({ block, onUnblock }) {
  const ended = block.unblocked_at ? `${timeAgo(block.unblocked_at)}${block.unblock_reason ? ` — ${block.unblock_reason}` : ""}` : timeAgo(block.blocked_until);
  return (
    <Card style={[{ marginBottom: 10 }, !block.active && { opacity: 0.75 }]}>
      <Row justify="space-between" align="flex-start">
        <T variant="title" style={{ flex: 1 }}>{block.value}</T>
        <Pill label={block.type === "account" ? "Account" : block.scope === "all" ? "Whole store" : "Sign-in"} color={block.type === "account" ? colors.warning : colors.danger} background={block.type === "account" ? colors.warningSoft : colors.dangerSoft} />
      </Row>
      <T variant="small" style={{ marginTop: 4 }}>{block.reason}{block.blocked_by ? ` · by ${block.blocked_by}` : ""}</T>
      <T variant="small">{block.active ? (block.blocked_until ? `Until ${formatDateTime(block.blocked_until)}` : "Until unblocked") : `Ended ${ended}`}</T>
      {block.active && onUnblock ? <Button title="Unblock" icon="lock-open-outline" variant="outline" small block={false} style={{ marginTop: 10 }} onPress={() => onUnblock(block)} /> : null}
    </Card>
  );
}

/** Blocks an IP address by hand: from the whole store (the API turns it away) or just from signing in. */
function BlockSheet({ ip, yourIp, onClose, onBlocked }) {
  const { request } = useAuth();
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState({ ip, hours: "24", scope: "all", reason: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (name) => (value) => setValues((current) => ({ ...current, [name]: value }));

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      const result = await request("/admin/security/blocks", {
        method: "POST",
        body: { ip: values.ip.trim(), hours: values.hours ? Number(values.hours) : null, scope: values.scope, reason: values.reason.trim() || null },
      });
      onBlocked(result.message);
    } catch (blockError) {
      setError(blockError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />
        <ScrollView keyboardShouldPersistTaps="handled">
          <T variant="h2">Block an address</T>
          <T variant="small" style={{ marginTop: 2, marginBottom: 14 }}>For someone attacking or scraping the store.</T>
          {error ? <Notice tone="error" message={error} style={{ marginBottom: 12 }} /> : null}
          <TextField label="IP address" autoCapitalize="none" keyboardType="numbers-and-punctuation" placeholder="e.g. 203.0.113.7" hint={yourIp ? `Your own address is ${yourIp} — it can’t be blocked.` : undefined} value={values.ip} onChangeText={set("ip")} />
          <SelectField label="For" value={values.hours} options={DURATIONS} onChange={set("hours")} />
          <SelectField label="From" value={values.scope} options={[{ value: "all", label: "The whole store" }, { value: "sign-in", label: "Signing in only" }]} onChange={set("scope")} />
          <TextField label="Reason (for your records)" maxLength={200} placeholder="e.g. Password guessing" value={values.reason} onChangeText={set("reason")} />
          <Button title="Block this address" icon="ban-outline" variant="danger" loading={saving} disabled={!values.ip.trim()} onPress={submit} />
        </ScrollView>
      </View>
    </Modal>
  );
}

/** How website visitors answered the cookie banner in the last 30 days (kept as proof of consent), and the latest answers. */
function CookieChoices({ data, error }) {
  const stats = data?.last_30_days;
  const share = (count) => (stats?.total ? `${Math.round((count / stats.total) * 100)}%` : "–");

  return (
    <Card style={{ marginTop: 22 }}>
      <T variant="h3">Cookie choices</T>
      <T variant="small" style={{ marginTop: 2 }}>How website visitors answered the cookie banner in the last 30 days. Each answer is kept as a record of consent{data ? ` (Cookie Policy of ${data.policy_version})` : ""}.</T>
      {error ? <Notice tone="error" message={error} style={{ marginTop: 10 }} /> : null}
      {stats ? (
        <>
          <View style={styles.consentStats}>
            {[["Answers", stats.total], ["Accept all", `${stats.accept_all} (${share(stats.accept_all)})`], ["Necessary only", `${stats.necessary_only} (${share(stats.necessary_only)})`], ["Chose their own", stats.custom], ["Allow performance", `${stats.performance_share}%`]].map(([label, value]) => (
              <View key={label} style={styles.consentStat}><T variant="small">{label}</T><T variant="strong">{value}</T></View>
            ))}
          </View>
          {data.latest.length ? data.latest.slice(0, 10).map((consent) => (
            <View key={consent.id} style={styles.consent}>
              <Row justify="space-between">
                <T variant="strong" style={{ fontSize: 15 }}>{CHOICES[consent.choice] || consent.choice}</T>
                <T variant="small">{formatDateTime(consent.created_at)}</T>
              </Row>
              <T variant="small">Performance {consent.performance ? "allowed" : "off"}{consent.user_id ? ` · signed-in user #${consent.user_id}` : ""}{consent.page ? ` · ${consent.page}` : ""}</T>
              <T variant="small" selectable numberOfLines={1}>ID {consent.consent_id}{consent.device ? ` · ${consent.device}` : ""}</T>
            </View>
          )) : <T variant="body" style={{ marginTop: 10 }}>No answers yet. They appear as visitors respond to the cookie banner.</T>}
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  search: { flexDirection: "row", alignItems: "center", gap: 10, height: 48, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 16, backgroundColor: colors.white },
  searchInput: { flex: 1, height: "100%", color: colors.text, fontFamily: fonts.bodySemi, fontSize: 16 },
  chips: { gap: 8, paddingVertical: 10 },
  row: { marginBottom: 10, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.lg, padding: 14, backgroundColor: colors.white, ...shadow.card },
  consentStats: { flexDirection: "row", flexWrap: "wrap", marginTop: 10, marginBottom: 4 },
  consentStat: { width: "50%", paddingVertical: 6 },
  consent: { marginTop: 8, borderTopWidth: 1, borderTopColor: colors.lineSoft, paddingTop: 8 },
  backdrop: { flex: 1, backgroundColor: "rgba(10,31,25,0.45)" },
  sheet: { maxHeight: "90%", borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 10, backgroundColor: colors.white },
  handle: { width: 42, height: 5, alignSelf: "center", marginBottom: 14, borderRadius: 3, backgroundColor: colors.line },
});
