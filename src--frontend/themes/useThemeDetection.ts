import { useState, useEffect } from 'react';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import type { ThemeType } from './ThemeProvider';

interface DomainConfig {
  pattern: RegExp;
  theme: ThemeType;
  label: string;
}

const DOMAIN_CONFIGS: DomainConfig[] = [
  { pattern: /\.edu\.in$/i, theme: 'neumorphism', label: 'Educational' },
  { pattern: /\.edu$/i, theme: 'neumorphism', label: 'Educational' },
  { pattern: /\.ac\.in$/i, theme: 'neumorphism', label: 'Educational' },
  { pattern: /university/i, theme: 'neumorphism', label: 'Educational' },
  { pattern: /college/i, theme: 'neumorphism', label: 'Educational' },
  { pattern: /school/i, theme: 'neumorphism', label: 'Educational' },
  { pattern: /institute/i, theme: 'neumorphism', label: 'Educational' },
  { pattern: /academy/i, theme: 'neumorphism', label: 'Educational' },
  { pattern: /iit/i, theme: 'neumorphism', label: 'Educational' },
  { pattern: /nit/i, theme: 'neumorphism', label: 'Educational' },
  { pattern: /bits/i, theme: 'neumorphism', label: 'Educational' },
];

export function useThemeDetection() {
  const { user } = useSupabaseAuth();
  const [detectedTheme, setDetectedTheme] = useState<ThemeType | null>(null);
  const [organizationType, setOrganizationType] = useState<'educational' | 'company' | null>(null);

  useEffect(() => {
    if (!user?.email) {
      setDetectedTheme(null);
      setOrganizationType(null);
      return;
    }

    const domain = user.email.split('@')[1]?.toLowerCase() || '';
    
    let detected: ThemeType = 'glassmorphism';
    let orgType: 'educational' | 'company' = 'company';

    for (const config of DOMAIN_CONFIGS) {
      if (config.pattern.test(domain)) {
        detected = config.theme;
        orgType = 'educational';
        break;
      }
    }

    setDetectedTheme(detected);
    setOrganizationType(orgType);
  }, [user?.email]);

  const getThemeFromEmail = (email: string): ThemeType => {
    const domain = email.split('@')[1]?.toLowerCase() || '';
    
    for (const config of DOMAIN_CONFIGS) {
      if (config.pattern.test(domain)) {
        return config.theme;
      }
    }
    
    return 'glassmorphism';
  };

  const isEducational = organizationType === 'educational';
  const isCompany = organizationType === 'company';

  return {
    detectedTheme,
    organizationType,
    isEducational,
    isCompany,
    getThemeFromEmail,
    detectedLabel: isEducational ? 'Educational Institution' : 'Company',
  };
}

export function getOrganizationTypeFromDomain(domain: string): 'educational' | 'company' {
  const educationalPatterns = [
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

  for (const pattern of educationalPatterns) {
    if (pattern.test(domain)) {
      return 'educational';
    }
  }

  return 'company';
}

export function getThemeFromDomain(domain: string): ThemeType {
  return getOrganizationTypeFromDomain(domain) === 'educational' ? 'neumorphism' : 'glassmorphism';
}
