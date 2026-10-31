import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Linking, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card, Loader, Notice, Pill, Row, SelectField, SwitchRow, T, TextField } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { SITE_URL } from "@/lib/config";
import { confirmAction } from "@/lib/confirm";
import { timeAgo } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { colors, fonts, radius } from "@/theme";
import { Command, formatBytes } from "./ServerTabs";

const TYPES = { manual: "Manual", automatic: "Automatic", safety: "Safety copy" };
const POLL_MS = 2000;
const HOURS = Array.from({ length: 24 }, (_, hour) => ({ value: hour, label: `${hour % 12 || 12}:00 ${hour < 12 ? "am" : "pm"}` }));
const KEEP = [7, 14, 30, 60].map((count) => ({ value: count, label: `${count} backups` }));

const formatWhen = (value) => new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

/** Asks for the admin's password before a backup leaves the server or replaces the database. */
function ConfirmSheet({ action, backup, onClose, onDone }) {
  const { request } = useAuth();
  const insets = useSafeAreaInsets();
  const restoring = action === "restore";
  const [password, setPassword] = useState("");
  const [word, setWord] = useState("");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [changes, setChanges] = useState(null);

  useEffect(() => {
    if (!restoring) return;
    request(`/admin/server/backups/${backup.id}/restore-check`).then((data) => setChanges(data.changes)).catch(() => setChanges(false));
  }, [backup.id, request, restoring]);

  const submit = async () => {
    setBusy(true);
    setErrors({});
    try {
      const body = restoring ? { password, confirm: word } : { password };
      onDone(await request(`/admin/server/backups/${backup.id}/${restoring ? "restore" : "download-link"}`, { method: "POST", body }));
    } catch (requestError) {
      setErrors(Object.keys(requestError.fieldErrors || {}).length ? requestError.fieldErrors : { form: requestError.message });
      setBusy(false);
    }
  };

  const lost = changes ? [["order", changes.orders], ["customer account", changes.customers], ["product", changes.products]]
    .filter(([, count]) => count > 0).map(([label, count]) => `${count} ${label}${count === 1 ? "" : "s"}`) : [];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={busy ? undefined : onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <T variant="h2" style={{ marginBottom: 10 }}>{restoring ? "Restore this backup?" : "Download this backup"}</T>
            {restoring ? (
              <>
                <T style={styles.line}>The whole database goes back to how it was on {formatWhen(backup.started_at)}.</T>
                {changes === null ? <T variant="small" style={styles.line}>Checking what’s changed since then…</T> : null}
                {lost.length ? <Notice tone="warning" message={`${lost.join(", ")} added since then will be removed.`} style={styles.line} /> : null}
                {changes && !lost.length ? <T style={styles.line}>No orders, customers or products have been added since then.</T> : null}
                <T variant="small" style={styles.line}>The store goes offline for shoppers while this runs. A safety copy is saved first, and goes back automatically if anything fails. Anyone who signed in after this backup, maybe you, will have to sign in again.</T>
                <TextField label="Type RESTORE to confirm" value={word} onChangeText={setWord} autoCapitalize="characters" autoCorrect={false} error={errors.confirm} />
              </>
            ) : <T style={styles.line}>This file holds every customer’s details and all your store’s data, so keep it somewhere private.</T>}
            <TextField label="Your admin password" value={password} onChangeText={setPassword} secure autoCapitalize="none" error={errors.password} />
            {errors.form || errors.backup ? <T variant="small" color={colors.danger} style={styles.line}>{errors.form || errors.backup}</T> : null}
            <Row gap={10}>
              <View style={styles.flex}><Button title="Cancel" variant="outline" disabled={busy} onPress={onClose} /></View>
              <View style={styles.flex}><Button title={restoring ? "Restore" : "Download"} variant={restoring ? "danger" : "primary"} loading={busy} disabled={!password || (restoring && (!word || changes === null))} onPress={submit} /></View>
            </Row>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function BackupCard({ backup, working, onAsk, onDelete }) {
  const failed = backup.status === "failed";
  const running = backup.status === "running";
  return (
    <Card style={{ marginBottom: 10 }}>
      <Row justify="space-between" style={{ marginBottom: 4 }}>
        <T variant="title" style={styles.flex}>{formatWhen(backup.started_at)}</T>
        <Pill label={failed ? "Failed" : running ? "Working…" : TYPES[backup.trigger]} color={failed ? colors.danger : running ? colors.warning : colors.emerald} background={failed ? colors.dangerSoft : running ? colors.warningSoft : colors.mint} />
      </Row>
      <T variant="small">{[backup.status === "ready" ? formatBytes(backup.size) : null, backup.by ? `by ${backup.by}` : "Scheduled", backup.downloaded_at ? `downloaded ${timeAgo(backup.downloaded_at)}` : null].filter(Boolean).join(" · ")}</T>
      {failed ? <T variant="small" color={colors.danger} style={{ marginTop: 4 }}>{backup.error}</T> : null}
      {running ? null : (
        <Row gap={8} style={{ marginTop: 10 }}>
          {backup.status === "ready" ? (
            <>
              <View style={styles.flex}><Button title="Download" variant="outline" small disabled={working} onPress={() => onAsk({ action: "download", backup })} /></View>
              <View style={styles.flex}><Button title="Restore" variant="outline" small disabled={working} onPress={() => onAsk({ action: "restore", backup })} /></View>
            </>
          ) : null}
          <View style={styles.flex}><Button title="Delete" variant="danger" small disabled={working} onPress={() => onDelete(backup)} /></View>
        </Row>
      )}
    </Card>
  );
}

function AutomaticCard({ settings, onSaved }) {
  const { request } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      toast((await request("/admin/server/backups/settings", { method: "PUT", body: form })).message);
      onSaved();
    } catch (saveError) {
      toast(saveError.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ marginBottom: 14 }}>
      <T variant="h3" style={{ marginBottom: 4 }}>Automatic backups</T>
      <T variant="small" style={{ marginBottom: 8 }}>One a day, India time. Older automatic backups are deleted to save space; manual backups and safety copies stay until you delete them.</T>
      <SwitchRow label="Back up every day" value={form.enabled} onValueChange={(enabled) => setForm({ ...form, enabled })} />
      {form.enabled ? (
        <>
          <SelectField label="Time" value={form.hour} options={HOURS} onChange={(hour) => setForm({ ...form, hour })} />
          <SelectField label="Keep the latest" value={form.keep} options={KEEP} onChange={(keep) => setForm({ ...form, keep })} />
        </>
      ) : null}
      <Button title="Save" variant="outline" small loading={saving} onPress={save} />
    </Card>
  );
}

/** Copies of the database, the same as the website's Backups tab. */
export default function BackupsPanel() {
  const { request } = useAuth();
  const toast = useToast();
  const { data, setData, error, reload } = useLoad(() => request("/admin/server/backups"), [request]);
  const [restoring, setRestoring] = useState(false);
  const [starting, setStarting] = useState(false);
  const [asking, setAsking] = useState(null);

  const working = restoring || data?.working;
  useEffect(() => {
    if (!working) return undefined;
    const timer = setInterval(async () => {
      try {
        const next = await request("/admin/server/backups");
        setData(next);
        if (restoring && next.restore?.status !== "running") {
          const done = next.restore?.status === "done";
          setRestoring(false);
          toast(done ? "The database has been restored." : "The restore failed. See the details below.", done ? undefined : "error");
        }
      } catch {
        // The store answers 503 while a restore runs; the next try will get through.
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [working, restoring, request, setData, toast]);

  const backUp = async () => {
    setStarting(true);
    try {
      await request("/admin/server/backups", { method: "POST" });
      await reload();
    } catch (backupError) {
      toast(backupError.message, "error");
    } finally {
      setStarting(false);
    }
  };

  const remove = (backup) => confirmAction({
    title: "Delete this backup?",
    message: `The one from ${formatWhen(backup.started_at)}. This can’t be undone.`,
    onConfirm: async () => {
      try {
        toast((await request(`/admin/server/backups/${backup.id}`, { method: "DELETE" })).message);
        reload();
      } catch (deleteError) {
        toast(deleteError.message, "error");
      }
    },
  });

  const finish = (result) => {
    if (asking.action === "restore") {
      setRestoring(true);
    } else {
      // The phone's browser, so the file lands in its downloads.
      Linking.openURL(`${SITE_URL}${result.url}`);
      setTimeout(reload, 1500);
    }
    setAsking(null);
  };

  if (restoring) {
    return <Notice tone="warning" title="Restoring the database…" message="The store is offline for shoppers until this finishes. This screen updates by itself." />;
  }
  if (!data) return error ? <Notice tone="error" message={error} /> : <Loader label="Loading backups…" />;

  const { problem, install_command: install, backups, settings, restore } = data;

  return (
    <>
      {problem ? (
        <Notice tone="warning" title="Backups can’t run yet" message={problem} style={{ marginBottom: 14 }}>
          {install ? <Command command={install} note="Run this on the server, then come back here." /> : null}
        </Notice>
      ) : null}

      {restore && restore.status !== "running" ? (
        <Notice tone={restore.status === "done" ? "success" : "error"} style={{ marginBottom: 14 }}
          title={restore.status === "done" ? `Restored the backup from ${formatWhen(restore.backup_taken_at)}` : "The last restore failed"}
          message={restore.status === "done" ? `${timeAgo(restore.finished_at)}${restore.by ? `, by ${restore.by}` : ""}.${restore.safety_copy ? " The database as it was is kept as a safety copy below." : ""}` : restore.error} />
      ) : null}

      <Card style={{ marginBottom: 14 }}>
        <T variant="h3" style={{ marginBottom: 4 }}>Database backups</T>
        <T variant="small" style={{ marginBottom: 10 }}>{backups.length ? `${backups.length} ${backups.length === 1 ? "backup" : "backups"}, using ${formatBytes(data.total_size)}.` : "No backups yet."}</T>
        <View style={styles.fact}><T variant="small">Latest backup</T><T variant="title">{timeAgo(data.last_ready_at)}</T></View>
        <View style={styles.fact}><T variant="small">Next automatic</T><T variant="title">{data.next_automatic_at ? formatWhen(data.next_automatic_at) : "Switched off"}</T></View>
        <View style={styles.fact}><T variant="small">Last copied off the server</T><T variant="title">{timeAgo(data.last_copied_at)}</T></View>
        <T variant="small" style={{ marginVertical: 10 }}>Backups are kept on the server, so they’d be lost with it. Download one every so often and keep it somewhere safe.</T>
        <Button title={data.working || starting ? "Backing up…" : "Back up now"} icon="cloud-upload-outline" loading={starting} disabled={Boolean(problem) || data.working} onPress={backUp} />
      </Card>

      {backups.map((backup) => <BackupCard key={backup.id} backup={backup} working={data.working} onAsk={setAsking} onDelete={remove} />)}

      <AutomaticCard key={JSON.stringify(settings)} settings={settings} onSaved={reload} />

      <Card>
        <T variant="h3" style={{ marginBottom: 4 }}>If the admin panel won’t open</T>
        <T variant="small" style={{ marginBottom: 4 }}>A badly broken database stops everyone signing in. A restore can also be run on the server.</T>
        <Command command={data.restore_command} note="Lists the backups, then restores the one you name. Run it in the e-street-backend folder." />
      </Card>

      {asking ? <ConfirmSheet {...asking} onClose={() => setAsking(null)} onDone={finish} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  line: { marginBottom: 12 },
  fact: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderTopWidth: 1, borderTopColor: colors.lineSoft, paddingVertical: 7 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { maxHeight: "88%", borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: 18, paddingTop: 18, backgroundColor: colors.white, fontFamily: fonts.medium },
});
