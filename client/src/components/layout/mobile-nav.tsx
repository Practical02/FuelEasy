import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useIsMobile, usePWA, useVibration } from "@/hooks/use-mobile";
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
  Home
} from "lucide-react";

const mobileNavigation = [
  { name: "Home", href: "/dashboard", icon: Home },
  { name: "Stock", href: "/stock", icon: Boxes },
  { name: "Sales", href: "/sales", icon: Receipt },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "More", href: "/payments", icon: CreditCard },
];

export default function MobileNav() {
  const [location] = useLocation();
  const isMobile = useIsMobile();
  const { isPWA } = usePWA();
  const vibrate = useVibration();

  if (!isMobile) return null;

  const handleNavClick = () => {
    // Provide haptic feedback on Android
    vibrate(50);
  };

  return (
    <nav className="mobile-nav z-40">
      <div className="flex items-center justify-around px-2 py-2">
        {mobileNavigation.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || 
                          (location === "/" && item.href === "/dashboard") ||
                          (item.href === "/payments" && (location === "/payments" || location === "/invoices" || location === "/reports" || location === "/cashbook"));
          
          return (
            <Link 
              key={item.name}
              href={item.href}
              onClick={handleNavClick}
              className={cn(
                "flex flex-col items-center justify-center w-full py-2 px-1 rounded-lg transition-colors touch-target",
                isActive 
                  ? "text-blue-600 bg-blue-50" 
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              )}
            >
              <Icon className="w-6 h-6 mb-1" />
              <span className="text-xs font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// Mobile menu for "More" section
export function MobileMoreMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [location] = useLocation();
  const vibrate = useVibration();

  const moreItems = [
    { name: "Payments", href: "/payments", icon: CreditCard },
    { name: "Invoices", href: "/invoices", icon: FileText },
    { name: "Cashbook", href: "/cashbook", icon: DollarSign },
    { name: "Reports", href: "/reports", icon: ChartBar },
  ];

  const handleItemClick = () => {
    vibrate(50);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />
      <div className="fixed bottom-20 left-4 right-4 bg-white rounded-lg shadow-lg border border-gray-200 z-50 safe-area-bottom">
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">More Options</h3>
          <div className="grid grid-cols-2 gap-3">
            {moreItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              
              return (
                <Link 
                  key={item.name}
                  href={item.href}
                  onClick={handleItemClick}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-lg transition-colors touch-target",
                    isActive 
                      ? "text-blue-600 bg-blue-50" 
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                  )}
                >
                  <Icon className="w-6 h-6 mb-2" />
                  <span className="text-xs font-medium">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
} 