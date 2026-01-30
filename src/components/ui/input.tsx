import React from 'react';

// Simple utility to merge class names (mimics clsx/classnames)
function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        className={cn(
          // Base styles
          'flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-[var(--primary-color,#0066cc)] focus:border-transparent',
          // Default border color
          !error && 'border-gray-300',
          // Error state
          error && 'border-[var(--error-color,#dc3545)] focus:ring-[var(--error-color,#dc3545)]',
          // Disabled state
          props.disabled && 'opacity-70 cursor-not-allowed bg-gray-100',
          // Custom className from props
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export { Input };
