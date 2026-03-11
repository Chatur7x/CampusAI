import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, TrendingUp, AlertTriangle, CheckCircle2, Info, BookOpen, Loader2 } from 'lucide-react';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { supabase } from '@/lib/supabase';

interface SubjectStats {
  id: string;
  name: string;
  total: number;
  attended: number;
}

export default function AttendanceCalculatorPage() {
  const { user } = useSupabaseAuth();
  const [subjects, setSubjects] = useState<SubjectStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<string>('custom');
  const [totalClasses, setTotalClasses] = useState(50);
  const [attendedClasses, setAttendedClasses] = useState(38);
  const [requiredPercentage, setRequiredPercentage] = useState(75);

  // Fetch real attendance data grouped by subject
  useEffect(() => {
    (async () => {
      if (!user?.student?.id && !user?.id) { setLoading(false); return; }
      try {
        const studentId = user?.student?.id;
        if (!studentId) { setLoading(false); return; }

        // Get all attendance records for this student
        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('subject_id, status')
          .eq('student_id', studentId);

        if (!attendanceData?.length) { setLoading(false); return; }

        // Get subject names
        const subjectIds = [...new Set(attendanceData.map(a => a.subject_id).filter(Boolean))];
        let subjectMap: Record<string, string> = {};
        if (subjectIds.length > 0) {
          const { data: subjectData } = await supabase
            .from('subjects')
            .select('id, name, code')
            .in('id', subjectIds);
          if (subjectData) {
            subjectMap = Object.fromEntries(subjectData.map(s => [s.id, `${s.name} (${s.code})`]));
          }
          // Fallback: try courses table
          const missing = subjectIds.filter(id => !subjectMap[id]);
          if (missing.length > 0) {
            const { data: courseData } = await supabase
              .from('courses')
              .select('id, name, code')
              .in('id', missing);
            if (courseData) {
              courseData.forEach(c => { subjectMap[c.id] = `${c.name} (${c.code})`; });
            }
          }
        }

        // Group by subject
        const statsMap: Record<string, { total: number; attended: number }> = {};
        for (const rec of attendanceData) {
          const sid = rec.subject_id || 'unknown';
          if (!statsMap[sid]) statsMap[sid] = { total: 0, attended: 0 };
          statsMap[sid].total++;
          if (rec.status === 'PRESENT' || rec.status === 'LATE') {
            statsMap[sid].attended++;
          }
        }

        const result: SubjectStats[] = Object.entries(statsMap).map(([id, stats]) => ({
          id,
          name: subjectMap[id] || `Subject ${id.substring(0, 8)}`,
          total: stats.total,
          attended: stats.attended,
        }));

        setSubjects(result);
        // Auto-select first subject if available
        if (result.length > 0) {
          setSelectedSubject(result[0].id);
          setTotalClasses(result[0].total);
          setAttendedClasses(result[0].attended);
        }
      } catch (err) {
        console.error('Failed to fetch attendance data:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const handleSubjectChange = (subjectId: string) => {
    setSelectedSubject(subjectId);
    if (subjectId !== 'custom') {
      const subject = subjects.find(s => s.id === subjectId);
      if (subject) {
        setTotalClasses(subject.total);
        setAttendedClasses(subject.attended);
      }
    }
  };

  const safeAttended = Math.min(attendedClasses, totalClasses);
  const currentPercentage = totalClasses > 0 ? (safeAttended / totalClasses) * 100 : 0;

  const analysis = useMemo(() => {
    if (totalClasses === 0) return { canSkip: 0, needsToAttend: 0 };
    
    // Safety Margin: Classes that can be missed while staying above threshold
    // (A) / (T + S) = req / 100  => S = (100*A / req) - T
    const safetyMargin = Math.floor(Math.max(0, (100 * safeAttended / requiredPercentage) - totalClasses));

    if (currentPercentage >= requiredPercentage) {
      return {
        canSkip: safetyMargin,
        needsToAttend: 0,
      };
    } else {
      // Classes needed in a row: (A + x) / (T + x) = req / 100
      // 100A + 100x = reqT + reqx
      // x(100 - req) = reqT - 100A
      // x = (reqT - 100A) / (100 - req)
      if (requiredPercentage === 100) {
        // If 100% is required and we missed even one, we can NEVER reach exactly 100%.
        return { canSkip: 0, needsToAttend: Infinity };
      }
      const x = (requiredPercentage * totalClasses - 100 * safeAttended) / (100 - requiredPercentage);
      return {
        canSkip: 0,
        needsToAttend: Math.ceil(Math.max(0, x)),
      };
    }
  }, [totalClasses, safeAttended, requiredPercentage, currentPercentage]);

  const risk = useMemo(() => {
    if (currentPercentage < requiredPercentage - 10) return { level: 'CRITICAL', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
    if (currentPercentage < requiredPercentage) return { level: 'WARNING', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
    return { level: 'SAFE', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
  }, [currentPercentage, requiredPercentage]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Attendance Margin Calculator</h2>
          <p className="text-slate-400 mt-1">Plan your leaves or track exactly how many classes you need.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          <span className="ml-3 text-slate-400">Loading your attendance data...</span>
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-950/70 border border-slate-800 rounded-3xl shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Calculator className="w-5 h-5 text-emerald-400" />
              Current Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-slate-300 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-500" /> 
                Select Subject
              </Label>
              <Select value={selectedSubject} onValueChange={handleSubjectChange}>
                <SelectTrigger className="w-full bg-slate-900 border-slate-700 text-white">
                  <SelectValue placeholder="Select a subject to auto-fill" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-white">
                  <SelectItem value="custom">Custom Input (Manual)</SelectItem>
                  {subjects.map(sub => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {sub.name} ({sub.attended}/{sub.total})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 pt-2">
              <Label className="text-slate-300">Total Classes Held</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={totalClasses}
                onChange={(e) => {
                  setTotalClasses(Math.max(1, parseInt(e.target.value) || 0));
                  setSelectedSubject('custom');
                }}
                className="bg-slate-900 border-slate-800 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Classes Attended</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={totalClasses}
                value={attendedClasses}
                onChange={(e) => {
                  setAttendedClasses(Math.max(0, parseInt(e.target.value) || 0));
                  setSelectedSubject('custom');
                }}
                className="bg-slate-900 border-slate-800 text-white"
              />
              {attendedClasses > totalClasses && (
                <p className="text-xs text-amber-500 mt-1">Attended classes cannot exceed total classes.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Required Attendance (%)</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                value={requiredPercentage}
                onChange={(e) => setRequiredPercentage(Math.min(100, Math.max(1, parseInt(e.target.value) || 0)))}
                className="bg-slate-900 border-slate-800 text-white"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-950/70 border border-slate-800 rounded-3xl shadow-[0_24px_60px_rgba(0,0,0,0.5)] flex flex-col">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              Analysis Report
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 flex-1 flex flex-col justify-between">
            <div className="flex flex-col items-center">
              <div className="w-full flex justify-between items-end mb-2">
                <span className="text-sm font-medium text-slate-400">Current</span>
                <span className="text-3xl font-bold text-white">{currentPercentage.toFixed(1)}%</span>
              </div>
              <div className="w-full relative">
                <Progress 
                  value={currentPercentage} 
                  className="h-3 bg-slate-800 w-full" 
                  indicatorClassName={currentPercentage >= requiredPercentage ? "bg-emerald-500" : "bg-amber-500"} 
                />
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-red-500/80 z-10 hidden sm:block" 
                  style={{ left: `${requiredPercentage}%` }}
                >
                  <span className="absolute -top-6 -translate-x-1/2 text-[10px] text-red-400 font-bold bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 whitespace-nowrap">Target {requiredPercentage}%</span>
                </div>
              </div>
            </div>

            <div className={`p-4 rounded-2xl ${risk.bg} border ${risk.border} flex items-start gap-3`}>
              {currentPercentage >= requiredPercentage ? (
                <CheckCircle2 className={`w-5 h-5 mt-0.5 ${risk.color}`} />
              ) : (
                <AlertTriangle className={`w-5 h-5 mt-0.5 ${risk.color}`} />
              )}
              <div>
                <h4 className={`font-semibold ${risk.color}`}>{risk.level} STATUS</h4>
                {currentPercentage >= requiredPercentage ? (
                  <div className="space-y-1">
                    <p className="text-sm text-emerald-200/70 mt-1">
                      You are safely above the target! You can skip <strong className="text-emerald-300 font-bold">{analysis.canSkip}</strong> more classes.
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                       <Badge className="bg-emerald-500/20 text-emerald-300 border-none">Safety Margin: {analysis.canSkip} classes</Badge>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm text-amber-200/70 mt-1">
                      {analysis.needsToAttend === Infinity 
                        ? 'Target mathematically impossible to reach (can never undo a missed class for 100%).'
                        : `Target not met. You must attend the next ${analysis.needsToAttend} consecutive classes.`}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                       <Badge className="bg-amber-500/20 text-amber-300 border-none">Required: {analysis.needsToAttend === Infinity ? 'Impossible' : `${analysis.needsToAttend} more`}</Badge>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/50 flex gap-3 text-sm text-slate-400">
              <Info className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
              <p>
                {currentPercentage >= requiredPercentage 
                  ? "Skipping more than the specified amount will result in your attendance falling below the required margin."
                  : "The required number is a straight continuation. Missing any upcoming class will increase the overall burden."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      )}
    </div>
  );
}