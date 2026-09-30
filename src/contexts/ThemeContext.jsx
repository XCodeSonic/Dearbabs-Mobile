// src/contexts/ThemeContext.js
import { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

// ✅ FIX: Create context with default value
const ThemeContext = createContext({
  colors: {
    primary: '#FF6B9D',
    primaryLight: '#FF8FB1',
    primaryDark: '#E8558A',
    primaryGradient: ['#FF6B9D', '#FF8FB1', '#FFA0C0'],
    background: '#F8F9FA',
    surface: '#FFFFFF',
    card: '#FFFFFF',
    cardBackground: '#FFFFFF',
    text: '#1C1C1E',
    textSecondary: '#8A8A8E',
    textTertiary: '#B0B0B0',
    border: '#E5E5EA',
    divider: '#F0F0F0',
    tabBar: '#FFFFFF',
    inputBackground: '#F8F8F8',
    shadow: '#000',
    success: '#4CAF50',
    error: '#FF3B30',
    warning: '#FF9800',
    info: '#2196F3',
    overlay: 'rgba(0,0,0,0.5)',
    overlayLight: 'rgba(0,0,0,0.05)',
    gradientStart: '#FF6B9D',
    gradientEnd: '#FF8FB1',
  },
  isDark: false,
  toggleTheme: () => {},
  setTheme: () => {},
});

export const useTheme = () => {
  const context = useContext(ThemeContext);
  // ✅ Don't throw error, return context with defaults
  if (!context) {
    console.warn('useTheme was used outside of ThemeProvider, using default theme');
    return {
      colors: {
        primary: '#FF6B9D',
        primaryLight: '#FF8FB1',
        primaryDark: '#E8558A',
        primaryGradient: ['#FF6B9D', '#FF8FB1', '#FFA0C0'],
        background: '#F8F9FA',
        surface: '#FFFFFF',
        card: '#FFFFFF',
        cardBackground: '#FFFFFF',
        text: '#1C1C1E',
        textSecondary: '#8A8A8E',
        textTertiary: '#B0B0B0',
        border: '#E5E5EA',
        divider: '#F0F0F0',
        tabBar: '#FFFFFF',
        inputBackground: '#F8F8F8',
        shadow: '#000',
        success: '#4CAF50',
        error: '#FF3B30',
        warning: '#FF9800',
        info: '#2196F3',
        overlay: 'rgba(0,0,0,0.5)',
        overlayLight: 'rgba(0,0,0,0.05)',
        gradientStart: '#FF6B9D',
        gradientEnd: '#FF8FB1',
      },
      isDark: false,
      toggleTheme: () => {},
      setTheme: () => {},
    };
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemColorScheme === 'dark');

  useEffect(() => {
    setIsDark(systemColorScheme === 'dark');
  }, [systemColorScheme]);

  const colors = {
    primary: '#FF6B9D',
    primaryLight: '#FF8FB1',
    primaryDark: '#E8558A',
    primaryGradient: ['#FF6B9D', '#FF8FB1', '#FFA0C0'],
    
    background: isDark ? '#1C1C1E' : '#F8F9FA',
    surface: isDark ? '#2C2C2E' : '#FFFFFF',
    card: isDark ? '#2C2C2E' : '#FFFFFF',
    cardBackground: isDark ? '#2C2C2E' : '#FFFFFF',
    
    text: isDark ? '#FFFFFF' : '#1C1C1E',
    textSecondary: isDark ? '#8E8E93' : '#8A8A8E',
    textTertiary: isDark ? '#636366' : '#B0B0B0',
    
    border: isDark ? '#3A3A3C' : '#E5E5EA',
    divider: isDark ? '#3A3A3C' : '#F0F0F0',
    
    tabBar: isDark ? '#1C1C1E' : '#FFFFFF',
    inputBackground: isDark ? '#2C2C2E' : '#F8F8F8',
    shadow: isDark ? 'transparent' : '#000',
    
    success: '#4CAF50',
    error: '#FF3B30',
    warning: '#FF9800',
    info: '#2196F3',
    
    overlay: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)',
    overlayLight: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    
    gradientStart: isDark ? '#FF6B9D' : '#FF6B9D',
    gradientEnd: isDark ? '#FF8FB1' : '#FF8FB1',
  };

  const toggleTheme = () => setIsDark(!isDark);
  const setTheme = (dark) => setIsDark(dark);

  const value = {
    colors,
    isDark,
    toggleTheme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;