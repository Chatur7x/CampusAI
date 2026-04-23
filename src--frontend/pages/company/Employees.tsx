import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/themes';
import {
  Search, Download, UserPlus,
  Eye, Edit, Trash2,
  CheckCircle, Clock, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface Employee {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  department_name: string;
  designation: string;
  employee_id: string;
  status: string;
  avatar: string;
  check_in: string | null;
}

export default function CompanyEmployees() {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<string[]>(['All']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch employees from Supabase
  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError(null);

      // Query profiles joined with potential employee data
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select(`
          id,
          user_id,
          email,
          first_name,
          last_name,
          is_active
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Transform data to match our interface
      // In a real scenario, you'd have an employees table or join with other tables
      const transformedData: Employee[] = (data || []).map((profile, index) => ({
        id: profile.id,
        user_id: profile.user_id,
        email: profile.email || '',
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        department_name: 'General', // Would come from a departments join
        designation: 'Employee', // Would come from employee-specific table
        employee_id: `EMP-${String(index + 1).padStart(4, '0')}`,
        status: profile.is_active ? 'active' : 'inactive',
        avatar: `${(profile.first_name || 'U')[0]}${(profile.last_name || '')[0] || 'U'}`.toUpperCase(),
        check_in: profile.is_active ? new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : null,
      }));

      setEmployees(transformedData);

      // Extract unique departments
      const uniqueDepts = ['All', ...new Set(transformedData.map(e => e.department_name).filter(Boolean))];
      setDepartments(uniqueDepts);

    } catch (err: any) {
      console.error('Error fetching employees:', err);
      setError(err.message || 'Failed to load employees');
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleViewEmployee = (employee: Employee) => {
    toast.info(`Viewing ${employee.first_name} ${employee.last_name}`);
  };

  const handleEditEmployee = (employee: Employee) => {
    toast.info(`Editing ${employee.first_name} ${employee.last_name}`);
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    if (!confirm(`Are you sure you want to delete ${employee.first_name} ${employee.last_name}?`)) {
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from('profiles')
        .update({ is_active: false })
        .eq('id', employee.id);

      if (deleteError) throw deleteError;

      setEmployees(prev => prev.filter(e => e.id !== employee.id));
      toast.success(`${employee.first_name} ${employee.last_name} has been deactivated`);
    } catch (err: any) {
      toast.error(`Failed to delete: ${err.message}`);
    }
  };

  const handleExport = () => {
    if (filteredEmployees.length === 0) {
      toast.info('No employees to export');
      return;
    }

    const csvContent = [
      ['ID', 'Name', 'Email', 'Designation', 'Department', 'Employee ID', 'Status'].join(','),
      ...filteredEmployees.map(emp => [
        emp.employee_id,
        `${emp.first_name} ${emp.last_name}`,
        emp.email,
        emp.designation,
        emp.department_name,
        emp.employee_id,
        emp.status
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employees-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Employees exported successfully');
  };

  const handleAddEmployee = () => {
    toast.info('Add employee feature - opens modal for new employee registration');
  };

  const filteredEmployees = employees.filter(emp => {
    const fullName = `${emp.first_name} ${emp.last_name}`.toLowerCase();
    const matchesSearch = fullName.includes(searchQuery.toLowerCase()) ||
                          emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          emp.employee_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDepartment = selectedDepartment === 'All' || emp.department_name === selectedDepartment;
    const matchesStatus = selectedStatus === 'All Status' || emp.status === selectedStatus.toLowerCase().replace(' ', '-');
    return matchesSearch && matchesDepartment && matchesStatus;
  });

  const stats = {
    total: employees.length,
    active: employees.filter(e => e.status === 'active').length,
    onLeave: employees.filter(e => e.status === 'inactive').length,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Active</Badge>;
      case 'inactive':
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Inactive</Badge>;
      default:
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">{status}</Badge>;
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
            Manage your organization&apos;s employees
          </p>
        </div>
        <Button 
          onClick={handleAddEmployee}
          className={theme === 'glassmorphism' ? 'glass-button-primary' : 'neu-button-primary'}
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Add Employee
        </Button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <span className="ml-3 text-white/60">Loading employees...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="glass-card border-red-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-red-400">{error}</p>
            <Button variant="ghost" onClick={fetchEmployees} className="mt-2">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && (
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
                <p className="text-2xl font-bold text-emerald-400">{stats.active}</p>
                <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Active</p>
              </CardContent>
            </Card>
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-amber-400">{stats.onLeave}</p>
                <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Inactive</p>
              </CardContent>
            </Card>
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-blue-400">{departments.length - 1}</p>
                <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Departments</p>
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
                    placeholder="Search employees by name, email, or ID..."
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
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className={`px-4 py-2 rounded-xl border ${
                      theme === 'glassmorphism' 
                        ? 'bg-white/5 border-white/10 text-white' 
                        : 'bg-slate-100 border-slate-200 text-slate-800'
                    }`}
                  >
                    <option value="All Status">All Status</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
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
              {filteredEmployees.length === 0 ? (
                <div className="text-center py-12">
                  <p className={`${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                    No employees found
                  </p>
                  {employees.length === 0 && (
                    <p className={`mt-2 text-sm ${theme === 'glassmorphism' ? 'text-white/30' : 'text-slate-400'}`}>
                      Add employees to see them here
                    </p>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className={`border-b ${theme === 'glassmorphism' ? 'border-white/10' : 'border-slate-200'}`}>
                        <th className={`px-6 py-4 text-left text-xs font-semibold uppercase ${
                          theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'
                        }`}>Employee</th>
                        <th className={`px-6 py-4 text-left text-xs font-semibold uppercase ${
                          theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'
                        }`}>Designation</th>
                        <th className={`px-6 py-4 text-left text-xs font-semibold uppercase ${
                          theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'
                        }`}>Department</th>
                        <th className={`px-6 py-4 text-left text-xs font-semibold uppercase ${
                          theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'
                        }`}>Status</th>
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
                                  {emp.first_name} {emp.last_name}
                                </p>
                                <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                                  {emp.employee_id}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`${theme === 'glassmorphism' ? 'text-white/80' : 'text-slate-600'}`}>
                              {emp.designation}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <Badge className={theme === 'glassmorphism' ? 'bg-white/10 text-white/70' : 'bg-slate-100 text-slate-600'}>
                              {emp.department_name}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            {getStatusBadge(emp.status)}
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
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}