<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\User;
use App\Services\Invoices;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\URL;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Invoices: the printable copy, and lists and GST reports for admins, sellers and shoppers. */
class InvoiceController extends Controller
{
    /** The printable invoice. Opened from a signed link, so the app, emails and new tabs need no sign-in. */
    public function print(Invoice $invoice)
    {
        return response()->view('invoices.show', [
            'invoice' => $invoice,
            'words' => Invoices::amountInWords((float) $invoice->grand_total),
        ]);
    }

    /** Admins see every invoice, sellers their own, shoppers those for their orders. Filter by month (YYYY-MM). */
    public function index(Request $request)
    {
        $request->validate([
            'month' => ['nullable', 'date_format:Y-m'],
            'search' => ['nullable', 'string', 'max:60'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);
        $query = $this->filtered($request);
        $issued = (clone $query)->where('status', 'issued');
        $page = $query->orderByDesc('issued_at')->orderByDesc('id')->paginate($request->integer('per_page', 20));

        return response()->json([
            'data' => collect($page->items())->map(fn (Invoice $invoice) => $invoice->summary())->values(),
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'total' => $page->total(),
            // Cancelled invoices keep their numbers but don't count.
            'totals' => [
                'taxable' => round((float) (clone $issued)->sum('taxable_total'), 2),
                'cgst' => round((float) (clone $issued)->sum('cgst_total'), 2),
                'sgst' => round((float) (clone $issued)->sum('sgst_total'), 2),
                'igst' => round((float) (clone $issued)->sum('igst_total'), 2),
                'grand' => round((float) (clone $issued)->sum('grand_total'), 2),
            ],
        ], 200);
    }

    /** Every invoice line of a month as a spreadsheet (CSV), for GST returns. */
    public function report(Request $request): StreamedResponse
    {
        $request->validate(['month' => ['required', 'date_format:Y-m']]);
        $invoices = $this->filtered($request)->orderBy('issued_at')->orderBy('id')->get();
        $columns = ['Invoice number', 'Date', 'Type', 'Status', 'Order', 'Supplier', 'Supplier GSTIN', 'Buyer', 'Buyer GSTIN',
            'Place of supply', 'Description', 'HSN/SAC', 'Quantity', 'GST rate %', 'Taxable value', 'CGST', 'SGST', 'IGST', 'Total'];

        return response()->streamDownload(function () use ($invoices, $columns) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // so Excel reads ₹ and names correctly
            fputcsv($out, $columns);
            foreach ($invoices as $invoice) {
                foreach ($invoice->lines as $line) {
                    fputcsv($out, [
                        $invoice->number, $invoice->issued_at->format('d-m-Y'), $invoice->type === Invoice::TAX_INVOICE ? 'Tax invoice' : 'Bill of supply',
                        $invoice->status, $invoice->order_id, $invoice->supplier['name'] ?? '', $invoice->supplier['gstin'] ?? '',
                        $invoice->buyer['name'] ?? '', $invoice->buyer['gstin'] ?? '',
                        trim(($invoice->place_of_supply ? "{$invoice->place_of_supply}-" : '') . ($invoice->buyer['state'] ?? '')),
                        $line['description'], $line['hsn_code'] ?? '', $line['quantity'], $line['gst_rate'], $line['taxable_value'],
                        $line['cgst'], $line['sgst'], $line['igst'], $line['total'],
                    ]);
                }
            }
            fclose($out);
        }, "elitezaar-gst-{$request->input('month')}.csv", ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * A link to a month's report that works for 10 minutes without signing in, as whoever asked for it: the app opens
     * it in the phone's browser, which can't send the app's sign-in.
     */
    public function reportLink(Request $request)
    {
        $validated = $request->validate(['month' => ['required', 'date_format:Y-m'], 'vendor_id' => ['nullable', 'string', 'max:20']]);
        $url = URL::temporarySignedRoute('invoices.report', now()->addMinutes(10), array_filter([
            'user' => $request->user()->id,
            'month' => $validated['month'],
            'vendor_id' => $validated['vendor_id'] ?? null,
        ]), absolute: false);

        return response()->json(['url' => $url]);
    }

    /** The report from a link made by reportLink(), for the user it was made for. */
    public function signedReport(Request $request, User $user): StreamedResponse
    {
        $request->setUserResolver(fn () => $user);

        return $this->report($request);
    }

    private function filtered(Request $request)
    {
        $user = $request->user();
        $query = Invoice::query();
        if ($user->hasAdminRole() && User::isApprovedAdminEmail($user->email)) {
            // Admins can narrow to the store's own invoices ("store") or one seller's.
            $vendor = $request->input('vendor_id');
            $query->when($vendor === 'store', fn ($query) => $query->whereNull('vendor_id'))
                ->when(ctype_digit((string) $vendor), fn ($query) => $query->where('vendor_id', (int) $vendor));
        } elseif ($user->role === 'seller') {
            $query->where('vendor_id', $user->id);
        } else {
            $query->whereHas('order', fn ($query) => $query->where('user_id', $user->id));
        }

        if ($request->filled('month')) {
            $start = Carbon::createFromFormat('Y-m', $request->input('month'))->startOfMonth();
            $query->whereBetween('issued_at', [$start, $start->copy()->endOfMonth()]);
        }
        if ($request->filled('search')) {
            $search = trim($request->input('search'));
            $query->where(fn ($query) => $query->where('number', 'like', "%{$search}%")
                ->orWhere('order_id', ctype_digit($search) ? (int) $search : 0));
        }

        return $query;
    }
}
