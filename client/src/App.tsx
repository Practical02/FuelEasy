import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Stock from "@/pages/stock";
import Clients from "@/pages/clients";
import Sales from "@/pages/sales";
import Payments from "@/pages/payments";
import Invoices from "@/pages/invoices";
import Reports from "@/pages/reports";
import Sidebar from "@/components/layout/sidebar";

function Router() {
  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto lg:ml-64 pt-16 lg:pt-0">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/stock" component={Stock} />
          <Route path="/clients" component={Clients} />
          <Route path="/sales" component={Sales} />
          <Route path="/payments" component={Payments} />
          <Route path="/invoices" component={Invoices} />
          <Route path="/reports" component={Reports} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
