/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Use CSS variables for dynamic theming
        primary: {
          DEFAULT: 'var(--primary-color, #0066cc)',
          light: 'color-mix(in srgb, var(--primary-color, #0066cc) 80%, white)',
          dark: 'color-mix(in srgb, var(--primary-color, #0066cc), black 20%)',
        },
        secondary: {
          DEFAULT: 'var(--secondary-color, #f8f9fa)',
          light: 'color-mix(in srgb, var(--secondary-color, #f8f9fa) 80%, white)',
          dark: 'color-mix(in srgb, var(--secondary-color, #f8f9fa), black 10%)',
        },
        // Semantic colors
        success: 'var(--success-color, #28a745)',
        error: 'var(--error-color, #dc3545)',
        warning: 'var(--warning-color, #ffc107)',
        info: 'var(--info-color, #17a2b8)',
      },
      fontFamily: {
        sans: 'var(--font-family, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
      },
      borderRadius: {
        DEFAULT: 'var(--border-radius, 0.25rem)',
      },
      boxShadow: {
        DEFAULT: 'var(--box-shadow, 0 4px 6px rgba(0, 0, 0, 0.1))',
        card: 'var(--card-shadow, 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05))',
      },
      spacing: {
        form: 'var(--form-spacing, 1rem)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms')({
      strategy: 'class', // Only apply form styles to elements with specific classes
    }),
  ],
  safelist: [
    // Always include these classes in the build
    'text-primary',
    'bg-primary',
    'border-primary',
    'text-error',
    'bg-error',
    'text-success',
    'bg-success',
    'animate-fade-in',
    'animate-slide-up',
    'animate-pulse-slow',
  ],
};
