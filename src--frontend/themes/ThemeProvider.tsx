import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';

export type ThemeType = 'neumorphism' | 'glassmorphism';
export type ColorScheme = 'dark' | 'light' | 'system';

interface ThemeContextValue {
  theme: ThemeType;
  colorScheme: ColorScheme;
  isDark: boolean;
  isEducational: boolean;
  isCompany: boolean;
  detectedLabel: string;
  setTheme: (theme: ThemeType) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  toggleTheme: () => void;
  refreshThemeFromEmail: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const EDUCATIONAL_PATTERNS = [
  /\.edu\.in$/i,
  /\.edu$/i,
  /\.ac\.in$/i,
  /university/i,
  /college/i,
  /school/i,
  /institute/i,
  /academy/i,
  /iit/i,
  /nit/i,
  /bits/i,
];

function getOrganizationType(email: string): 'educational' | 'company' {
  const domain = email.split('@')[1]?.toLowerCase() || '';
  for (const pattern of EDUCATIONAL_PATTERNS) {
    if (pattern.test(domain)) return 'educational';
  }
  return 'company';
}

function getThemeFromOrgType(orgType: 'educational' | 'company'): ThemeType {
  return orgType === 'educational' ? 'neumorphism' : 'glassmorphism';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useSupabaseAuth();
  
  const [theme, setThemeState] = useState<ThemeType>('glassmorphism');
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('aisms_color_scheme') as ColorScheme) || 'system';
    }
    return 'system';
  });
  const [isDark, setIsDark] = useState(true);
  const [isEducational, setIsEducational] = useState(false);
  const [isCompany, setIsCompany] = useState(true);
  const [detectedLabel, setDetectedLabel] = useState('Company');

  const updateThemeFromEmail = useCallback(() => {
    if (!user?.email) return;
    
    const orgType = getOrganizationType(user.email);
    const detectedTheme = getThemeFromOrgType(orgType);
    
    const savedTheme = localStorage.getItem('aisms_theme') as ThemeType | null;
    
    if (!savedTheme) {
      setThemeState(detectedTheme);
    }
    
    setIsEducational(orgType === 'educational');
    setIsCompany(orgType === 'company');
    setDetectedLabel(orgType === 'educational' ? 'Educational Institution' : 'Company');
  }, [user?.email]);

  useEffect(() => {
    updateThemeFromEmail();
  }, [updateThemeFromEmail]);

  useEffect(() => {
    const root = document.documentElement;
    
    root.classList.remove('neu-theme', 'glass-theme', 'light', 'dark');
    
    if (theme === 'neumorphism') {
      root.classList.add('neu-theme');
      root.style.background = colorScheme === 'light' || (colorScheme === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches) ? '#e0e5ec' : '#1a1a2e';
      root.style.color = colorScheme === 'light' || (colorScheme === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches) ? '#374151' : '#e0e5ec';
      setIsDark(colorScheme !== 'light' && !(colorScheme === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches));
    } else {
      root.classList.add('glass-theme');
      root.style.background = '';
      root.style.color = '';
      setIsDark(true);
    }

    const resolvedColorScheme = colorScheme === 'system' 
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : colorScheme;
    
    root.classList.add(resolvedColorScheme);
    localStorage.setItem('aisms_theme', theme);
    localStorage.setItem('aisms_color_scheme', colorScheme);
  }, [theme, colorScheme]);

  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
  };

  const setColorScheme = (newScheme: ColorScheme) => {
    setColorSchemeState(newScheme);
  };

  const toggleTheme = () => {
    setThemeState(prev => prev === 'glassmorphism' ? 'neumorphism' : 'glassmorphism');
  };

  const refreshThemeFromEmail = () => {
    updateThemeFromEmail();
  };

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      colorScheme, 
      isDark, 
      isEducational, 
      isCompany,
      detectedLabel,
      setTheme, 
      setColorScheme, 
      toggleTheme,
      refreshThemeFromEmail 
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

export { useThemeDetection, getOrganizationTypeFromDomain, getThemeFromDomain } from './useThemeDetection';
