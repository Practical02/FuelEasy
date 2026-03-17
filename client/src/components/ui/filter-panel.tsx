import { useState, useEffect } from "react";
import { Filter, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

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
  className,
}: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(() => defaultOpen || hasActiveFilters);

  useEffect(() => {
    if (hasActiveFilters) setIsOpen(true);
  }, [hasActiveFilters]);

  return (
    <Card className={cn("mb-6", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            className="p-4 cursor-pointer hover:bg-gray-50 transition-colors rounded-t-lg"
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setIsOpen((o) => !o);
              }
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center flex-wrap gap-2">
                <Filter className="w-4 h-4 text-gray-600 shrink-0" />
                <span className="font-medium text-gray-900">{title}</span>
                {hasActiveFilters && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                    Active
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hasActiveFilters && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearAll();
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Clear all
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
        <CollapsibleContent className="overflow-visible data-[state=closed]:overflow-hidden">
          <CardContent className="pt-0 pb-6 px-5 overflow-visible">
            {/* Choice filters: multi-column with relaxed spacing to avoid congestion */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6 auto-rows-min">
              {children}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
