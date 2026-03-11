import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Calendar, Download, Filter, FileText, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CURRENCY, STATUS_COLORS } from "@/lib/constants";
import type { Sale, Client, Invoice } from "@shared/schema";
import ExcelJS from 'exceljs';

type SaleWithClient = Sale & { client: Client };

export default function Reports() {
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [reportType, setReportType] = useState<string>("pending");

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: salesResponse } = useQuery<any>({
    queryKey: ["/api/sales"],
  });
  const sales: SaleWithClient[] = Array.isArray(salesResponse)
    ? (salesResponse as SaleWithClient[])
    : (salesResponse?.data ?? []);

  const { data: invoices = [] } = useQuery<any[]>({
    queryKey: ["/api/invoices"],
  });

  // Filter sales based on selected criteria
  const filteredSales = sales.filter(sale => {
    // Client filter
    if (selectedClient !== "all" && sale.clientId !== selectedClient) {
      return false;
    }

    // Date filter
    const saleDate = new Date(sale.saleDate);
    if (dateFrom && saleDate < new Date(dateFrom)) {
      return false;
    }
    if (dateTo && saleDate > new Date(dateTo)) {
      return false;
    }

    // Report type filter
    if (reportType === "pending") {
      return sale.saleStatus === "Pending LPO" || sale.saleStatus === "LPO Received" || sale.saleStatus === "Invoiced";
    } else if (reportType === "vat" || reportType === "monthly-profit") {
      return true; // All sales for VAT and Monthly Profit
    }

    return true;
  });

  // Monthly profit: group sales by month (sale date)
  const monthlyProfitData = useMemo(() => {
    if (reportType !== "monthly-profit") return [];
    const byMonth: Record<string, { revenue: number; cogs: number; grossProfit: number; count: number }> = {};
    for (const sale of filteredSales) {
      const d = new Date(sale.saleDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!byMonth[key]) byMonth[key] = { revenue: 0, cogs: 0, grossProfit: 0, count: 0 };
      const rev = parseFloat(sale.subtotal);
      const cogs = parseFloat(sale.cogs);
      byMonth[key].revenue += rev;
      byMonth[key].cogs += cogs;
      byMonth[key].grossProfit += parseFloat(sale.grossProfit);
      byMonth[key].count += 1;
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }));
  }, [reportType, filteredSales]);

  const pendingInvoices = useMemo(() => {
    if (reportType !== "pending-invoices") return [] as any[];
    // Pending invoices = not Paid
    const invs = (invoices || []) as any[];
    return invs.filter(inv => inv.status !== "Paid").filter(inv => {
      if (selectedClient === "all") return true;
      const s = inv.sales && inv.sales[0];
      return s && s.clientId === selectedClient;
    }).filter(inv => {
      if (!dateFrom && !dateTo) return true;
      const d = new Date(inv.invoiceDate);
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo && d > new Date(dateTo)) return false;
      return true;
    });
  }, [reportType, invoices, selectedClient, dateFrom, dateTo]);

  // Calculate totals
  const totals = filteredSales.reduce(
    (acc, sale) => ({
      subtotal: acc.subtotal + parseFloat(sale.subtotal),
      vatAmount: acc.vatAmount + parseFloat(sale.vatAmount),
      totalAmount: acc.totalAmount + parseFloat(sale.totalAmount),
      quantity: acc.quantity + parseFloat(sale.quantityGallons),
    }),
    { subtotal: 0, vatAmount: 0, totalAmount: 0, quantity: 0 }
  );

  const invoiceTotals = useMemo(() => {
    if (reportType !== "pending-invoices") return { count: 0, totalAmount: 0, pendingAmount: 0 };
    const sum = pendingInvoices.reduce((acc, inv: any) => {
      acc.count += 1;
      acc.totalAmount += parseFloat(inv.totalAmount);
      acc.pendingAmount += parseFloat(inv.pendingAmount || 0);
      return acc;
    }, { count: 0, totalAmount: 0, pendingAmount: 0 });
    return sum;
  }, [pendingInvoices, reportType]);

  const exportToExcel = async () => {
    // Create client details section for the selected client
    const selectedClientData = selectedClient !== "all"
      ? clients.find(c => c.id === selectedClient)
      : null;

    // Create workbook and worksheet
    const sheetName = selectedClientData
      ? selectedClientData.name.substring(0, 30)
      : reportType === "pending-invoices"
        ? "Pending Invoices"
        : reportType === "pending"
          ? "Pending Business"
          : reportType === "monthly-profit"
            ? "Monthly Profit"
            : "VAT Report";
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    let currentRow = 1;

    // Add client header if specific client selected
    if (selectedClientData) {
      worksheet.getCell(`A${currentRow}`).value = `Client Details for: ${selectedClientData.name}`;
      worksheet.getCell(`A${currentRow}`).font = { bold: true, size: 14 };
      currentRow++;

      worksheet.getCell(`A${currentRow}`).value = `Contact Person: ${selectedClientData.contactPerson}`;
      currentRow++;
      worksheet.getCell(`A${currentRow}`).value = `Phone: ${selectedClientData.phoneNumber}`;
      currentRow++;
      worksheet.getCell(`A${currentRow}`).value = `Email: ${selectedClientData.email}`;
      currentRow++;
      worksheet.getCell(`A${currentRow}`).value = `Address: ${selectedClientData.address}`;
      currentRow += 2; // Empty row
    }

    // Add report type and date range
    const reportTypeLabel =
      reportType === "pending-invoices"
        ? "Pending Invoices Report"
        : reportType === "pending"
          ? "Pending Business Report"
          : reportType === "monthly-profit"
            ? "Monthly Profit Report"
            : "VAT Report";
    worksheet.getCell(`A${currentRow}`).value = `Report Type: ${reportTypeLabel}`;
    worksheet.getCell(`A${currentRow}`).font = { bold: true };
    currentRow++;

    if (dateFrom || dateTo) {
      worksheet.getCell(`A${currentRow}`).value = `Date Range: ${dateFrom || "Start"} to ${dateTo || "End"}`;
      currentRow++;
    }
    currentRow++; // Empty row

    if (reportType === "monthly-profit") {
      const monthHeaders = ["Month", "Revenue (excl. VAT)", "COGS", "Gross Profit", "Margin %", "Sales Count"];
      monthHeaders.forEach((header, index) => {
        const cell = worksheet.getCell(currentRow, index + 1);
        cell.value = header;
        cell.font = { bold: true };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
      });
      currentRow++;
      monthlyProfitData.forEach((row) => {
        const margin = row.revenue > 0 ? ((row.grossProfit / row.revenue) * 100).toFixed(1) : "0";
        [row.month, row.revenue, row.cogs, row.grossProfit, `${margin}%`, row.count].forEach((value, index) => {
          worksheet.getCell(currentRow, index + 1).value = value;
        });
        currentRow++;
      });
      currentRow++;
      worksheet.getCell(currentRow, 1).value = "TOTALS:";
      worksheet.getCell(currentRow, 1).font = { bold: true };
      worksheet.getCell(currentRow, 2).value = monthlyProfitData.reduce((s, r) => s + r.revenue, 0);
      worksheet.getCell(currentRow, 3).value = monthlyProfitData.reduce((s, r) => s + r.cogs, 0);
      worksheet.getCell(currentRow, 4).value = monthlyProfitData.reduce((s, r) => s + r.grossProfit, 0);
    } else if (reportType === "pending-invoices") {
      // Pending Invoices: invoice columns and data with VAT split
      const invHeaders = [
        "Invoice No.",
        "Invoice Date",
        "Due Date",
        "LPO No.",
        "Client Name",
        "Subtotal (excl. VAT)",
        "VAT Amount",
        "Total Amount",
        "Pending Amount",
        "Status",
      ];
      invHeaders.forEach((header, index) => {
        const cell = worksheet.getCell(currentRow, index + 1);
        cell.value = header;
        cell.font = { bold: true };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE0E0E0" },
        };
      });
      currentRow++;

      pendingInvoices.forEach((inv: any) => {
        const clientName = inv.sale?.client?.name ?? inv.sales?.[0]?.client?.name ?? "—";
        const total = parseFloat(inv.totalAmount);
        const vat = parseFloat(inv.vatAmount || 0);
        const subtotal = total - vat;
        const dueDate = inv.dueDate ? new Date(inv.dueDate) : (() => { const d = new Date(inv.invoiceDate); d.setMonth(d.getMonth() + 1); return d; })();
        const rowData = [
          inv.invoiceNumber ?? "",
          new Date(inv.invoiceDate).toLocaleDateString(),
          dueDate.toLocaleDateString(),
          inv.lpoNumber ?? inv.sale?.lpoNumber ?? inv.sales?.[0]?.lpoNumber ?? "N/A",
          clientName,
          subtotal,
          vat,
          total,
          parseFloat(inv.pendingAmount || 0),
          inv.status ?? "",
        ];
        rowData.forEach((value, index) => {
          worksheet.getCell(currentRow, index + 1).value = value;
        });
        currentRow++;
      });

      // Totals row for pending invoices
      currentRow++;
      worksheet.getCell(currentRow, 1).value = "TOTALS:";
      worksheet.getCell(currentRow, 1).font = { bold: true };
      worksheet.getCell(currentRow, 6).value = pendingInvoices.reduce((s: number, inv: any) => s + parseFloat(inv.totalAmount) - parseFloat(inv.vatAmount || 0), 0);
      worksheet.getCell(currentRow, 7).value = pendingInvoices.reduce((s: number, inv: any) => s + parseFloat(inv.vatAmount || 0), 0);
      worksheet.getCell(currentRow, 8).value = invoiceTotals.totalAmount;
      worksheet.getCell(currentRow, 9).value = invoiceTotals.pendingAmount;
    } else {
      // Pending LPO (Sales) or VAT: sales columns and data
      const headers = [
        "Date of Sale",
        "Date of Invoice",
        "Invoice Number",
        "Client Name",
        "LPO Number",
        "Quantity (Gallons)",
        "Unit Price (AED)",
        "Subtotal (AED)",
        "VAT Amount (AED)",
        "Total Amount (AED)",
        "Status",
      ];

      headers.forEach((header, index) => {
        const cell = worksheet.getCell(currentRow, index + 1);
        cell.value = header;
        cell.font = { bold: true };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE0E0E0" },
        };
      });
      currentRow++;

      filteredSales.forEach(sale => {
        const rowData = [
          new Date(sale.saleDate).toLocaleDateString(),
          sale.saleStatus === "Invoiced" || sale.saleStatus === "Paid" ? new Date(sale.saleDate).toLocaleDateString() : "Not Invoiced",
          sale.saleStatus === "Invoiced" || sale.saleStatus === "Paid" ? `INV-${sale.lpoNumber}` : "Not Generated",
          sale.client.name,
          sale.lpoNumber,
          parseFloat(sale.quantityGallons),
          parseFloat(sale.salePricePerGallon),
          parseFloat(sale.subtotal),
          parseFloat(sale.vatAmount),
          parseFloat(sale.totalAmount),
          sale.saleStatus,
        ];
        rowData.forEach((value, index) => {
          worksheet.getCell(currentRow, index + 1).value = value;
        });
        currentRow++;
      });

      currentRow++;
      worksheet.getCell(currentRow, 6).value = "TOTALS:";
      worksheet.getCell(currentRow, 6).font = { bold: true };
      worksheet.getCell(currentRow, 7).value = totals.quantity;
      worksheet.getCell(currentRow, 8).value = totals.subtotal;
      worksheet.getCell(currentRow, 9).value = totals.vatAmount;
      worksheet.getCell(currentRow, 10).value = totals.totalAmount;
    }

    // Auto-size columns
    worksheet.columns.forEach(column => {
      let maxLength = 0;
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        const cellLength = cell.value ? cell.value.toString().length : 0;
        if (cellLength > maxLength) {
          maxLength = cellLength;
        }
      });
      column.width = Math.min(Math.max(maxLength + 2, 10), 50);
    });

    // Generate filename and save
    const dateStr = new Date().toISOString().split("T")[0];
    const clientStr = selectedClientData ? `_${selectedClientData.name.replace(/[^a-zA-Z0-9]/g, "_")}` : "";
    const filename = `${reportType}_report${clientStr}_${dateStr}.xlsx`;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToCSV = () => {
    const dateStr = new Date().toISOString().split("T")[0];

    if (reportType === "pending-invoices") {
      const headers = [
        "Invoice No.",
        "Invoice Date",
        "LPO No.",
        "Client Name",
        "Total Amount",
        "Pending Amount",
        "Status",
      ];
      const csvData = pendingInvoices.map((inv: any) => {
        const clientName = inv.sale?.client?.name ?? inv.sales?.[0]?.client?.name ?? "—";
        return [
          inv.invoiceNumber ?? "",
          new Date(inv.invoiceDate).toLocaleDateString(),
          inv.lpoNumber ?? inv.sale?.lpoNumber ?? inv.sales?.[0]?.lpoNumber ?? "N/A",
          clientName,
          parseFloat(inv.totalAmount),
          parseFloat(inv.pendingAmount || 0),
          inv.status ?? "",
        ];
      });
      const csvContent = [headers, ...csvData]
        .map(row => row.map(cell => `"${cell}"`).join(","))
        .join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${reportType}_report_${dateStr}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    const headers = [
      "Date of Sale",
      "Client Name",
      "LPO Number",
      "Quantity (Gallons)",
      "Unit Price",
      "Subtotal",
      "VAT Amount",
      "Total Amount",
      "Status",
    ];
    const csvData = filteredSales.map(sale => [
      new Date(sale.saleDate).toLocaleDateString(),
      sale.client.name,
      sale.lpoNumber,
      sale.quantityGallons,
      sale.salePricePerGallon,
      sale.subtotal,
      sale.vatAmount,
      sale.totalAmount,
      sale.saleStatus,
    ]);
    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${reportType}_report_${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Header
        title="Reports"
        description="View and export reports"
      />
      <div className="p-4 lg:p-6 space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Report Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Report Type</label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="pending">Pending LPO (Sales)</SelectItem>
                   <SelectItem value="pending-invoices">Pending Invoices</SelectItem>
                   <SelectItem value="vat">VAT Report</SelectItem>
                   <SelectItem value="monthly-profit">Monthly Profit Report</SelectItem>
                 </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Client</label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">From Date</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">To Date</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <Button onClick={exportToExcel} className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Export to Excel
            </Button>
            <Button onClick={exportToCSV} variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export to CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{reportType === "monthly-profit" ? "Months" : "Total Records"}</p>
                <p className="text-2xl font-bold text-gray-900">{reportType === "monthly-profit" ? monthlyProfitData.length : reportType === "pending-invoices" ? invoiceTotals.count : filteredSales.length}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        {reportType !== 'pending-invoices' && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Quantity</p>
                <p className="text-2xl font-bold text-gray-900">{totals.quantity.toFixed(0)}</p>
                <p className="text-xs text-gray-500">gallons</p>
              </div>
              <Calendar className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>) }

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{reportType === 'pending-invoices' ? 'Pending Amount' : 'VAT Amount'}</p>
                <p className="text-2xl font-bold text-gray-900">{reportType === 'pending-invoices' ? `${CURRENCY} ${invoiceTotals.pendingAmount.toFixed(2)}` : `${CURRENCY} ${totals.vatAmount.toFixed(2)}`}</p>
              </div>
              <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-orange-600">VAT</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Amount</p>
                <p className="text-2xl font-bold text-gray-900">{CURRENCY} {(reportType === 'pending-invoices' ? invoiceTotals.totalAmount : totals.totalAmount).toFixed(2)}</p>
              </div>
              <div className="h-8 w-8 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-bold text-primary-600">₹</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Data */}
      <Card>
        <CardHeader>
          <CardTitle>
            {reportType === "pending" ? "Pending Business Report" : reportType === "pending-invoices" ? "Pending Invoices Report" : reportType === "monthly-profit" ? "Monthly Profit Report" : "VAT Report"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reportType === "monthly-profit" ? (
            monthlyProfitData.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No sales in the selected period for monthly profit</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 text-sm font-medium text-gray-600">Month</th>
                      <th className="text-right p-3 text-sm font-medium text-gray-600">Revenue (excl. VAT)</th>
                      <th className="text-right p-3 text-sm font-medium text-gray-600">COGS</th>
                      <th className="text-right p-3 text-sm font-medium text-gray-600">Gross Profit</th>
                      <th className="text-right p-3 text-sm font-medium text-gray-600">Margin %</th>
                      <th className="text-right p-3 text-sm font-medium text-gray-600">Sales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyProfitData.map((row) => (
                      <tr key={row.month} className="border-b hover:bg-gray-50">
                        <td className="p-3 text-sm font-medium">{row.month}</td>
                        <td className="p-3 text-sm text-right">{CURRENCY} {row.revenue.toFixed(2)}</td>
                        <td className="p-3 text-sm text-right">{CURRENCY} {row.cogs.toFixed(2)}</td>
                        <td className="p-3 text-sm text-right font-medium">{CURRENCY} {row.grossProfit.toFixed(2)}</td>
                        <td className="p-3 text-sm text-right">{row.revenue > 0 ? ((row.grossProfit / row.revenue) * 100).toFixed(1) : "0"}%</td>
                        <td className="p-3 text-sm text-right">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4 pt-4 border-t flex justify-end gap-6 text-sm">
                  <span><strong>Total Revenue:</strong> {CURRENCY} {monthlyProfitData.reduce((s, r) => s + r.revenue, 0).toFixed(2)}</span>
                  <span><strong>Total COGS:</strong> {CURRENCY} {monthlyProfitData.reduce((s, r) => s + r.cogs, 0).toFixed(2)}</span>
                  <span><strong>Total Gross Profit:</strong> {CURRENCY} {monthlyProfitData.reduce((s, r) => s + r.grossProfit, 0).toFixed(2)}</span>
                </div>
              </div>
            )
          ) : reportType === "pending-invoices" ? (
            pendingInvoices.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No pending invoices found for the selected criteria</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 text-sm font-medium text-gray-600">Invoice No.</th>
                      <th className="text-left p-3 text-sm font-medium text-gray-600">Invoice Date</th>
                      <th className="text-left p-3 text-sm font-medium text-gray-600">Due Date</th>
                      <th className="text-left p-3 text-sm font-medium text-gray-600">LPO No.</th>
                      <th className="text-right p-3 text-sm font-medium text-gray-600">Subtotal (excl. VAT)</th>
                      <th className="text-right p-3 text-sm font-medium text-gray-600">VAT</th>
                      <th className="text-right p-3 text-sm font-medium text-gray-600">Total</th>
                      <th className="text-right p-3 text-sm font-medium text-gray-600">Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingInvoices.map((inv: any) => {
                      const total = parseFloat(inv.totalAmount);
                      const vat = parseFloat(inv.vatAmount || 0);
                      const subtotal = total - vat;
                      const dueDate = inv.dueDate ? new Date(inv.dueDate) : (() => { const d = new Date(inv.invoiceDate); d.setMonth(d.getMonth() + 1); return d; })();
                      return (
                        <tr key={inv.id} className="border-b hover:bg-gray-50">
                          <td className="p-3 text-sm">{inv.invoiceNumber}</td>
                          <td className="p-3 text-sm">{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                          <td className="p-3 text-sm">{dueDate.toLocaleDateString()}</td>
                          <td className="p-3 text-sm">{inv.lpoNumber || (inv.sale?.lpoNumber ?? "N/A")}</td>
                          <td className="p-3 text-sm text-right">{CURRENCY} {subtotal.toFixed(2)}</td>
                          <td className="p-3 text-sm text-right">{CURRENCY} {vat.toFixed(2)}</td>
                          <td className="p-3 text-sm text-right">{CURRENCY} {total.toFixed(2)}</td>
                          <td className="p-3 text-sm text-right font-medium">{CURRENCY} {parseFloat(inv.pendingAmount || 0).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : filteredSales.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No records found for the selected criteria</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 text-sm font-medium text-gray-600">Date</th>
                      <th className="text-left p-3 text-sm font-medium text-gray-600">Client</th>
                      <th className="text-left p-3 text-sm font-medium text-gray-600">LPO Number</th>
                      <th className="text-right p-3 text-sm font-medium text-gray-600">Quantity</th>
                      <th className="text-right p-3 text-sm font-medium text-gray-600">Subtotal</th>
                      <th className="text-right p-3 text-sm font-medium text-gray-600">VAT</th>
                      <th className="text-right p-3 text-sm font-medium text-gray-600">Total</th>
                      <th className="text-center p-3 text-sm font-medium text-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map((sale) => (
                      <tr key={sale.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 text-sm">
                          {new Date(sale.saleDate).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-sm font-medium">{sale.client.name}</td>
                        <td className="p-3 text-sm">{sale.lpoNumber}</td>
                        <td className="p-3 text-sm text-right">{parseFloat(sale.quantityGallons).toFixed(0)}</td>
                        <td className="p-3 text-sm text-right">{CURRENCY} {parseFloat(sale.subtotal).toFixed(2)}</td>
                        <td className="p-3 text-sm text-right">{CURRENCY} {parseFloat(sale.vatAmount).toFixed(2)}</td>
                        <td className="p-3 text-sm text-right font-medium">{CURRENCY} {parseFloat(sale.totalAmount).toFixed(2)}</td>
                        <td className="p-3 text-center">
                          <Badge className={STATUS_COLORS[sale.saleStatus as keyof typeof STATUS_COLORS]}>
                            {sale.saleStatus}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {filteredSales.map((sale) => (
                  <Card key={sale.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-medium text-gray-900">{sale.client.name}</h3>
                          <p className="text-sm text-gray-600">{sale.lpoNumber}</p>
                        </div>
                        <Badge className={STATUS_COLORS[sale.saleStatus as keyof typeof STATUS_COLORS]}>
                          {sale.saleStatus}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-600">Date:</span>
                          <p className="font-medium">{new Date(sale.saleDate).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Quantity:</span>
                          <p className="font-medium">{parseFloat(sale.quantityGallons).toFixed(0)} gal</p>
                        </div>
                      </div>

                      <Separator className="my-3" />

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Subtotal:</span>
                          <span>{CURRENCY} {parseFloat(sale.subtotal).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">VAT (5%):</span>
                          <span>{CURRENCY} {parseFloat(sale.vatAmount).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-medium text-base pt-2 border-t">
                          <span>Total:</span>
                          <span>{CURRENCY} {parseFloat(sale.totalAmount).toFixed(2)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Summary Footer */}
              <div className="mt-6 pt-4 border-t bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-700">Total Subtotal:</span>
                    <span className="font-bold">{CURRENCY} {totals.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-700">Total VAT:</span>
                    <span className="font-bold">{CURRENCY} {totals.vatAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-700">Grand Total:</span>
                    <span className="font-bold text-lg">{CURRENCY} {totals.totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      </div>
    </>
  );
}