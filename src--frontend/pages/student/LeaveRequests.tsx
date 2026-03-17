import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Loader2, 
  Plus, 
  Calendar, 
  FileText, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  History,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { leaveService } from '@/lib/api';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';

export default function StudentLeaveRequestsPage() {
  const { user } = useSupabaseAuth();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    type: 'PERSONAL',
    startDate: '',
    endDate: '',
    reason: ''
  });

  const fetchLeaves = async () => {
    if (!user?.student?.id) return;
    try {
      setLoading(true);
      const data = await leaveService.getForStudent(user.student.id);
      setLeaves(data);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load leave history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, [user?.student?.id]);

  const handleSubmit = async () => {
    if (!user?.student?.id) return;
    if (!form.startDate || !form.endDate || !form.reason.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      await leaveService.create({
        student_id: user.student.id,
        start_date: form.startDate,
        end_date: form.endDate,
        reason: form.reason,
        type: form.type as any
      });
      toast.success('Leave request submitted successfully');
      setIsSubmitOpen(false);
      setForm({ type: 'PERSONAL', startDate: '', endDate: '', reason: '' });
      fetchLeaves();
    } catch (err) {
      toast.error('Failed to submit leave request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusColors: Record<string, string> = {
    PENDING: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    APPROVED: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    REJECTED: 'bg-red-500/10 text-red-500 border-red-500/20',
    CANCELLED: 'bg-slate-500/10 text-slate-500 border-slate-500/20'
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-3 py-1">LEAVE MANAGEMENT</Badge>
          <h1 className="text-4xl font-black text-white tracking-tight">My Leave Requests</h1>
          <p className="text-slate-400 text-lg">Apply for leave and track your approval status in real-time.</p>
        </div>

        <Dialog open={isSubmitOpen} onOpenChange={setIsSubmitOpen}>
          <DialogTrigger asChild>
            <Button className="h-14 px-8 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold shadow-[0_10px_30px_-10px_rgba(16,185,129,0.5)] transition-all active:scale-95 group">
              <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform" />
              Apply for Leave
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-slate-950 border-slate-800 text-white max-w-md rounded-[2rem]">
            <DialogHeader className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 mb-2">
                <FileText className="w-6 h-6 text-emerald-400" />
              </div>
              <DialogTitle className="text-2xl font-bold tracking-tight">New Leave Application</DialogTitle>
              <DialogDescription className="text-slate-400">
                Provide details for your leave request. Your class in-charge will be notified.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-4">
              <div className="space-y-2">
                <Label className="text-slate-300 font-semibold text-sm ml-1">Leave Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="bg-slate-900/50 border-slate-800 h-12 rounded-xl">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="PERSONAL">Personal Leave</SelectItem>
                    <SelectItem value="MEDICAL">Medical / Sick Leave</SelectItem>
                    <SelectItem value="ACADEMIC">Academic / On Duty (OD)</SelectItem>
                    <SelectItem value="EMERGENCY">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300 font-semibold text-sm ml-1">Start Date</Label>
                  <div className="relative">
                    <Input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                      className="bg-slate-900/50 border-slate-800 h-12 rounded-xl pl-10"
                    />
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/60" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300 font-semibold text-sm ml-1">End Date</Label>
                  <div className="relative">
                    <Input
                      type="date"
                      value={form.endDate}
                      onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                      className="bg-slate-900/50 border-slate-800 h-12 rounded-xl pl-10"
                    />
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/60" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300 font-semibold text-sm ml-1">Reason for Leave</Label>
                <Textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className="bg-slate-900/50 border-slate-800 min-h-[100px] rounded-xl placeholder:text-slate-600 resize-none"
                  placeholder="Explain your reason clearly..."
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting}
                className="w-full h-14 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Send className="w-5 h-5 mr-2" />}
                Submit Application
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Statistics or Status Overview */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-slate-950/60 border-slate-800/60 backdrop-blur-xl rounded-[2rem] overflow-hidden border-emerald-500/10 shadow-2xl">
             <div className="h-2 bg-gradient-to-r from-emerald-500 to-teal-400" />
             <CardContent className="p-8 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                    <History className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Summary</CardTitle>
                    <CardDescription>Academic Year 2026</CardDescription>
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    { label: 'Total Applications', count: leaves.length, color: 'text-white' },
                    { label: 'Approved', count: leaves.filter(l => l.status === 'APPROVED').length, color: 'text-emerald-400' },
                    { label: 'Pending', count: leaves.filter(l => l.status === 'PENDING').length, color: 'text-amber-400' },
                    { label: 'Rejected', count: leaves.filter(l => l.status === 'REJECTED').length, color: 'text-red-400' }
                  ].map((stat, i) => (
                    <div key={i} className="flex justify-between items-center py-3 border-b border-slate-800/50 last:border-0">
                      <span className="text-slate-400 font-medium">{stat.label}</span>
                      <span className={`text-xl font-black ${stat.color}`}>{stat.count}</span>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 flex items-start gap-4">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Leaves approved here will automatically update your attendance records to "Excused" where applicable.
                  </p>
                </div>
             </CardContent>
          </Card>
        </div>

        {/* History List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              Recent Activity
            </h3>
            {loading && <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />}
          </div>

          {!loading && leaves.length === 0 ? (
            <Card className="bg-slate-950/40 border-slate-800 border-dashed rounded-[2rem] py-20">
              <CardContent className="flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-slate-900 flex items-center justify-center mb-6">
                  <FileText className="w-10 h-10 text-slate-700" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">No Leave History</h3>
                <p className="text-slate-500 max-w-xs">You haven't submitted any leave requests yet. Start by clicking "Apply for Leave".</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {leaves.map((leave, idx) => (
                  <motion.div
                    key={leave.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <Card className="bg-slate-950/60 border-slate-800/60 rounded-3xl overflow-hidden hover:border-emerald-500/20 transition-all group">
                      <CardContent className="p-6">
                        <div className="flex flex-col sm:flex-row gap-6">
                          <div className="flex-1 space-y-4">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <Badge className={`${statusColors[leave.status || 'PENDING']} uppercase text-[10px] font-black tracking-widest`}>
                                  {leave.status}
                                </Badge>
                                <h4 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                                  {leave.type || 'PERSONAL'} LEAVE
                                </h4>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-mono text-slate-500 uppercase">Submitted On</p>
                                <p className="text-sm font-bold text-slate-300">{new Date(leave.created_at).toLocaleDateString()}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-900/30 border border-slate-800/50">
                               <div className="space-y-1">
                                 <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Start Date</p>
                                 <div className="flex items-center gap-2 text-white">
                                    <Calendar className="w-4 h-4 text-emerald-500" />
                                    <span className="font-semibold">{new Date(leave.start_date).toLocaleDateString()}</span>
                                 </div>
                               </div>
                               <div className="space-y-1">
                                 <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">End Date</p>
                                 <div className="flex items-center gap-2 text-white">
                                    <Clock className="w-4 h-4 text-teal-500" />
                                    <span className="font-semibold">{new Date(leave.end_date).toLocaleDateString()}</span>
                                 </div>
                               </div>
                            </div>

                            <div className="space-y-2">
                               <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Reason</p>
                               <p className="text-sm text-slate-400 italic line-clamp-2 leading-relaxed">"{leave.reason}"</p>
                            </div>

                            {leave.status === 'REJECTED' && leave.rejection_reason && (
                              <div className="mt-4 p-4 rounded-2xl bg-red-500/5 border border-red-500/10">
                                <div className="flex items-center gap-2 text-red-400 text-xs font-bold mb-1">
                                  <XCircle className="w-4 h-4" /> REJECTION COMMENT
                                </div>
                                <p className="text-sm text-red-300/80">{leave.rejection_reason}</p>
                              </div>
                            )}

                            {leave.status === 'APPROVED' && (
                              <div className="flex items-center gap-2 text-emerald-400/80 text-xs font-bold">
                                <CheckCircle2 className="w-4 h-4" /> Verified & Synchronized with Timetable
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
