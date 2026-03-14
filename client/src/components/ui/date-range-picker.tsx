import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function toYmd(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onClear: () => void;
  label?: string;
  /** Default spans two columns in FilterPanel grids so the control stays usable on xl layouts */
  className?: string;
}

export function DateRangePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClear,
  label = "Date Range",
  className,
}: DateRangePickerProps) {
  const hasValues = Boolean(startDate || endDate);
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(() => ({
    from: startDate ? new Date(startDate + "T12:00:00") : undefined,
    to: endDate ? new Date(endDate + "T12:00:00") : undefined,
  }));

  useEffect(() => {
    setRange({
      from: startDate ? new Date(startDate + "T12:00:00") : undefined,
      to: endDate ? new Date(endDate + "T12:00:00") : undefined,
    });
  }, [startDate, endDate]);

  const labelText =
    startDate && endDate
      ? `${format(new Date(startDate + "T12:00:00"), "MMM d, yyyy")} – ${format(new Date(endDate + "T12:00:00"), "MMM d, yyyy")}`
      : startDate
        ? `From ${format(new Date(startDate + "T12:00:00"), "MMM d, yyyy")}`
        : endDate
          ? `Until ${format(new Date(endDate + "T12:00:00"), "MMM d, yyyy")}`
          : "Select date range";

  return (
    <div
      className={cn(
        "space-y-2 min-w-0 w-full md:col-span-2 xl:col-span-2",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium text-gray-700 flex items-center shrink-0">
          <CalendarIcon className="w-4 h-4 mr-1" />
          {label}
        </Label>
        {hasValues && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700 shrink-0"
          >
            <X className="w-3 h-3 mr-1" />
            Clear
          </Button>
        )}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal min-h-10 min-w-[12rem]",
              !hasValues && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
            <span className="truncate">{labelText}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={range?.from ?? range?.to ?? new Date()}
            selected={range}
            onSelect={(next) => {
              setRange(next);
              if (next?.from) onStartDateChange(toYmd(next.from));
              else onStartDateChange("");
              if (next?.to) onEndDateChange(toYmd(next.to));
              else if (!next?.from) onEndDateChange("");
              else onEndDateChange("");
              if (next?.from && next?.to) setOpen(false);
            }}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
