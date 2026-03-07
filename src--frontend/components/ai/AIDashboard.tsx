// =============================================================
// AIDashboard — Python AI Backend Version
// Fetches analytics from FastAPI server
// =============================================================
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Brain, TrendingUp, TrendingDown, AlertTriangle, Shield,
  Activity, BarChart3, Users, Minus, Target, ShieldAlert,
  Sparkles, Eye, ScanFace, Loader2, RefreshCw,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { attendanceService } from '@/lib/api';

import {
  predictRisk, predictTrend, getCorrelation, classifyProfile,
  getModelHealth,
  type RiskResult, type TrendResult, type CorrelationResult,
  type ProfileResult, type ModelHealth,
} from '@/lib/ai/apiClient';

// ── Types ──

interface AIDashboardProps {
  attendanceRecords?: { date: string; status: string; courseId?: string }[];
  studentPerformances?: { attendance: number; grade: number; name?: string }[];
  role: 'student' | 'faculty' | 'admin';
  studentName?: string;
  studentId?: string;
}

type _RiskCategory = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const RISK_COLORS: Record<string, string> = {
  LOW: 'text-green-600 bg-green-500/10 border-green-500',
  MEDIUM: 'text-amber-600 bg-amber-500/10 border-amber-500',
  HIGH: 'text-orange-600 bg-orange-500/10 border-orange-500',
  CRITICAL: 'text-red-600 bg-red-500/10 border-red-500',
};

const RISK_ICONS: Record<string, React.ReactNode> = {
  LOW: <Shield className="h-5 w-5 text-green-500" />,
  MEDIUM: <Activity className="h-5 w-5 text-amber-500" />,
  HIGH: <AlertTriangle className="h-5 w-5 text-orange-500" />,
  CRITICAL: <ShieldAlert className="h-5 w-5 text-red-500" />,
};

// ── Component ──

export default function AIDashboard({
  attendanceRecords: externalRecords,
  studentPerformances = [],
  role,
  studentName: _studentName = 'Student',
  studentId,
}: AIDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [riskData, setRiskData] = useState<RiskResult | null>(null);
  const [trendData, setTrendData] = useState<TrendResult | null>(null);
  const [correlationData, setCorrelationData] = useState<CorrelationResult | null>(null);
  const [profileData, setProfileData] = useState<ProfileResult | null>(null);
  const [modelHealthData, setModelHealthData] = useState<ModelHealth[]>([]);
  const [error, setError] = useState('');
  const [selfFetchedRecords, setSelfFetchedRecords] = useState<{ date: string; status: string; courseId?: string }[]>([]);

  const { user } = useSupabaseAuth();

  // Self-fetch attendance if not provided externally
  useEffect(() => {
    if (externalRecords && externalRecords.length > 0) return;
    (async () => {
      try {
        if (role === 'student') {
          const sid = user?.student?.id || user?.id || '';
          if (!sid) return;
          const records = await attendanceService.getForStudent(sid);
          setSelfFetchedRecords(records.map((r) => ({
            date: r.date || '',
            status: (r.status || 'absent').toLowerCase(),
            courseId: r.subject_id || r.course_id || undefined,
          })));
        } else {
          const limit = role === 'admin' ? 500 : 200;
          const { data } = await supabase
            .from('attendance')
            .select('date, status, course_id')
            .order('date', { ascending: false })
            .limit(limit);
          if (data) {
            setSelfFetchedRecords(data.map((r: { date?: string; status?: string; course_id?: string }) => ({
              date: r.date || '',
              status: (r.status || 'absent').toLowerCase(),
              courseId: r.course_id || undefined,
            })));
          }
        }
      } catch (err) {
        console.warn('AIDashboard: failed to self-fetch attendance', err);
      }
    })();
  }, [role, user?.student?.id, user?.id, externalRecords]);

  const attendanceRecords = (externalRecords && externalRecords.length > 0) ? externalRecords : selfFetchedRecords;

  // ── Computed stats ──
  const attendanceRate = useMemo(() => {
    if (attendanceRecords.length === 0) return 0;
    const present = attendanceRecords.filter(r => r.status === 'present' || r.status === 'late').length;
    return Math.round((present / attendanceRecords.length) * 100 * 10) / 10;
  }, [attendanceRecords]);

  // Compute weekly rates from records
  const weeklyRates = useMemo(() => {
    if (attendanceRecords.length < 2) return [];
    const sorted = [...attendanceRecords].sort((a, b) => a.date.localeCompare(b.date));
    const weeks: number[][] = [[]];
    let weekStart = new Date(sorted[0].date);
    for (const r of sorted) {
      const d = new Date(r.date);
      if (d.getTime() - weekStart.getTime() > 7 * 86400000) {
        weeks.push([]);
        weekStart = d;
      }
      weeks[weeks.length - 1].push(r.status === 'present' || r.status === 'late' ? 1 : 0);
    }
    return weeks
      .filter(w => w.length > 0)
      .map(w => Math.round((w.reduce((a, b) => a + b, 0) / w.length) * 100));
  }, [attendanceRecords]);

  // Count consecutive absences
  const consecutiveAbsences = useMemo(() => {
    let max = 0, cur = 0;
    for (const r of attendanceRecords) {
      if (r.status === 'absent') { cur++; max = Math.max(max, cur); } else cur = 0;
    }
    return max;
  }, [attendanceRecords]);

  // ── Fetch AI analytics from Python server ──
  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const promises: Promise<void>[] = [];

      // Risk prediction
      promises.push(
        predictRisk({
          student_id: studentId || 'unknown',
          attendance_pct: attendanceRate,
          consecutive_absences: consecutiveAbsences,
          late_count: attendanceRecords.filter(r => r.status === 'late').length,
          monthly_trend: weeklyRates.length >= 2
            ? weeklyRates[weeklyRates.length - 1] - weeklyRates[weeklyRates.length - 2]
            : 0,
        }).then(setRiskData)
      );

      // Trend prediction
      if (weeklyRates.length >= 2) {
        promises.push(
          predictTrend(weeklyRates, 4).then(setTrendData)
        );
      }

      // Performance correlation
      if (studentPerformances.length >= 3) {
        promises.push(
          getCorrelation(
            studentPerformances.map(s => s.attendance),
            studentPerformances.map(s => s.grade),
          ).then(setCorrelationData)
        );
      }

      // Behaviour profile
      promises.push(
        classifyProfile({
          attendance_pct: attendanceRate,
          absence_streak_max: consecutiveAbsences,
          late_pct: attendanceRecords.length > 0
            ? (attendanceRecords.filter(r => r.status === 'late').length / attendanceRecords.length) * 100
            : 0,
        }).then(setProfileData)
      );

      // Model monitoring (admin only)
      if (role === 'admin') {
        promises.push(
          getModelHealth().then(setModelHealthData).catch(() => setModelHealthData([]))
        );
      }

      await Promise.allSettled(promises);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch AI analytics');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attendanceRecords, role]);

  useEffect(() => {
    if (attendanceRecords.length > 0) fetchAnalytics();
    else setLoading(false);
  }, [attendanceRecords.length, fetchAnalytics]);

  // ── Render ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Loading AI Analytics from Python server...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-violet-500/20 to-blue-500/20 rounded-xl">
            <Brain className="h-6 w-6 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold">AI Analytics Dashboard</h2>
            <p className="text-sm text-muted-foreground">
              Powered by Python — DeepFace, Scikit-learn, Statsmodels, PyOD
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAnalytics}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {error && (
        <div className="bg-amber-500/10 rounded-lg p-3 flex gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />
          <p className="text-sm text-amber-700 dark:text-amber-400">{error}</p>
        </div>
      )}

      {/* Top Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Attendance</span>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold">{attendanceRate}%</p>
              <Progress value={attendanceRate} className="h-1.5 mt-2" />
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className={`border ${RISK_COLORS[riskData?.category || 'LOW']}`}>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Risk Score</span>
                {RISK_ICONS[riskData?.category || 'LOW']}
              </div>
              <p className="text-2xl font-bold">{riskData ? Math.round(riskData.risk_score * 100) : 0}/100</p>
              <Badge variant="outline" className="mt-1 text-xs">{riskData?.category || 'N/A'}</Badge>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Trend</span>
                {trendData?.trend === 'improving' ? <TrendingUp className="h-4 w-4 text-green-500" /> :
                 trendData?.trend === 'declining' ? <TrendingDown className="h-4 w-4 text-red-500" /> :
                 <Minus className="h-4 w-4 text-muted-foreground" />}
              </div>
              <p className="text-2xl font-bold capitalize">{trendData?.trend || 'N/A'}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {trendData?.predictions?.[0] ? `Next: ~${trendData.predictions[0]}%` : 'Insufficient data'}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Profile</span>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-lg font-bold">{profileData?.profile || 'N/A'}</p>
              <Badge variant="outline" className="mt-1 text-xs">
                {profileData?.method === 'kmeans' ? 'KMeans' : 'Heuristic'}
              </Badge>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="risk" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="risk">Risk Analysis</TabsTrigger>
          <TabsTrigger value="trend">Predictions</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        {/* Risk Tab */}
        <TabsContent value="risk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Target className="h-5 w-5" />Risk Assessment</CardTitle>
              <CardDescription>
                {riskData?.method === 'isolation_forest' ? 'Isolation Forest anomaly detection' :
                 riskData?.method === 'logistic_regression' ? 'Logistic Regression prediction' :
                 'Heuristic rule-based scoring'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Risk Score</p>
                  <p className="text-3xl font-bold">{riskData ? Math.round(riskData.risk_score * 100) : 0}</p>
                </div>
                <div className={`rounded-lg p-3 text-center border ${RISK_COLORS[riskData?.category || 'LOW']}`}>
                  <p className="text-xs text-muted-foreground">Category</p>
                  <p className="text-3xl font-bold">{riskData?.category || 'N/A'}</p>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Contributing Factors</h4>
                {[
                  { label: 'Attendance Rate', value: attendanceRate, max: 100 },
                  { label: 'Consecutive Absences', value: consecutiveAbsences, max: 10 },
                  { label: 'Late Count', value: attendanceRecords.filter(r => r.status === 'late').length, max: 20 },
                ].map((f, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>{f.label}</span>
                      <span className="text-muted-foreground">{f.value}</span>
                    </div>
                    <Progress value={Math.min((f.value / f.max) * 100, 100)} className="h-2" />
                  </div>
                ))}
              </div>

              <div className={`rounded-lg p-4 border ${RISK_COLORS[riskData?.category || 'LOW']}`}>
                <div className="flex items-start gap-2">
                  {RISK_ICONS[riskData?.category || 'LOW']}
                  <div>
                    <p className="font-medium text-sm">AI Recommendation</p>
                    <p className="text-sm mt-1">
                      {riskData?.category === 'CRITICAL' ? 'Immediate intervention required. Contact student advisor.' :
                       riskData?.category === 'HIGH' ? 'Consider scheduling a meeting with the student.' :
                       riskData?.category === 'MEDIUM' ? 'Monitor closely. May benefit from check-in.' :
                       'Attendance pattern is healthy. Keep it up!'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trend Tab */}
        <TabsContent value="trend" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Sparkles className="h-5 w-5" />Attendance Forecast</CardTitle>
                <CardDescription>
                  {trendData?.method === 'arima' ? 'ARIMA(1,1,1) time series' : 'Linear regression (y = mx + c)'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {trendData?.predictions && trendData.predictions.length > 0 ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-muted/50 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground">Next Week</p>
                        <p className="text-2xl font-bold">{trendData.predictions[0]}%</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground">In 4 Weeks</p>
                        <p className="text-2xl font-bold">{trendData.predictions[trendData.predictions.length - 1]}%</p>
                      </div>
                    </div>
                    {trendData.r_squared !== undefined && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">R²:</span>
                        <Progress value={trendData.r_squared * 100} className="flex-1 h-2" />
                        <span className="text-sm text-muted-foreground">{(trendData.r_squared * 100).toFixed(1)}%</span>
                      </div>
                    )}
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium">Weekly Predictions</h4>
                      {trendData.predictions.map((p, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="w-20 text-muted-foreground">Week {i + 1}</span>
                          <Progress value={p} className="flex-1 h-2" />
                          <span className="w-12 text-right">{p}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-center text-muted-foreground py-6">Need more weekly data for predictions.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Weekly Attendance History</CardTitle>
              </CardHeader>
              <CardContent>
                {weeklyRates.length > 0 ? (
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {weeklyRates.map((rate, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-16 text-muted-foreground">Week {i + 1}</span>
                        <Progress value={rate} className="flex-1 h-2" />
                        <span className="w-12 text-right font-mono">{rate}%</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-6">No weekly data yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          {correlationData ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />Attendance vs Grades (Pearson)
                </CardTitle>
                <CardDescription>r = covariance(x,y) / (σx × σy)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Pearson r</p>
                    <p className="text-2xl font-bold">{correlationData.r}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">p-value</p>
                    <p className="text-2xl font-bold">{correlationData.p_value}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Significant?</p>
                    <p className="text-2xl font-bold">{correlationData.significant ? '✓' : '✗'}</p>
                  </div>
                </div>
                <div className="bg-primary/5 rounded-lg p-4">
                  <p className="text-sm">{correlationData.interpretation}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">Strength</p>
                    <p className="font-bold capitalize">{correlationData.strength}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-muted-foreground">Direction</p>
                    <p className="font-bold capitalize">{correlationData.direction}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Performance data not available yet.</p>
                <p className="text-sm mt-1">Need ≥3 students with both attendance and grade data.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2"><Shield className="h-5 w-5" />Security & Anti-Fraud</CardTitle>
              <CardDescription>Python AI-powered fraud detection pipeline</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <ScanFace className="h-6 w-6 mx-auto mb-1 text-primary" />
                  <p className="text-xs text-muted-foreground">DeepFace ArcFace</p>
                  <p className="font-bold text-green-500">Active</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <Eye className="h-6 w-6 mx-auto mb-1 text-primary" />
                  <p className="text-xs text-muted-foreground">Mediapipe Liveness</p>
                  <p className="font-bold text-green-500">Active</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <ShieldAlert className="h-6 w-6 mx-auto mb-1 text-primary" />
                  <p className="text-xs text-muted-foreground">PyOD / One-Class SVM</p>
                  <p className="font-bold text-green-500">Active</p>
                </div>
              </div>

              <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-medium">Python AI Capabilities</h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    'DeepFace ArcFace (512-D embeddings)',
                    'Mediapipe face mesh (468 landmarks)',
                    'EAR blink detection',
                    'PnP head-pose estimation',
                    'Geopy Haversine geofencing',
                    'Isolation Forest anomaly detection',
                    'One-Class SVM (PyOD)',
                    'KMeans behavior profiling',
                    'ARIMA trend forecasting',
                    'MLflow model monitoring',
                  ].map((cap, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                      {cap}
                    </div>
                  ))}
                </div>
              </div>

              {/* Model Health (admin only) */}
              {role === 'admin' && modelHealthData.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Model Health (MLflow)</h4>
                  {modelHealthData.map((m, i) => (
                    <div key={i} className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                      <span className="text-sm font-medium">{m.model}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{m.total_predictions} predictions</span>
                        <Badge variant={m.status === 'healthy' ? 'default' : 'destructive'}>
                          {m.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {role !== 'student' && (
                <div className="bg-amber-500/10 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />Fraud Detection Summary
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Real-time fraud detection runs during every attendance submission via the Python AI server.
                    GPS spoofing, device fingerprinting, and behavioural anomalies are checked automatically.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
