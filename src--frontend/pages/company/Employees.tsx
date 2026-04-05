import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/themes';
import {
  Users, Search, Filter, Download, UserPlus, MoreVertical,
  Mail, Phone, MapPin, Calendar, Eye, Edit, Trash2,
  CheckCircle, Clock, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

const mockEmployees = [
  { id: 1, name: 'John Doe', email: 'john@google.com', role: 'Software Engineer', department: 'Engineering', employeeId: 'GOOG-001', status: 'active', avatar: 'JD', checkIn: '9:02 AM' },
  { id: 2, name: 'Sarah Smith', email: 'sarah@google.com', role: 'Product Manager', department: 'Product', employeeId: 'GOOG-002', status: 'active', avatar: 'SS', checkIn: '9:15 AM' },
  { id: 3, name: 'Mike Johnson', email: 'mike@google.com', role: 'Designer', department: 'Design', employeeId: 'GOOG-003', status: 'on-leave', avatar: 'MJ', checkIn: '-' },
  { id: 4, name: 'Emily Brown', email: 'emily@google.com', role: 'Data Analyst', department: 'Analytics', employeeId: 'GOOG-004', status: 'active', avatar: 'EB', checkIn: '9:30 AM' },
  { id: 5, name: 'David Wilson', email: 'david@google.com', role: 'DevOps Engineer', department: 'Engineering', employeeId: 'GOOG-005', status: 'active', avatar: 'DW', checkIn: '8:45 AM' },
  { id: 6, name: 'Lisa Anderson', email: 'lisa@google.com', role: 'HR Manager', department: 'HR', employeeId: 'GOOG-006', status: 'active', avatar: 'LA', checkIn: '9:00 AM' },
];

const departments = ['All', 'Engineering', 'Product', 'Design', 'Analytics', 'HR'];
const roles = ['All Roles', 'Admin', 'Manager', 'Employee', 'Contractor'];
const statuses = ['All Status', 'Active', 'On Leave', 'Remote', 'Inactive'];

export default function CompanyEmployees() {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [selectedRole, setSelectedRole] = useState('All Roles');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<typeof mockEmployees[0] | null>(null);
  const [editEmployee, setEditEmployee] = useState<typeof mockEmployees[0] | null>(null);

  const handleViewEmployee = (employee: typeof mockEmployees[0]) => {
    setSelectedEmployee(employee);
    toast.info(`Viewing ${employee.name}`);
  };

  const handleEditEmployee = (employee: typeof mockEmployees[0]) => {
    setEditEmployee(employee);
    toast.info(`Editing ${employee.name}`);
  };

  const handleDeleteEmployee = (employee: typeof mockEmployees[0]) => {
    if (confirm(`Are you sure you want to delete ${employee.name}?`)) {
      toast.success(`${employee.name} has been deleted`);
    }
  };

  const handleExport = () => {
    const csvContent = [
      ['ID', 'Name', 'Email', 'Role', 'Department', 'Employee ID', 'Status'].join(','),
      ...mockEmployees.map(emp => [
        emp.id, emp.name, emp.email, emp.role, emp.department, emp.employeeId, emp.status
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employees.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Employees exported successfully');
  };

  const filteredEmployees = mockEmployees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         emp.employeeId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDepartment = selectedDepartment === 'All' || emp.department === selectedDepartment;
    const matchesStatus = selectedStatus === 'All Status' || emp.status === selectedStatus.toLowerCase();
    return matchesSearch && matchesDepartment && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Active</Badge>;
      case 'on-leave':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">On Leave</Badge>;
      case 'remote':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Remote</Badge>;
      default:
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Inactive</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
            Employees
          </h1>
          <p className={`mt-1 ${theme === 'glassmorphism' ? 'text-white/60' : 'text-slate-500'}`}>
            Manage your organization's employees
          </p>
        </div>
        <Button 
          onClick={() => setShowAddModal(true)}
          className={theme === 'glassmorphism' ? 'glass-button-primary' : 'neu-button-primary'}
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Add Employee
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <p className={`text-2xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>247</p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Total</p>
          </CardContent>
        </Card>
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">218</p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Active</p>
          </CardContent>
        </Card>
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">23</p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>On Leave</p>
          </CardContent>
        </Card>
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">45</p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Remote</p>
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
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-10 ${theme === 'glassmorphism' ? 'glass-input' : 'neu-input'}`}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <select 
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className={`px-4 py-2 rounded-xl border ${
                  theme === 'glassmorphism' 
                    ? 'bg-white/5 border-white/10 text-white' 
                    : 'bg-slate-100 border-slate-200 text-slate-800'
                }`}
              >
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select 
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className={`px-4 py-2 rounded-xl border ${
                  theme === 'glassmorphism' 
                    ? 'bg-white/5 border-white/10 text-white' 
                    : 'bg-slate-100 border-slate-200 text-slate-800'
                }`}
              >
                {roles.map(r => <option key={r} value={r}>{r}</option>)}
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
            <Button variant="outline" className={theme === 'glassmorphism' ? 'glass-button-ghost' : 'neu-button'} onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Employee List */}
      <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${theme === 'glassmorphism' ? 'border-white/10' : 'border-slate-200'}`}>
                  <th className={`px-6 py-4 text-left text-xs font-semibold uppercase ${
                    theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'
                  }`}>Employee</th>
                  <th className={`px-6 py-4 text-left text-xs font-semibold uppercase ${
                    theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'
                  }`}>Role</th>
                  <th className={`px-6 py-4 text-left text-xs font-semibold uppercase ${
                    theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'
                  }`}>Department</th>
                  <th className={`px-6 py-4 text-left text-xs font-semibold uppercase ${
                    theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'
                  }`}>Status</th>
                  <th className={`px-6 py-4 text-left text-xs font-semibold uppercase ${
                    theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'
                  }`}>Check-in</th>
                  <th className={`px-6 py-4 text-right text-xs font-semibold uppercase ${
                    theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'
                  }`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className={`border-b ${
                    theme === 'glassmorphism' ? 'border-white/5 hover:bg-white/5' : 'border-slate-100 hover:bg-slate-50'
                  } transition-colors`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center font-bold text-white">
                          {emp.avatar}
                        </div>
                        <div>
                          <p className={`font-medium ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                            {emp.name}
                          </p>
                          <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                            {emp.employeeId}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`${theme === 'glassmorphism' ? 'text-white/80' : 'text-slate-600'}`}>
                        {emp.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge className={theme === 'glassmorphism' ? 'bg-white/10 text-white/70' : 'bg-slate-100 text-slate-600'}>
                        {emp.department}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(emp.status)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {emp.status === 'active' ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Clock className="w-4 h-4 text-amber-400" />
                        )}
                        <span className={`${theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}`}>
                          {emp.checkIn}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" className="text-white/50 hover:text-white" onClick={() => handleViewEmployee(emp)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-white/50 hover:text-white" onClick={() => handleEditEmployee(emp)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-400/50 hover:text-red-400" onClick={() => handleDeleteEmployee(emp)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
