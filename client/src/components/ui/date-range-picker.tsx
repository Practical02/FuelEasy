import { Calendar, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onClear: () => void;
  label?: string;
  className?: string;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClear,
  label = "Date Range",
  className
}: DateRangePickerProps) {
  const hasValues = startDate || endDate;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-gray-700 flex items-center">
          <Calendar className="w-4 h-4 mr-1" />
          {label}
        </Label>
        {hasValues && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
          >
            <X className="w-3 h-3 mr-1" />
            Clear
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Input
            type="date"
            placeholder="Start date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="text-sm"
          />
        </div>
        <div>
          <Input
            type="date"
            placeholder="End date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="text-sm"
          />
        </div>
      </div>
    </div>
  );
}