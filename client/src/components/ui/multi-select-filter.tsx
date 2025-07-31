import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectFilterProps {
  options: MultiSelectOption[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  label: string;
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function MultiSelectFilter({
  options,
  selectedValues,
  onSelectionChange,
  label,
  placeholder = "Select options",
  icon,
  className
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);

  const handleToggle = (value: string) => {
    const newSelection = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    onSelectionChange(newSelection);
  };

  const handleClear = () => {
    onSelectionChange([]);
  };

  const hasSelection = selectedValues.length > 0;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-gray-700 flex items-center">
          {icon && <span className="mr-1">{icon}</span>}
          {label}
        </Label>
        {hasSelection && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
          >
            <X className="w-3 h-3 mr-1" />
            Clear
          </Button>
        )}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={`w-full justify-between text-sm ${hasSelection ? 'text-gray-900' : 'text-gray-500'}`}
          >
            {hasSelection
              ? `${selectedValues.length} selected`
              : placeholder
            }
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <div className="max-h-60 overflow-auto">
            {options.map((option) => (
              <div
                key={option.value}
                className="flex items-center space-x-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                onClick={() => handleToggle(option.value)}
              >
                <Checkbox
                  checked={selectedValues.includes(option.value)}
                  onChange={() => handleToggle(option.value)}
                />
                <label className="text-sm flex-1 cursor-pointer">
                  {option.label}
                </label>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}