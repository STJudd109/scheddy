import React, { createContext, useContext, ReactNode, useMemo, useEffect } from 'react';
import { DEFAULT_THEME } from '../lib/constants';

// Define the theme interface
export interface Theme {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  logoUrl?: string;
  buttonText?: string;
  textColor?: string;
  errorColor?: string;
  successColor?: string;
  borderRadius?: string;
  boxShadow?: string;
}

// Default theme values
const defaultTheme: Theme = {
  primaryColor: DEFAULT_THEME.PRIMARY_COLOR,
  secondaryColor: DEFAULT_THEME.SECONDARY_COLOR,
  fontFamily: DEFAULT_THEME.FONT_FAMILY,
  textColor: '#333333',
  errorColor: DEFAULT_THEME.ERROR_COLOR,
  successColor: DEFAULT_THEME.SUCCESS_COLOR,
  borderRadius: DEFAULT_THEME.BORDER_RADIUS,
  boxShadow: DEFAULT_THEME.BOX_SHADOW,
  buttonText: DEFAULT_THEME.BUTTON_TEXT,
};

// Create the context with default values
const ThemeContext = createContext<Theme>(defaultTheme);

// Custom hook for accessing the theme
export const useTheme = () => useContext(ThemeContext);

interface ThemeProviderProps {
  children: ReactNode;
  theme?: Partial<Theme>;
}

/**
 * ThemeProvider component that provides theme configuration throughout the application
 * 
 * @param props.children - Child components that will have access to the theme
 * @param props.theme - Custom theme configuration to override defaults
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ 
  children, 
  theme = {} 
}) => {
  // Merge default theme with custom theme
  const mergedTheme = useMemo(() => ({
    ...defaultTheme,
    ...theme,
  }), [theme]);

  // Apply CSS variables to :root for global access
  useEffect(() => {
    // Convert theme object to CSS variables
    const root = document.documentElement;
    
    root.style.setProperty('--primary-color', mergedTheme.primaryColor);
    root.style.setProperty('--primary-color-light', `color-mix(in srgb, ${mergedTheme.primaryColor} 80%, white)`);
    root.style.setProperty('--primary-color-dark', `color-mix(in srgb, ${mergedTheme.primaryColor}, black 20%)`);
    
    root.style.setProperty('--secondary-color', mergedTheme.secondaryColor);
    root.style.setProperty('--secondary-color-light', `color-mix(in srgb, ${mergedTheme.secondaryColor} 80%, white)`);
    root.style.setProperty('--secondary-color-dark', `color-mix(in srgb, ${mergedTheme.secondaryColor}, black 10%)`);
    
    root.style.setProperty('--text-color', mergedTheme.textColor || '#333333');
    root.style.setProperty('--error-color', mergedTheme.errorColor || DEFAULT_THEME.ERROR_COLOR);
    root.style.setProperty('--success-color', mergedTheme.successColor || DEFAULT_THEME.SUCCESS_COLOR);
    root.style.setProperty('--border-radius', mergedTheme.borderRadius || DEFAULT_THEME.BORDER_RADIUS);
    root.style.setProperty('--box-shadow', mergedTheme.boxShadow || DEFAULT_THEME.BOX_SHADOW);
    root.style.setProperty('--font-family', mergedTheme.fontFamily);
    
    // Set font family on body
    document.body.style.fontFamily = mergedTheme.fontFamily;
    
    // Clean up on unmount
    return () => {
      // Reset CSS variables if needed
      // This is optional and depends on your app's requirements
    };
  }, [mergedTheme]);

  return (
    <ThemeContext.Provider value={mergedTheme}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Higher-order component to inject theme props into a component
 * 
 * @param Component - The component to wrap with theme props
 * @returns A new component with theme props injected
 */
export const withTheme = <P extends object>(
  Component: React.ComponentType<P & { theme: Theme }>
) => {
  return (props: P) => {
    const theme = useTheme();
    return <Component {...props} theme={theme} />;
  };
};

export default ThemeProvider;
