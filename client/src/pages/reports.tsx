import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Download, Filter, FileText, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CURRENCY, STATUS_COLORS } from "@/lib/constants";
import type { Sale, Client } from "@shared/schema";
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
    } else if (reportType === "vat") {
      return true; // All sales for VAT report
    }

    return true;
  });

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

  const exportToExcel = async () => {
    // Create client details section for the selected client
    const selectedClientData = selectedClient !== "all" 
      ? clients.find(c => c.id === selectedClient)
      : null;

    // Create workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const sheetName = selectedClientData ? selectedClientData.name.substring(0, 30) : reportType === 'pending' ? 'Pending Business' : 'VAT Report';
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
    worksheet.getCell(`A${currentRow}`).value = `Report Type: ${reportType === 'pending' ? 'Pending Business Report' : 'VAT Report'}`;
    worksheet.getCell(`A${currentRow}`).font = { bold: true };
    currentRow++;
    
    if (dateFrom || dateTo) {
      worksheet.getCell(`A${currentRow}`).value = `Date Range: ${dateFrom || 'Start'} to ${dateTo || 'End'}`;
      currentRow++;
    }
    currentRow++; // Empty row

    // Headers
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
      "Status"
    ];
    
    // Add headers
    headers.forEach((header, index) => {
      const cell = worksheet.getCell(currentRow, index + 1);
      cell.value = header;
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
    });
    currentRow++;

    // Add sales data
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
        sale.saleStatus
      ];

      rowData.forEach((value, index) => {
        worksheet.getCell(currentRow, index + 1).value = value;
      });
      currentRow++;
    });

    // Add totals
    currentRow++; // Empty row
    worksheet.getCell(currentRow, 6).value = "TOTALS:";
    worksheet.getCell(currentRow, 6).font = { bold: true };
    worksheet.getCell(currentRow, 7).value = totals.quantity;
    worksheet.getCell(currentRow, 8).value = totals.subtotal;
    worksheet.getCell(currentRow, 9).value = totals.vatAmount;
    worksheet.getCell(currentRow, 10).value = totals.totalAmount;

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
    const dateStr = new Date().toISOString().split('T')[0];
    const clientStr = selectedClientData ? `_${selectedClientData.name.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
    const filename = `${reportType}_report${clientStr}_${dateStr}.xlsx`;

    // Save file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const exportToCSV = () => {
    const headers = [
      "Date of Sale",
      "Client Name", 
      "LPO Number",
      "Quantity (Gallons)",
      "Unit Price",
      "Subtotal",
      "VAT Amount",
      "Total Amount",
      "Status"
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
      sale.saleStatus
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${reportType}_report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600">Generate client and VAT reports for your business</p>
        </div>
      </div>

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
                  <SelectItem value="pending">Pending Business</SelectItem>
                  <SelectItem value="vat">VAT Report</SelectItem>
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
                <p className="text-sm font-medium text-gray-600">Total Records</p>
                <p className="text-2xl font-bold text-gray-900">{filteredSales.length}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

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

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Amount</p>
                <p className="text-2xl font-bold text-gray-900">{CURRENCY} {totals.totalAmount.toFixed(2)}</p>
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
            {reportType === "pending" ? "Pending Business Report" : "VAT Report"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredSales.length === 0 ? (
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
  );
}