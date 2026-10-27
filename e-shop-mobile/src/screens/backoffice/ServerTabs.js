import React, { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Card, Chip, Loader, Notice, Pill, Row, SectionHeader, SelectField, T } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { timeAgo } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { colors, fonts, radius } from "@/theme";

/** 1536 → "1.5 KB" */
export const formatBytes = (value) => {
  const units = ["bytes", "KB", "MB", "GB", "TB"];
  let size = Number(value) || 0;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit ? 1 : 0)} ${units[unit]}`;
};

/** 0.4 → "under 1 ms", 340 → "340 ms", 1830 → "1.8 s" */
const formatMs = (ms) => {
  const value = Number(ms) || 0;
  if (value >= 1000) return `${(value / 1000).toFixed(1)} s`;
  return value > 0 && value < 1 ? "under 1 ms" : `${Math.round(value)} ms`;
};

/** Commands to free disk space outside the store's own files, safe on Ubuntu (the same as the website shows). */
const SPACE_COMMANDS = [
  { command: "df -h /", note: "How full the disk is." },
  { command: "sudo du -xh / --max-depth=2 2>/dev/null | sort -rh | head -25", note: "The biggest folders on the disk." },
  { command: "sudo journalctl --vacuum-size=100M", note: "Shrinks the system journal to 100 MB." },
  { command: "sudo apt-get clean && sudo apt-get autoremove --purge -y", note: "Removes downloaded packages and old kernels." },
  { command: "sudo find /var/log -name '*.gz' -mtime +14 -delete", note: "Deletes old compressed system logs." },
  { command: "rm -rf ~/.npm/_cacache ~/.cache/composer", note: "Clears npm and Composer download caches." },
];
const GROW_DISK_STEPS = [
  "AWS console › EC2 › Instances › your server › Storage tab › click the volume ID.",
  "Actions › Modify volume › enter the new size (e.g. 20 GiB) › Modify. Extra space costs a few cents per GB per month.",
  "Wait until the volume’s state shows “optimizing” or “completed”, then run the commands below on the server.",
];
const GROW_DISK_COMMANDS = ["lsblk", "sudo growpart /dev/nvme0n1 1   # or /dev/xvda 1 — use the disk name lsblk shows", "sudo resize2fs /dev/root", "df -h /"];

function Command({ command, note }) {
  return (
    <View style={{ marginTop: 10 }}>
      {note ? <T variant="small">{note}</T> : null}
      <Text selectable style={styles.command}>{command}</Text>
    </View>
  );
}

function Meter({ percent, status }) {
  const color = status === "critical" ? colors.danger : status === "warning" ? colors.warning : colors.emerald;
  return <View style={styles.meter}><View style={[styles.meterFill, { width: `${Math.min(100, Number(percent) || 0)}%`, backgroundColor: color }]} /></View>;
}

/** Sends a test email to the signed-in admin through the mailer in the server's .env. */
export function TestEmailCard({ style }) {
  const { request } = useAuth();
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const send = async () => {
    setSending(true);
    setResult(null);
    try {
      setResult({ sent: true, ...(await request("/admin/server/test-email", { method: "POST" })) });
    } catch (sendError) {
      setResult({ sent: false, message: sendError.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card style={style}>
      <T variant="h3">Emails</T>
      <T variant="small" style={{ marginTop: 2 }}>Order confirmations, password resets and alerts go out through the server’s mail settings. Send yourself one to check they arrive.</T>
      <Button title="Send a test email to me" icon="mail-outline" variant="outline" small block={false} loading={sending} onPress={send} style={{ marginTop: 12 }} />
      {result ? <Notice tone={result.sent ? "success" : "error"} message={result.message} style={{ marginTop: 12 }} /> : null}
    </Card>
  );
}

const PERIODS = [{ days: 1, label: "24 hours" }, { days: 7, label: "7 days" }, { days: 30, label: "30 days" }];

/** How fast pages load for real visitors, and how long each API call takes, with the likely cause of slow ones. */
export function SpeedPanel() {
  const { request } = useAuth();
  const [days, setDays] = useState(7);
  const loaded = useLoad(async () => ({ days, ...(await request("/admin/server/speed", { query: { days } })) }), [days, request]);
  // Figures for another period aren't shown while this one loads.
  const data = loaded.data?.days === days ? loaded.data : null;
  const error = loaded.error;

  return (
    <View>
      <Row gap={8} style={{ marginBottom: 12 }}>
        {PERIODS.map((period) => <Chip key={period.days} label={period.label} active={days === period.days} onPress={() => setDays(period.days)} />)}
      </Row>
      {error ? <Notice tone="error" message={error} /> : null}
      {!data && !error ? <Loader label="Loading speed figures…" /> : null}
      {data ? (
        <>
          <SectionHeader eyebrow="Under 2.5 s is good; over 4 s loses shoppers" title="Website pages" />
          {data.pages.length ? data.pages.map((page) => (
            <Card key={page.page} style={[{ marginBottom: 10 }, page.poor_share >= 25 && styles.slow]}>
              <Row justify="space-between" align="flex-start">
                <View style={{ flex: 1 }}>
                  <T variant="title">{page.label || page.page}</T>
                  <T variant="small">{page.hits.toLocaleString("en-IN")} visits · {page.mobile_share}% on phones</T>
                </View>
                <T variant="h3">{formatMs(page.avg_lcp)}</T>
              </Row>
              <T variant="small" style={{ marginTop: 6 }}>Fast {page.good_share}% · slow {page.poor_share}% · server answer {formatMs(page.avg_ttfb)}</T>
              {page.tip ? <T variant="small" color={colors.text} style={styles.tip}>💡 {page.tip}</T> : null}
            </Card>
          )) : <Card><T variant="body">No page loads recorded yet. They appear as visitors browse the website.</T></Card>}

          <SectionHeader eyebrow={`Under 0.6 s is quick; over ${formatMs(data.slow_ms)} is slow`} title="Server answers (API)" style={{ marginTop: 18 }} />
          {data.routes.length ? data.routes.map((route) => (
            <Card key={route.route} style={[{ marginBottom: 10 }, route.avg_ms >= data.slow_ms && styles.slow]}>
              <Row justify="space-between" align="flex-start">
                <View style={{ flex: 1 }}>
                  <T variant="title">{route.label || route.route}</T>
                  <T variant="small">{route.hits.toLocaleString("en-IN")} calls · slowest {formatMs(route.max_ms)}</T>
                </View>
                <T variant="h3">{formatMs(route.avg_ms)}</T>
              </Row>
              <T variant="small" style={{ marginTop: 6 }}>Slow {route.slow_share}% · errors {route.error_hits} · {route.avg_queries} database queries per call</T>
              {route.tip ? <T variant="small" color={colors.text} style={styles.tip}>💡 {route.tip}</T> : null}
            </Card>
          )) : <Card><T variant="body">Nothing recorded for this period yet.</T></Card>}
        </>
      ) : null}
    </View>
  );
}

/** What fills the disk, one-tap clean-ups, and how to free or add space on the server itself. */
export function StoragePanel() {
  const { request } = useAuth();
  const toast = useToast();
  const { data, setData, error } = useLoad(() => request("/admin/server/storage"), [request]);
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState("");

  const measureAgain = async () => {
    try {
      setData(await request("/admin/server/storage", { query: { fresh: 1 } }));
    } catch (measureError) {
      toast(measureError.message, "error");
    }
  };

  const clean = async (action) => {
    setBusy(action);
    setProgress("");
    try {
      let result = await request("/admin/server/cleanup", { method: "POST", body: { action } });
      // Photos go a batch at a time; keep going while each batch gets some done.
      while (action === "photos" && result.remaining > 0 && result.optimised > 0) {
        setProgress(result.message);
        result = await request("/admin/server/cleanup", { method: "POST", body: { action } });
      }
      toast(result.message);
      setData((current) => ({ ...current, disk: result.disk, storage: result.storage }));
    } catch (cleanError) {
      toast(cleanError.message, "error");
    } finally {
      setBusy("");
      setProgress("");
    }
  };

  if (!data) return error ? <Notice tone="error" message={error} /> : <Loader label="Measuring what’s on the disk…" />;

  const { disk, storage, photo_sides: sides } = data;
  const folder = (key) => storage.folders.find((item) => item.key === key);
  const scale = Math.max(disk?.used || 0, storage.app_total, 1);
  const oversized = storage.photos.small.oversized + storage.photos.large.oversized;
  const cleanups = [
    {
      action: "photos",
      title: "Product photos",
      text: oversized
        ? `${oversized} ${oversized === 1 ? "photo is" : "photos are"} bigger than shoppers need. Shrinking them (to ${sides.small} px for lists, ${sides.large} px for product pages) speeds up the shop and frees space.`
        : `All ${storage.photos.small.count} product photos are the right size.`,
      label: busy === "photos" ? "Optimising…" : "Optimise photos",
      disabled: !oversized,
    },
    { action: "temp-uploads", title: `Old photo uploads · ${formatBytes(folder("temp")?.bytes || 0)}`, text: "Uploads are copied into their product, so they aren’t needed afterwards. This removes those older than a day.", label: "Remove old uploads" },
    { action: "logs", title: `Log files · ${formatBytes(folder("logs")?.bytes || 0)}`, text: "Removes log files older than a week and trims any log over 10 MB to its latest entries.", label: "Clean logs" },
  ];

  return (
    <View>
      <Card>
        <Row justify="space-between">
          <T variant="h3">Disk</T>
          <Pressable onPress={measureAgain} hitSlop={8}><T variant="strong" color={colors.tealDark} style={{ fontSize: 14 }}>Measure again</T></Pressable>
        </Row>
        <T variant="small">Measured {timeAgo(storage.measured_at) || "just now"}.</T>
        {disk ? (
          <>
            <T variant="h2" style={{ marginTop: 10 }}>{disk.percent}% full</T>
            <T variant="small">{formatBytes(disk.used)} used · {formatBytes(disk.free)} free · {formatBytes(disk.total)} in all</T>
            <Meter percent={disk.percent} status={disk.status} />
            {disk.status !== "ok" ? <T variant="small" color={colors.danger} style={{ marginTop: 8 }}>{disk.status === "critical" ? "Almost full: uploads, orders and deploys will start failing. Clean up below, or make the disk bigger." : "Getting full. Clean up below before it becomes a problem."}</T> : null}
          </>
        ) : <T variant="body" style={{ marginTop: 8 }}>The disk size isn’t available on this server.</T>}
        <T variant="label" style={{ marginTop: 16, marginBottom: 6 }}>What’s using it</T>
        {[...storage.folders, ...(storage.outside_app != null ? [{ key: "other", label: "Operating system & everything else", bytes: storage.outside_app }] : [])].map((item) => (
          <View key={item.key} style={{ marginTop: 8 }}>
            <Row justify="space-between"><T variant="body" style={{ flex: 1, fontSize: 15 }}>{item.label}</T><T variant="strong" style={{ fontSize: 15 }}>{formatBytes(item.bytes)}</T></Row>
            <View style={styles.bar}><View style={[styles.barFill, { width: `${Math.max(1, (item.bytes / scale) * 100)}%` }]} /></View>
          </View>
        ))}
      </Card>

      <SectionHeader eyebrow="Safe one-tap clean-ups of the store’s own files" title="Clean up" style={{ marginTop: 18 }} />
      {progress ? <Notice tone="info" message={progress} style={{ marginBottom: 10 }} /> : null}
      {cleanups.map((item) => (
        <Card key={item.action} style={{ marginBottom: 10 }}>
          <T variant="title">{item.title}</T>
          <T variant="small" style={{ marginTop: 4 }}>{item.text}</T>
          <Button title={item.label} variant={item.action === "photos" ? "primary" : "outline"} small block={false} disabled={Boolean(busy) || item.disabled} loading={busy === item.action} onPress={() => clean(item.action)} style={{ marginTop: 10 }} />
        </Card>
      ))}

      <SectionHeader eyebrow="Connect with PuTTY or SSH, run one at a time" title="Need more space?" style={{ marginTop: 18 }} />
      <Card>
        {SPACE_COMMANDS.map((item) => <Command key={item.command} command={item.command} note={item.note} />)}
        <T variant="h3" style={{ marginTop: 18 }}>Make the disk bigger</T>
        {GROW_DISK_STEPS.map((step, index) => <T key={step} variant="small" style={{ marginTop: 6 }}>{index + 1}. {step}</T>)}
        {GROW_DISK_COMMANDS.map((command) => <Command key={command} command={command} />)}
      </Card>
    </View>
  );
}

const LEVELS = [{ key: "all", label: "Everything" }, { key: "error", label: "Errors" }, { key: "warning", label: "Warnings" }];

/** The latest entries of the server's log file, newest first. */
export function LogPanel() {
  const { request } = useAuth();
  const [filters, setFilters] = useState({ file: "", level: "error" });
  const { data, error, loading, refreshing, reload } = useLoad(() => request("/admin/server/logs", { query: { level: filters.level, file: filters.file || undefined } }), [filters, request]);
  // The entry showing its details, by time and message (positions change when the log is reloaded).
  const [openKey, setOpenKey] = useState(null);
  const entryKey = (entry) => `${entry.time}|${entry.message}`;

  return (
    <View>
      <T variant="body" style={{ marginBottom: 12 }}>The raw log, newest first. Problems (on Overview) groups the same errors together and is usually easier to read.</T>
      <Row gap={8} style={{ marginBottom: 10 }}>
        {LEVELS.map((level) => <Chip key={level.key} label={level.label} active={filters.level === level.key} onPress={() => setFilters((current) => ({ ...current, level: level.key }))} />)}
      </Row>
      {data?.files?.length ? (
        <SelectField
          label="Log file"
          value={filters.file || data.file || ""}
          options={data.files.map((file) => ({ value: file.name, label: `${file.name} (${formatBytes(file.size)})` }))}
          onChange={(file) => setFilters((current) => ({ ...current, file }))}
        />
      ) : null}
      <Button title="Refresh" icon="refresh" variant="outline" small block={false} loading={refreshing} onPress={reload} style={{ marginBottom: 12 }} />
      {error ? <Notice tone="error" message={error} /> : null}
      {loading ? <Loader label="Reading the log…" /> : null}
      {data && !data.entries.length ? <Card><T variant="body">{data.file ? "Nothing at this level in the latest part of the log." : "There’s no log file yet."}</T></Card> : null}
      {(data?.entries || []).map((entry, index) => (
        <Pressable key={`${entry.time}-${index}`} onPress={() => entry.details && setOpenKey(openKey === entryKey(entry) ? null : entryKey(entry))} style={styles.entry}>
          <Row gap={8}>
            <Pill label={entry.level} color={entry.level === "error" || entry.level === "critical" ? colors.danger : entry.level === "warning" ? colors.warning : colors.muted} background={entry.level === "error" || entry.level === "critical" ? colors.dangerSoft : entry.level === "warning" ? colors.warningSoft : colors.lineSoft} />
            <T variant="small">{entry.time}</T>
          </Row>
          <T variant="body" style={{ marginTop: 6, fontSize: 14 }} numberOfLines={openKey === entryKey(entry) ? undefined : 3}>{entry.message}</T>
          {entry.details ? (openKey === entryKey(entry) ? <Text selectable style={styles.command}>{entry.details}</Text> : <T variant="small" color={colors.tealDark} style={{ marginTop: 4 }}>Tap for details</T>) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  command: { marginTop: 6, borderRadius: radius.sm, padding: 10, overflow: "hidden", color: "#e8f1ec", backgroundColor: colors.emerald, fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }), fontSize: 12 },
  meter: { height: 10, marginTop: 10, borderRadius: 5, overflow: "hidden", backgroundColor: colors.lineSoft },
  meterFill: { height: "100%", borderRadius: 5 },
  bar: { height: 6, marginTop: 4, borderRadius: 3, overflow: "hidden", backgroundColor: colors.lineSoft },
  barFill: { height: "100%", borderRadius: 3, backgroundColor: colors.tealDark },
  slow: { borderColor: colors.danger, borderWidth: 1 },
  tip: { marginTop: 8, borderRadius: radius.sm, padding: 8, backgroundColor: colors.warningSoft, fontFamily: fonts.body },
  entry: { marginBottom: 10, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.lg, padding: 12, backgroundColor: colors.white },
});
