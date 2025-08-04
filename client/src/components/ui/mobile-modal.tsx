import React from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { X, ChevronDown } from "lucide-react";
import { Button } from "./button";

interface MobileModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  showCloseButton?: boolean;
  showDragHandle?: boolean;
  maxHeight?: string;
}

export function MobileModal({
  isOpen,
  onClose,
  title,
  children,
  className,
  showCloseButton = true,
  showDragHandle = true,
  maxHeight = "90vh"
}: MobileModalProps) {
  const isMobile = useIsMobile();
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStartY, setDragStartY] = React.useState(0);
  const [currentY, setCurrentY] = React.useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setDragStartY(e.touches[0].clientY);
    setCurrentY(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const deltaY = e.touches[0].clientY - dragStartY;
    setCurrentY(deltaY);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    
    // If dragged down more than 100px, close the modal
    if (currentY > 100) {
      onClose();
    }
    
    setCurrentY(0);
  };

  if (!isOpen) return null;

  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50"
          onClick={onClose}
        />
        
        {/* Modal */}
        <div 
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-lg shadow-lg transition-transform duration-300 ease-out",
            className
          )}
          style={{
            transform: `translateY(${Math.max(0, -currentY)}px)`,
            maxHeight: maxHeight
          }}
        >
          {/* Drag Handle */}
          {showDragHandle && (
            <div 
              className="flex justify-center pt-3 pb-2"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="w-12 h-1 bg-gray-300 rounded-full" />
            </div>
          )}
          
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              {title && (
                <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              )}
              {showCloseButton && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="p-2 h-auto"
                >
                  <X className="w-5 h-5" />
                </Button>
              )}
            </div>
          )}
          
          {/* Content */}
          <div className="overflow-y-auto" style={{ maxHeight: `calc(${maxHeight} - 120px)` }}>
            {children}
          </div>
        </div>
      </>
    );
  }

  // Desktop modal (fallback)
  return (
    <>
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div 
          className={cn(
            "bg-white rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto",
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              {title && (
                <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              )}
              {showCloseButton && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="p-2 h-auto"
                >
                  <X className="w-5 h-5" />
                </Button>
              )}
            </div>
          )}
          
          {/* Content */}
          <div className="p-6">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}

// Mobile Action Sheet
interface MobileActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  actions: {
    label: string;
    onClick: () => void;
    variant?: 'default' | 'destructive' | 'secondary';
    icon?: React.ReactNode;
  }[];
  cancelLabel?: string;
}

export function MobileActionSheet({
  isOpen,
  onClose,
  title,
  actions,
  cancelLabel = "Cancel"
}: MobileActionSheetProps) {
  const isMobile = useIsMobile();

  if (!isOpen) return null;

  if (isMobile) {
    return (
      <>
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50"
          onClick={onClose}
        />
        <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-lg shadow-lg">
          {/* Drag Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1 bg-gray-300 rounded-full" />
          </div>
          
          {/* Title */}
          {title && (
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 text-center">{title}</h3>
            </div>
          )}
          
          {/* Actions */}
          <div className="p-4 space-y-2">
            {actions.map((action, index) => (
              <Button
                key={index}
                variant={action.variant || "ghost"}
                className="w-full justify-start h-12 text-base"
                onClick={() => {
                  action.onClick();
                  onClose();
                }}
              >
                {action.icon && <span className="mr-3">{action.icon}</span>}
                {action.label}
              </Button>
            ))}
          </div>
          
          {/* Cancel Button */}
          <div className="p-4 border-t border-gray-200">
            <Button
              variant="ghost"
              className="w-full h-12 text-base"
              onClick={onClose}
            >
              {cancelLabel}
            </Button>
          </div>
        </div>
      </>
    );
  }

  // Desktop fallback
  return (
    <MobileModal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-2">
        {actions.map((action, index) => (
          <Button
            key={index}
            variant={action.variant || "ghost"}
            className="w-full justify-start"
            onClick={() => {
              action.onClick();
              onClose();
            }}
          >
            {action.icon && <span className="mr-3">{action.icon}</span>}
            {action.label}
          </Button>
        ))}
      </div>
    </MobileModal>
  );
} 