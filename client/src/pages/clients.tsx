import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Header from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import NewClientModal from "@/components/modals/new-client-modal";
import { Phone, Mail, MapPin, Edit, Eye, TrendingUp } from "lucide-react";
import { CURRENCY } from "@/lib/constants";
import type { Client, SaleWithClient } from "@shared/schema";

export default function Clients() {
  const [showNewClientModal, setShowNewClientModal] = useState(false);

  const { data: clients, isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: sales } = useQuery<SaleWithClient[]>({
    queryKey: ["/api/sales"],
  });

  // Calculate total sales per client
  const clientSales = sales?.reduce((acc, sale) => {
    const clientId = sale.clientId;
    if (!acc[clientId]) {
      acc[clientId] = 0;
    }
    acc[clientId] += parseFloat(sale.totalAmount);
    return acc;
  }, {} as Record<string, number>) || {};

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
        {clientsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-lg">Loading clients...</div>
          </div>
        ) : clients && clients.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            {clients.map((client) => (
              <Card key={client.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 lg:p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 text-lg">{client.name}</h4>
                      <p className="text-gray-600">{client.contactPerson}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600">
                        <Eye className="w-4 h-4" />
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
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <div className="text-gray-500 mb-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Phone className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No clients found</h3>
                <p className="text-gray-600 mb-6">
                  Get started by adding your first client to track sales and manage relationships.
                </p>
                <Button onClick={() => setShowNewClientModal(true)} className="primary-500 text-white hover:primary-600">
                  Add Your First Client
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <NewClientModal 
        open={showNewClientModal} 
        onOpenChange={setShowNewClientModal} 
      />
    </>
  );
}
