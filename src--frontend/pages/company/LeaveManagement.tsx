import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/themes';
import {
  Calendar, Search, Plus, CheckCircle, XCircle,
  Clock, AlertCircle, Filter, Download, Eye
} from 'lucide-react';

const mockLeaveRequests = [
  { id: 1, employee: 'John Doe', type: 'Annual Leave', days: 5, startDate: '2026-04-10', endDate: '2026-04-14', status: 'pending', reason: 'Family vacation' },
  { id: 2, employee: 'Sarah Smith', type: 'Sick Leave', days: 2, startDate: '2026-04-08', endDate: '2026-04-09', status: 'approved', reason: 'Medical appointment' },
  { id: 3, employee: 'Mike Johnson', type: 'Work from Home', days: 3, startDate: '2026-04-15', endDate: '2026-04-17', status: 'pending', reason: 'Home repairs' },
  { id: 4, employee: 'Emily Brown', type: 'Annual Leave', days: 10, startDate: '2026-04-20', endDate: '2026-04-29', status: 'rejected', reason: 'Wedding attendance' },
  { id: 5, employee: 'David Wilson', type: 'Personal Leave', days: 1, startDate: '2026-04-12', endDate: '2026-04-12', status: 'pending', reason: 'Personal work' },
];

const leaveTypes = ['All Types', 'Annual Leave', 'Sick Leave', 'Work from Home', 'Personal Leave'];
const statuses = ['All Status', 'Pending', 'Approved', 'Rejected'];

export default function CompanyLeaveManagement() {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All Types');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [showAddModal, setShowAddModal] = useState(false);

  const filteredRequests = mockLeaveRequests.filter(req => {
    const matchesSearch = req.employee.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'All Types' || req.type === selectedType;
    const matchesStatus = selectedStatus === 'All Status' || req.status === selectedStatus.toLowerCase();
    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
          <CheckCircle className="w-3 h-3 mr-1" /> Approved
        </Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
          <XCircle className="w-3 h-3 mr-1" /> Rejected
        </Badge>;
      default:
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
          <Clock className="w-3 h-3 mr-1" /> Pending
        </Badge>;
    }
  };

  const pendingCount = mockLeaveRequests.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
            Leave Requests
          </h1>
          <p className={`mt-1 ${theme === 'glassmorphism' ? 'text-white/60' : 'text-slate-500'}`}>
            Manage employee leave requests
          </p>
        </div>
        <Button 
          onClick={() => setShowAddModal(true)}
          className={theme === 'glassmorphism' ? 'glass-button-primary' : 'neu-button-primary'}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Request
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <p className={`text-2xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>28</p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Total Requests</p>
          </CardContent>
        </Card>
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{pendingCount}</p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Pending</p>
          </CardContent>
        </Card>
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">22</p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Approved</p>
          </CardContent>
        </Card>
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-400">4</p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Rejected</p>
          </CardContent>
        </Card>
      </div>

      <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
              <Input
                placeholder="Search requests..."
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
                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <Button variant="outline" className={theme === 'glassmorphism' ? 'glass-button-ghost' : 'neu-button'}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {filteredRequests.map((req) => (
          <Card key={req.id} className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-2">
                    <h3 className={`text-lg font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                      {req.employee}
                    </h3>
                    {getStatusBadge(req.status)}
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className={theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}>
                      <Badge className={theme === 'glassmorphism' ? 'bg-white/10 text-white/70' : 'bg-slate-100 text-slate-600'} variant="outline">
                        {req.type}
                      </Badge>
                    </span>
                    <span className={theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}>
                      <Calendar className="w-4 h-4 inline mr-1" />
                      {req.startDate} - {req.endDate}
                    </span>
                    <span className={theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}>
                      {req.days} day{req.days > 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className={`mt-2 text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                    Reason: {req.reason}
                  </p>
                </div>
                {req.status === 'pending' && (
                  <div className="flex gap-2 ml-4">
                    <Button size="sm" className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30">
                      <CheckCircle className="w-4 h-4 mr-1" /> Approve
                    </Button>
                    <Button size="sm" className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30">
                      <XCircle className="w-4 h-4 mr-1" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
