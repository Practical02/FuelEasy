import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import NotificationsBell from "@/components/layout/notifications-bell";

interface HeaderProps {
  title: string;
  description: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
  };
}

export default function Header({ title, description, primaryAction }: HeaderProps) {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-4 lg:px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl lg:text-2xl font-semibold text-gray-900 truncate">{title}</h2>
          <p className="text-gray-600 text-sm lg:text-base hidden sm:block">{description}</p>
        </div>
        <div className="flex items-center space-x-2 lg:space-x-4 ml-4">
          {primaryAction && (
            <Button 
              onClick={primaryAction.onClick} 
              className="bg-blue-600 text-white hover:bg-blue-700 text-sm lg:text-base px-3 lg:px-4 py-2"
              size="sm"
            >
              <Plus className="w-4 h-4 lg:mr-2" />
              <span className="hidden lg:inline">{primaryAction.label}</span>
            </Button>
          )}
          <NotificationsBell />
        </div>
      </div>
    </header>
  );
}
