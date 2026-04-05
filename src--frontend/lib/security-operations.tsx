import { useState, useCallback, useMemo, createContext, useContext, type ReactNode, useEffect } from 'react';
import { supabase } from './supabase';

export type ThreatLevel = 'low' | 'medium' | 'high' | 'critical';
export type ThreatCategory = 'unauthorized_access' | 'data_breach' | 'anomaly' | 'vulnerability' | 'compliance' | 'insider_threat';
export type AnomalyType = 'behavioral' | 'temporal' | 'geographic' | 'device' | 'velocity';

export interface SecurityAlert {
  id: string;
  title: string;
  description: string;
  threatLevel: ThreatLevel;
  category: ThreatCategory;
  source: string;
  affectedUserId?: string;
  affectedResource?: string;
  indicators: string[];
  recommendedActions: string[];
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
}

export interface AnomalyDetection {
  id: string;
  type: AnomalyType;
  severity: ThreatLevel;
  description: string;
  userId?: string;
  userName?: string;
  detectedAt: string;
  confidence: number;
  factors: {
    name: string;
    value: number;
    expected: number;
    deviation: number;
  }[];
  isFlagged: boolean;
}

export interface ComplianceCheck {
  id: string;
  framework: string;
  requirement: string;
  status: 'compliant' | 'non_compliant' | 'partial' | 'not_applicable';
  lastChecked: string;
  nextCheck: string;
  issues: string[];
}

export interface ThreatIntel {
  id: string;
  indicator: string;
  type: 'ip' | 'domain' | 'hash' | 'url' | 'email';
  confidence: number;
  category: string;
  firstSeen: string;
  lastSeen: string;
  relatedAlerts: string[];
}

interface SecurityOperationsContextValue {
  alerts: SecurityAlert[];
  anomalies: AnomalyDetection[];
  compliance: ComplianceCheck[];
  threatIntel: ThreatIntel[];
  stats: {
    totalAlerts: number;
    openAlerts: number;
    criticalAlerts: number;
    resolvedToday: number;
    anomaliesDetected: number;
    complianceScore: number;
  };
  isLoading: boolean;
  acknowledgeAlert: (id: string) => Promise<void>;
  resolveAlert: (id: string, resolution: string, isFalsePositive?: boolean) => Promise<void>;
  flagAnomaly: (id: string) => Promise<void>;
  dismissAnomaly: (id: string) => Promise<void>;
  runComplianceCheck: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SecurityOperationsContext = createContext<SecurityOperationsContextValue | null>(null);

const AI_BASE_URL = import.meta.env.VITE_AI_SERVER_URL || 'http://localhost:8000';

export function SecurityOperationsProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyDetection[]>([]);
  const [compliance, setCompliance] = useState<ComplianceCheck[]>([]);
  const [threatIntel, setThreatIntel] = useState<ThreatIntel[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const stats = useMemo(() => ({
    totalAlerts: alerts.length,
    openAlerts: alerts.filter(a => a.status === 'open').length,
    criticalAlerts: alerts.filter(a => a.threatLevel === 'critical').length,
    resolvedToday: alerts.filter(a => a.status === 'resolved' && 
      a.resolvedAt && 
      new Date(a.resolvedAt).toDateString() === new Date().toDateString()
    ).length,
    anomaliesDetected: anomalies.filter(a => a.isFlagged).length,
    complianceScore: calculateComplianceScore(compliance),
  }), [alerts, anomalies, compliance]);

  function calculateComplianceScore(checks: ComplianceCheck[]): number {
    if (checks.length === 0) return 100;
    const compliant = checks.filter(c => c.status === 'compliant').length;
    return Math.round((compliant / checks.length) * 100);
  }

  const fetchSecurityData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [alertsRes, anomaliesRes, complianceRes, intelRes] = await Promise.all([
        supabase.from('security_alerts').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('anomaly_detections').select('*').order('detected_at', { ascending: false }).limit(50),
        supabase.from('compliance_checks').select('*').order('last_checked', { ascending: false }),
        supabase.from('threat_intel').select('*').order('last_seen', { ascending: false }).limit(100),
      ]);

      if (alertsRes.data) {
        setAlerts(alertsRes.data.map((a: any) => ({
          id: a.id,
          title: a.title,
          description: a.description,
          threatLevel: a.threat_level as ThreatLevel,
          category: a.category as ThreatCategory,
          source: a.source,
          affectedUserId: a.affected_user_id,
          affectedResource: a.affected_resource,
          indicators: a.indicators || [],
          recommendedActions: a.recommended_actions || [],
          status: a.status,
          resolvedAt: a.resolved_at,
          resolvedBy: a.resolved_by,
          createdAt: a.created_at,
        })));
      }

      if (anomaliesRes.data) {
        setAnomalies(anomaliesRes.data.map((a: any) => ({
          id: a.id,
          type: a.type as AnomalyType,
          severity: a.severity as ThreatLevel,
          description: a.description,
          userId: a.user_id,
          userName: a.user_name,
          detectedAt: a.detected_at,
          confidence: a.confidence,
          factors: a.factors || [],
          isFlagged: a.is_flagged || false,
        })));
      }

      if (complianceRes.data) {
        setCompliance(complianceRes.data.map((c: any) => ({
          id: c.id,
          framework: c.framework,
          requirement: c.requirement,
          status: c.status,
          lastChecked: c.last_checked,
          nextCheck: c.next_check,
          issues: c.issues || [],
        })));
      }

      if (intelRes.data) {
        setThreatIntel(intelRes.data.map((t: any) => ({
          id: t.id,
          indicator: t.indicator,
          type: t.type,
          confidence: t.confidence,
          category: t.category,
          firstSeen: t.first_seen,
          lastSeen: t.last_seen,
          relatedAlerts: t.related_alerts || [],
        })));
      }

      // Try to fetch AI-analyzed anomalies
      try {
        const aiRes = await fetch(`${AI_BASE_URL}/api/security/anomaly-detection`, {
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          if (aiData.anomalies) {
            setAnomalies(prev => {
              const existingIds = new Set(prev.map(a => a.id));
              const newAnomalies = aiData.anomalies
                .filter((a: any) => !existingIds.has(a.id))
                .map((a: any) => ({
                  id: a.id,
                  type: a.type,
                  severity: a.severity,
                  description: a.description,
                  userId: a.user_id,
                  userName: a.user_name,
                  detectedAt: a.detected_at,
                  confidence: a.confidence,
                  factors: a.factors || [],
                  isFlagged: false,
                }));
              return [...prev, ...newAnomalies].slice(0, 50);
            });
          }
        }
      } catch {
        // AI server unavailable, continue with DB data
      }
    } catch (error) {
      console.error('Failed to fetch security data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSecurityData();
  }, [fetchSecurityData]);

  // Subscribe to real-time security alerts
  useEffect(() => {
    const channel = supabase
      .channel('security-alerts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'security_alerts',
      }, (payload) => {
        const newAlert = payload.new as any;
        setAlerts(prev => [{
          id: newAlert.id,
          title: newAlert.title,
          description: newAlert.description,
          threatLevel: newAlert.threat_level,
          category: newAlert.category,
          source: newAlert.source,
          affectedUserId: newAlert.affected_user_id,
          affectedResource: newAlert.affected_resource,
          indicators: newAlert.indicators || [],
          recommendedActions: newAlert.recommended_actions || [],
          status: newAlert.status,
          resolvedAt: newAlert.resolved_at,
          resolvedBy: newAlert.resolved_by,
          createdAt: newAlert.created_at,
        }, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const acknowledgeAlert = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('security_alerts')
      .update({ status: 'investigating' })
      .eq('id', id);

    if (!error) {
      setAlerts(prev =>
        prev.map(a => a.id === id ? { ...a, status: 'investigating' } : a)
      );
    }
  }, []);

  const resolveAlert = useCallback(async (id: string, resolution: string, isFalsePositive = false) => {
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('security_alerts')
      .update({
        status: isFalsePositive ? 'false_positive' : 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id,
      })
      .eq('id', id);

    if (!error) {
      setAlerts(prev =>
        prev.map(a => a.id === id ? {
          ...a,
          status: isFalsePositive ? 'false_positive' : 'resolved',
          resolvedAt: new Date().toISOString(),
          resolvedBy: user?.id,
        } : a)
      );
    }
  }, []);

  const flagAnomaly = useCallback(async (id: string) => {
    await supabase
      .from('anomaly_detections')
      .update({ is_flagged: true })
      .eq('id', id);

    setAnomalies(prev =>
      prev.map(a => a.id === id ? { ...a, isFlagged: true } : a)
    );
  }, []);

  const dismissAnomaly = useCallback(async (id: string) => {
    await supabase
      .from('anomaly_detections')
      .delete()
      .eq('id', id);

    setAnomalies(prev => prev.filter(a => a.id !== id));
  }, []);

  const runComplianceCheck = useCallback(async () => {
    setIsLoading(true);
    // Trigger compliance check on backend
    try {
      await fetch(`${AI_BASE_URL}/api/security/compliance-check`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });
      await fetchSecurityData();
    } catch (error) {
      console.error('Compliance check failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchSecurityData]);

  return (
    <SecurityOperationsContext.Provider
      value={{
        alerts,
        anomalies,
        compliance,
        threatIntel,
        stats,
        isLoading,
        acknowledgeAlert,
        resolveAlert,
        flagAnomaly,
        dismissAnomaly,
        runComplianceCheck,
        refresh: fetchSecurityData,
      }}
    >
      {children}
    </SecurityOperationsContext.Provider>
  );
}

export function useSecurityOperations() {
  const context = useContext(SecurityOperationsContext);
  if (!context) {
    throw new Error('useSecurityOperations must be used within SecurityOperationsProvider');
  }
  return context;
}

// Security Alert Badge Component
export const ThreatLevelBadge = ({ level }: { level: ThreatLevel }) => {
  const styles = {
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    critical: 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse',
  };

  const labels = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };

  return (
    <span className={`px-2 py-1 text-xs font-bold rounded-full border ${styles[level]}`}>
      {labels[level]}
    </span>
  );
};

// Compliance Score Gauge Component
export const ComplianceScoreGauge = ({ score }: { score: number }) => {
  const getColor = (s: number) => {
    if (s >= 90) return 'text-emerald-500';
    if (s >= 70) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="relative w-20 h-20">
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx="40"
          cy="40"
          r="36"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-slate-700"
        />
        <circle
          cx="40"
          cy="40"
          r="36"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 226} 226`}
          className={getColor(score)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-xl font-bold ${getColor(score)}`}>{score}%</span>
        <span className="text-xs text-slate-400">Score</span>
      </div>
    </div>
  );
};

// Anomaly Factor Bar Component
export const AnomalyFactorBar = ({ 
  name, 
  value, 
  expected,
  deviation 
}: { 
  name: string;
  value: number;
  expected: number;
  deviation: number;
}) => {
  const deviationPercent = Math.abs(deviation);
  const color = deviationPercent > 50 ? 'bg-red-500' : deviationPercent > 25 ? 'bg-yellow-500' : 'bg-emerald-500';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-slate-300">{name}</span>
        <span className={deviation > 0 ? 'text-red-400' : 'text-yellow-400'}>
          {deviation > 0 ? '+' : ''}{deviation.toFixed(1)}%
        </span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${Math.min(100, deviationPercent)}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-500">
        <span>Expected: {expected.toFixed(1)}</span>
        <span>Actual: {value.toFixed(1)}</span>
      </div>
    </div>
  );
};
