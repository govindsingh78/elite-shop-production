import React, { useState } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Button, Card, ListRow, Loader, Notice, Pill, Screen, SectionHeader, Stat, T } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { SITE_URL } from "@/lib/config";
import { timeAgo } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { colors, fonts, radius } from "@/theme";

const SEVERITY = {
  critical: { label: "Urgent", color: colors.danger, background: colors.dangerSoft },
  warning: { label: "Needs attention", color: colors.warning, background: colors.warningSoft },
  info: { label: "Good to know", color: colors.tealDark, background: colors.tealSoft },
};
const AUDIENCES = { customer: "shoppers", seller: "sellers", admin: "admins", guest: "visitors", system: "background tasks" };
const SOURCES = { server: "Server", website: "Website", app: "App" };

const bytes = (value) => {
  const units = ["bytes", "KB", "MB", "GB", "TB"];
  let size = Number(value) || 0;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit ? 1 : 0)} ${units[unit]}`;
};

/** Admin: the server's health at a glance, what needs attention, the latest problems and suggestions. */
export default function ServerScreen() {
  const { request } = useAuth();
  const { data, loading, refreshing, error, reload } = useLoad(() => request("/admin/server"), [request], { refocus: true });

  if (loading) return <Loader label="Checking the server…" />;
  if (!data) return <Screen><Notice tone="error" message={error || "Couldn’t check the server."} /></Screen>;
  const { health, attention, suggestions, problems } = data;
  const { disk, memory, cpu, database, background } = health;
  const urgent = attention.filter((item) => item.severity !== "info").length;
  const tone = (status) => (status === "critical" || status === "warning" ? "danger" : "emerald");

  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <Notice
        tone={urgent ? "warning" : "success"}
        title={urgent ? `${urgent} ${urgent === 1 ? "thing needs" : "things need"} your attention` : "Everything looks healthy"}
        message={`Checked ${timeAgo(health.checked_at) || "just now"} · automatic checks ${background.running ? `ran ${timeAgo(background.last_check_at) || "just now"}` : "aren’t running"}.`}
      />

      <View style={styles.vitals}>
        <Stat icon="server-outline" label={disk ? `Disk · ${bytes(disk.free)} free` : "Disk"} value={disk ? `${disk.percent}%` : "—"} tone={tone(disk?.status)} />
        <Stat icon="hardware-chip-outline" label={memory ? `Memory · ${bytes(memory.available)} free` : "Memory"} value={memory ? `${memory.percent}%` : "—"} tone={tone(memory?.status)} />
        <Stat icon="speedometer-outline" label={cpu ? `CPU load · ${cpu.cores} ${cpu.cores === 1 ? "core" : "cores"}` : "CPU load"} value={cpu ? String(cpu.load[1]) : "—"} tone={tone(cpu?.status)} />
        <Stat icon="layers-outline" label="Database" value={database.status === "critical" ? "Down" : database.latency_ms < 1 ? "< 1 ms" : `${Math.round(database.latency_ms)} ms`} tone={tone(database.status)} />
      </View>

      <SectionHeader eyebrow="Checked every 10 minutes" title="Needs attention" style={{ marginTop: 22 }} />
      {attention.length ? attention.map((item) => (
        <Card key={item.key} style={{ marginBottom: 10 }}>
          <View style={{ alignSelf: "flex-start" }}><Pill label={SEVERITY[item.severity]?.label || item.severity} color={SEVERITY[item.severity]?.color} background={SEVERITY[item.severity]?.background} /></View>
          <T variant="title" style={{ marginTop: 8 }}>{item.title}</T>
          <T variant="body" style={{ marginTop: 4 }}>{item.detail}</T>
          {item.commands?.map((command) => <Text key={command} selectable style={styles.command}>{command}</Text>)}
        </Card>
      )) : <Card><T variant="body">Nothing right now. Disk, memory, database, settings, problems and speed all look fine.</T></Card>}

      <SectionHeader eyebrow={problems.open ? `${problems.open} open · ${problems.last_day} in the last 24 hours` : "What people run into"} title="Latest problems" style={{ marginTop: 22 }} />
      {problems.latest.length
        ? problems.latest.map((problem) => <ProblemCard key={problem.id} problem={problem} onChanged={reload} />)
        : <Card><T variant="body">No open problems. Nobody has run into an error lately.</T></Card>}

      {suggestions.length ? (
        <>
          <SectionHeader eyebrow="Run the store better" title="Suggestions" style={{ marginTop: 22 }} />
          <Card>
            {suggestions.map((item, index) => (
              <ListRow
                key={item.key}
                icon="bulb-outline"
                title={item.title}
                subtitle={item.detail}
                onPress={item.app_link ? () => router.push(item.app_link) : undefined}
                last={index === suggestions.length - 1}
              />
            ))}
          </Card>
        </>
      ) : null}

      <Button title="Speed, storage & log on the website" icon="open-outline" variant="outline" style={{ marginTop: 18 }} onPress={() => Linking.openURL(`${SITE_URL}/admin/server`)} />
      {Platform.OS !== "web" ? <T variant="small" center style={{ marginTop: 8 }}>Clean-ups and the full log are on the website’s admin panel.</T> : null}
    </Screen>
  );
}

function ProblemCard({ problem, onChanged }) {
  const { request } = useAuth();
  const toast = useToast();
  const [details, setDetails] = useState(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const who = Object.entries(problem.affected || {}).sort(([, a], [, b]) => b - a).map(([key, count]) => `${AUDIENCES[key] || key} ${count}`).join(", ");

  const toggle = async () => {
    setOpen(!open);
    if (!details) {
      try {
        setDetails((await request(`/admin/server/problems/${problem.id}`)).problem);
      } catch (loadError) {
        toast(loadError.message, "error");
      }
    }
  };

  const resolve = async () => {
    setSaving(true);
    try {
      toast((await request(`/admin/server/problems/${problem.id}`, { method: "PATCH", body: { status: "resolved" } })).message);
      onChanged();
    } catch (saveError) {
      toast(saveError.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ marginBottom: 10 }}>
      <Pressable onPress={toggle} accessibilityRole="button" style={styles.problemHead}>
        <View style={styles.count}><Text style={styles.countText}>{problem.hits}×</Text></View>
        <View style={{ flex: 1 }}>
          <T variant="title" numberOfLines={open ? undefined : 2}>{problem.title}</T>
          <T variant="small">{SOURCES[problem.source]} · {timeAgo(problem.last_seen_at)}{who ? ` · ${who}` : ""}</T>
        </View>
      </Pressable>
      {open ? (
        <View style={{ marginTop: 10 }}>
          {!details ? <T variant="small">Loading…</T> : (
            <>
              {details.url ? <T variant="small">Where: {details.method && details.method !== "GET" ? `${details.method} ` : ""}{details.url}</T> : null}
              {details.location ? <T variant="small">Code: {details.location}</T> : null}
              {details.message && details.message !== details.title ? <Text selectable style={styles.command}>{details.message}</Text> : null}
              <Button title="Mark fixed" icon="checkmark" small block={false} loading={saving} onPress={resolve} style={{ marginTop: 12 }} />
            </>
          )}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  vitals: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 14 },
  command: { marginTop: 8, borderRadius: radius.sm, padding: 10, overflow: "hidden", color: "#e8f1ec", backgroundColor: colors.emerald, fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }), fontSize: 12 },
  problemHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  count: { minWidth: 46, alignItems: "center", borderRadius: 12, paddingVertical: 8, backgroundColor: colors.dangerSoft },
  countText: { color: colors.danger, fontFamily: fonts.heading, fontSize: 15 },
});
