import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Header from "@/components/layout/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Building2, Palette, FileText, CreditCard, Save, Eye } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { BusinessSettings, InsertBusinessSettings } from "@shared/schema";
import { insertBusinessSettingsSchema } from "@shared/schema";
import { generateInvoicePDF } from "@/lib/pdf";

// Mock invoice data for preview
const mockInvoiceData = {
  id: "preview",
  invoiceNumber: "INV-2024-001",
  invoiceDate: new Date(),
  totalAmount: "1250.00",
  vatAmount: "62.50",
  status: "Generated" as const,
  saleId: "mock",
  createdAt: new Date(),
  sale: {
    id: "mock",
    clientId: "mock",
    projectId: "mock",
    lpoNumber: "LPO-2024-001",
    saleDate: new Date(),
    quantityGallons: "500.00",
    salePricePerGallon: "2.50",
    purchasePricePerGallon: "2.00",
    vatPercentage: "5.00",
    vatAmount: "62.50",
    totalAmount: "1250.00",
    pendingAmount: "625.00",
    saleStatus: "Pending" as const,
    createdAt: new Date(),
    client: {
      id: "mock",
      name: "Sample Client Ltd",
      contactPerson: "John Doe",
      phoneNumber: "+1-234-567-8900",
      email: "john@sampleclient.com",
      address: "123 Business Street, Commercial District, City 12345",
      createdAt: new Date()
    },
    project: {
      id: "mock",
      clientId: "mock",
      name: "Construction Project Alpha",
      description: "Major construction project",
      status: "Active" as const,
      createdAt: new Date()
    }
  }
};

export default function BusinessSettings() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("company");

  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/business-settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/business-settings");
      return res.json() as Promise<BusinessSettings>;
    }
  });

  const form = useForm<InsertBusinessSettings>({
    resolver: zodResolver(insertBusinessSettingsSchema),
    values: settings || {
      companyName: "FuelFlow Trading",
      companyAddress: "",
      companyCity: "",
      companyState: "",
      companyZip: "",
      companyCountry: "",
      companyPhone: "",
      companyEmail: "",
      companyWebsite: "",
      taxNumber: "",
      vatNumber: "",
      invoicePrefix: "INV",
      invoiceNumberStart: 1000,
      primaryColor: "#1976D2",
      secondaryColor: "#666666",
      logoUrl: "",
      defaultPaymentTerms: "Net 30",
      bankName: "",
      bankAccount: "",
      bankRoutingNumber: "",
      invoiceFooter: "Thank you for your business!",
      templateStyle: "modern"
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertBusinessSettings) => {
      const res = await apiRequest("PUT", "/api/business-settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-settings"] });
      toast({
        title: "Settings Updated",
        description: "Business settings have been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update settings",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (data: InsertBusinessSettings) => {
    updateMutation.mutate(data);
  };

  const handlePreviewInvoice = () => {
    if (settings) {
      generateInvoicePDF(mockInvoiceData, { ...settings, ...form.getValues() });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading business settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Header
        title="Business Settings"
        subtitle="Configure your company information and invoice templates"
      />

      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="company" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Company
            </TabsTrigger>
            <TabsTrigger value="invoice" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Invoice
            </TabsTrigger>
            <TabsTrigger value="design" className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Design
            </TabsTrigger>
            <TabsTrigger value="payment" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Payment
            </TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>
                  Basic company details that will appear on your invoices
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name *</Label>
                    <Input
                      id="companyName"
                      {...form.register("companyName")}
                      placeholder="Your Company Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyWebsite">Website</Label>
                    <Input
                      id="companyWebsite"
                      {...form.register("companyWebsite")}
                      placeholder="https://yourcompany.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="companyAddress">Address</Label>
                  <Textarea
                    id="companyAddress"
                    {...form.register("companyAddress")}
                    placeholder="Street address"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyCity">City</Label>
                    <Input
                      id="companyCity"
                      {...form.register("companyCity")}
                      placeholder="City"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyState">State/Province</Label>
                    <Input
                      id="companyState"
                      {...form.register("companyState")}
                      placeholder="State"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyZip">ZIP/Postal Code</Label>
                    <Input
                      id="companyZip"
                      {...form.register("companyZip")}
                      placeholder="12345"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyPhone">Phone</Label>
                    <Input
                      id="companyPhone"
                      {...form.register("companyPhone")}
                      placeholder="+1-234-567-8900"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="companyEmail">Email</Label>
                    <Input
                      id="companyEmail"
                      type="email"
                      {...form.register("companyEmail")}
                      placeholder="info@yourcompany.com"
                    />
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="taxNumber">Tax Number</Label>
                    <Input
                      id="taxNumber"
                      {...form.register("taxNumber")}
                      placeholder="Tax identification number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vatNumber">VAT Number</Label>
                    <Input
                      id="vatNumber"
                      {...form.register("vatNumber")}
                      placeholder="VAT registration number"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoice" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Invoice Configuration</CardTitle>
                <CardDescription>
                  Configure invoice numbering and default terms
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="invoicePrefix">Invoice Prefix</Label>
                    <Input
                      id="invoicePrefix"
                      {...form.register("invoicePrefix")}
                      placeholder="INV"
                    />
                    <p className="text-sm text-gray-500">
                      Prefix for invoice numbers (e.g., INV-2024-001)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invoiceNumberStart">Starting Number</Label>
                    <Input
                      id="invoiceNumberStart"
                      type="number"
                      {...form.register("invoiceNumberStart", { valueAsNumber: true })}
                      placeholder="1000"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defaultPaymentTerms">Default Payment Terms</Label>
                  <Select
                    value={form.watch("defaultPaymentTerms")}
                    onValueChange={(value) => form.setValue("defaultPaymentTerms", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment terms" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                      <SelectItem value="Net 15">Net 15 days</SelectItem>
                      <SelectItem value="Net 30">Net 30 days</SelectItem>
                      <SelectItem value="Net 45">Net 45 days</SelectItem>
                      <SelectItem value="Net 60">Net 60 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoiceFooter">Invoice Footer</Label>
                  <Textarea
                    id="invoiceFooter"
                    {...form.register("invoiceFooter")}
                    placeholder="Thank you for your business!"
                    rows={3}
                  />
                  <p className="text-sm text-gray-500">
                    Text that appears at the bottom of invoices
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="design" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Invoice Design</CardTitle>
                <CardDescription>
                  Customize the appearance of your invoices
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="templateStyle">Template Style</Label>
                  <Select
                    value={form.watch("templateStyle")}
                    onValueChange={(value) => form.setValue("templateStyle", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select template style" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="modern">
                        <div className="flex items-center gap-2">
                          Modern
                          <Badge variant="secondary">Recommended</Badge>
                        </div>
                      </SelectItem>
                      <SelectItem value="classic">Classic</SelectItem>
                      <SelectItem value="minimal">Minimal</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-500">
                    Choose the overall design style for your invoices
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="primaryColor">Primary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="primaryColor"
                        type="color"
                        {...form.register("primaryColor")}
                        className="w-16 h-10 p-1 border rounded"
                      />
                      <Input
                        {...form.register("primaryColor")}
                        placeholder="#1976D2"
                        className="flex-1"
                      />
                    </div>
                    <p className="text-sm text-gray-500">
                      Main brand color for headers and accents
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secondaryColor">Secondary Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="secondaryColor"
                        type="color"
                        {...form.register("secondaryColor")}
                        className="w-16 h-10 p-1 border rounded"
                      />
                      <Input
                        {...form.register("secondaryColor")}
                        placeholder="#666666"
                        className="flex-1"
                      />
                    </div>
                    <p className="text-sm text-gray-500">
                      Secondary color for borders and text
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logoUrl">Logo URL</Label>
                  <Input
                    id="logoUrl"
                    {...form.register("logoUrl")}
                    placeholder="https://yourcompany.com/logo.png"
                  />
                  <p className="text-sm text-gray-500">
                    URL to your company logo (optional)
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payment" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Payment Information</CardTitle>
                <CardDescription>
                  Bank details and payment instructions for invoices
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank Name</Label>
                  <Input
                    id="bankName"
                    {...form.register("bankName")}
                    placeholder="Your Bank Name"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bankAccount">Account Number</Label>
                    <Input
                      id="bankAccount"
                      {...form.register("bankAccount")}
                      placeholder="Account number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bankRoutingNumber">Routing Number</Label>
                    <Input
                      id="bankRoutingNumber"
                      {...form.register("bankRoutingNumber")}
                      placeholder="Routing/Sort code"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={handlePreviewInvoice}
            className="flex items-center gap-2"
          >
            <Eye className="w-4 h-4" />
            Preview Invoice
          </Button>

          <Button
            type="submit"
            disabled={updateMutation.isPending}
            className="flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {updateMutation.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </form>
    </div>
  );
}