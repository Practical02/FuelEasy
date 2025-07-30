import { Button } from "@/components/ui/button";
import { Plus, Bell } from "lucide-react";

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
    <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">{title}</h2>
          <p className="text-gray-600">{description}</p>
        </div>
        <div className="flex items-center space-x-4">
          {primaryAction && (
            <Button onClick={primaryAction.onClick} className="primary-500 text-white hover:primary-600">
              <Plus className="w-4 h-4 mr-2" />
              {primaryAction.label}
            </Button>
          )}
          <button className="text-gray-400 hover:text-gray-600">
            <Bell className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
