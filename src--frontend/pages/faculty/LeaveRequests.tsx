import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle2, XCircle, FileText, Calendar, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { leaveService, studentService } from '@/lib/api';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';

export default function LeaveRequestsPage() {
  const { user } = useSupabaseAuth();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      // Fetch all pending leaves; in a real enterprise app, we'd pass class IDs
      const data = await leaveService.getPending();
      
      // Enrich with student details
      const enrichedLeaves = await Promise.all(data.map(async (leave: any) => {
        const student = await studentService.getById(leave.student_id);
        return {
          ...leave,
          studentName: student ? `${(student as any).profile?.first_name || 'Unknown'} ${(student as any).profile?.last_name || ''}` : 'Unknown Student',
          enrollmentId: student?.enrollment_id || 'N/A'
        };
      }));

      setLeaves(enrichedLeaves);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.faculty?.id) {
      fetchLeaves();
    }
  }, [user?.faculty?.id]);

  const handleAction = async (leaveId: string, action: 'APPROVE' | 'REJECT', reason = '') => {
    if (!user?.faculty?.id) return;
    setProcessingId(leaveId);
    try {
      if (action === 'APPROVE') {
        await leaveService.approve(leaveId, user.faculty.id);
        toast.success('Leave request approved');
      } else {
        await leaveService.reject(leaveId, user.faculty.id, reason);
        toast.success('Leave request rejected');
      }
      // Remove from list
      setLeaves(leaves.filter(l => l.id !== leaveId));
    } catch (err) {
      toast.error('Failed to process leave request');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        <span className="ml-3 text-slate-400">Loading leave requests...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Leave Approvals</h1>
          <p className="text-slate-400">Review and approve pending student leaves</p>
        </div>
        <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 px-3 py-1 text-sm">
          {leaves.length} Pending
        </Badge>
      </div>

      {leaves.length === 0 ? (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="py-12 text-center text-slate-400">
            <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400/50 mb-3" />
            <p>No pending leave requests right now.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {leaves.map((leave) => (
            <Card key={leave.id} className="bg-slate-900/70 border border-slate-800 shadow-xl relative overflow-hidden transition-all hover:border-cyan-500/30">
              {leave.type === 'MEDICAL' && (
                <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden">
                  <div className="absolute top-4 -right-6 bg-red-500 text-white text-[10px] font-bold py-1 px-8 rotate-45 transform">
                    MEDICAL
                  </div>
                </div>
              )}
              <CardContent className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-cyan-400 font-bold border border-cyan-500/20">
                    {leave.studentName.charAt(0)}
                  </div>
                  <div className="flex-1 pr-6">
                    <h3 className="text-lg font-semibold text-white truncate">{leave.studentName}</h3>
                    <p className="text-sm text-slate-400 truncate">{leave.enrollmentId}</p>
                  </div>
                </div>

                <div className="space-y-3 mb-6 bg-slate-950/50 p-3 rounded-lg border border-slate-800/50">
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Calendar className="w-4 h-4 text-emerald-400" />
                    <span>From: {new Date(leave.start_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <span>To: {new Date(leave.end_date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm text-slate-300">
                    <FileText className="w-4 h-4 text-cyan-400 mt-1 flex-shrink-0" />
                    <p className="line-clamp-2 leading-relaxed">{leave.reason}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button 
                    onClick={() => handleAction(leave.id, 'APPROVE')}
                    disabled={processingId === leave.id}
                    className="flex-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/20"
                  >
                    {processingId === leave.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Approve
                  </Button>
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="flex-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/20 hover:text-red-300">
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-slate-900 border-slate-800 text-white">
                      <DialogHeader>
                        <DialogTitle>Reject Leave Request</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded flex gap-2 text-amber-200 text-sm">
                          <AlertCircle className="w-5 h-5 flex-shrink-0" />
                          <p>You are about to reject {leave.studentName}'s leave request. An optional reason can be provided.</p>
                        </div>
                        <Input id={`reason-${leave.id}`} placeholder="Rejection reason (optional)" className="bg-slate-800 border-slate-700" />
                        <Button
                          onClick={(e) => {
                            const reason = (document.getElementById(`reason-${leave.id}`) as HTMLInputElement)?.value || '';
                            handleAction(leave.id, 'REJECT', reason);
                          }}
                          className="w-full bg-red-600 hover:bg-red-700"
                        >
                          Confirm Rejection
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
