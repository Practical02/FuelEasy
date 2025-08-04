import React from "react";
import { cn } from "@/lib/utils";
import { useIsMobile, useKeyboard } from "@/hooks/use-mobile";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import { Textarea } from "./textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Checkbox } from "./checkbox";

interface MobileFormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'textarea' | 'select' | 'checkbox' | 'date';
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
  };
}

interface MobileFormProps {
  fields: MobileFormField[];
  onSubmit: (data: Record<string, any>) => void;
  submitLabel?: string;
  loading?: boolean;
  className?: string;
  defaultValues?: Record<string, any>;
}

export function MobileForm({
  fields,
  onSubmit,
  submitLabel = "Submit",
  loading = false,
  className,
  defaultValues = {}
}: MobileFormProps) {
  const isMobile = useIsMobile();
  const isKeyboardOpen = useKeyboard();
  const [formData, setFormData] = React.useState<Record<string, any>>(defaultValues);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const handleInputChange = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateField = (field: MobileFormField, value: any): string => {
    if (field.required && !value) {
      return `${field.label} is required`;
    }

    if (value && field.validation) {
      const { pattern, min, max, minLength, maxLength } = field.validation;
      
      if (pattern && !new RegExp(pattern).test(value)) {
        return `${field.label} format is invalid`;
      }
      
      if (min !== undefined && Number(value) < min) {
        return `${field.label} must be at least ${min}`;
      }
      
      if (max !== undefined && Number(value) > max) {
        return `${field.label} must be at most ${max}`;
      }
      
      if (minLength && value.length < minLength) {
        return `${field.label} must be at least ${minLength} characters`;
      }
      
      if (maxLength && value.length > maxLength) {
        return `${field.label} must be at most ${maxLength} characters`;
      }
    }

    return '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields
    const newErrors: Record<string, string> = {};
    fields.forEach(field => {
      const error = validateField(field, formData[field.name]);
      if (error) {
        newErrors[field.name] = error;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(formData);
  };

  const renderField = (field: MobileFormField) => {
    const value = formData[field.name] || '';
    const error = errors[field.name];

    const commonProps = {
      id: field.name,
      name: field.name,
      value: value,
      onChange: (e: any) => handleInputChange(field.name, e.target.value),
      className: cn(
        "mobile-input",
        error && "border-red-500 focus:border-red-500 focus:ring-red-500"
      ),
      placeholder: field.placeholder,
      required: field.required
    };

    switch (field.type) {
      case 'textarea':
        return (
          <Textarea
            {...commonProps}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
            rows={isMobile ? 4 : 3}
          />
        );

      case 'select':
        return (
          <Select
            value={value}
            onValueChange={(val) => handleInputChange(field.name, val)}
          >
            <SelectTrigger className={cn("mobile-input", error && "border-red-500")}>
              <SelectValue placeholder={field.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={field.name}
              checked={value}
              onCheckedChange={(checked) => handleInputChange(field.name, checked)}
            />
            <Label htmlFor={field.name} className="text-sm font-normal">
              {field.label}
            </Label>
          </div>
        );

      case 'date':
        return (
          <Input
            {...commonProps}
            type="date"
            onChange={(e) => handleInputChange(field.name, e.target.value)}
          />
        );

      default:
        return (
          <Input
            {...commonProps}
            type={field.type}
            onChange={(e) => handleInputChange(field.name, e.target.value)}
          />
        );
    }
  };

  if (isMobile) {
    return (
      <form 
        onSubmit={handleSubmit} 
        className={cn("mobile-form space-y-6", className)}
      >
        {fields.map((field) => (
          <div key={field.name} className="mobile-form-group">
            {field.type !== 'checkbox' && (
              <Label htmlFor={field.name} className="text-sm font-medium text-gray-700">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
            )}
            
            {renderField(field)}
            
            {errors[field.name] && (
              <p className="text-sm text-red-600 mt-1">{errors[field.name]}</p>
            )}
          </div>
        ))}
        
        <div className="pt-4">
          <Button
            type="submit"
            className="mobile-btn-primary w-full"
            disabled={loading}
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="mobile-spinner mr-2" />
                Loading...
              </div>
            ) : (
              submitLabel
            )}
          </Button>
        </div>
      </form>
    );
  }

  // Desktop form (fallback)
  return (
    <form 
      onSubmit={handleSubmit} 
      className={cn("space-y-4", className)}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((field) => (
          <div key={field.name} className="space-y-2">
            {field.type !== 'checkbox' && (
              <Label htmlFor={field.name} className="text-sm font-medium">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
            )}
            
            {renderField(field)}
            
            {errors[field.name] && (
              <p className="text-sm text-red-600">{errors[field.name]}</p>
            )}
          </div>
        ))}
      </div>
      
      <div className="pt-4">
        <Button
          type="submit"
          className="w-full md:w-auto"
          disabled={loading}
        >
          {loading ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Loading...
            </div>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </form>
  );
}

// Mobile Form Section
interface MobileFormSectionProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

export function MobileFormSection({
  title,
  subtitle,
  children,
  className
}: MobileFormSectionProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className={cn("mobile-card", className)}>
        {(title || subtitle) && (
          <div className="mb-4">
            {title && (
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            )}
            {subtitle && (
              <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
        )}
        {children}
      </div>
    );
  }

  // Desktop fallback
  return (
    <div className={cn("bg-white rounded-lg border border-gray-200 p-6", className)}>
      {(title || subtitle) && (
        <div className="mb-4">
          {title && (
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          )}
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
      )}
      {children}
    </div>
  );
} 