import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/themes';
import {
  Calendar, Search, Plus, CheckCircle, XCircle,
  Clock, Download, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface LeaveRequest {
  id: string;
  user_id: string;
  employee_name: string;
  leave_type: string;
  days: number;
  start_date: string;
  end_date: string;
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
  created_at: string;
}

export default function CompanyLeaveManagement() {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All Types');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaveRequests = async () => {
    try {
      setLoading(true);
      setError(null);

      // Query leave_requests table
      const { data, error: fetchError } = await supabase
        .from('leave_requests')
        .select(`
          id,
          user_id,
          leave_type,
          days,
          start_date,
          end_date,
          status,
          reason,
          created_at,
          profiles (
            first_name,
            last_name
          )
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const transformedData: LeaveRequest[] = (data || []).map(leave => ({
        id: leave.id,
        user_id: leave.user_id,
        employee_name: `${(leave.profiles as any)?.[0]?.first_name || ''} ${(leave.profiles as any)?.[0]?.last_name || ''}`.trim() || leave.user_id,
        leave_type: leave.leave_type,
        days: leave.days,
        start_date: leave.start_date,
        end_date: leave.end_date,
        status: leave.status,
        reason: leave.reason || '',
        created_at: leave.created_at,
      }));

      setLeaveRequests(transformedData);

    } catch (err: any) {
      console.error('Error fetching leave requests:', err);
      setError(err.message || 'Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveRequests();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      const { error: updateError } = await supabase
        .from('leave_requests')
        .update({ status: 'approved' })
        .eq('id', id);

      if (updateError) throw updateError;

      setLeaveRequests(prev => prev.map(req => 
        req.id === id ? { ...req, status: 'approved' } : req
      ));
      toast.success('Leave request approved');
    } catch (err: any) {
      toast.error(`Failed to approve: ${err.message}`);
    }
  };

  const handleReject = async (id: string) => {
    try {
      const { error: updateError } = await supabase
        .from('leave_requests')
        .update({ status: 'rejected' })
        .eq('id', id);

      if (updateError) throw updateError;

      setLeaveRequests(prev => prev.map(req => 
        req.id === id ? { ...req, status: 'rejected' } : req
      ));
      toast.success('Leave request rejected');
    } catch (err: any) {
      toast.error(`Failed to reject: ${err.message}`);
    }
  };

  const handleExport = () => {
    if (filteredRequests.length === 0) {
      toast.info('No leave requests to export');
      return;
    }

    const csvContent = [
      ['ID', 'Employee', 'Type', 'Days', 'Start Date', 'End Date', 'Status', 'Reason'].join(','),
      ...filteredRequests.map(req => [
        req.id,
        req.employee_name,
        req.leave_type,
        req.days,
        req.start_date,
        req.end_date,
        req.status,
        req.reason
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leave-requests-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Leave requests exported successfully');
  };

  const handleAddRequest = () => {
    toast.info('Add leave request feature - opens modal for new request');
  };

  const filteredRequests = leaveRequests.filter(req => {
    const matchesSearch = req.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         req.leave_type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'All Types' || req.leave_type === selectedType;
    const matchesStatus = selectedStatus === 'All Status' || req.status === selectedStatus.toLowerCase();
    return matchesSearch && matchesType && matchesStatus;
  });

  const stats = {
    total: leaveRequests.length,
    pending: leaveRequests.filter(r => r.status === 'pending').length,
    approved: leaveRequests.filter(r => r.status === 'approved').length,
    rejected: leaveRequests.filter(r => r.status === 'rejected').length,
  };

  const leaveTypes = ['All Types', 'Sick', 'Personal', 'Annual', 'Work from Home', 'Academic'];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Rejected</Badge>;
      default:
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
            Leave Management
          </h1>
          <p className={`mt-1 ${theme === 'glassmorphism' ? 'text-white/60' : 'text-slate-500'}`}>
            Manage employee leave requests
          </p>
        </div>
        <Button 
          onClick={handleAddRequest}
          className={theme === 'glassmorphism' ? 'glass-button-primary' : 'neu-button-primary'}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Request
        </Button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <span className="ml-3 text-white/60">Loading leave requests...</span>
        </div>
      )}

      {!loading && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-4 text-center">
                <p className={`text-2xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                  {stats.total}
                </p>
                <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Total</p>
              </CardContent>
            </Card>
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-amber-400">{stats.pending}</p>
                <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Pending</p>
              </CardContent>
            </Card>
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-400">{stats.approved}</p>
                <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Approved</p>
              </CardContent>
            </Card>
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-red-400">{stats.rejected}</p>
                <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Rejected</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                  <Input
                    placeholder="Search by employee name or leave type..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`pl-10 ${theme === 'glassmorphism' ? 'glass-input' : 'neu-input'}`}
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <select 
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className={`px-4 py-2 rounded-xl border ${
                      theme === 'glassmorphism' 
                        ? 'bg-white/5 border-white/10 text-white' 
                        : 'bg-slate-100 border-slate-200 text-slate-800'
                    }`}
                  >
                    {leaveTypes.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select 
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className={`px-4 py-2 rounded-xl border ${
                      theme === 'glassmorphism' 
                        ? 'bg-white/5 border-white/10 text-white' 
                        : 'bg-slate-100 border-slate-200 text-slate-800'
                    }`}
                  >
                    <option value="All Status">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <Button variant="outline" className={theme === 'glassmorphism' ? 'glass-button-ghost' : 'neu-button'} onClick={handleExport}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Leave Requests List */}
          {filteredRequests.length === 0 ? (
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-12 text-center">
                <Calendar className={`w-16 h-16 mx-auto mb-4 ${theme === 'glassmorphism' ? 'text-white/20' : 'text-slate-300'}`} />
                <h3 className={`text-lg font-medium mb-2 ${theme === 'glassmorphism' ? 'text-white/80' : 'text-slate-700'}`}>
                  No Leave Requests
                </h3>
                <p className={`${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                  Leave requests will appear here when submitted
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-0">
                <div className="divide-y divide-white/5">
                  {filteredRequests.map((req) => (
                    <div key={req.id} className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className={`font-medium ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                              {req.employee_name}
                            </h4>
                            <Badge className={theme === 'glassmorphism' ? 'bg-white/10 text-white/70' : 'bg-slate-100 text-slate-600'}>
                              {req.leave_type}
                            </Badge>
                            {getStatusBadge(req.status)}
                          </div>
                          <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                            {req.days} day(s) • {req.start_date} to {req.end_date}
                          </p>
                          {req.reason && (
                            <p className={`text-sm mt-2 ${theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}`}>
                              Reason: {req.reason}
                            </p>
                          )}
                        </div>
                        {req.status === 'pending' && (
                          <div className="flex gap-2 ml-4">
                            <Button size="sm" className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30" onClick={() => handleApprove(req.id)}>
                              <CheckCircle className="w-4 h-4 mr-1" /> Approve
                            </Button>
                            <Button size="sm" className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30" onClick={() => handleReject(req.id)}>
                              <XCircle className="w-4 h-4 mr-1" /> Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}