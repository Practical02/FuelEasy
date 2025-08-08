import { Switch, Route } from "wouter";
import { Suspense, lazy } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useIsMobile, usePWA, useOnlineStatus } from "@/hooks/use-mobile";
import { AuthProvider, ProtectedRoute, useAuth } from "@/lib/auth";
import Sidebar from "@/components/layout/sidebar";
import MobileNav from "@/components/layout/mobile-nav";
import { cn } from "@/lib/utils";

// Lazy load pages for better performance
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Stock = lazy(() => import("@/pages/stock"));
const Clients = lazy(() => import("@/pages/clients"));
const Sales = lazy(() => import("@/pages/sales"));
const Payments = lazy(() => import("@/pages/payments"));
const Invoices = lazy(() => import("@/pages/invoices"));
const Reports = lazy(() => import(/* webpackChunkName: "reports" */ "@/pages/reports"));
const Cashbook = lazy(() => import("@/pages/cashbook"));
const ClientPage = lazy(() => import("@/pages/client"));
const BusinessSettings = lazy(() => import("@/pages/business-settings"));
const Login = lazy(() => import("@/pages/login"));
const NotFound = lazy(() => import("@/pages/not-found"));

// Loading component
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <div className="flex items-center space-x-2">
        <div className="w-4 h-4 bg-blue-600 rounded-full animate-pulse"></div>
        <div className="w-4 h-4 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '0.1s' }}></div>
        <div className="w-4 h-4 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
      </div>
    </div>
  );
}

function Router() {
  const isMobile = useIsMobile();
  const { isPWA } = usePWA();
  const isOnline = useOnlineStatus();

  return (
    <Switch>
      <Route path="/login">
        <Suspense fallback={<PageLoader />}>
          <Login />
        </Suspense>
      </Route>
      <Route>
        <ProtectedRoute>
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
              
              <Suspense fallback={<PageLoader />}>
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
                  <Route path="/settings" component={BusinessSettings} />
                  <Route component={NotFound} />
                </Switch>
              </Suspense>
            </main>
            
            {/* Mobile Navigation */}
            <MobileNav />
          </div>
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
