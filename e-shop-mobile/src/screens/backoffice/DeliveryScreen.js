import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import PagedList from "@/components/PagedList";
import { Button, Card, EmptyState, Notice, Pill, Row, Segmented, SelectField, T, TextField } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { confirmAction } from "@/lib/confirm";
import { colors, fonts, radius } from "@/theme";

const DAY_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7].map((day) => ({ value: String(day), label: day === 0 ? "Same day" : `${day} day${day === 1 ? "" : "s"}` }));
const EXTRA_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7].map((day) => ({ value: String(day), label: day === 0 ? "None" : `+${day} day${day === 1 ? "" : "s"}` }));
const ZONES = { local: "Same city", state: "Same state", regional: "Nearby state", national: "Across India", remote: "Hard-to-reach area" };
const digits = (text) => text.replace(/\D/g, "").slice(0, 6);

/**
 * Admin: where we deliver (everywhere in India apart from blocked areas, or only the areas listed), the PIN codes on
 * the list, Elitezaar's own dispatch PIN code and packing time, and a PIN code checker — as on the website.
 */
export default function DeliveryScreen() {
  const { request } = useAuth();
  const [meta, setMeta] = useState(null);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  // Bumped after a change, so the list reloads.
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((current) => current + 1);

  return (
    <>
      <PagedList
        deps={[search, version]}
        fetchPage={async (page) => {
          const result = await request("/admin/delivery", { query: { search, page } });
          setMeta({ settings: result.settings, counts: result.counts });
          return result;
        }}
        header={(
          <View>
            <T variant="body" style={{ marginBottom: 12 }}>Choose the PIN codes we deliver to. Shoppers check theirs on each product, with an estimate from where it ships, and checkout refuses addresses we don’t deliver to.</T>
            {meta ? <SettingsCard settings={meta.settings} counts={meta.counts} onSaved={reload} /> : null}
            <CheckCard />
            <AddCard onAdded={reload} />
            <T variant="h3" style={{ marginTop: 22 }}>The list</T>
            <T variant="small" style={{ marginBottom: 10 }}>{meta?.counts.all ? `${meta.counts.deliverable} we deliver to · ${meta.counts.blocked} we don’t. The most specific entry wins.` : "Nothing listed yet."}</T>
            <View style={styles.search}>
              <Ionicons name="search" size={18} color={colors.muted} />
              <TextInput value={searchDraft} onChangeText={setSearchDraft} onSubmitEditing={() => setSearch(searchDraft.trim())} placeholder="PIN code or name" placeholderTextColor={colors.faint} returnKeyType="search" style={styles.searchInput} />
              {searchDraft ? <Pressable onPress={() => { setSearchDraft(""); setSearch(""); }} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.faint} /></Pressable> : null}
            </View>
          </View>
        )}
        renderItem={(area) => (
          <Pressable onPress={() => setEditing(area)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
            <View style={{ flex: 1 }}>
              <T variant="title" color={area.deliverable ? colors.text : colors.danger} style={{ letterSpacing: 1 }}>{area.pincode}</T>
              <T variant="small">{area.is_prefix ? `Every PIN code starting ${area.pincode}` : "One PIN code"}{area.region ? ` · ${area.region}` : ""}</T>
              {area.name ? <T variant="small" color={colors.body}>{area.name}</T> : null}
            </View>
            {area.deliverable
              ? <Pill label={`We deliver${area.extra_days ? ` · +${area.extra_days}d` : ""}`} color={colors.success} background={colors.successSoft} />
              : <Pill label="We don’t deliver" color={colors.danger} background={colors.dangerSoft} />}
          </Pressable>
        )}
        empty={<EmptyState icon="location-outline" title={search ? "Nothing matches" : "Nothing listed yet"} message={search ? undefined : "Add PIN codes above."} />}
      />
      {editing ? <EditSheet area={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} /> : null}
    </>
  );
}

function SettingsCard({ settings, counts, onSaved }) {
  const { request } = useAuth();
  const toast = useToast();
  const [values, setValues] = useState({ mode: settings.mode, store_pincode: settings.store_pincode || "", dispatch_days: String(settings.dispatch_days) });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const result = await request("/admin/delivery/settings", { method: "PUT", body: { ...values, store_pincode: values.store_pincode || null, dispatch_days: Number(values.dispatch_days) } });
      toast(result.message);
      onSaved();
    } catch (saveError) {
      setErrors(saveError.fieldErrors || {});
      toast(saveError.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <T variant="h3">Where we deliver</T>
      <T variant="small" style={{ marginBottom: 10 }}>Applies to Indian addresses.</T>
      <Segmented options={[{ value: "all", label: "Everywhere" }, { value: "listed", label: "Only listed" }]} value={values.mode} onChange={(mode) => setValues({ ...values, mode })} />
      <T variant="small" style={{ marginTop: 8, marginBottom: 12 }}>
        {values.mode === "all"
          ? (counts.blocked ? `Every Indian PIN code except the ${counts.blocked} ${counts.blocked === 1 ? "entry" : "entries"} marked “we don’t deliver”.` : "Every Indian PIN code, unless you mark one “we don’t deliver”.")
          : `Just the ${counts.deliverable} ${counts.deliverable === 1 ? "entry" : "entries"} marked “we deliver”; every other address is refused.`}
      </T>
      {errors.mode ? <Notice tone="error" message={errors.mode} style={{ marginBottom: 12 }} /> : null}
      <TextField label="Elitezaar dispatches from" keyboardType="number-pad" maxLength={6} placeholder="PIN code" hint={`${settings.store_region ? `${settings.store_region}. ` : ""}For Elitezaar’s own products; sellers’ ship from their pickup PIN code.`} value={values.store_pincode} onChangeText={(text) => setValues({ ...values, store_pincode: digits(text) })} error={errors.store_pincode} />
      <SelectField label="Days to pack and hand over" value={values.dispatch_days} options={DAY_OPTIONS} onChange={(dispatch_days) => setValues({ ...values, dispatch_days })} />
      <Button title="Save" icon="checkmark" loading={saving} onPress={save} />
    </Card>
  );
}

function CheckCard() {
  const { request } = useAuth();
  const [pincode, setPincode] = useState("");
  const [from, setFrom] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    setError("");
    setResult(null);
    try {
      setResult(await request("/admin/delivery/check", { query: { pincode, from: from || undefined } }));
    } catch (checkError) {
      setError(Object.values(checkError.fieldErrors || {})[0] || checkError.message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card style={{ marginTop: 14 }}>
      <T variant="h3">Check a PIN code</T>
      <T variant="small" style={{ marginBottom: 10 }}>What shoppers there see, from a pickup PIN code (or Elitezaar’s).</T>
      <Row gap={10}>
        <TextField label="Deliver to" keyboardType="number-pad" maxLength={6} value={pincode} onChangeText={(text) => setPincode(digits(text))} style={{ flex: 1 }} />
        <TextField label="Ships from" keyboardType="number-pad" maxLength={6} placeholder="Optional" value={from} onChangeText={(text) => setFrom(digits(text))} style={{ flex: 1 }} />
      </Row>
      <Button title="Check" icon="search" variant="outline" loading={checking} disabled={pincode.length !== 6} onPress={check} />
      {error ? <T variant="small" color={colors.danger} style={{ marginTop: 8 }}>{error}</T> : null}
      {result ? (
        <Notice
          tone={result.deliverable ? "success" : "error"}
          title={result.deliverable ? `${result.label} · ${result.days.min === result.days.max ? result.days.max : `${result.days.min}–${result.days.max}`} days` : undefined}
          message={result.deliverable
            ? `${result.from ? `${result.from} → ` : ""}${result.to}${result.distance_km ? ` · about ${result.distance_km.toLocaleString("en-IN")} km` : ""} · ${ZONES[result.zone] || result.zone}${result.area ? ` · matches ${result.area}` : ""}`
            : result.message}
          style={{ marginTop: 12 }}
        />
      ) : null}
    </Card>
  );
}

function AddCard({ onAdded }) {
  const { request } = useAuth();
  const toast = useToast();
  const [values, setValues] = useState({ pincodes: "", name: "", deliverable: true, extra_days: "0" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    setSaving(true);
    setError("");
    try {
      const result = await request("/admin/delivery/areas", { method: "POST", body: { ...values, extra_days: Number(values.extra_days) } });
      toast(result.message);
      setValues({ pincodes: "", name: "", deliverable: true, extra_days: "0" });
      onAdded();
    } catch (addError) {
      setError(addError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ marginTop: 14 }}>
      <T variant="h3">Add PIN codes</T>
      <T variant="small" style={{ marginBottom: 10 }}>Full PIN codes, or their first digits for a whole area (302 is Jaipur and around). Separate many with commas.</T>
      <TextField label="PIN codes" multiline keyboardType="numbers-and-punctuation" placeholder="302001, 302016, 3030" value={values.pincodes} onChangeText={(pincodes) => setValues({ ...values, pincodes })} error={error || undefined} />
      <TextField label="Name (optional)" maxLength={80} placeholder="e.g. Jaipur city" value={values.name} onChangeText={(name) => setValues({ ...values, name })} />
      <Segmented options={[{ value: "yes", label: "We deliver" }, { value: "no", label: "We don’t deliver" }]} value={values.deliverable ? "yes" : "no"} onChange={(choice) => setValues({ ...values, deliverable: choice === "yes", extra_days: choice === "yes" ? values.extra_days : "0" })} style={{ marginBottom: 12 }} />
      {values.deliverable ? <SelectField label="Extra days (for places couriers reach slowly)" value={values.extra_days} options={EXTRA_OPTIONS} onChange={(extra_days) => setValues({ ...values, extra_days })} /> : null}
      <Button title="Add to the list" icon="add" loading={saving} disabled={!values.pincodes.trim()} onPress={add} />
    </Card>
  );
}

/** Mounted only while editing, so its fields start from the chosen entry. */
function EditSheet({ area, onClose, onSaved }) {
  const { request } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [values, setValues] = useState({ name: area.name || "", deliverable: area.deliverable, extra_days: String(area.extra_days) });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      toast((await request(`/admin/delivery/areas/${area.id}`, { method: "PUT", body: { ...values, extra_days: Number(values.extra_days) } })).message);
      onSaved();
    } catch (saveError) {
      toast(saveError.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = () => confirmAction({
    title: `Remove ${area.pincode}?`,
    message: "It comes off the list; the delivery setting decides for it from then on.",
    confirmLabel: "Remove",
    onConfirm: async () => {
      try {
        toast((await request(`/admin/delivery/areas/${area.id}`, { method: "DELETE" })).message);
        onSaved();
      } catch (removeError) {
        toast(removeError.message, "error");
      }
    },
  });

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />
        <ScrollView keyboardShouldPersistTaps="handled">
          <T variant="h2">{area.pincode}</T>
          <T variant="small" style={{ marginBottom: 14 }}>{area.is_prefix ? `Every PIN code starting ${area.pincode}` : "One PIN code"}{area.region ? ` · ${area.region}` : ""}</T>
          <TextField label="Name" maxLength={80} value={values.name} onChangeText={(name) => setValues({ ...values, name })} />
          <Segmented options={[{ value: "yes", label: "We deliver" }, { value: "no", label: "We don’t deliver" }]} value={values.deliverable ? "yes" : "no"} onChange={(choice) => setValues({ ...values, deliverable: choice === "yes", extra_days: choice === "yes" ? values.extra_days : "0" })} style={{ marginBottom: 12 }} />
          {values.deliverable ? <SelectField label="Extra days" value={values.extra_days} options={EXTRA_OPTIONS} onChange={(extra_days) => setValues({ ...values, extra_days })} /> : null}
          <Row gap={10}>
            <Button title="Remove" icon="trash-outline" variant="danger" block={false} onPress={remove} />
            <View style={{ flex: 1 }}><Button title="Save" icon="checkmark" loading={saving} onPress={save} /></View>
          </Row>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: "row", alignItems: "center", gap: 10, height: 48, marginBottom: 12, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 16, backgroundColor: colors.white },
  searchInput: { flex: 1, height: "100%", color: colors.text, fontFamily: fonts.bodySemi, fontSize: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.lg, padding: 14, backgroundColor: colors.white },
  backdrop: { flex: 1, backgroundColor: "rgba(10,31,25,0.45)" },
  sheet: { maxHeight: "90%", borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 10, backgroundColor: colors.white },
  handle: { width: 42, height: 5, alignSelf: "center", marginBottom: 14, borderRadius: 3, backgroundColor: colors.line },
});
