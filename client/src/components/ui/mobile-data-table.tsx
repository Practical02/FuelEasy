import React from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronRight, Search, Filter, Download } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";

interface MobileDataTableProps<T> {
  data: T[];
  columns: {
    key: string;
    header: string;
    cell?: (item: T) => React.ReactNode;
    mobilePriority?: boolean; // Show on mobile cards
  }[];
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  onRowClick?: (item: T) => void;
  onExport?: () => void;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function MobileDataTable<T extends Record<string, any>>({
  data,
  columns,
  searchPlaceholder = "Search...",
  onSearch,
  onRowClick,
  onExport,
  loading = false,
  emptyMessage = "No data available",
  className
}: MobileDataTableProps<T>) {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = React.useState("");

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    onSearch?.(value);
  };

  const mobileColumns = columns.filter(col => col.mobilePriority !== false);

  if (isMobile) {
    return (
      <div className={cn("space-y-4", className)}>
        {/* Mobile Header */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 mobile-search-input"
              />
            </div>
          </div>
          <div className="flex items-center space-x-2 ml-2">
            <Button variant="outline" size="sm" className="p-2">
              <Filter className="w-4 h-4" />
            </Button>
            {onExport && (
              <Button variant="outline" size="sm" className="p-2" onClick={onExport}>
                <Download className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Cards */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="mobile-card animate-pulse">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="mobile-empty">
            <div className="mobile-empty-icon">
              <Search className="w-12 h-12 text-gray-400" />
            </div>
            <p className="mobile-empty-text">{emptyMessage}</p>
          </div>
        ) : (
          <div className="mobile-list">
            {data.map((item, index) => (
              <div
                key={index}
                className={cn(
                  "mobile-list-item cursor-pointer transition-colors",
                  onRowClick && "hover:bg-gray-50 active:bg-gray-100"
                )}
                onClick={() => onRowClick?.(item)}
              >
                <div className="flex-1 space-y-1">
                  {mobileColumns.map((column) => (
                    <div key={column.key} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">
                        {column.header}:
                      </span>
                      <span className="text-sm text-gray-900 text-right">
                        {column.cell ? column.cell(item) : item[column.key]}
                      </span>
                    </div>
                  ))}
                </div>
                {onRowClick && (
                  <ChevronRight className="w-5 h-5 text-gray-400 ml-2" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Desktop table (fallback to regular table)
  return (
    <div className={cn("space-y-4", className)}>
      {/* Desktop Header */}
      <div className="flex items-center justify-between">
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          {onExport && (
            <Button variant="outline" size="sm" onClick={onExport}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          )}
        </div>
      </div>

      {/* Desktop Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="mobile-table">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {column.header}
                  </th>
                ))}
                {onRowClick && <th className="relative px-6 py-3"></th>}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {columns.map((column) => (
                      <td key={column.key} className="px-6 py-4">
                        <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                      </td>
                    ))}
                    {onRowClick && <td className="px-6 py-4"></td>}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (onRowClick ? 1 : 0)} className="px-6 py-12 text-center">
                    <div className="mobile-empty">
                      <div className="mobile-empty-icon">
                        <Search className="w-12 h-12 text-gray-400" />
                      </div>
                      <p className="mobile-empty-text">{emptyMessage}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((item, index) => (
                  <tr
                    key={index}
                    className={cn(
                      onRowClick && "cursor-pointer hover:bg-gray-50"
                    )}
                    onClick={() => onRowClick?.(item)}
                  >
                    {columns.map((column) => (
                      <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {column.cell ? column.cell(item) : item[column.key]}
                      </td>
                    ))}
                    {onRowClick && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 