import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  BookOpen, 
  Calendar, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  FileUp,
  ExternalLink,
  Search,
  Filter,
  ChevronRight,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { assignmentService } from '@/lib/api';
import type { Assignment } from '@/lib/api';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { Input } from '@/components/ui/input';

export default function StudentAssignmentsPage() {
  const { user } = useSupabaseAuth();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  useEffect(() => {
    async function loadAssignments() {
      if (!user?.id) return;
      try {
        const data = await assignmentService.getForStudent(user.id);
        setAssignments(data);
      } catch (err) {
        console.error('Failed to load assignments:', err);
      } finally {
        setLoading(false);
      }
    }
    loadAssignments();
  }, [user?.id]);

  const filteredAssignments = assignments.filter(a => 
    a.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    a.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING': return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">PENDING</Badge>;
      case 'SUBMITTED': return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">SUBMITTED</Badge>;
      case 'LATE': return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">OVERDUE</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDaysRemaining = (deadline: string) => {
    const diff = new Date(deadline).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 px-3 py-1">ACADEMIC HUB</Badge>
          <h1 className="text-4xl font-black text-white tracking-tight">Assignments</h1>
          <p className="text-slate-400 text-lg">Track your coursework, deadlines, and submissions across all subjects.</p>
        </div>
        
        <div className="flex items-center gap-3">
            <div className="relative group">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
               <Input 
                 placeholder="Search assignments..."
                 className="bg-slate-900/50 border-slate-800 rounded-2xl pl-10 h-12 w-64 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all text-white"
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
               />
            </div>
            <Button variant="outline" className="h-12 w-12 rounded-2xl bg-slate-900/50 border-slate-800 text-slate-400 hover:text-white transition-colors">
               <Filter className="w-5 h-5" />
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Sidebar - Stats & Categories */}
        <div className="lg:col-span-1 space-y-6">
           <Card className="bg-slate-950/60 border-slate-800/60 backdrop-blur-xl rounded-[2rem] overflow-hidden border-indigo-500/10 shadow-2xl">
              <CardContent className="p-8 space-y-8">
                 <div className="space-y-4">
                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Overall Progress</h3>
                    <div className="space-y-2">
                       <div className="flex justify-between text-sm">
                          <span className="text-slate-300 font-medium">Completion Rate</span>
                          <span className="text-indigo-400 font-bold">68%</span>
                       </div>
                       <Progress value={68} className="h-2 bg-slate-900 border border-slate-800 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" />
                       </Progress>
                    </div>
                 </div>

                 <div className="space-y-2">
                    {[
                      { label: 'Upcoming', count: 2, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400/10' },
                      { label: 'Submitted', count: 1, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
                      { label: 'Missing', count: 1, icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-400/10' },
                    ].map((item, idx) => (
                      <button key={idx} className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-slate-900/50 transition-all group border border-transparent hover:border-slate-800">
                         <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center`}>
                               <item.icon className={`w-4 h-4 ${item.color}`} />
                            </div>
                            <span className="text-sm font-semibold text-slate-300 group-hover:text-white">{item.label}</span>
                         </div>
                         <span className="text-sm font-black text-slate-500 group-hover:text-indigo-400">{item.count}</span>
                      </button>
                    ))}
                 </div>

                 <div className="pt-6 border-t border-slate-900">
                    <div className="p-5 rounded-3xl bg-indigo-500/5 border border-indigo-500/10 flex flex-col gap-3">
                       <p className="text-sm text-slate-400 leading-relaxed font-medium">
                          Next Deadline: <span className="text-indigo-300 font-bold italic">DBMS Normalization</span>
                       </p>
                       <div className="flex items-center gap-2 text-xs font-black text-indigo-400/80 uppercase tracking-tighter">
                          <Clock className="w-3 h-3" /> Ends in 3 Days
                       </div>
                    </div>
                 </div>
              </CardContent>
           </Card>
        </div>

        {/* Assignments List */}
        <div className="lg:col-span-3">
           <AnimatePresence mode="popLayout">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {filteredAssignments.map((assignment, idx) => {
                    const daysLeft = getDaysRemaining(assignment.deadline);
                    return (
                       <motion.div
                         key={assignment.id}
                         initial={{ opacity: 0, scale: 0.95, y: 20 }}
                         animate={{ opacity: 1, scale: 1, y: 0 }}
                         transition={{ delay: idx * 0.1 }}
                         layout
                       >
                          <Card className="h-full bg-slate-950/60 border-slate-800/60 rounded-[2rem] overflow-hidden group hover:border-indigo-500/30 transition-all shadow-xl hover:shadow-indigo-500/5 relative">
                             {/* Priority Indicator */}
                             {assignment.priority === 'URGENT' && (
                               <div className="absolute top-0 right-0 w-2 h-full bg-red-500" />
                             )}
                             
                             <CardContent className="p-8 flex flex-col h-full">
                                <div className="flex justify-between items-start mb-6">
                                   <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center border border-slate-800 group-hover:bg-indigo-500 group-hover:border-indigo-400 transition-all duration-500">
                                      <BookOpen className="w-7 h-7 text-indigo-400 group-hover:text-white transition-colors" />
                                   </div>
                                   {getStatusBadge(assignment.status)}
                                </div>

                                <div className="space-y-2 mb-6">
                                   <p className="text-[10px] font-black text-indigo-400/80 uppercase tracking-[0.2em]">{assignment.subject}</p>
                                   <h3 className="text-2xl font-black text-white leading-tight group-hover:translate-x-1 transition-transform">{assignment.title}</h3>
                                   <p className="text-sm text-slate-500 line-clamp-2 mt-2 leading-relaxed">{assignment.description}</p>
                                </div>

                                <div className="mt-auto space-y-6">
                                   <div className="flex items-center justify-between text-xs font-bold px-1">
                                      <div className="flex items-center gap-2 text-slate-400">
                                         <Calendar className="w-4 h-4 text-slate-600" />
                                         Deadline: <span className={daysLeft < 3 ? 'text-red-400' : 'text-slate-300'}>{new Date(assignment.deadline).toLocaleDateString()}</span>
                                      </div>
                                      <div className="text-indigo-400/80">{assignment.points} Points</div>
                                   </div>

                                   <div className="flex gap-3">
                                      {assignment.status === 'PENDING' || assignment.status === 'LATE' ? (
                                        <Button className="flex-1 h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-2">
                                           <FileUp className="w-4 h-4" />
                                           Submit
                                        </Button>
                                      ) : (
                                        <Button variant="outline" className="flex-1 h-12 rounded-xl bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-bold gap-2 cursor-default">
                                           <CheckCircle2 className="w-4 h-4" />
                                           Completed
                                        </Button>
                                      )}
                                      <Button variant="outline" className="h-12 w-12 rounded-xl bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-400 transition-all">
                                         <ExternalLink className="w-4 h-4" />
                                      </Button>
                                   </div>
                                </div>
                             </CardContent>
                          </Card>
                       </motion.div>
                    );
                 })}
              </div>
           </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
