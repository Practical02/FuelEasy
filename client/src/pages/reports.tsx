import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Header from "@/components/layout/header";
import { Calendar, Download, FileText, FileSpreadsheet, TrendingUp, TrendingDown, Wallet, Percent, BarChart3, Package, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterPanel } from "@/components/ui/filter-panel";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { CURRENCY, STATUS_COLORS } from "@/lib/constants";
import { fetchAllSales, salesKeys, salesListFromResponse } from "@/lib/sales-query";
import {
  type Sale,
  type Client,
  type Invoice,
  type Stock,
  type AccountHead,
  type CashbookEntryWithAccountHead,
  SALE_COGS_DECIMAL_PLACES,
  SALE_PURCHASE_PPG_DECIMAL_PLACES,
} from "@shared/schema";
import ExcelJS from 'exceljs';
import { isInLocalYmdRange } from "@/lib/date-range";

type SaleWithClient = Sale & { client: Client; project?: { name: string } | null };

export default function Reports() {
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [reportType, setReportType] = useState<string>("whole-sales");
  const [profitGranularity, setProfitGranularity] = useState<"monthly" | "annual">("monthly");
  const [vatGranularity, setVatGranularity] = useState<"monthly" | "annual">("monthly");
  const [showVatLineItems, setShowVatLineItems] = useState(false);
  const [cashbookAccountHeadId, setCashbookAccountHeadId] = useState<string>("all");
  const [cashbookFlow, setCashbookFlow] = useState<string>("all");
  const [cashbookTxnType, setCashbookTxnType] = useState<string>("all");

  const { data: accountHeadsList = [] } = useQuery<AccountHead[]>({
    queryKey: ["/api/account-heads"],
    enabled: reportType === "cashbook" || reportType === "purchase",
  });

  const cashbookReportQueryKey = [
    "/api/cashbook",
    "report",
    reportType,
    dateFrom,
    dateTo,
    cashbookAccountHeadId,
    cashbookFlow,
    cashbookTxnType,
  ] as const;

  const { data: cashbookEntries = [] } = useQuery<CashbookEntryWithAccountHead[]>({
    queryKey: cashbookReportQueryKey,
    enabled: reportType === "cashbook",
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (cashbookAccountHeadId !== "all") params.set("accountHeadId", cashbookAccountHeadId);
      if (cashbookFlow !== "all") params.set("flow", cashbookFlow);
      if (cashbookTxnType !== "all") params.set("transactionType", cashbookTxnType);
      const q = params.toString();
      return (await apiRequest("GET", `/api/cashbook${q ? `?${q}` : ""}`)).json();
    },
  });

  const cashbookTotals = useMemo(() => {
    if (reportType !== "cashbook") return { inflow: 0, outflow: 0 };
    return cashbookEntries.reduce(
      (acc, e) => {
        const a = parseFloat(e.amount);
        if (e.isInflow === 1) acc.inflow += a;
        else acc.outflow += a;
        return acc;
      },
      { inflow: 0, outflow: 0 }
    );
  }, [reportType, cashbookEntries]);

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: clientProjects = [] } = useQuery({
    queryKey: ["/api/projects/by-client", selectedClient],
    queryFn: async () =>
      selectedClient === "all"
        ? []
        : (await apiRequest("GET", `/api/projects/by-client/${selectedClient}`)).json(),
    enabled: selectedClient !== "all",
  });

  useEffect(() => {
    setSelectedProject("all");
  }, [selectedClient]);

  const { data: salesResponse } = useQuery({
    queryKey: salesKeys.all(dateFrom, dateTo),
    queryFn: () =>
      fetchAllSales({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });
  const sales: SaleWithClient[] = salesListFromResponse(salesResponse) as SaleWithClient[];

  const { data: invoices = [] } = useQuery<any[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: stockRows = [] } = useQuery<Stock[]>({
    queryKey: ["/api/stock"],
    queryFn: async () => (await apiRequest("GET", "/api/stock")).json(),
    enabled: reportType === "vat" || reportType === "purchase",
  });

  const supplierNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const h of accountHeadsList) m[h.id] = h.name;
    return m;
  }, [accountHeadsList]);

  // Map saleId -> { invoiceNumber, invoiceDate } for pending report
  const saleIdToInvoice = useMemo(() => {
    const map: Record<string, { invoiceNumber: string; invoiceDate: string }> = {};
    (invoices || []).forEach((inv: any) => {
      const info = { invoiceNumber: inv.invoiceNumber ?? "", invoiceDate: inv.invoiceDate ? new Date(inv.invoiceDate).toISOString() : "" };
      if (inv.sale?.id) map[inv.sale.id] = info;
      (inv.sales || []).forEach((s: any) => { if (s?.id) map[s.id] = info; });
    });
    return map;
  }, [invoices]);

  // Filter sales based on selected criteria
  const filteredSales = sales.filter(sale => {
    // Client filter
    if (selectedClient !== "all" && sale.clientId !== selectedClient) {
      return false;
    }

    // Project filter (only when a specific project is chosen; scoped to client’s projects)
    if (selectedProject !== "all" && sale.projectId !== selectedProject) {
      return false;
    }

    // Date filter (end date inclusive — full calendar day)
    if (!isInLocalYmdRange(sale.saleDate, dateFrom || undefined, dateTo || undefined)) {
      return false;
    }

    if (reportType === "pending") {
      return sale.saleStatus === "Pending LPO";
    } else if (reportType === "whole-sales") {
      return true; // All sales regardless of status
    } else if (reportType === "vat" || reportType === "profit") {
      return true;
    } else if (reportType === "cashbook" || reportType === "purchase") {
      return false;
    }

    return true;
  });

  const monthKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
    });
  };

  // Monthly profit (Excel + optional table); charts use same rollup
  const monthlyProfitData = useMemo(() => {
    if (reportType !== "profit") return [];
    const byMonth: Record<string, { revenue: number; cogs: number; grossProfit: number; count: number }> = {};
    for (const sale of filteredSales) {
      const d = new Date(sale.saleDate);
      const key = monthKey(d);
      if (!byMonth[key]) byMonth[key] = { revenue: 0, cogs: 0, grossProfit: 0, count: 0 };
      byMonth[key].revenue += parseFloat(sale.subtotal);
      byMonth[key].cogs += parseFloat(sale.cogs);
      byMonth[key].grossProfit += parseFloat(sale.grossProfit);
      byMonth[key].count += 1;
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        monthLabel: monthLabel(month),
        marginPct: data.revenue > 0 ? (data.grossProfit / data.revenue) * 100 : 0,
        ...data,
      }));
  }, [reportType, filteredSales]);

  const annualProfitData = useMemo(() => {
    if (reportType !== "profit") return [];
    const byYear: Record<string, { revenue: number; cogs: number; grossProfit: number; count: number }> = {};
    for (const sale of filteredSales) {
      const y = String(new Date(sale.saleDate).getFullYear());
      if (!byYear[y]) byYear[y] = { revenue: 0, cogs: 0, grossProfit: 0, count: 0 };
      byYear[y].revenue += parseFloat(sale.subtotal);
      byYear[y].cogs += parseFloat(sale.cogs);
      byYear[y].grossProfit += parseFloat(sale.grossProfit);
      byYear[y].count += 1;
    }
    return Object.entries(byYear)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, data]) => ({
        period: year,
        marginPct: data.revenue > 0 ? (data.grossProfit / data.revenue) * 100 : 0,
        ...data,
      }));
  }, [reportType, filteredSales]);

  const vatByMonth = useMemo(() => {
    if (reportType !== "vat") return [];
    const byMonth: Record<string, { subtotal: number; vat: number; total: number; count: number }> = {};
    for (const sale of filteredSales) {
      const key = monthKey(new Date(sale.saleDate));
      if (!byMonth[key]) byMonth[key] = { subtotal: 0, vat: 0, total: 0, count: 0 };
      byMonth[key].subtotal += parseFloat(sale.subtotal);
      byMonth[key].vat += parseFloat(sale.vatAmount);
      byMonth[key].total += parseFloat(sale.totalAmount);
      byMonth[key].count += 1;
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, monthLabel: monthLabel(month), ...data }));
  }, [reportType, filteredSales]);

  const vatByYear = useMemo(() => {
    if (reportType !== "vat") return [];
    const byYear: Record<string, { subtotal: number; vat: number; total: number; count: number }> = {};
    for (const sale of filteredSales) {
      const y = String(new Date(sale.saleDate).getFullYear());
      if (!byYear[y]) byYear[y] = { subtotal: 0, vat: 0, total: 0, count: 0 };
      byYear[y].subtotal += parseFloat(sale.subtotal);
      byYear[y].vat += parseFloat(sale.vatAmount);
      byYear[y].total += parseFloat(sale.totalAmount);
      byYear[y].count += 1;
    }
    return Object.entries(byYear)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, data]) => ({ year, ...data }));
  }, [reportType, filteredSales]);

  /** Stock purchases in period (input VAT — same date filter as sales VAT report). */
  const filteredStock = useMemo(() => {
    if (reportType !== "vat") return [] as Stock[];
    return (stockRows || []).filter((row) =>
      isInLocalYmdRange(row.purchaseDate, dateFrom || undefined, dateTo || undefined)
    );
  }, [reportType, stockRows, dateFrom, dateTo]);

  /** Fuel/stock purchases for Purchase report (date filter on purchase date). */
  const filteredPurchaseStock = useMemo(() => {
    if (reportType !== "purchase") return [] as Stock[];
    return (stockRows || []).filter((row) =>
      isInLocalYmdRange(row.purchaseDate, dateFrom || undefined, dateTo || undefined)
    );
  }, [reportType, stockRows, dateFrom, dateTo]);

  const purchaseTotals = useMemo(() => {
    if (reportType !== "purchase")
      return { quantity: 0, vatAmount: 0, totalCost: 0, costExVat: 0 };
    return filteredPurchaseStock.reduce(
      (acc, r) => {
        const total = parseFloat(r.totalCost);
        const vat = parseFloat(r.vatAmount);
        return {
          quantity: acc.quantity + parseFloat(r.quantityGallons),
          vatAmount: acc.vatAmount + vat,
          totalCost: acc.totalCost + total,
          costExVat: acc.costExVat + (total - vat),
        };
      },
      { quantity: 0, vatAmount: 0, totalCost: 0, costExVat: 0 }
    );
  }, [reportType, filteredPurchaseStock]);

  const stockInputVatTotal = useMemo(
    () => filteredStock.reduce((s, r) => s + parseFloat(r.vatAmount), 0),
    [filteredStock]
  );

  const stockVatByMonth = useMemo(() => {
    if (reportType !== "vat") return [];
    const byMonth: Record<string, { inputVat: number; count: number }> = {};
    for (const row of filteredStock) {
      const key = monthKey(new Date(row.purchaseDate));
      if (!byMonth[key]) byMonth[key] = { inputVat: 0, count: 0 };
      byMonth[key].inputVat += parseFloat(row.vatAmount);
      byMonth[key].count += 1;
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, monthLabel: monthLabel(month), ...data }));
  }, [reportType, filteredStock]);

  const stockVatByYear = useMemo(() => {
    if (reportType !== "vat") return [];
    const byYear: Record<string, { inputVat: number; count: number }> = {};
    for (const row of filteredStock) {
      const y = String(new Date(row.purchaseDate).getFullYear());
      if (!byYear[y]) byYear[y] = { inputVat: 0, count: 0 };
      byYear[y].inputVat += parseFloat(row.vatAmount);
      byYear[y].count += 1;
    }
    return Object.entries(byYear)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, data]) => ({ year, ...data }));
  }, [reportType, filteredStock]);

  /** Sales output VAT + stock input VAT per month (for net position). */
  const vatCombinedMonthly = useMemo(() => {
    if (reportType !== "vat") return [];
    const keys = new Set<string>();
    vatByMonth.forEach((r) => keys.add(r.month));
    stockVatByMonth.forEach((r) => keys.add(r.month));
    return Array.from(keys)
      .sort((a, b) => a.localeCompare(b))
      .map((month) => {
        const sales = vatByMonth.find((r) => r.month === month);
        const stock = stockVatByMonth.find((r) => r.month === month);
        const outputVat = sales?.vat ?? 0;
        const inputVat = stock?.inputVat ?? 0;
        return {
          month,
          monthLabel: monthLabel(month),
          outputVat,
          inputVat,
          netVat: outputVat - inputVat,
        };
      });
  }, [reportType, vatByMonth, stockVatByMonth]);

  const vatCombinedAnnual = useMemo(() => {
    if (reportType !== "vat") return [];
    const keys = new Set<string>();
    vatByYear.forEach((r) => keys.add(r.year));
    stockVatByYear.forEach((r) => keys.add(r.year));
    return Array.from(keys)
      .sort((a, b) => a.localeCompare(b))
      .map((year) => {
        const sales = vatByYear.find((r) => r.year === year);
        const stock = stockVatByYear.find((r) => r.year === year);
        const outputVat = sales?.vat ?? 0;
        const inputVat = stock?.inputVat ?? 0;
        return { year, outputVat, inputVat, netVat: outputVat - inputVat };
      });
  }, [reportType, vatByYear, stockVatByYear]);

  const profitTotals = useMemo(() => {
    if (reportType !== "profit")
      return {
        revenue: 0,
        cogs: 0,
        grossProfit: 0,
        marginPct: 0,
        saleCount: 0,
        totalGallons: 0,
        avgProfitPerSale: 0,
      };
    const revenue = filteredSales.reduce((s, x) => s + parseFloat(x.subtotal), 0);
    const cogs = filteredSales.reduce((s, x) => s + parseFloat(x.cogs), 0);
    const grossProfit = filteredSales.reduce((s, x) => s + parseFloat(x.grossProfit), 0);
    const saleCount = filteredSales.length;
    const totalGallons = filteredSales.reduce((s, x) => s + parseFloat(x.quantityGallons), 0);
    return {
      revenue,
      cogs,
      grossProfit,
      marginPct: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
      saleCount,
      totalGallons,
      avgProfitPerSale: saleCount > 0 ? grossProfit / saleCount : 0,
    };
  }, [reportType, filteredSales]);

  /** Unified rows for profit chart (month or year label on X). */
  const profitTimeSeries = useMemo(() => {
    if (reportType !== "profit") return [];
    if (profitGranularity === "monthly") {
      return monthlyProfitData.map((r) => ({
        label: r.monthLabel,
        grossProfit: r.grossProfit,
        revenue: r.revenue,
        cogs: r.cogs,
        marginPct: r.marginPct,
        count: r.count,
      }));
    }
    return annualProfitData.map((r) => ({
      label: r.period,
      grossProfit: r.grossProfit,
      revenue: r.revenue,
      cogs: r.cogs,
      marginPct: r.marginPct,
      count: r.count,
    }));
  }, [reportType, profitGranularity, monthlyProfitData, annualProfitData]);

  const profitInsights = useMemo(() => {
    if (reportType !== "profit" || profitTimeSeries.length === 0) return null;
    const rows = profitTimeSeries;
    let bestI = 0;
    let worstI = 0;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].grossProfit > rows[bestI].grossProfit) bestI = i;
      if (rows[i].grossProfit < rows[worstI].grossProfit) worstI = i;
    }
    const first = rows[0];
    const last = rows[rows.length - 1];
    const trend = last.grossProfit - first.grossProfit;
    return {
      best: rows[bestI],
      worst: rows[worstI],
      trend,
      periodCount: rows.length,
    };
  }, [reportType, profitTimeSeries]);

  const pendingInvoices = useMemo(() => {
    if (reportType !== "pending-invoices") return [] as any[];
    // Pending invoices = not Paid
    const invs = (invoices || []) as any[];
    return invs.filter(inv => inv.status !== "Paid").filter(inv => {
      if (selectedClient === "all") return true;
      const s = inv.sales && inv.sales[0];
      return s && s.clientId === selectedClient;
    }).filter(inv => {
      if (selectedProject !== "all") {
        const pid = inv.sale?.projectId ?? inv.sales?.[0]?.projectId;
        if (pid !== selectedProject) return false;
      }
      return isInLocalYmdRange(inv.invoiceDate, dateFrom || undefined, dateTo || undefined);
    });
  }, [reportType, invoices, selectedClient, selectedProject, dateFrom, dateTo]);

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
          ? "Pending LPO"
          : reportType === "whole-sales"
            ? "Sales Report"
            : reportType === "purchase"
              ? "Purchase Report"
            : reportType === "profit"
            ? "Profit Report"
            : reportType === "cashbook"
              ? "Cashbook"
              : "VAT Report";
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    let currentRow = 1;
    const TITLE_MERGE_END_COL = 10; // A–J

    const mergeTitleRow = (text: string, opts?: { size?: number }) => {
      worksheet.mergeCells(currentRow, 1, currentRow, TITLE_MERGE_END_COL);
      const cell = worksheet.getCell(currentRow, 1);
      cell.value = text;
      cell.font = { bold: true, size: opts?.size ?? 12 };
      cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true, indent: 0 };
      currentRow++;
    };

    // Client name only; merged title row, left-aligned (not shown when client filter does not apply)
    if (selectedClientData && reportType !== "purchase" && reportType !== "cashbook") {
      mergeTitleRow(`Client: ${selectedClientData.name}`, { size: 13 });
    }

    const reportTypeLabel =
      reportType === "pending-invoices"
        ? "Pending Invoices Report"
        : reportType === "pending"
          ? "Pending LPO Report"
          : reportType === "whole-sales"
            ? "Sales Report"
            : reportType === "purchase"
              ? "Purchase Report"
            : reportType === "profit"
              ? "Profit Report"
              : reportType === "cashbook"
                ? "Cashbook Report"
                : "VAT Report";
    mergeTitleRow(`Report type: ${reportTypeLabel}`);

    if (dateFrom || dateTo) {
      mergeTitleRow(`Date range: ${dateFrom || "…"} to ${dateTo || "…"}`);
    }
    currentRow++; // blank row before table
    const tableStartRow = currentRow;

    if (reportType === "cashbook") {
      const headers = ["Date", "Account head", "Type", "Category", "Description", "Flow", "Amount", "Pending", "Method"];
      headers.forEach((header, index) => {
        const cell = worksheet.getCell(currentRow, index + 1);
        cell.value = header;
        cell.font = { bold: true };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
      });
      currentRow++;
      for (const e of cashbookEntries) {
        [
          new Date(e.transactionDate).toLocaleDateString(),
          e.accountHead?.name ?? "—",
          e.transactionType,
          e.category ?? "—",
          e.description,
          e.isInflow === 1 ? "In" : "Out",
          parseFloat(e.amount),
          e.isPending === 1 ? "Yes" : "No",
          e.paymentMethod ?? "—",
        ].forEach((value, index) => {
          worksheet.getCell(currentRow, index + 1).value = value;
        });
        currentRow++;
      }
      currentRow++;
      worksheet.getCell(currentRow, 1).value = "Totals (this export):";
      worksheet.getCell(currentRow, 1).font = { bold: true };
      worksheet.getCell(currentRow, 6).value = "Inflow";
      worksheet.getCell(currentRow, 7).value = cashbookTotals.inflow;
      currentRow++;
      worksheet.getCell(currentRow, 6).value = "Outflow";
      worksheet.getCell(currentRow, 7).value = cashbookTotals.outflow;
    } else if (reportType === "profit") {
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
      const invHeaders = [
        "Client Name",
        "Invoice No.",
        "Invoice Date",
        "Due Date",
        "LPO No.",
        "Total Amount",
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
        const dueDate = inv.dueDate
          ? new Date(inv.dueDate)
          : (() => {
              const d = new Date(inv.invoiceDate);
              d.setMonth(d.getMonth() + 1);
              return d;
            })();
        const rowData = [
          clientName,
          inv.invoiceNumber ?? "",
          new Date(inv.invoiceDate).toLocaleDateString(),
          dueDate.toLocaleDateString(),
          inv.lpoNumber ?? inv.sale?.lpoNumber ?? inv.sales?.[0]?.lpoNumber ?? "—",
          total,
        ];
        rowData.forEach((value, index) => {
          worksheet.getCell(currentRow, index + 1).value = value;
        });
        currentRow++;
      });

      currentRow++;
      worksheet.getCell(currentRow, 1).value = "TOTALS:";
      worksheet.getCell(currentRow, 1).font = { bold: true };
      worksheet.getCell(currentRow, 6).value = invoiceTotals.totalAmount;
    } else if (reportType === "pending") {
      // Pending LPO: no LPO/invoice columns (not applicable yet); include delivery note no. when recorded
      const headers = [
        "Date of Sale",
        "Client Name",
        "Project",
        "Delivery Note no.",
        "Quantity",
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
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
      });
      currentRow++;
      filteredSales.forEach((sale) => {
        const saleWithProject = sale as SaleWithClient;
        const rowData = [
          new Date(sale.saleDate).toLocaleDateString(),
          sale.client.name,
          saleWithProject.project?.name ?? "—",
          (sale as Sale).deliveryNoteNumber ?? "—",
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
      worksheet.getCell(currentRow, 4).value = "TOTALS:";
      worksheet.getCell(currentRow, 4).font = { bold: true };
      worksheet.getCell(currentRow, 5).value = totals.quantity;
      worksheet.getCell(currentRow, 7).value = totals.subtotal;
      worksheet.getCell(currentRow, 8).value = totals.vatAmount;
      worksheet.getCell(currentRow, 9).value = totals.totalAmount;
    } else if (reportType === "purchase") {
      const headers = [
        "Purchase date",
        "Supplier",
        "Quantity (gal)",
        "Unit price (AED)",
        "VAT %",
        "Amount ex VAT (AED)",
        "VAT (AED)",
        "Total cost (AED)",
      ];
      headers.forEach((header, index) => {
        const cell = worksheet.getCell(currentRow, index + 1);
        cell.value = header;
        cell.font = { bold: true };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
      });
      currentRow++;
      filteredPurchaseStock.forEach((row) => {
        const supplier =
          row.supplierAccountHeadId != null
            ? supplierNameById[row.supplierAccountHeadId] ?? "—"
            : "—";
        const exVat = parseFloat(row.totalCost) - parseFloat(row.vatAmount);
        [
          new Date(row.purchaseDate).toLocaleDateString(),
          supplier,
          parseFloat(row.quantityGallons),
          parseFloat(row.purchasePricePerGallon),
          parseFloat(row.vatPercentage),
          exVat,
          parseFloat(row.vatAmount),
          parseFloat(row.totalCost),
        ].forEach((value, index) => {
          worksheet.getCell(currentRow, index + 1).value = value;
        });
        currentRow++;
      });
      currentRow++;
      worksheet.getCell(currentRow, 1).value = "TOTALS:";
      worksheet.getCell(currentRow, 1).font = { bold: true };
      worksheet.getCell(currentRow, 3).value = purchaseTotals.quantity;
      worksheet.getCell(currentRow, 6).value = purchaseTotals.costExVat;
      worksheet.getCell(currentRow, 7).value = purchaseTotals.vatAmount;
      worksheet.getCell(currentRow, 8).value = purchaseTotals.totalCost;
    } else {
      // VAT / sales report: LPO + Delivery Note no. + invoice columns
      const headers = [
        "Date of Sale",
        "Client Name",
        "Project",
        "LPO Number",
        "Delivery Note no.",
        "Invoice Number",
        "Date of Invoice",
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
      filteredSales.forEach((sale) => {
        const inv = saleIdToInvoice[sale.id];
        const saleWithProject = sale as SaleWithClient;
        const rowData = [
          new Date(sale.saleDate).toLocaleDateString(),
          sale.client.name,
          saleWithProject.project?.name ?? "—",
          sale.lpoNumber,
          (sale as Sale).deliveryNoteNumber ?? "—",
          inv?.invoiceNumber ?? "—",
          inv?.invoiceDate
            ? new Date(inv.invoiceDate).toLocaleDateString()
            : sale.invoiceDate
              ? new Date(sale.invoiceDate).toLocaleDateString()
              : "—",
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
      worksheet.getCell(currentRow, 8).value = "TOTALS:";
      worksheet.getCell(currentRow, 8).font = { bold: true };
      worksheet.getCell(currentRow, 9).value = totals.quantity;
      worksheet.getCell(currentRow, 11).value = totals.subtotal;
      worksheet.getCell(currentRow, 12).value = totals.vatAmount;
      worksheet.getCell(currentRow, 13).value = totals.totalAmount;
      if (reportType === "vat") {
        currentRow += 2;
        mergeTitleRow("Stock purchases — input VAT (same date range)");
        const stockHeaders = ["Purchase date", "Qty (gal)", "Input VAT (AED)", "Total cost (AED)"];
        stockHeaders.forEach((header, index) => {
          const cell = worksheet.getCell(currentRow, index + 1);
          cell.value = header;
          cell.font = { bold: true };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
        });
        currentRow++;
        filteredStock.forEach((row) => {
          [
            new Date(row.purchaseDate).toLocaleDateString(),
            parseFloat(row.quantityGallons),
            parseFloat(row.vatAmount),
            parseFloat(row.totalCost),
          ].forEach((value, index) => {
            worksheet.getCell(currentRow, index + 1).value = value;
          });
          currentRow++;
        });
        currentRow++;
        worksheet.getCell(currentRow, 1).value = "Stock input VAT total:";
        worksheet.getCell(currentRow, 1).font = { bold: true };
        worksheet.getCell(currentRow, 3).value = stockInputVatTotal;
        currentRow++;
        worksheet.getCell(currentRow, 1).value = "Net VAT (output − input):";
        worksheet.getCell(currentRow, 1).font = { bold: true };
        worksheet.getCell(currentRow, 3).value = totals.vatAmount - stockInputVatTotal;
      }
    }

    // Compact column widths (only from table downward — ignores merged title rows)
    const MAX_COL = 14;
    const WIDTH_MIN = 6;
    const WIDTH_MAX = 20;
    for (let c = 1; c <= MAX_COL; c++) {
      const col = worksheet.getColumn(c);
      let maxLen = WIDTH_MIN;
      col.eachCell({ includeEmpty: false }, (cell, rowNumber) => {
        if (rowNumber < tableStartRow) return;
        const raw = cell.value;
        const s =
          raw == null
            ? ""
            : typeof raw === "object" && raw instanceof Date
              ? raw.toLocaleDateString()
              : String(raw);
        const n = s.length;
        if (n > maxLen) maxLen = n;
      });
      col.width = Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, maxLen + 1));
    }

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

    if (reportType === "cashbook") {
      const headers = ["Date", "Account head", "Type", "Description", "Flow", "Amount", "Pending"];
      const csvData = cashbookEntries.map((e) => [
        new Date(e.transactionDate).toLocaleDateString(),
        e.accountHead?.name ?? "—",
        e.transactionType,
        e.description.replace(/"/g, '""'),
        e.isInflow === 1 ? "In" : "Out",
        parseFloat(e.amount),
        e.isPending === 1 ? "Yes" : "No",
      ]);
      const csvContent = [headers, ...csvData]
        .map((row) => row.map((cell) => `"${cell}"`).join(","))
        .join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cashbook_report_${dateStr}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (reportType === "pending-invoices") {
      const headers = [
        "Client Name",
        "Invoice No.",
        "Invoice Date",
        "Due Date",
        "LPO No.",
        "Total Amount",
      ];
      const csvData = pendingInvoices.map((inv: any) => {
        const clientName = inv.sale?.client?.name ?? inv.sales?.[0]?.client?.name ?? "—";
        const total = parseFloat(inv.totalAmount);
        const dueDate = inv.dueDate
          ? new Date(inv.dueDate)
          : (() => {
              const d = new Date(inv.invoiceDate);
              d.setMonth(d.getMonth() + 1);
              return d;
            })();
        return [
          clientName,
          inv.invoiceNumber ?? "",
          new Date(inv.invoiceDate).toLocaleDateString(),
          dueDate.toLocaleDateString(),
          inv.lpoNumber ?? inv.sale?.lpoNumber ?? inv.sales?.[0]?.lpoNumber ?? "—",
          total,
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

    if (reportType === "purchase") {
      const headers = [
        "Purchase date",
        "Supplier",
        "Quantity (gal)",
        "Unit price (AED)",
        "VAT %",
        "Amount ex VAT (AED)",
        "VAT (AED)",
        "Total cost (AED)",
      ];
      const csvData = filteredPurchaseStock.map((row) => {
        const supplier =
          row.supplierAccountHeadId != null
            ? supplierNameById[row.supplierAccountHeadId] ?? "—"
            : "—";
        const exVat = parseFloat(row.totalCost) - parseFloat(row.vatAmount);
        return [
          new Date(row.purchaseDate).toLocaleDateString(),
          supplier.replace(/"/g, '""'),
          parseFloat(row.quantityGallons),
          parseFloat(row.purchasePricePerGallon),
          parseFloat(row.vatPercentage),
          exVat,
          parseFloat(row.vatAmount),
          parseFloat(row.totalCost),
        ];
      });
      const csvContent = [headers, ...csvData]
        .map((row) => row.map((cell) => `"${cell}"`).join(","))
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

    const headers =
      reportType === "pending"
        ? [
            "Date of Sale",
            "Client Name",
            "Project",
            "Delivery Note no.",
            "Quantity (Gallons)",
            "Unit Price",
            "Subtotal",
            "VAT Amount",
            "Total Amount",
            "Status",
          ]
        : [
            "Date of Sale",
            "Client Name",
            "LPO Number",
            "Delivery Note no.",
            "Invoice No.",
            "Invoice Date",
            "Quantity (Gallons)",
            "Unit Price",
            "Subtotal",
            "VAT Amount",
            "Total Amount",
            "Status",
          ];
    const csvData =
      reportType === "pending"
        ? filteredSales.map((sale) => [
            new Date(sale.saleDate).toLocaleDateString(),
            sale.client.name,
            (sale as SaleWithClient).project?.name ?? "",
            (sale as Sale).deliveryNoteNumber ?? "",
            sale.quantityGallons,
            sale.salePricePerGallon,
            sale.subtotal,
            sale.vatAmount,
            sale.totalAmount,
            sale.saleStatus,
          ])
        : filteredSales.map((sale) => {
            const inv = saleIdToInvoice[sale.id];
            return [
              new Date(sale.saleDate).toLocaleDateString(),
              sale.client.name,
              sale.lpoNumber ?? "",
              (sale as Sale).deliveryNoteNumber ?? "",
              inv?.invoiceNumber ?? "",
              inv?.invoiceDate
                ? new Date(inv.invoiceDate).toLocaleDateString()
                : sale.invoiceDate
                  ? new Date(sale.invoiceDate).toLocaleDateString()
                  : "",
              sale.quantityGallons,
              sale.salePricePerGallon,
              sale.subtotal,
              sale.vatAmount,
              sale.totalAmount,
              sale.saleStatus,
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
  };

  const reportFiltersActive =
    selectedClient !== "all" ||
    selectedProject !== "all" ||
    Boolean(dateFrom) ||
    Boolean(dateTo) ||
    (reportType === "cashbook" &&
      (cashbookAccountHeadId !== "all" || cashbookFlow !== "all" || cashbookTxnType !== "all"));

  const clearReportFilters = () => {
    setSelectedClient("all");
    setSelectedProject("all");
    setDateFrom("");
    setDateTo("");
    setCashbookAccountHeadId("all");
    setCashbookFlow("all");
    setCashbookTxnType("all");
  };

  return (
    <>
      <Header
        title="Reports"
        description="View and export reports"
      />
      <div className="p-4 lg:p-6 space-y-6">
      <FilterPanel
        title="Report filters"
        hasActiveFilters={reportFiltersActive}
        onClearAll={clearReportFilters}
        defaultOpen
      >
        <div className="space-y-2 min-w-[160px]">
          <label className="text-sm font-medium text-gray-700">Report type</label>
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="whole-sales">Sales Report</SelectItem>
              <SelectItem value="purchase">Purchase report</SelectItem>
              <SelectItem value="pending">Pending LPO (Sales)</SelectItem>
              <SelectItem value="pending-invoices">Pending Invoices</SelectItem>
              <SelectItem value="vat">VAT Report</SelectItem>
              <SelectItem value="profit">Profit report</SelectItem>
              <SelectItem value="cashbook">Cashbook report</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {reportType === "cashbook" && (
          <>
            <div className="space-y-2 min-w-0">
              <label className="text-sm font-medium text-gray-700">Account head</label>
              <Select value={cashbookAccountHeadId} onValueChange={setCashbookAccountHeadId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All account heads</SelectItem>
                  {accountHeadsList.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name} ({h.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 min-w-0">
              <label className="text-sm font-medium text-gray-700">Flow</label>
              <Select value={cashbookFlow} onValueChange={setCashbookFlow}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="inflow">Inflow</SelectItem>
                  <SelectItem value="outflow">Outflow</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 min-w-0">
              <label className="text-sm font-medium text-gray-700">Transaction type</label>
              <Select value={cashbookTxnType} onValueChange={setCashbookTxnType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {["Invoice", "Stock Purchase", "Supplier Payment", "Investment", "Expense", "Withdrawal", "Other"].map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        <div className={`space-y-2 min-w-[160px] ${reportType === "cashbook" || reportType === "purchase" ? "opacity-50 pointer-events-none" : ""}`}>
          <label className="text-sm font-medium text-gray-700">Client</label>
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className={`space-y-2 min-w-[160px] ${reportType === "purchase" ? "opacity-50 pointer-events-none" : ""}`}>
          <label className="text-sm font-medium text-gray-700">Project</label>
          <Select
            value={selectedProject}
            onValueChange={setSelectedProject}
            disabled={selectedClient === "all" || reportType === "purchase"}
          >
            <SelectTrigger className={selectedClient === "all" || reportType === "purchase" ? "opacity-70" : ""}>
              <SelectValue
                placeholder={
                  selectedClient === "all"
                    ? "Select a client first"
                    : "All projects"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {clientProjects.map((p: { id: string; name: string }) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedClient === "all" && (
            <p className="text-xs text-gray-500">Choose a client to filter by project.</p>
          )}
        </div>

        <DateRangePicker
          startDate={dateFrom}
          endDate={dateTo}
          onStartDateChange={setDateFrom}
          onEndDateChange={setDateTo}
          onClear={() => {
            setDateFrom("");
            setDateTo("");
          }}
          label="Period"
        />

        <div className="col-span-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 mt-1 border-t border-gray-100">
          <p className="text-sm text-gray-500">
            Filters apply to the table below. Export includes the current view.
          </p>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button onClick={exportToExcel} className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </Button>
            <Button onClick={exportToCSV} variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              CSV
            </Button>
          </div>
        </div>
      </FilterPanel>

      {/* Summary Cards */}
      <div
        className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${
          reportType === "vat"
            ? "lg:grid-cols-3 xl:grid-cols-6"
            : reportType === "profit"
              ? "lg:grid-cols-4"
              : reportType === "purchase"
                ? "lg:grid-cols-3 xl:grid-cols-5"
                : "lg:grid-cols-4"
        }`}
      >
        {reportType === "profit" ? null : reportType === "cashbook" ? (
          <>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-gray-600">Rows</p>
                <p className="text-2xl font-bold text-gray-900">{cashbookEntries.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-gray-600">Inflow (filtered)</p>
                <p className="text-2xl font-bold text-emerald-700">{CURRENCY} {cashbookTotals.inflow.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-gray-600">Outflow (filtered)</p>
                <p className="text-2xl font-bold text-red-700">{CURRENCY} {cashbookTotals.outflow.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-gray-600">Net (in − out)</p>
                <p className="text-2xl font-bold text-gray-900">{CURRENCY} {(cashbookTotals.inflow - cashbookTotals.outflow).toFixed(2)}</p>
              </CardContent>
            </Card>
          </>
        ) : reportType === "purchase" ? (
          <>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Purchases</p>
                    <p className="text-2xl font-bold text-gray-900">{filteredPurchaseStock.length}</p>
                  </div>
                  <FileText className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total quantity</p>
                    <p className="text-2xl font-bold text-gray-900">{purchaseTotals.quantity.toFixed(0)}</p>
                    <p className="text-xs text-gray-500">gallons</p>
                  </div>
                  <Calendar className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Amount (ex VAT)</p>
                    <p className="text-2xl font-bold text-gray-900">{CURRENCY} {purchaseTotals.costExVat.toFixed(2)}</p>
                    <p className="text-xs text-gray-500">VAT-free purchase value</p>
                  </div>
                  <div className="h-8 w-8 bg-slate-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-slate-600">Σ</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Input VAT</p>
                    <p className="text-2xl font-bold text-gray-900">{CURRENCY} {purchaseTotals.vatAmount.toFixed(2)}</p>
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
                    <p className="text-sm font-medium text-gray-600">Total cost</p>
                    <p className="text-2xl font-bold text-gray-900">{CURRENCY} {purchaseTotals.totalCost.toFixed(2)}</p>
                  </div>
                  <div className="h-8 w-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-primary-600">₹</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : reportType === "vat" ? (
          <>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-gray-600">Sales subtotal (excl. VAT)</p>
                <p className="text-2xl font-bold text-gray-900">{CURRENCY} {totals.subtotal.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-gray-600">Output VAT (on sales)</p>
                <p className="text-2xl font-bold text-orange-700">{CURRENCY} {totals.vatAmount.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-gray-600">Input VAT (stock purchases)</p>
                <p className="text-2xl font-bold text-teal-700">{CURRENCY} {stockInputVatTotal.toFixed(2)}</p>
                <p className="text-xs text-gray-500">{filteredStock.length} purchase(s)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-gray-600">Net VAT (output − input)</p>
                <p className={`text-2xl font-bold ${totals.vatAmount - stockInputVatTotal >= 0 ? "text-amber-800" : "text-emerald-700"}`}>
                  {CURRENCY} {(totals.vatAmount - stockInputVatTotal).toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">Typical VAT payable direction</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-gray-600">Sales total (incl. VAT)</p>
                <p className="text-2xl font-bold text-gray-900">{CURRENCY} {totals.totalAmount.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm font-medium text-gray-600">Sales count</p>
                <p className="text-2xl font-bold text-gray-900">{filteredSales.length}</p>
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{reportType === "pending-invoices" ? "Invoices" : "Total Records"}</p>
                    <p className="text-2xl font-bold text-gray-900">{reportType === "pending-invoices" ? invoiceTotals.count : filteredSales.length}</p>
                  </div>
                  <FileText className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            {reportType !== "pending-invoices" && (
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
              </Card>
            )}
            {reportType !== "pending-invoices" && (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">VAT Amount</p>
                      <p className="text-2xl font-bold text-gray-900">{CURRENCY} {totals.vatAmount.toFixed(2)}</p>
                    </div>
                    <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-orange-600">VAT</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Amount</p>
                    <p className="text-2xl font-bold text-gray-900">{CURRENCY} {(reportType === "pending-invoices" ? invoiceTotals.totalAmount : totals.totalAmount).toFixed(2)}</p>
                  </div>
                  <div className="h-8 w-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-primary-600">₹</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Report Data */}
      {reportType === "cashbook" ? (
        <Card>
          <CardHeader>
            <CardTitle>Cashbook report</CardTitle>
          </CardHeader>
          <CardContent>
            {cashbookEntries.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No entries match the filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-2">Date</th>
                      <th className="text-left p-2">Account head</th>
                      <th className="text-left p-2">Type</th>
                      <th className="text-left p-2">Description</th>
                      <th className="text-right p-2">Amount</th>
                      <th className="text-center p-2">Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashbookEntries.map((e) => (
                      <tr key={e.id} className="border-b">
                        <td className="p-2">{new Date(e.transactionDate).toLocaleDateString()}</td>
                        <td className="p-2 font-medium">{e.accountHead?.name ?? "—"}</td>
                        <td className="p-2">{e.transactionType}</td>
                        <td className="p-2 max-w-xs truncate" title={e.description}>{e.description}</td>
                        <td className={`p-2 text-right font-medium ${e.isInflow === 1 ? "text-emerald-700" : "text-red-700"}`}>
                          {e.isInflow === 1 ? "+" : "-"}{CURRENCY} {parseFloat(e.amount).toFixed(2)}
                        </td>
                        <td className="p-2 text-center">{e.isPending === 1 ? "Yes" : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : reportType === "purchase" ? (
        <Card>
          <CardHeader>
            <CardTitle>Purchase report</CardTitle>
            <p className="text-sm text-muted-foreground font-normal">
              Fuel and stock purchases in the selected period (by purchase date). Client and project filters do not apply.
            </p>
          </CardHeader>
          <CardContent>
            {filteredPurchaseStock.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No stock purchases match the date range.</p>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-2 font-medium">Purchase date</th>
                        <th className="text-left p-2 font-medium">Supplier</th>
                        <th className="text-right p-2 font-medium">Qty (gal)</th>
                        <th className="text-right p-2 font-medium">Unit price</th>
                        <th className="text-right p-2 font-medium">VAT %</th>
                        <th className="text-right p-2 font-medium">Amount (ex VAT)</th>
                        <th className="text-right p-2 font-medium">VAT</th>
                        <th className="text-right p-2 font-medium">Total cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPurchaseStock.map((row) => (
                        <tr key={row.id} className="border-b">
                          <td className="p-2">{new Date(row.purchaseDate).toLocaleDateString()}</td>
                          <td className="p-2 font-medium">
                            {row.supplierAccountHeadId != null
                              ? supplierNameById[row.supplierAccountHeadId] ?? "—"
                              : "—"}
                          </td>
                          <td className="p-2 text-right tabular-nums">{parseFloat(row.quantityGallons).toFixed(0)}</td>
                          <td className="p-2 text-right tabular-nums">{CURRENCY} {parseFloat(row.purchasePricePerGallon).toFixed(SALE_PURCHASE_PPG_DECIMAL_PLACES)}</td>
                          <td className="p-2 text-right tabular-nums">{parseFloat(row.vatPercentage).toFixed(2)}%</td>
                          <td className="p-2 text-right tabular-nums">
                            {CURRENCY}{" "}
                            {(parseFloat(row.totalCost) - parseFloat(row.vatAmount)).toFixed(2)}
                          </td>
                          <td className="p-2 text-right tabular-nums">{CURRENCY} {parseFloat(row.vatAmount).toFixed(2)}</td>
                          <td className="p-2 text-right font-medium tabular-nums">{CURRENCY} {parseFloat(row.totalCost).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="md:hidden space-y-3">
                  {filteredPurchaseStock.map((row) => (
                    <Card key={row.id}>
                      <CardContent className="p-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Date</span>
                          <span className="font-medium">{new Date(row.purchaseDate).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Supplier</span>
                          <span className="font-medium text-right">
                            {row.supplierAccountHeadId != null
                              ? supplierNameById[row.supplierAccountHeadId] ?? "—"
                              : "—"}
                          </span>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-muted-foreground text-xs">Qty</span>
                            <p className="font-medium">{parseFloat(row.quantityGallons).toFixed(0)} gal</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">Unit price</span>
                            <p className="font-medium">{CURRENCY} {parseFloat(row.purchasePricePerGallon).toFixed(SALE_PURCHASE_PPG_DECIMAL_PLACES)}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">Ex VAT</span>
                            <p className="font-medium">
                              {CURRENCY}{" "}
                              {(parseFloat(row.totalCost) - parseFloat(row.vatAmount)).toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">VAT</span>
                            <p className="font-medium">{parseFloat(row.vatPercentage).toFixed(2)}% · {CURRENCY} {parseFloat(row.vatAmount).toFixed(2)}</p>
                          </div>
                          <div className="col-span-2">
                            <span className="text-muted-foreground text-xs">Total</span>
                            <p className="font-semibold">{CURRENCY} {parseFloat(row.totalCost).toFixed(2)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="mt-6 pt-4 border-t bg-gray-50 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">Total quantity:</span>
                      <span className="font-bold">{purchaseTotals.quantity.toFixed(0)} gal</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">Total (ex VAT):</span>
                      <span className="font-bold">{CURRENCY} {purchaseTotals.costExVat.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">Total VAT:</span>
                      <span className="font-bold">{CURRENCY} {purchaseTotals.vatAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">Total cost:</span>
                      <span className="font-bold text-lg">{CURRENCY} {purchaseTotals.totalCost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : reportType === "profit" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between space-y-0 pb-2">
              <div>
                <CardTitle>Profit report</CardTitle>
                <p className="text-sm text-muted-foreground font-normal mt-1.5">
                  Gross profit over time for the filtered period. Revenue and COGS exclude VAT; figures respect client, project, and date filters above.
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {dateFrom || "Start"} → {dateTo || "End"}
                  {selectedClient !== "all" && clients.find((c) => c.id === selectedClient) && (
                    <> · {clients.find((c) => c.id === selectedClient)!.name}</>
                  )}
                </p>
              </div>
              <div className="flex rounded-lg border border-border bg-muted/30 p-1 shrink-0">
                <Button
                  type="button"
                  variant={profitGranularity === "monthly" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => setProfitGranularity("monthly")}
                >
                  Monthly
                </Button>
                <Button
                  type="button"
                  variant={profitGranularity === "annual" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => setProfitGranularity("annual")}
                >
                  Annual
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {profitTimeSeries.length === 0 ? (
                <div className="py-16 text-center border border-dashed rounded-lg bg-muted/20">
                  <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-3 font-medium text-foreground">No sales in this period</p>
                  <p className="mt-1 text-sm text-muted-foreground">Adjust the date range or filters to see profit.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/40 p-4 col-span-2 md:col-span-1 lg:col-span-2">
                      <p className="text-xs font-medium text-muted-foreground">Gross profit</p>
                      <p className="mt-1 text-xl font-bold tabular-nums text-emerald-900">
                        {CURRENCY} {profitTotals.grossProfit.toFixed(SALE_COGS_DECIMAL_PLACES)}
                      </p>
                      <p className="text-xs text-emerald-800/80 mt-0.5">After COGS (excl. VAT)</p>
                    </div>
                    <div className="rounded-lg border bg-card p-4">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" /> Revenue
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">{CURRENCY} {profitTotals.revenue.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">excl. VAT</p>
                    </div>
                    <div className="rounded-lg border bg-card p-4">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Wallet className="h-3 w-3" /> COGS
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">{CURRENCY} {profitTotals.cogs.toFixed(SALE_COGS_DECIMAL_PLACES)}</p>
                    </div>
                    <div className="rounded-lg border bg-card p-4">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Percent className="h-3 w-3" /> Margin
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">{profitTotals.marginPct.toFixed(1)}%</p>
                    </div>
                    <div className="rounded-lg border bg-card p-4">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Hash className="h-3 w-3" /> Sales
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">{profitTotals.saleCount}</p>
                      <p className="text-xs text-muted-foreground">
                        {CURRENCY} {profitTotals.avgProfitPerSale.toFixed(0)} avg profit
                      </p>
                    </div>
                    <div className="rounded-lg border bg-card p-4">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <Package className="h-3 w-3" /> Volume
                      </p>
                      <p className="mt-1 text-lg font-semibold tabular-nums">{profitTotals.totalGallons.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                      <p className="text-xs text-muted-foreground">gallons sold</p>
                    </div>
                  </div>

                  {profitInsights && profitInsights.periodCount > 1 && (
                    <div className="flex flex-wrap gap-3 text-sm rounded-lg border bg-muted/30 px-4 py-3">
                      <span className="text-muted-foreground">
                        <span className="font-medium text-foreground">Best:</span>{" "}
                        {profitInsights.best.label} ({CURRENCY} {profitInsights.best.grossProfit.toFixed(0)})
                      </span>
                      <span className="text-muted-foreground hidden sm:inline">·</span>
                      <span className="text-muted-foreground">
                        <span className="font-medium text-foreground">Lowest:</span>{" "}
                        {profitInsights.worst.label} ({CURRENCY} {profitInsights.worst.grossProfit.toFixed(0)})
                      </span>
                      <span className="text-muted-foreground hidden sm:inline">·</span>
                      <span className={`inline-flex items-center gap-1 font-medium ${profitInsights.trend >= 0 ? "text-emerald-700" : "text-amber-800"}`}>
                        {profitInsights.trend >= 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        {profitInsights.trend >= 0 ? "Up" : "Down"}{" "}
                        {CURRENCY} {Math.abs(profitInsights.trend).toFixed(0)} from first to last period
                      </span>
                    </div>
                  )}

                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3">Gross profit over time</h3>
                    <div className="rounded-lg border bg-card p-4">
                      <ChartContainer
                        config={{
                          grossProfit: { label: "Gross profit", color: "hsl(142 55% 36%)" },
                          revenue: { label: "Revenue (excl. VAT)", color: "hsl(214 60% 48%)" },
                        }}
                        className="h-[min(380px,55vh)] w-full"
                      >
                        <ComposedChart data={profitTimeSeries} margin={{ top: 8, right: 12, left: 8, bottom: profitGranularity === "monthly" ? 56 : 24 }}>
                          <defs>
                            <linearGradient id="profitAreaFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="hsl(142 55% 36%)" stopOpacity={0.35} />
                              <stop offset="100%" stopColor="hsl(142 55% 36%)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                            interval={profitGranularity === "monthly" ? "preserveStartEnd" : 0}
                            angle={profitGranularity === "monthly" ? -35 : 0}
                            textAnchor={profitGranularity === "monthly" ? "end" : "middle"}
                            height={profitGranularity === "monthly" ? 52 : 28}
                          />
                          <YAxis
                            tick={{ fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                            width={52}
                            tickFormatter={(v) =>
                              v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : String(v)
                            }
                          />
                          <ChartTooltip
                            content={
                              <ChartTooltipContent
                                formatter={(value) => (
                                  <span className="font-mono tabular-nums">
                                    {typeof value === "number" ? `${CURRENCY} ${value.toFixed(2)}` : String(value)}
                                  </span>
                                )}
                              />
                            }
                          />
                          <Legend wrapperStyle={{ paddingTop: 12 }} />
                          <Area
                            type="monotone"
                            dataKey="grossProfit"
                            name="Gross profit"
                            stroke="hsl(142 55% 36%)"
                            strokeWidth={2}
                            fill="url(#profitAreaFill)"
                          />
                          <Line
                            type="monotone"
                            dataKey="revenue"
                            name="Revenue (excl. VAT)"
                            stroke="hsl(214 60% 48%)"
                            strokeWidth={1.5}
                            strokeDasharray="6 4"
                            dot={false}
                          />
                        </ComposedChart>
                      </ChartContainer>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Solid area = gross profit each {profitGranularity === "monthly" ? "month" : "year"}. Dashed line = revenue (excl. VAT) for scale context.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3">Period breakdown</h3>
                    <div className="rounded-lg border overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="px-4 py-3 text-left font-medium">Period</th>
                              <th className="px-4 py-3 text-right font-medium">Revenue</th>
                              <th className="px-4 py-3 text-right font-medium">COGS</th>
                              <th className="px-4 py-3 text-right font-medium">Gross profit</th>
                              <th className="px-4 py-3 text-right font-medium">Margin</th>
                              <th className="px-4 py-3 text-right font-medium">Sales</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(profitGranularity === "monthly" ? monthlyProfitData : annualProfitData).map((row) => (
                              <tr key={"month" in row ? row.month : row.period} className="border-b last:border-0 hover:bg-muted/30">
                                <td className="px-4 py-2.5 font-medium">{"monthLabel" in row ? row.monthLabel : row.period}</td>
                                <td className="px-4 py-2.5 text-right tabular-nums">{CURRENCY} {row.revenue.toFixed(2)}</td>
                                <td className="px-4 py-2.5 text-right tabular-nums">{CURRENCY} {row.cogs.toFixed(SALE_COGS_DECIMAL_PLACES)}</td>
                                <td className="px-4 py-2.5 text-right tabular-nums font-medium text-emerald-800">
                                  {CURRENCY} {row.grossProfit.toFixed(SALE_COGS_DECIMAL_PLACES)}
                                </td>
                                <td className="px-4 py-2.5 text-right tabular-nums">{row.marginPct.toFixed(1)}%</td>
                                <td className="px-4 py-2.5 text-right text-muted-foreground">{row.count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
      <Card>
        <CardHeader>
          <CardTitle>
            {reportType === "pending" ? "Pending LPO Report" : reportType === "whole-sales" ? "Sales Report" : reportType === "pending-invoices" ? "Pending Invoices Report" : "VAT Report"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reportType === "pending-invoices" ? (
            pendingInvoices.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No pending invoices found for the selected criteria</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 text-sm font-medium text-gray-600">Client</th>
                      <th className="text-left p-3 text-sm font-medium text-gray-600">Invoice No.</th>
                      <th className="text-left p-3 text-sm font-medium text-gray-600">Invoice Date</th>
                      <th className="text-left p-3 text-sm font-medium text-gray-600">Due Date</th>
                      <th className="text-left p-3 text-sm font-medium text-gray-600">LPO No.</th>
                      <th className="text-right p-3 text-sm font-medium text-gray-600">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingInvoices.map((inv: any) => {
                      const total = parseFloat(inv.totalAmount);
                      const dueDate = inv.dueDate ? new Date(inv.dueDate) : (() => { const d = new Date(inv.invoiceDate); d.setMonth(d.getMonth() + 1); return d; })();
                      const clientName =
                        inv.sale?.client?.name ?? inv.sales?.[0]?.client?.name ?? "—";
                      return (
                        <tr key={inv.id} className="border-b hover:bg-gray-50">
                          <td className="p-3 text-sm font-medium">{clientName}</td>
                          <td className="p-3 text-sm">{inv.invoiceNumber}</td>
                          <td className="p-3 text-sm">{new Date(inv.invoiceDate).toLocaleDateString()}</td>
                          <td className="p-3 text-sm">{dueDate.toLocaleDateString()}</td>
                          <td className="p-3 text-sm">{inv.lpoNumber || (inv.sale?.lpoNumber ?? inv.sales?.[0]?.lpoNumber ?? "—")}</td>
                          <td className="p-3 text-sm text-right font-medium">{CURRENCY} {total.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : reportType === "vat" ? (
            filteredSales.length === 0 && filteredStock.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <p className="text-gray-500">No sales or stock purchases in this date range.</p>
                <p className="text-sm text-gray-400">Output VAT comes from sales; input VAT from stock purchases (same period filter).</p>
              </div>
            ) : (
              <div className="space-y-6">
                <p className="text-sm text-gray-600 rounded-md bg-muted/50 p-3">
                  <strong>VAT on sales</strong> (output) is what you charge customers. <strong>VAT on stock</strong> (input) is what you pay suppliers—both matter for net VAT due (confirm with your accountant).
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-gray-600">View:</span>
                  <Button
                    type="button"
                    variant={vatGranularity === "monthly" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setVatGranularity("monthly")}
                  >
                    Monthly
                  </Button>
                  <Button
                    type="button"
                    variant={vatGranularity === "annual" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setVatGranularity("annual")}
                  >
                    Annual
                  </Button>
                </div>
                <div className="min-h-[280px] w-full">
                  <p className="text-sm font-medium text-gray-700 mb-2">Sales: subtotal + output VAT (stacked)</p>
                  <ChartContainer
                    config={{
                      subtotal: { label: "Subtotal (excl. VAT)", color: "hsl(142 40% 40%)" },
                      vat: { label: "Output VAT", color: "hsl(28 90% 48%)" },
                    }}
                    className="h-[280px] w-full"
                  >
                    {vatGranularity === "monthly" ? (
                      <BarChart data={vatByMonth} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} interval={0} angle={-35} textAnchor="end" height={60} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : String(v))} />
                        <ChartTooltip content={<ChartTooltipContent formatter={(v) => [`${CURRENCY} ${Number(v).toFixed(2)}`, ""]} />} />
                        <Legend />
                        <Bar dataKey="subtotal" name="Subtotal" stackId="a" fill="var(--color-subtotal)" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="vat" name="Output VAT" stackId="a" fill="var(--color-vat)" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    ) : (
                      <BarChart data={vatByYear} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : String(v))} />
                        <ChartTooltip content={<ChartTooltipContent formatter={(v) => [`${CURRENCY} ${Number(v).toFixed(2)}`, ""]} />} />
                        <Legend />
                        <Bar dataKey="subtotal" name="Subtotal" stackId="a" fill="var(--color-subtotal)" />
                        <Bar dataKey="vat" name="Output VAT" stackId="a" fill="var(--color-vat)" />
                      </BarChart>
                    )}
                  </ChartContainer>
                </div>
                <div className="min-h-[260px] w-full">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Output VAT vs input VAT (stock){vatGranularity === "monthly" ? " — by month" : " — by year"}
                  </p>
                  <ChartContainer
                    config={{
                      outputVat: { label: "Output VAT (sales)", color: "hsl(28 90% 48%)" },
                      inputVat: { label: "Input VAT (stock)", color: "hsl(175 45% 38%)" },
                    }}
                    className="h-[260px] w-full"
                  >
                    <BarChart
                      data={vatGranularity === "monthly" ? vatCombinedMonthly : vatCombinedAnnual.map((r) => ({ ...r, monthLabel: r.year }))}
                      margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey={vatGranularity === "monthly" ? "monthLabel" : "year"}
                        tick={{ fontSize: 11 }}
                        interval={0}
                        angle={vatGranularity === "monthly" ? -35 : 0}
                        textAnchor={vatGranularity === "monthly" ? "end" : "middle"}
                        height={vatGranularity === "monthly" ? 60 : 28}
                      />
                      <YAxis tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent formatter={(v) => [`${CURRENCY} ${Number(v).toFixed(2)}`, ""]} />} />
                      <Legend />
                      <Bar dataKey="outputVat" name="Output VAT" fill="var(--color-outputVat)" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="inputVat" name="Input VAT (stock)" fill="var(--color-inputVat)" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </div>
                <div className="min-h-[220px] w-full">
                  <p className="text-sm font-medium text-gray-700 mb-2">Net VAT (output − input) by period</p>
                  <ChartContainer
                    config={{ netVat: { label: "Net VAT", color: "hsl(35 80% 42%)" } }}
                    className="h-[220px] w-full"
                  >
                    <BarChart
                      data={vatGranularity === "monthly" ? vatCombinedMonthly : vatCombinedAnnual.map((r) => ({ ...r, monthLabel: r.year }))}
                      margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey={vatGranularity === "monthly" ? "monthLabel" : "year"} tick={{ fontSize: 11 }} interval={0} angle={vatGranularity === "monthly" ? -35 : 0} textAnchor={vatGranularity === "monthly" ? "end" : "middle"} height={vatGranularity === "monthly" ? 60 : 30} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent formatter={(v) => [`${CURRENCY} ${Number(v).toFixed(2)}`, "Net VAT"]} />} />
                      <Bar dataKey="netVat" name="Net VAT" fill="var(--color-netVat)" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </div>
                <Collapsible open={showVatLineItems} onOpenChange={setShowVatLineItems}>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm" type="button">
                      {showVatLineItems ? "Hide" : "Show"} line items ({filteredSales.length})
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 space-y-4">
                    <div className="hidden md:block overflow-x-auto border rounded-md">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left p-2 font-medium">Date</th>
                            <th className="text-left p-2 font-medium">Client</th>
                            <th className="text-left p-2 font-medium">Project</th>
                            <th className="text-left p-2 font-medium">LPO</th>
                            <th className="text-right p-2 font-medium">Subtotal</th>
                            <th className="text-right p-2 font-medium">VAT</th>
                            <th className="text-right p-2 font-medium">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSales.map((sale) => (
                            <tr key={sale.id} className="border-b">
                              <td className="p-2">{new Date(sale.saleDate).toLocaleDateString()}</td>
                              <td className="p-2 font-medium">{sale.client.name}</td>
                              <td className="p-2">{(sale as SaleWithClient).project?.name ?? "—"}</td>
                              <td className="p-2">{sale.lpoNumber ?? "—"}</td>
                              <td className="p-2 text-right">{CURRENCY} {parseFloat(sale.subtotal).toFixed(2)}</td>
                              <td className="p-2 text-right">{CURRENCY} {parseFloat(sale.vatAmount).toFixed(2)}</td>
                              <td className="p-2 text-right font-medium">{CURRENCY} {parseFloat(sale.totalAmount).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )
          ) : filteredSales.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No records found for the selected criteria</p>
            </div>
          ) : (
            <>
              {/* Desktop Table — Pending LPO only */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 text-sm font-medium text-gray-600">Date</th>
                      <th className="text-left p-3 text-sm font-medium text-gray-600">Client</th>
                      <th className="text-left p-3 text-sm font-medium text-gray-600">Project</th>
                      <th className="text-left p-3 text-sm font-medium text-gray-600">Delivery Note no.</th>
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
                          <td className="p-3 text-sm">{(sale as SaleWithClient).project?.name ?? "—"}</td>
                          <td className="p-3 text-sm">{(sale as Sale).deliveryNoteNumber ?? "—"}</td>
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
                            <p className="text-sm text-gray-600">
                              Delivery Note no.: {(sale as Sale).deliveryNoteNumber ?? "—"}
                            </p>
                          {(sale as SaleWithClient).project?.name && (
                            <p className="text-sm text-gray-500">Project: {(sale as SaleWithClient).project?.name}</p>
                          )}
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
      )}
      </div>
    </>
  );
}