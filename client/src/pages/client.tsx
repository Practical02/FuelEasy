import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import type { Client, Project, SaleWithClient } from "@shared/schema";
import NewProjectModal from "@/components/modals/new-project-modal";
import { DataTable } from "@/components/ui/data-table";
import { columns as projectColumns } from "../components/projects-columns";
import { columns as salesColumns } from "../components/sales-columns";

export default function ClientPage() {
  const [, params] = useRoute("/clients/:id");
  const id = params?.id;
  const [isProjectModalOpen, setProjectModalOpen] = useState(false);

  const { data: client, isLoading: isClientLoading } = useQuery<Client>({
    queryKey: ["client", id],
    queryFn: () => apiRequest("GET", `/api/clients/${id}`).then(res => res.json()),
    enabled: !!id,
  });

  const { data: projects, isLoading: areProjectsLoading } = useQuery<Project[]>({
    queryKey: ["projects", "by-client", id],
    queryFn: () => apiRequest("GET", `/api/projects/by-client/${id}`).then(res => res.json()),
    enabled: !!id,
  });

  const { data: sales, isLoading: areSalesLoading } = useQuery<SaleWithClient[]>({
    queryKey: ["sales", "by-client", id],
    queryFn: () => apiRequest("GET", `/api/sales/by-client/${id}`).then(res => res.json()),
    enabled: !!id,
  });

  if (isClientLoading || areProjectsLoading || areSalesLoading) {
    return <div>Loading...</div>;
  }

  if (!client) {
    return <div>Client not found</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{client.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Contact: {client.contactPerson}</p>
          <p>Email: {client.email}</p>
          <p>Phone: {client.phoneNumber}</p>
          <p>Address: {client.address}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Projects</CardTitle>
          <Button onClick={() => setProjectModalOpen(true)}>New Project</Button>
        </CardHeader>
        <CardContent>
          <DataTable columns={projectColumns} data={projects || []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sales</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={salesColumns} data={sales || []} />
        </CardContent>
      </Card>

      <NewProjectModal
        open={isProjectModalOpen}
        onOpenChange={setProjectModalOpen}
        client={client}
      />
    </div>
  );
}
