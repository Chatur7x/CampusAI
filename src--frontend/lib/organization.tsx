import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import { supabase } from './supabase';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  domain: string;
  type: 'company' | 'educational';
  logo?: string;
  primaryColor?: string;
  website?: string;
  contactEmail?: string;
  phone?: string;
  address?: string;
  isActive: boolean;
  createdAt: string;
  settings: OrganizationSettings;
}

export interface OrganizationSettings {
  allowSelfRegistration: boolean;
  requireEmailVerification: boolean;
  enforceDomain: boolean;
  maxUsers: number;
  features: {
    faceRecognition: boolean;
    blockchain: boolean;
    aiAnalytics: boolean;
    geofencing: boolean;
    pushNotifications: boolean;
  };
  attendance: {
    minAttendancePercent: number;
    lateThresholdMinutes: number;
    autoMarkAbsent: boolean;
    workingHoursStart: string;
    workingHoursEnd: string;
  };
}

export interface OrganizationContextValue {
  organization: Organization | null;
  organizations: Organization[];
  isLoading: boolean;
  switchOrganization: (orgId: string) => Promise<void>;
  updateOrganization: (updates: Partial<Organization>) => Promise<void>;
  createOrganization: (org: Omit<Organization, 'id' | 'createdAt'>) => Promise<Organization>;
  getOrganizationByDomain: (email: string) => Organization | null;
}

const defaultSettings: OrganizationSettings = {
  allowSelfRegistration: true,
  requireEmailVerification: true,
  enforceDomain: true,
  maxUsers: 1000,
  features: {
    faceRecognition: true,
    blockchain: true,
    aiAnalytics: true,
    geofencing: true,
    pushNotifications: true,
  },
  attendance: {
    minAttendancePercent: 75,
    lateThresholdMinutes: 15,
    autoMarkAbsent: false,
    workingHoursStart: '09:00',
    workingHoursEnd: '17:00',
  },
};

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useSupabaseAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadOrganizations();
    } else {
      setOrganization(null);
      setOrganizations([]);
      setIsLoading(false);
    }
  }, [user]);

  const loadOrganizations = async () => {
    try {
      setIsLoading(true);

      const { data: userOrgs, error } = await supabase
        .from('user_organizations')
        .select(`
          organization_id,
          role,
          organizations (*)
        `)
        .eq('user_id', user?.id);

      if (error) throw error;

      const orgs = (userOrgs || []).map((uo: any) => ({
        ...uo.organizations,
        settings: uo.organizations.settings || defaultSettings,
      })) as Organization[];

      setOrganizations(orgs);

      const savedOrgId = localStorage.getItem('current_organization_id');
      const currentOrg = savedOrgId 
        ? orgs.find(o => o.id === savedOrgId)
        : orgs[0];

      if (currentOrg) {
        setOrganization(currentOrg);
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const switchOrganization = async (orgId: string) => {
    const org = organizations.find(o => o.id === orgId);
    if (org) {
      localStorage.setItem('current_organization_id', orgId);
      setOrganization(org);
    }
  };

  const updateOrganization = async (updates: Partial<Organization>) => {
    if (!organization) return;

    const { error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', organization.id);

    if (error) throw error;

    setOrganization(prev => prev ? { ...prev, ...updates } : null);
    setOrganizations(prev => 
      prev.map(o => o.id === organization.id ? { ...o, ...updates } : o)
    );
  };

  const createOrganization = async (
    orgData: Omit<Organization, 'id' | 'createdAt'>
  ): Promise<Organization> => {
    const { data, error } = await supabase
      .from('organizations')
      .insert({
        name: orgData.name,
        slug: orgData.slug,
        domain: orgData.domain,
        type: orgData.type,
        logo: orgData.logo,
        primary_color: orgData.primaryColor,
        website: orgData.website,
        contact_email: orgData.contactEmail,
        phone: orgData.phone,
        address: orgData.address,
        is_active: true,
        settings: orgData.settings || defaultSettings,
      })
      .select()
      .single();

    if (error) throw error;

    const newOrg = {
      ...data,
      settings: data.settings || defaultSettings,
    } as Organization;

    if (user) {
      await supabase.from('user_organizations').insert({
        user_id: user.id,
        organization_id: data.id,
        role: 'OWNER',
      });
    }

    setOrganizations(prev => [...prev, newOrg]);
    return newOrg;
  };

  const getOrganizationByDomain = (email: string): Organization | null => {
    const domain = email.split('@')[1];
    if (!domain) return null;
    return organizations.find(o => o.domain === domain) || null;
  };

  return (
    <OrganizationContext.Provider
      value={{
        organization,
        organizations,
        isLoading,
        switchOrganization,
        updateOrganization,
        createOrganization,
        getOrganizationByDomain,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within OrganizationProvider');
  }
  return context;
}

export function useDomainDetection() {
  const detectOrganization = (email: string): {
    type: 'company' | 'educational' | null;
    suggestedOrg: Partial<Organization>;
  } => {
    const domain = email.split('@')[1];
    if (!domain) return { type: null, suggestedOrg: {} };

    const domainParts = domain.split('.');
    const tld = domainParts[domainParts.length - 1];

    if (tld === 'edu' || domain.includes('university') || domain.includes('college') || domain.includes('school') || domain.includes('edu.in')) {
      return {
        type: 'educational',
        suggestedOrg: {
          type: 'educational',
          domain,
          name: domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1),
          slug: domain.split('.')[0].toLowerCase(),
        },
      };
    }

    return {
      type: 'company',
      suggestedOrg: {
        type: 'company',
        domain,
        name: domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1),
        slug: domain.split('.')[0].toLowerCase(),
      },
    };
  };

  const isAdminEmail = (email: string): boolean => {
    return email.toLowerCase().startsWith('admin@');
  };

  const extractOrganizationFromEmail = (email: string): string => {
    const domain = email.split('@')[1];
    return domain?.split('.')[0] || '';
  };

  return {
    detectOrganization,
    isAdminEmail,
    extractOrganizationFromEmail,
  };
}

export { defaultSettings };
