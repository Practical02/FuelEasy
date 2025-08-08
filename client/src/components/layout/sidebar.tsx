import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import {
  BarChart3,
  Boxes,
  Users,
  Receipt,
  CreditCard,
  FileText,
  ChartBar,
  Fuel,
  DollarSign,
  LogOut,
  Menu,
  X,
  Settings
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: BarChart3 },
  { name: "Stock", href: "/stock", icon: Boxes },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Sales", href: "/sales", icon: Receipt },
  { name: "Payments", href: "/payments", icon: CreditCard },
  { name: "Invoices", href: "/invoices", icon: FileText },
  { name: "Cashbook", href: "/cashbook", icon: DollarSign },
  { name: "Reports", href: "/reports", icon: ChartBar },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function Sidebar() {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Fuel className="text-white w-4 h-4" />
            </div>
            <h1 className="text-lg font-semibold text-gray-900">FuelFlow</h1>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-40 bg-black bg-opacity-50"
          onClick={closeMobileMenu}
        />
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-white shadow-sm border-r border-gray-200 flex-col fixed left-0 top-0 h-full">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Fuel className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">FuelFlow</h1>
              <p className="text-sm text-gray-500">Trading Management</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href || (location === "/" && item.href === "/dashboard");
              
              return (
                <li key={item.name}>
                  <Link 
                    href={item.href}
                    className={cn(
                      "flex items-center space-x-3 px-3 py-3 rounded-lg font-medium transition-colors",
                      isActive 
                        ? "bg-blue-50 text-blue-600" 
                        : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center space-x-3 px-3 py-2">
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
              <Users className="text-gray-600 w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Trading Manager</p>
              <p className="text-xs text-gray-500">Diesel Operations</p>
            </div>
            <button className="text-gray-400 hover:text-gray-600 p-1">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <aside className={cn(
        "lg:hidden fixed left-0 top-0 z-50 w-80 h-full bg-white shadow-lg transform transition-transform duration-300 ease-in-out",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="pt-16 h-full flex flex-col">
          <nav className="flex-1 p-4">
            <ul className="space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href || (location === "/" && item.href === "/dashboard");
                
                return (
                  <li key={item.name}>
                    <Link 
                      href={item.href}
                      onClick={closeMobileMenu}
                      className={cn(
                        "flex items-center space-x-4 px-4 py-4 rounded-xl font-medium transition-colors text-base",
                        isActive 
                          ? "bg-blue-50 text-blue-600" 
                          : "text-gray-700 hover:bg-gray-100"
                      )}
                    >
                      <Icon className="w-6 h-6" />
                      <span>{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center space-x-3 px-4 py-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <Users className="text-white w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-base font-medium text-gray-900">{user?.username || "Admin"}</p>
                <p className="text-sm text-gray-500">System Administrator</p>
              </div>
              <button 
                onClick={handleLogout}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
