import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useIsMobile, usePWA, useOnlineStatus } from "@/hooks/use-mobile";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Stock from "@/pages/stock";
import Clients from "@/pages/clients";
import Sales from "@/pages/sales";
import Payments from "@/pages/payments";
import Invoices from "@/pages/invoices";
import Reports from "@/pages/reports";
import Cashbook from "@/pages/cashbook";
import ClientPage from "@/pages/client";
import Sidebar from "@/components/layout/sidebar";
import MobileNav from "@/components/layout/mobile-nav";
import { cn } from "@/lib/utils";

function Router() {
  const isMobile = useIsMobile();
  const { isPWA } = usePWA();
  const isOnline = useOnlineStatus();

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      <main className={cn(
        "flex-1 overflow-auto pt-16 lg:pt-0",
        isMobile ? "pb-20" : "lg:ml-64" // Add bottom padding for mobile nav
      )}>
        {/* Offline indicator */}
        {!isOnline && (
          <div className="bg-yellow-100 border-b border-yellow-200 px-4 py-2 text-center">
            <p className="text-sm text-yellow-800">
              You're offline. Some features may be limited.
            </p>
          </div>
        )}
        
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/stock" component={Stock} />
          <Route path="/clients" component={Clients} />
          <Route path="/clients/:id" component={ClientPage} />
          <Route path="/sales" component={Sales} />
          <Route path="/payments" component={Payments} />
          <Route path="/invoices" component={Invoices} />
          <Route path="/reports" component={Reports} />
          <Route path="/cashbook" component={Cashbook} />
          <Route component={NotFound} />
        </Switch>
      </main>
      
      {/* Mobile Navigation */}
      <MobileNav />
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
