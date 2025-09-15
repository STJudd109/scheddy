import React from 'react';

// Simple utility to merge class names (mimics clsx/classnames)
function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', asChild = false, ...props }, ref) => {
    const Comp = asChild ? 'span' : 'button';
    
    return (
      <Comp
        className={cn(
          // Base styles
          'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          
          // Variant styles
          variant === 'default' && 'bg-[var(--primary-color,#0066cc)] text-white hover:opacity-90',
          variant === 'secondary' && 'bg-[var(--secondary-color,#f8f9fa)] text-[var(--primary-color,#0066cc)] hover:bg-[var(--secondary-color-dark,#e9ecef)]',
          variant === 'outline' && 'border border-[var(--primary-color,#0066cc)] bg-transparent text-[var(--primary-color,#0066cc)] hover:bg-[var(--primary-color,#0066cc)] hover:bg-opacity-10',
          variant === 'ghost' && 'bg-transparent text-[var(--primary-color,#0066cc)] hover:bg-[var(--primary-color,#0066cc)] hover:bg-opacity-10',
          
          // Size styles
          size === 'sm' && 'py-1.5 px-3 text-sm',
          size === 'md' && 'py-2 px-4',
          size === 'lg' && 'py-3 px-6 text-base',
          
          // Disabled styles
          props.disabled && 'opacity-70 cursor-not-allowed',
          
          // Custom className from props
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button };
