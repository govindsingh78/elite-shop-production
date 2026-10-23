import React, { useRef, useState } from "react";
import {
  ActivityIndicator, FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView,
  StyleSheet, Switch, Text, TextInput, View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, fonts, radius, shadow } from "@/theme";

/* ---------- Text ---------- */
const VARIANTS = {
  display: { fontFamily: fonts.display, fontSize: 32, lineHeight: 35, letterSpacing: -1, color: colors.ink },
  h1: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30, letterSpacing: -0.7, color: colors.ink },
  h2: { fontFamily: fonts.heading, fontSize: 21, lineHeight: 26, letterSpacing: -0.4, color: colors.ink },
  h3: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 22, letterSpacing: -0.2, color: colors.text },
  title: { fontFamily: fonts.semi, fontSize: 15.5, lineHeight: 20, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.body },
  strong: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 22, color: colors.text },
  small: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.muted },
  label: { fontFamily: fonts.bodyBold, fontSize: 11.5, lineHeight: 15, letterSpacing: 1.6, textTransform: "uppercase", color: colors.muted },
  eyebrow: { fontFamily: fonts.bodyBold, fontSize: 11.5, lineHeight: 15, letterSpacing: 2.2, textTransform: "uppercase", color: colors.goldDeep },
  price: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 22, color: colors.ink },
};

export function T({ variant = "body", color, center, style, children, ...props }) {
  return <Text style={[VARIANTS[variant], color && { color }, center && { textAlign: "center" }, style]} {...props}>{children}</Text>;
}

/* ---------- Layout ---------- */
/**
 * Page container: cream background, padded, scrollable, optional pull-to-refresh.
 * Forms pass `keyboard`, which keeps the focused field scrolled above the keyboard on iOS and Android.
 */
export function Screen({ children, scroll = true, refreshing, onRefresh, safeTop = false, padded = true, footer, contentStyle, keyboard = false }) {
  const insets = useSafeAreaInsets();
  const padding = [padded && styles.padded, safeTop && { paddingTop: insets.top + 8 }, { paddingBottom: (footer ? 16 : insets.bottom + 28) }, contentStyle];
  const ScrollComponent = keyboard ? KeyboardAwareScrollView : ScrollView;
  const body = scroll ? (
    <ScrollComponent
      style={styles.flex}
      contentContainerStyle={padding}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...(keyboard ? { bottomOffset: 24 } : null)}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.emerald} colors={[colors.emerald]} /> : undefined}
    >
      {children}
    </ScrollComponent>
  ) : <View style={[styles.flex, padding]}>{children}</View>;

  return (
    <View style={styles.screen}>
      {body}
      {footer && <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>{footer}</View>}
    </View>
  );
}

export const Gap = ({ size = 12 }) => <View style={{ height: size }} />;
export const Row = ({ children, style, gap = 10, align = "center", justify }) => (
  <View style={[{ flexDirection: "row", alignItems: align, gap }, justify && { justifyContent: justify }, style]}>{children}</View>
);

export function Card({ children, style, onPress, flat }) {
  const content = <View style={[styles.card, !flat && shadow.card, style]}>{children}</View>;
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>{content}</Pressable> : content;
}

export function SectionHeader({ eyebrow, title, actionLabel, onAction, style }) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <View style={styles.flex}>
        {eyebrow ? <T variant="eyebrow">{eyebrow}</T> : null}
        <T variant="h2" style={eyebrow && { marginTop: 4 }}>{title}</T>
      </View>
      {actionLabel ? (
        <Pressable onPress={onAction} hitSlop={10} style={styles.sectionAction}>
          <T variant="strong" color={colors.emerald} style={{ fontSize: 14 }}>{actionLabel}</T>
          <Ionicons name="arrow-forward" size={15} color={colors.emerald} />
        </Pressable>
      ) : null}
    </View>
  );
}

/* ---------- Buttons ---------- */
const BUTTONS = {
  primary: { bg: colors.emerald, fg: colors.white, border: colors.emerald },
  teal: { bg: colors.teal, fg: colors.ink, border: colors.teal },
  gold: { bg: colors.goldLight, fg: colors.ink, border: colors.goldLight },
  outline: { bg: colors.white, fg: colors.emerald, border: colors.line },
  ghost: { bg: "transparent", fg: colors.emerald, border: "transparent" },
  danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
  light: { bg: "rgba(255,255,255,0.14)", fg: colors.white, border: "rgba(255,255,255,0.4)" },
};

export function Button({ title, onPress, variant = "primary", icon, iconRight, loading, disabled, small, style, block = true }) {
  const tone = BUTTONS[variant] || BUTTONS.primary;
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button, small && styles.buttonSmall, !block && { alignSelf: "flex-start" },
        { backgroundColor: tone.bg, borderColor: tone.border },
        variant === "primary" && shadow.card,
        pressed && styles.pressed, inactive && { opacity: 0.55 }, style,
      ]}
    >
      {loading ? <ActivityIndicator color={tone.fg} size="small" /> : icon ? <Ionicons name={icon} size={small ? 16 : 18} color={tone.fg} /> : null}
      <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: tone.fg }]}>{title}</Text>
      {iconRight && !loading ? <Ionicons name={iconRight} size={small ? 16 : 18} color={tone.fg} /> : null}
    </Pressable>
  );
}

export function IconButton({ icon, onPress, color = colors.emerald, background = colors.white, size = 40, badge, label }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityLabel={label} style={({ pressed }) => [styles.iconButton, { width: size, height: size, backgroundColor: background }, pressed && styles.pressed]}>
      <Ionicons name={icon} size={size * 0.48} color={color} />
      {badge ? <View style={styles.badgeDot}><Text style={styles.badgeDotText}>{badge > 99 ? "99+" : badge}</Text></View> : null}
    </Pressable>
  );
}

/* ---------- Form fields ---------- */
export function TextField({ label, error, hint, secure, multiline, style, inputStyle, icon, ...props }) {
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, style]}>
      {label ? <T variant="strong" style={styles.fieldLabel}>{label}</T> : null}
      <View style={[styles.inputWrap, focused && styles.inputFocused, error && styles.inputError, multiline && { alignItems: "flex-start" }]}>
        {icon ? <Ionicons name={icon} size={18} color={colors.muted} style={{ marginLeft: 12, marginTop: multiline ? 14 : 0 }} /> : null}
        <TextInput
          placeholderTextColor={colors.faint}
          secureTextEntry={secure && hidden}
          multiline={multiline}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, multiline && styles.inputMultiline, inputStyle]}
          {...props}
        />
        {secure ? (
          <Pressable onPress={() => setHidden((value) => !value)} hitSlop={8} style={styles.inputAccessory}>
            <T variant="strong" color={colors.tealDark} style={{ fontSize: 13 }}>{hidden ? "Show" : "Hide"}</T>
          </Pressable>
        ) : null}
      </View>
      {error ? <T variant="small" color={colors.danger} style={styles.fieldNote}>{error}</T> : hint ? <T variant="small" style={styles.fieldNote}>{hint}</T> : null}
    </View>
  );
}

/** A tappable field that opens a bottom sheet of options. */
export function SelectField({ label, value, options, onChange, placeholder = "Choose…", error, style, disabled, searchable }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => String(option.value) === String(value));
  return (
    <View style={[styles.field, style]}>
      {label ? <T variant="strong" style={styles.fieldLabel}>{label}</T> : null}
      <Pressable onPress={() => setOpen(true)} disabled={disabled} style={[styles.inputWrap, styles.select, error && styles.inputError, disabled && styles.selectDisabled]}>
        <T variant="body" color={selected ? colors.text : colors.faint} style={styles.flex} numberOfLines={1}>{selected ? selected.label : placeholder}</T>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
      {error ? <T variant="small" color={colors.danger} style={styles.fieldNote}>{error}</T> : null}
      <OptionSheet visible={open} title={label || placeholder} options={options} value={value} searchable={searchable} onClose={() => setOpen(false)} onSelect={(next) => { onChange(next); setOpen(false); }} />
    </View>
  );
}

/** Bottom sheet of options. Long lists (countries, cities) get a search box; options marked `pinned` (e.g. "Not listed") stay at the top. */
export function OptionSheet({ visible, title, options, value, onSelect, onClose, searchable }) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const searchRef = useRef(null);
  const canSearch = searchable ?? options.length > 12;
  const term = query.trim().toLowerCase();
  const matches = options.filter((option) => !option.pinned && (!canSearch || !term || String(option.label).toLowerCase().includes(term)));
  const shown = [...options.filter((option) => option.pinned), ...matches];
  // Let go of the search box before the sheet closes: on Android a Modal closing with a focused input
  // hands focus to the first input on the screen underneath.
  const finish = (done) => {
    searchRef.current?.blur();
    Keyboard.dismiss();
    setQuery("");
    done();
  };
  const close = () => finish(onClose);
  const select = (next) => finish(() => onSelect(next));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      {/* Android too: the app is edge-to-edge, so a Modal is not resized when the keyboard opens. */}
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={close} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.sheetHandle} />
          <T variant="h3" style={{ marginBottom: 8 }}>{title}</T>
          {canSearch ? (
            <View style={styles.sheetSearch}>
              <Ionicons name="search" size={18} color={colors.muted} />
              <TextInput ref={searchRef} value={query} onChangeText={setQuery} placeholder="Search" placeholderTextColor={colors.faint} autoCorrect={false} autoCapitalize="none" returnKeyType="search" style={styles.sheetSearchInput} />
              {query ? <Pressable onPress={() => setQuery("")} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.faint} /></Pressable> : null}
            </View>
          ) : null}
          <FlatList
            data={shown}
            keyExtractor={(option) => String(option.value)}
            style={{ maxHeight: canSearch ? 360 : 420 }}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={24}
            ListFooterComponent={term && !matches.length ? <T variant="small" style={{ padding: 14 }}>{`No matches for “${query.trim()}”.`}</T> : null}
            renderItem={({ item }) => {
              const active = String(item.value) === String(value);
              return (
                <Pressable onPress={() => select(item.value)} style={({ pressed }) => [styles.option, active && styles.optionActive, pressed && styles.pressed]}>
                  <T variant="title" color={active ? colors.emerald : item.pinned ? colors.goldDeep : colors.text} style={styles.flex}>{item.label}</T>
                  {active ? <Ionicons name="checkmark-circle" size={20} color={colors.emerald} /> : null}
                </Pressable>
              );
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function SwitchRow({ label, hint, value, onValueChange }) {
  return (
    <Pressable onPress={() => onValueChange(!value)} style={styles.switchRow}>
      <View style={styles.flex}>
        <T variant="strong">{label}</T>
        {hint ? <T variant="small">{hint}</T> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: colors.teal, false: colors.line }} thumbColor={colors.white} />
    </Pressable>
  );
}

export function Segmented({ options, value, onChange, style }) {
  return (
    <View style={[styles.segmented, style]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable key={option.value} onPress={() => onChange(option.value)} style={[styles.segment, active && styles.segmentActive]}>
            <Text style={[styles.segmentText, active && { color: colors.white }]} numberOfLines={1}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, active, onPress, icon }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}>
      {active ? <View style={styles.chipDot} /> : icon ? <Ionicons name={icon} size={14} color={colors.emerald} /> : null}
      <Text style={[styles.chipText, active && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

export function QuantityStepper({ value, onChange, min = 1, max = 999, compact }) {
  const size = compact ? 32 : 40;
  return (
    <View style={[styles.stepper, { height: size }]}>
      <Pressable onPress={() => onChange(Math.max(min, value - 1))} disabled={value <= min} hitSlop={6} style={[styles.stepperButton, { width: size }, value <= min && { opacity: 0.35 }]}>
        <Ionicons name="remove" size={compact ? 16 : 18} color={colors.emerald} />
      </Pressable>
      <Text style={[styles.stepperValue, compact && { fontSize: 15, minWidth: 24 }]}>{value}</Text>
      <Pressable onPress={() => onChange(Math.min(max, value + 1))} disabled={value >= max} hitSlop={6} style={[styles.stepperButton, { width: size }, value >= max && { opacity: 0.35 }]}>
        <Ionicons name="add" size={compact ? 16 : 18} color={colors.emerald} />
      </Pressable>
    </View>
  );
}

/* ---------- Feedback ---------- */
export function Pill({ label, color = colors.emerald, background = colors.mint, style }) {
  return (
    <View style={[styles.pill, { backgroundColor: background }, style]}>
      <View style={[styles.pillDot, { backgroundColor: color }]} />
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

const NOTICE_TONES = {
  info: { icon: "information-circle", color: colors.tealDark, background: colors.tealSoft },
  error: { icon: "alert-circle", color: colors.danger, background: colors.dangerSoft },
  success: { icon: "checkmark-circle", color: colors.success, background: colors.successSoft },
  warning: { icon: "warning", color: colors.warning, background: colors.warningSoft },
};

export function Notice({ tone = "info", title, message, style, children }) {
  const config = NOTICE_TONES[tone];
  return (
    <View style={[styles.notice, { backgroundColor: config.background }, style]}>
      <Ionicons name={config.icon} size={20} color={config.color} style={{ marginTop: 1 }} />
      <View style={styles.flex}>
        {title ? <T variant="strong" color={config.color}>{title}</T> : null}
        {message ? <T variant="body" color={colors.text} style={{ fontSize: 15 }}>{message}</T> : null}
        {children}
      </View>
    </View>
  );
}

export function Loader({ label }) {
  return (
    <View style={styles.loader}>
      <ActivityIndicator color={colors.emerald} size="large" />
      {label ? <T variant="small" style={{ marginTop: 10 }}>{label}</T> : null}
    </View>
  );
}

export function EmptyState({ icon = "sparkles-outline", title, message, actionLabel, onAction }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Ionicons name={icon} size={30} color={colors.white} /></View>
      <T variant="h2" center>{title}</T>
      {message ? <T variant="body" center style={{ marginTop: 6, maxWidth: 300 }}>{message}</T> : null}
      {actionLabel ? <Button title={actionLabel} onPress={onAction} block={false} style={{ marginTop: 18, alignSelf: "center" }} /> : null}
    </View>
  );
}

/* ---------- Lists & data ---------- */
export function ListRow({ icon, title, subtitle, onPress, right, danger, last }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.listRow, !last && styles.listRowBorder, pressed && styles.pressed]}>
      {icon ? (
        <View style={[styles.listIcon, danger && { backgroundColor: colors.dangerSoft }]}>
          <Ionicons name={icon} size={19} color={danger ? colors.danger : colors.emerald} />
        </View>
      ) : null}
      <View style={styles.flex}>
        <T variant="title" color={danger ? colors.danger : colors.text}>{title}</T>
        {subtitle ? <T variant="small" numberOfLines={2}>{subtitle}</T> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.faint} /> : null)}
    </Pressable>
  );
}

export function Stat({ label, value, icon, tone = "emerald", style }) {
  const palette = {
    emerald: [colors.mint, colors.emerald],
    gold: [colors.goldSoft, colors.goldDeep],
    teal: [colors.tealSoft, colors.tealDark],
    danger: [colors.dangerSoft, colors.danger],
  }[tone];
  return (
    <View style={[styles.stat, style]}>
      <View style={[styles.statIcon, { backgroundColor: palette[0] }]}><Ionicons name={icon} size={18} color={palette[1]} /></View>
      <T variant="h2" style={{ marginTop: 10 }} numberOfLines={1} adjustsFontSizeToFit>{value}</T>
      <T variant="small" numberOfLines={1}>{label}</T>
    </View>
  );
}

export function KeyValue({ label, value, strong, last }) {
  return (
    <View style={[styles.keyValue, !last && styles.listRowBorder]}>
      <T variant="body" style={styles.flex}>{label}</T>
      <T variant={strong ? "price" : "strong"} style={{ textAlign: "right", flexShrink: 1 }}>{value}</T>
    </View>
  );
}

export const Divider = ({ style }) => <View style={[styles.divider, style]} />;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.cream },
  padded: { paddingHorizontal: 16, paddingTop: 14 },
  footer: { borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 16, paddingTop: 12, backgroundColor: colors.white },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  card: { borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.lg, padding: 16, backgroundColor: colors.white },
  sectionHeader: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginBottom: 14 },
  sectionAction: { flexDirection: "row", alignItems: "center", gap: 4, paddingBottom: 3 },
  button: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 18 },
  buttonSmall: { minHeight: 38, borderRadius: radius.sm, paddingHorizontal: 12 },
  buttonText: { fontFamily: fonts.semi, fontSize: 16, letterSpacing: 0.1 },
  iconButton: { alignItems: "center", justifyContent: "center", borderRadius: radius.pill, ...shadow.card },
  badgeDot: { position: "absolute", top: -3, right: -3, minWidth: 19, height: 19, alignItems: "center", justifyContent: "center", borderRadius: 10, paddingHorizontal: 4, backgroundColor: colors.teal },
  badgeDotText: { color: colors.ink, fontFamily: fonts.bodyBold, fontSize: 11 },
  field: { marginBottom: 14 },
  fieldLabel: { marginBottom: 6, fontSize: 15 },
  fieldNote: { marginTop: 5 },
  inputWrap: { minHeight: 50, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.white },
  // Colour-only focus state. Adding shadow props on focus makes Android re-mount the native
  // input, which drops focus and bounces it between fields (keyboard flickers and never opens).
  inputFocused: { borderColor: colors.teal, backgroundColor: "#fbfefe" },
  inputError: { borderColor: colors.danger },
  input: { flex: 1, minHeight: 48, paddingHorizontal: 14, color: colors.text, fontFamily: fonts.bodySemi, fontSize: 16, ...(Platform.OS === "web" ? { outlineStyle: "none" } : null) },
  inputMultiline: { minHeight: 104, paddingTop: 13, paddingBottom: 13, textAlignVertical: "top" },
  inputAccessory: { marginRight: 8, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.tealSoft },
  select: { gap: 8, paddingHorizontal: 14 },
  backdrop: { flex: 1, backgroundColor: "rgba(10,31,25,0.45)" },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 10, backgroundColor: colors.white },
  sheetHandle: { width: 42, height: 5, alignSelf: "center", marginBottom: 14, borderRadius: 3, backgroundColor: colors.line },
  option: { flexDirection: "row", alignItems: "center", borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 14 },
  sheetSearch: { flexDirection: "row", alignItems: "center", gap: 10, height: 46, marginBottom: 8, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 14, backgroundColor: colors.cream },
  sheetSearchInput: { flex: 1, height: "100%", color: colors.text, fontFamily: fonts.bodySemi, fontSize: 16, ...(Platform.OS === "web" ? { outlineStyle: "none" } : null) },
  selectDisabled: { opacity: 0.55 },
  optionActive: { backgroundColor: colors.mint },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, marginBottom: 6 },
  segmented: { flexDirection: "row", borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, padding: 4, backgroundColor: colors.white },
  segment: { flex: 1, alignItems: "center", borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: 6 },
  segmentActive: { backgroundColor: colors.emerald },
  segmentText: { color: colors.text, fontFamily: fonts.semi, fontSize: 14 },
  chip: { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 15, paddingVertical: 8, backgroundColor: colors.white },
  chipActive: { borderColor: colors.emerald, backgroundColor: colors.emerald },
  chipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.goldLight },
  chipText: { color: colors.text, fontFamily: fonts.semi, fontSize: 14 },
  stepper: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, backgroundColor: colors.white },
  stepperButton: { height: "100%", alignItems: "center", justifyContent: "center" },
  stepperValue: { minWidth: 30, textAlign: "center", color: colors.ink, fontFamily: fonts.heading, fontSize: 16 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  notice: { flexDirection: "row", gap: 10, borderRadius: radius.md, padding: 14 },
  loader: { flex: 1, minHeight: 240, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 16 },
  emptyIcon: { width: 70, height: 70, alignItems: "center", justifyContent: "center", marginBottom: 18, borderRadius: 22, backgroundColor: colors.emerald, ...shadow.lifted },
  listRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13 },
  listRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
  listIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.mint },
  stat: { flex: 1, minWidth: 140, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.lg, padding: 14, backgroundColor: colors.white, ...shadow.card },
  statIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 11 },
  keyValue: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  divider: { height: 1, marginVertical: 14, backgroundColor: colors.lineSoft },
});
