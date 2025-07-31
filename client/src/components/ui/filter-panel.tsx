import { useState } from "react";
import { Filter, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface FilterPanelProps {
  children: React.ReactNode;
  onClearAll: () => void;
  hasActiveFilters: boolean;
  title?: string;
  defaultOpen?: boolean;
  className?: string;
}

export function FilterPanel({
  children,
  onClearAll,
  hasActiveFilters,
  title = "Filters",
  defaultOpen = false,
  className
}: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className={`mb-6 ${className}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="p-4 cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-gray-600" />
                <span className="font-medium text-gray-900">{title}</span>
                {hasActiveFilters && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Active
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearAll();
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Clear All
                  </Button>
                )}
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-gray-600" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-600" />
                )}
              </div>
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {children}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}