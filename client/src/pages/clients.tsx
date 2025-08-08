import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { AmountRangeFilter } from "@/components/ui/amount-range-filter";
import { FilterPanel } from "@/components/ui/filter-panel";
import NewClientModal from "@/components/modals/new-client-modal";
import EditClientModal from "@/components/modals/edit-client-modal";
import ViewClientModal from "@/components/modals/view-client-modal";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Phone, Mail, MapPin, Edit, Eye, TrendingUp, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { CURRENCY } from "@/lib/constants";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Client, SaleWithClient } from "@shared/schema";

export default function Clients() {
  const [showNewClientModal, setShowNewClientModal] = useState(false);
  const [showEditClientModal, setShowEditClientModal] = useState(false);
  const [showViewClientModal, setShowViewClientModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const { toast } = useToast();

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [minSalesAmount, setMinSalesAmount] = useState("");
  const [maxSalesAmount, setMaxSalesAmount] = useState("");

  const { data: clients, isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: salesResponse } = useQuery<any>({
    queryKey: ["/api/sales"],
  });
  const sales: SaleWithClient[] = Array.isArray(salesResponse)
    ? (salesResponse as SaleWithClient[])
    : (salesResponse?.data ?? []);

  const deleteClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const response = await apiRequest("DELETE", `/api/clients/${clientId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Client Deleted",
        description: "Client has been deleted successfully.",
      });
      setShowDeleteDialog(false);
      setSelectedClient(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete client. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEditClick = (client: Client) => {
    setSelectedClient(client);
    setShowEditClientModal(true);
  };

  const handleViewClick = (client: Client) => {
    setSelectedClient(client);
    setShowViewClientModal(true);
  };

  const handleDeleteClick = (client: Client) => {
    setSelectedClient(client);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedClient) {
      deleteClientMutation.mutate(selectedClient.id);
    }
  };

  // Calculate total sales per client
  const clientSales = sales?.reduce((acc, sale) => {
    const clientId = sale.clientId;
    if (!acc[clientId]) {
      acc[clientId] = 0;
    }
    acc[clientId] += parseFloat(sale.totalAmount);
    return acc;
  }, {} as Record<string, number>) || {};

  // Filtering logic
  const filteredClients = useMemo(() => {
    if (!clients) return [];

    return clients.filter((client) => {
      // Search term filter (name, contact person, email, phone)
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesName = client.name.toLowerCase().includes(searchLower);
        const matchesContact = client.contactPerson.toLowerCase().includes(searchLower);
        const matchesEmail = client.email.toLowerCase().includes(searchLower);
        const matchesPhone = client.phoneNumber.toLowerCase().includes(searchLower);
        
        if (!matchesName && !matchesContact && !matchesEmail && !matchesPhone) {
          return false;
        }
      }

      // Sales amount filter
      const clientTotal = clientSales[client.id] || 0;
      if (minSalesAmount && clientTotal < parseFloat(minSalesAmount)) {
        return false;
      }
      if (maxSalesAmount && clientTotal > parseFloat(maxSalesAmount)) {
        return false;
      }

      return true;
    });
  }, [clients, searchTerm, minSalesAmount, maxSalesAmount, clientSales]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return !!(searchTerm || minSalesAmount || maxSalesAmount);
  }, [searchTerm, minSalesAmount, maxSalesAmount]);

  // Clear all filters
  const clearAllFilters = () => {
    setSearchTerm("");
    setMinSalesAmount("");
    setMaxSalesAmount("");
  };

  // Clear sales amount filters
  const clearSalesAmountFilters = () => {
    setMinSalesAmount("");
    setMaxSalesAmount("");
  };

  return (
    <>
      <Header 
        title="Client Management"
        description="Manage your diesel fuel customers and their information"
        primaryAction={{
          label: "Add Client",
          onClick: () => setShowNewClientModal(true)
        }}
      />

      <div className="p-4 lg:p-6">
        {/* Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by company name, contact person, email, or phone..."
            className="flex-1 max-w-md"
          />
          <Button 
            onClick={() => setShowNewClientModal(true)}
            className="bg-primary-600 text-white hover:bg-primary-700"
          >
            Add Client
          </Button>
        </div>

        {/* Advanced Filters Panel */}
        <FilterPanel
          hasActiveFilters={hasActiveFilters}
          onClearAll={clearAllFilters}
          title="Client Filters"
        >
          <AmountRangeFilter
            minValue={minSalesAmount}
            maxValue={maxSalesAmount}
            onMinChange={setMinSalesAmount}
            onMaxChange={setMaxSalesAmount}
            onClear={clearSalesAmountFilters}
            label="Total Sales Range"
            placeholder="Sales Amount"
          />
        </FilterPanel>

        {/* Results Summary */}
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Showing {filteredClients.length} of {clients?.length || 0} clients
            {hasActiveFilters && <span className="font-medium"> (filtered)</span>}
          </p>
        </div>

        {clientsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-lg">Loading clients...</div>
          </div>
        ) : filteredClients && filteredClients.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            {filteredClients.map((client) => (
              <Link key={client.id} href={`/clients/${client.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="p-4 lg:p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 text-lg">{client.name}</h4>
                        <p className="text-gray-600">{client.contactPerson}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => { e.preventDefault(); handleEditClick(client); }}
                          className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => { e.preventDefault(); handleViewClick(client); }}
                          className="text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => { e.preventDefault(); handleDeleteClick(client); }}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3 text-sm text-gray-600 mb-4">
                      <div className="flex items-center space-x-3">
                        <Phone className="w-4 h-4 flex-shrink-0" />
                        <span>{client.phoneNumber}</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Mail className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{client.email}</span>
                      </div>
                      <div className="flex items-start space-x-3">
                        <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span className="text-xs leading-relaxed">{client.address}</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500 text-sm">Total Sales:</span>
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-gray-900">
                            {CURRENCY} {(clientSales[client.id] || 0).toLocaleString()}
                          </span>
                          {clientSales[client.id] > 0 && (
                            <TrendingUp className="w-4 h-4 text-success-500" />
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="text-gray-500 mb-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Phone className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {hasActiveFilters ? "No clients match your filters" : "No clients found"}
                </h3>
                <p className="text-gray-600 mb-6">
                  {hasActiveFilters 
                    ? "Try adjusting your search terms or filters to find clients."
                    : "Get started by adding your first client to track sales and manage relationships."
                  }
                </p>
                {!hasActiveFilters && (
                  <Button onClick={() => setShowNewClientModal(true)} className="bg-blue-600 text-white hover:bg-blue-700">
                    Add Your First Client
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <NewClientModal 
        open={showNewClientModal} 
        onOpenChange={setShowNewClientModal} 
      />
      <EditClientModal 
        open={showEditClientModal} 
        onOpenChange={setShowEditClientModal}
        client={selectedClient}
      />
      <ViewClientModal 
        open={showViewClientModal} 
        onOpenChange={setShowViewClientModal}
        client={selectedClient}
      />
      <ConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Client"
        description={
          selectedClient
            ? `Are you sure you want to delete "${selectedClient.name}"? This action cannot be undone and will remove all associated data.`
            : "Are you sure you want to delete this client?"
        }
        confirmText="Delete Client"
        onConfirm={handleDeleteConfirm}
        isLoading={deleteClientMutation.isPending}
        variant="destructive"
      />
    </>
  );
}
