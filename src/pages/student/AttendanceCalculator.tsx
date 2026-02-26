import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Calculator, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';


export default function AttendanceCalculatorPage() {
  const [totalClasses, setTotalClasses] = useState(50);
  const [attendedClasses, setAttendedClasses] = useState(42);
  const [requiredPercentage, setRequiredPercentage] = useState(75);
  const [plannedAbsences, setPlannedAbsences] = useState(0);

  const currentPercentage = totalClasses > 0 ? (attendedClasses / totalClasses) * 100 : 0;
  const projectedPercentage = totalClasses + plannedAbsences > 0 
    ? (attendedClasses / (totalClasses + plannedAbsences)) * 100 
    : 0;
  
  const classesNeeded = Math.max(0, Math.ceil(
    (requiredPercentage * (totalClasses + plannedAbsences) - attendedClasses * 100) / (100 - requiredPercentage)
  ));
  
  const safeAbsences = Math.max(0, Math.floor(
    (attendedClasses * 100 - requiredPercentage * totalClasses) / requiredPercentage
  ));

  const getRiskLevel = () => {
    if (projectedPercentage < 60) return { level: 'HIGH', color: 'text-red-400', bg: 'bg-red-500/10' };
    if (projectedPercentage < 75) return { level: 'MEDIUM', color: 'text-amber-400', bg: 'bg-amber-500/10' };
    return { level: 'LOW', color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
  };

  const risk = getRiskLevel();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Attendance Calculator</h1>
        <p className="text-slate-400">Plan your attendance and calculate safe absence margin</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Calculator className="w-5 h-5 text-emerald-400" />
              Calculator
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Total Classes Held</Label>
              <Input
                type="number"
                value={totalClasses}
                onChange={(e) => setTotalClasses(Number(e.target.value))}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Classes Attended</Label>
              <Input
                type="number"
                value={attendedClasses}
                onChange={(e) => setAttendedClasses(Number(e.target.value))}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Required Attendance %</Label>
              <Input
                type="number"
                value={requiredPercentage}
                onChange={(e) => setRequiredPercentage(Number(e.target.value))}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Planned Future Absences</Label>
              <Input
                type="number"
                value={plannedAbsences}
                onChange={(e) => setPlannedAbsences(Number(e.target.value))}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <p className="text-sm text-slate-400">Current Attendance</p>
              <p className="text-4xl font-bold text-white">{currentPercentage.toFixed(1)}%</p>
              <Progress value={currentPercentage} className="h-3 mt-2 bg-slate-800" />
            </div>

            <div className="text-center">
              <p className="text-sm text-slate-400">Projected Attendance</p>
              <p className={`text-4xl font-bold ${risk.color}`}>{projectedPercentage.toFixed(1)}%</p>
              <p className="text-xs text-slate-500 mt-1">After {plannedAbsences} planned absences</p>
            </div>

            <div className={`p-4 rounded-lg ${risk.bg} border border-${risk.color.replace('text-', '')}/20`}>
              <div className="flex items-center gap-2">
                <AlertTriangle className={`w-5 h-5 ${risk.color}`} />
                <span className={`font-medium ${risk.color}`}>{risk.level} RISK</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-slate-800/50 text-center">
                <p className="text-sm text-slate-400">Safe Absences</p>
                <p className="text-2xl font-bold text-emerald-400">{safeAbsences}</p>
                <p className="text-xs text-slate-500">More classes you can miss</p>
              </div>
              <div className="p-4 rounded-lg bg-slate-800/50 text-center">
                <p className="text-sm text-slate-400">Classes Needed</p>
                <p className="text-2xl font-bold text-cyan-400">{classesNeeded}</p>
                <p className="text-xs text-slate-500">To reach {requiredPercentage}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {projectedPercentage < requiredPercentage && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
                <div>
                  <p className="font-medium text-white">Attendance Below Requirement</p>
                  <p className="text-sm text-slate-400">
                    Your projected attendance is below the required {requiredPercentage}%. 
                    Attend all upcoming classes to improve your attendance.
                  </p>
                </div>
              </div>
            )}
            {safeAbsences === 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
                <div>
                  <p className="font-medium text-white">No Safe Absences Left</p>
                  <p className="text-sm text-slate-400">
                    You cannot miss any more classes without falling below the required percentage.
                  </p>
                </div>
              </div>
            )}
            {projectedPercentage >= requiredPercentage && safeAbsences > 0 && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5" />
                <div>
                  <p className="font-medium text-white">Good Standing</p>
                  <p className="text-sm text-slate-400">
                    Your attendance is above the required percentage. You can safely miss {safeAbsences} more classes.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}