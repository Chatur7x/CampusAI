import { useState, useCallback, useMemo, createContext, useContext, type ReactNode, useEffect } from 'react';
import { supabase } from './supabase';

export interface AtRiskStudent {
  studentId: string;
  studentName: string;
  enrollmentId: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskFactors: {
    factor: string;
    impact: number;
    description: string;
  }[];
  attendanceTrend: number[];
  predictedAttendance: number;
  lastUpdated: string;
  recommendedActions: string[];
}

export interface AttendanceForecast {
  date: string;
  predicted: number;
  confidence: number;
  lowerBound: number;
  upperBound: number;
}

export interface PerformanceTrend {
  studentId: string;
  metric: string;
  current: number;
  previous: number;
  change: number;
  trend: 'improving' | 'stable' | 'declining';
  forecast: number[];
}

export interface PredictiveInsight {
  id: string;
  type: 'warning' | 'opportunity' | 'trend' | 'anomaly';
  title: string;
  description: string;
  affectedStudents: string[];
  confidence: number;
  createdAt: string;
  actionItems: string[];
}

interface PredictiveAnalyticsContextValue {
  atRiskStudents: AtRiskStudent[];
  forecasts: Record<string, AttendanceForecast[]>;
  trends: PerformanceTrend[];
  insights: PredictiveInsight[];
  isLoading: boolean;
  refreshPredictions: () => Promise<void>;
  getStudentRisk: (studentId: string) => AtRiskStudent | null;
  getClassForecast: (classId: string) => AttendanceForecast[];
}

const PredictiveAnalyticsContext = createContext<PredictiveAnalyticsContextValue | null>(null);

const AI_BASE_URL = import.meta.env.VITE_AI_SERVER_URL || 'http://localhost:8000';

export function PredictiveAnalyticsProvider({ children }: { children: ReactNode }) {
  const [atRiskStudents, setAtRiskStudents] = useState<AtRiskStudent[]>([]);
  const [forecasts, setForecasts] = useState<Record<string, AttendanceForecast[]>>({});
  const [trends] = useState<PerformanceTrend[]>([]);
  const [insights, setInsights] = useState<PredictiveInsight[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch AI predictions from backend
  const fetchPredictions = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // Fetch at-risk students from AI server
      const response = await fetch(`${AI_BASE_URL}/api/analytics/risk-prediction`, {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.students) {
          setAtRiskStudents(data.students);
        }
        if (data.forecasts) {
          setForecasts(data.forecasts);
        }
        if (data.insights) {
          setInsights(data.insights);
        }
      }
    } catch (error) {
      console.error('Failed to fetch AI predictions:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Calculate risk score locally (fallback when AI server unavailable)
  const calculateLocalRisk = useCallback(async (studentId: string): Promise<AtRiskStudent | null> => {
    try {
      // Get student's attendance history
      const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', studentId)
        .order('date', { ascending: false })
        .limit(30);

      if (!attendance || attendance.length === 0) return null;

      const student = await supabase
        .from('students_with_profiles')
        .select('*')
        .eq('id', studentId)
        .single();

      // Calculate attendance rate
      const present = attendance.filter((a: any) => a.status === 'PRESENT').length;
      const attendanceRate = (present / attendance.length) * 100;

      // Calculate trend (last 7 days vs previous 7 days)
      const recent = attendance.slice(0, 7).filter((a: any) => a.status === 'PRESENT').length;
      const previous = attendance.slice(7, 14).filter((a: any) => a.status === 'PRESENT').length;
      const trend = previous > 0 ? ((recent - previous) / previous) * 100 : 0;

      // Calculate risk factors
      const riskFactors: AtRiskStudent['riskFactors'] = [];
      let riskScore = 50;

      if (attendanceRate < 75) {
        riskScore += 30;
        riskFactors.push({
          factor: 'Low Attendance',
          impact: 30,
          description: `Attendance rate is ${attendanceRate.toFixed(1)}%, below the 75% threshold`,
        });
      }

      if (trend < -10) {
        riskScore += 20;
        riskFactors.push({
          factor: 'Declining Trend',
          impact: 20,
          description: `Attendance declining by ${Math.abs(trend).toFixed(1)}% compared to last week`,
        });
      }

      // Check for consecutive absences
      let consecutiveAbsences = 0;
      for (const a of attendance) {
        if (a.status !== 'PRESENT') consecutiveAbsences++;
        else break;
      }
      if (consecutiveAbsences >= 3) {
        riskScore += 25;
        riskFactors.push({
          factor: 'Consecutive Absences',
          impact: 25,
          description: `${consecutiveAbsences} consecutive days without attendance`,
        });
      }

      // Determine risk level
      let riskLevel: AtRiskStudent['riskLevel'] = 'low';
      if (riskScore >= 80) riskLevel = 'critical';
      else if (riskScore >= 60) riskLevel = 'high';
      else if (riskScore >= 40) riskLevel = 'medium';

      // Generate recommended actions
      const recommendedActions: string[] = [];
      if (attendanceRate < 75) {
        recommendedActions.push('Schedule meeting with student and guardian');
        recommendedActions.push('Review and address underlying issues');
      }
      if (trend < 0) {
        recommendedActions.push('Monitor closely over next 2 weeks');
      }
      if (consecutiveAbsences >= 3) {
        recommendedActions.push('Contact student immediately');
        recommendedActions.push('Verify reason for absence');
      }

      return {
        studentId,
        studentName: student.data ? `${student.data.profile?.first_name || ''} ${student.data.profile?.last_name || ''}`.trim() : 'Unknown',
        enrollmentId: student.data?.enrollment_id || 'N/A',
        riskScore: Math.min(100, riskScore),
        riskLevel,
        riskFactors,
        attendanceTrend: attendance.slice(0, 14).map((a: any) => a.status === 'PRESENT' ? 1 : 0),
        predictedAttendance: attendanceRate + (trend * 0.5),
        lastUpdated: new Date().toISOString(),
        recommendedActions,
      };
    } catch (error) {
      console.error('Error calculating local risk:', error);
      return null;
    }
  }, []);

  // Load all at-risk students
  useEffect(() => {
    const loadAtRiskStudents = async () => {
      setIsLoading(true);
      
      try {
        // First try to get from AI server
        await fetchPredictions();
      } catch {
        // Fallback: calculate locally for each student
        const { data: students } = await supabase
          .from('students')
          .select('id')
          .limit(50);

        if (students) {
          const risks = await Promise.all(
            students.map(s => calculateLocalRisk(s.id))
          );
          setAtRiskStudents(risks.filter((r): r is AtRiskStudent => r !== null));
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadAtRiskStudents();
  }, [fetchPredictions, calculateLocalRisk]);

  const getStudentRisk = useCallback((studentId: string) => {
    return atRiskStudents.find(r => r.studentId === studentId) || null;
  }, [atRiskStudents]);

  const getClassForecast = useCallback((classId: string) => {
    return forecasts[classId] || [];
  }, [forecasts]);

  return (
    <PredictiveAnalyticsContext.Provider
      value={{
        atRiskStudents,
        forecasts,
        trends,
        insights,
        isLoading,
        refreshPredictions: fetchPredictions,
        getStudentRisk,
        getClassForecast,
      }}
    >
      {children}
    </PredictiveAnalyticsContext.Provider>
  );
}

export function usePredictiveAnalytics() {
  const context = useContext(PredictiveAnalyticsContext);
  if (!context) {
    throw new Error('usePredictiveAnalytics must be used within PredictiveAnalyticsProvider');
  }
  return context;
}

export function useStudentRiskAssessment(studentId: string) {
  const { atRiskStudents, isLoading } = usePredictiveAnalytics();

  const riskAssessment = useMemo(() => {
    const student = atRiskStudents.find(r => r.studentId === studentId);
    return {
      risk: student || null,
      isAtRisk: student ? student.riskLevel !== 'low' : false,
      riskLevel: student?.riskLevel || 'low',
      riskScore: student?.riskScore || 0,
    };
  }, [atRiskStudents, studentId]);

  return { ...riskAssessment, isLoading };
}

// Risk Level Badge Component
export const RiskLevelBadge = ({ level }: { level: AtRiskStudent['riskLevel'] }) => {
  const styles = {
    low: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const labels = {
    low: 'Low Risk',
    medium: 'Medium Risk',
    high: 'High Risk',
    critical: 'Critical',
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${styles[level]}`}>
      {labels[level]}
    </span>
  );
};

// Risk Score Gauge Component
export const RiskScoreGauge = ({ score }: { score: number }) => {
  const getColor = (s: number) => {
    if (s >= 80) return 'text-red-500';
    if (s >= 60) return 'text-orange-500';
    if (s >= 40) return 'text-yellow-500';
    return 'text-emerald-500';
  };

  const getGradient = (s: number) => {
    if (s >= 80) return 'from-red-500 to-red-600';
    if (s >= 60) return 'from-orange-500 to-orange-600';
    if (s >= 40) return 'from-yellow-500 to-yellow-600';
    return 'from-emerald-500 to-emerald-600';
  };

  return (
    <div className="relative w-16 h-16">
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx="32"
          cy="32"
          r="28"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-slate-700"
        />
        <circle
          cx="32"
          cy="32"
          r="28"
          fill="none"
          stroke="url(#gradient)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 176} 176`}
        />
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" className={score >= 60 ? 'stop-color-red-500' : score >= 40 ? 'stop-color-yellow-500' : 'stop-color-emerald-500'} />
            <stop offset="100%" className={getGradient(score).split(' ')[1].replace('to-', 'stop-color-')} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-lg font-bold ${getColor(score)}`}>{score}</span>
      </div>
    </div>
  );
};
