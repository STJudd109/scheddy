import React, { useEffect } from 'react';

// Simple utility to merge class names (mimics clsx/classnames)
function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export function Modal({ 
  open, 
  onClose, 
  children, 
  title, 
  className 
}: ModalProps) {
  // Handle ESC key press
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose]);

  // Don't render anything if not open
  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black bg-opacity-50"
      onClick={onClose} // Close on backdrop click
    >
      <div 
        className={cn(
          "relative w-full mx-4 bg-white rounded-lg shadow-lg p-6 max-h-[90vh] overflow-y-auto",
          "sm:mx-auto sm:max-w-3xl",
          className
        )}
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-500 focus:outline-none"
          aria-label="Close"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        {/* Title */}
        {title && (
          <div className="mb-4 pb-3 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">{title}</h3>
          </div>
        )}
        
        {/* Content */}
        <div className="mt-2">
          {children}
        </div>
      </div>
    </div>
  );
}
