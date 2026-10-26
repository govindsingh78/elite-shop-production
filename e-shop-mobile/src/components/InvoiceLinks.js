import React from "react";
import * as WebBrowser from "expo-web-browser";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Card, ListRow, T } from "@/components/ui";
import { SITE_URL } from "@/lib/config";
import { formatPrice } from "@/lib/format";
import { colors } from "@/theme";

/**
 * An order's GST invoices. Each opens its printable page in the browser (signed link, no sign-in needed),
 * where it can be printed or saved as a PDF.
 */
export default function InvoiceLinks({ invoices = [], emptyText, style }) {
  return (
    <Card style={style}>
      <T variant="h3" style={{ marginBottom: 4 }}>Invoices</T>
      {invoices.length ? invoices.map((invoice, index) => (
        <ListRow
          key={invoice.id}
          icon="document-text-outline"
          title={`${invoice.status === "cancelled" ? "Cancelled · " : ""}${invoice.number}`}
          subtitle={`${invoice.supplier_name} · ${invoice.type === "tax_invoice" ? `GST ${formatPrice(invoice.tax_total)}` : "Bill of supply"}`}
          right={<Ionicons name="open-outline" size={18} color={colors.muted} />}
          onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}${invoice.print_url}`)}
          last={index === invoices.length - 1}
        />
      )) : <T variant="small">{emptyText || "Your GST invoice will be here once the order ships."}</T>}
    </Card>
  );
}
