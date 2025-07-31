import { DollarSign, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface AmountRangeFilterProps {
  minValue: string;
  maxValue: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
  onClear: () => void;
  label?: string;
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function AmountRangeFilter({
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  onClear,
  label = "Amount Range",
  placeholder = "Amount",
  icon = <DollarSign className="w-4 h-4" />,
  className
}: AmountRangeFilterProps) {
  const hasValues = minValue || maxValue;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-gray-700 flex items-center">
          {icon && <span className="mr-1">{icon}</span>}
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
            type="number"
            placeholder={`Min ${placeholder.toLowerCase()}`}
            value={minValue}
            onChange={(e) => onMinChange(e.target.value)}
            className="text-sm"
            step="0.01"
          />
        </div>
        <div>
          <Input
            type="number"
            placeholder={`Max ${placeholder.toLowerCase()}`}
            value={maxValue}
            onChange={(e) => onMaxChange(e.target.value)}
            className="text-sm"
            step="0.01"
          />
        </div>
      </div>
    </div>
  );
}