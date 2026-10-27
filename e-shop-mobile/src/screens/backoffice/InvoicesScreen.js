import React, { useState } from "react";
import { Linking, Pressable, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import Ionicons from "@expo/vector-icons/Ionicons";
import PagedList from "@/components/PagedList";
import { Button, Card, Chip, EmptyState, Pill, Row, T } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { SITE_URL } from "@/lib/config";
import { formatDate, formatPrice } from "@/lib/format";
import { colors, fonts, radius } from "@/theme";

const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const monthLabel = (key) => new Date(`${key}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
const shiftMonth = (key, by) => {
  const date = new Date(`${key}-01T00:00:00`);
  date.setMonth(date.getMonth() + by);
  return monthKey(date);
};

/**
 * Invoices for a month, with GST totals and the report for filing (opened in the browser as a spreadsheet).
 * Admins see every invoice, sellers their own.
 */
export default function InvoicesScreen({ portal }) {
  const { request } = useAuth();
  const toast = useToast();
  const isAdmin = portal === "admin";
  const thisMonth = monthKey(new Date());
  const [month, setMonth] = useState(thisMonth);
  const [supplier, setSupplier] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [totals, setTotals] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    setDownloading(true);
    try {
      const { url } = await request(`/${isAdmin ? "admin" : "vendor"}/gst/report-link`, { query: { month, vendor_id: supplier || undefined } });
      await Linking.openURL(`${SITE_URL}${url}`);
    } catch (downloadError) {
      toast(downloadError.message, "error");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <PagedList
      deps={[month, supplier, search]}
      fetchPage={async (page) => {
        const result = await request("/invoices", { query: { month, search, vendor_id: supplier || undefined, page } });
        setTotals(result.totals);
        return result;
      }}
      header={(
        <View>
          <T variant="body" style={{ marginBottom: 8 }}>Invoices are issued automatically when an order ships: one per seller, and one from Elitezaar for its own products and delivery.</T>
          <Pressable onPress={() => router.push(isAdmin ? "/admin/gst" : "/vendor/business")} hitSlop={6} style={{ alignSelf: "flex-start", marginBottom: 12 }}>
            <T variant="strong" color={colors.tealDark} style={{ fontSize: 14 }}>{isAdmin ? "GST settings →" : "Business & GST details →"}</T>
          </Pressable>
          <Row style={styles.month}>
            <Pressable onPress={() => setMonth(shiftMonth(month, -1))} hitSlop={10} accessibilityLabel="Previous month"><Ionicons name="chevron-back" size={22} color={colors.emerald} /></Pressable>
            <T variant="h3" style={{ flex: 1, textAlign: "center" }}>{monthLabel(month)}</T>
            <Pressable onPress={() => setMonth(shiftMonth(month, 1))} disabled={month >= thisMonth} hitSlop={10} accessibilityLabel="Next month">
              <Ionicons name="chevron-forward" size={22} color={month >= thisMonth ? colors.faint : colors.emerald} />
            </Pressable>
          </Row>
          {isAdmin ? (
            <Row gap={8} style={{ marginBottom: 10 }}>
              <Chip label="Everyone" active={!supplier} onPress={() => setSupplier("")} />
              <Chip label="Elitezaar only" active={supplier === "store"} onPress={() => setSupplier("store")} />
            </Row>
          ) : null}
          <View style={styles.search}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput value={searchDraft} onChangeText={setSearchDraft} onSubmitEditing={() => setSearch(searchDraft.trim())} placeholder="Invoice or order number" placeholderTextColor={colors.faint} returnKeyType="search" autoCapitalize="characters" style={styles.searchInput} />
            {searchDraft ? <Pressable onPress={() => { setSearchDraft(""); setSearch(""); }} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.faint} /></Pressable> : null}
          </View>
          {totals ? (
            <Card style={{ marginTop: 12 }}>
              <T variant="label">GST on issued invoices</T>
              <View style={styles.totals}>
                {[["Taxable value", totals.taxable], ["CGST", totals.cgst], ["SGST", totals.sgst], ["IGST", totals.igst]].map(([label, value]) => (
                  <View key={label} style={styles.total}><T variant="small">{label}</T><T variant="strong">{formatPrice(value)}</T></View>
                ))}
              </View>
              <Row justify="space-between" style={styles.grand}><T variant="strong">Invoiced (incl. GST)</T><T variant="h3">{formatPrice(totals.grand)}</T></Row>
            </Card>
          ) : null}
          <Button title="Download GST report (spreadsheet)" icon="download-outline" variant="outline" loading={downloading} onPress={download} style={{ marginTop: 12 }} />
          <T variant="small" style={{ marginTop: 6, marginBottom: 14 }}>Every invoice line for {monthLabel(month)}, as a CSV file for your GST return. It opens in your browser.</T>
        </View>
      )}
      renderItem={(invoice) => (
        <Pressable onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}${invoice.print_url}`)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}>
          <Row justify="space-between" align="flex-start">
            <View style={{ flex: 1 }}>
              <T variant="title">{invoice.number}</T>
              <T variant="small">{invoice.type === "tax_invoice" ? "Tax invoice" : "Bill of supply"} · {formatDate(invoice.issued_at)}</T>
            </View>
            {invoice.status === "cancelled"
              ? <Pill label="Cancelled" color={colors.danger} background={colors.dangerSoft} />
              : <Pill label="Issued" color={colors.success} background={colors.successSoft} />}
          </Row>
          <T variant="small" style={{ marginTop: 6 }}>{isAdmin ? invoice.supplier_name : invoice.buyer_name}{invoice.order_id ? ` · order #${invoice.order_id}` : ""}</T>
          <Row justify="space-between" style={{ marginTop: 8 }}>
            <T variant="small">GST {formatPrice(invoice.tax_total)}</T>
            <T variant="strong">{formatPrice(invoice.grand_total)}</T>
          </Row>
          {invoice.order_id ? (
            <Pressable onPress={() => router.push(`/${isAdmin ? "admin" : "vendor"}/order/${invoice.order_id}`)} hitSlop={6} style={{ marginTop: 8, alignSelf: "flex-start" }}>
              <T variant="strong" color={colors.tealDark} style={{ fontSize: 14 }}>Open order #{invoice.order_id} →</T>
            </Pressable>
          ) : null}
        </Pressable>
      )}
      empty={<EmptyState icon="document-text-outline" title="No invoices this month" message="They’re issued when orders ship." />}
    />
  );
}

const styles = StyleSheet.create({
  month: { marginBottom: 12, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.white },
  search: { flexDirection: "row", alignItems: "center", gap: 10, height: 48, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 16, backgroundColor: colors.white },
  searchInput: { flex: 1, height: "100%", color: colors.text, fontFamily: fonts.bodySemi, fontSize: 16 },
  totals: { flexDirection: "row", flexWrap: "wrap", marginTop: 8 },
  total: { width: "50%", paddingVertical: 6 },
  grand: { marginTop: 6, borderTopWidth: 1, borderTopColor: colors.lineSoft, paddingTop: 10 },
  row: { marginBottom: 10, borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.lg, padding: 14, backgroundColor: colors.white },
});
