import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/themes';
import {
  Building2, Search, Plus, Users,
  Edit, Eye, TrendingUp, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  head_name: string | null;
  employee_count: number;
  is_active: boolean;
  created_at: string;
}

export default function CompanyDepartments() {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      if (fetchError) throw fetchError;

      const transformedData: Department[] = (data || []).map(dept => ({
        id: dept.id,
        name: dept.name,
        code: dept.code,
        description: dept.description,
        head_name: null, // Would come from HOD join
        employee_count: 0, // Would come from count query
        is_active: dept.is_active ?? true,
        created_at: dept.created_at,
      }));

      setDepartments(transformedData);

    } catch (err: any) {
      console.error('Error fetching departments:', err);
      setError(err.message || 'Failed to load departments');
      toast.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleViewDept = (dept: Department) => {
    toast.info(`Viewing ${dept.name} department`);
  };

  const handleEditDept = (dept: Department) => {
    toast.info(`Editing ${dept.name}`);
  };

  const handleAddDept = () => {
    toast.info('Add department feature - opens modal for new department');
  };

  const filteredDepts = departments.filter(dept =>
    dept.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dept.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (active: boolean) => {
    if (active) {
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Active</Badge>;
    }
    return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Inactive</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
            Departments
          </h1>
          <p className={`mt-1 ${theme === 'glassmorphism' ? 'text-white/60' : 'text-slate-500'}`}>
            Manage organizational departments
          </p>
        </div>
        <Button 
          onClick={handleAddDept}
          className={theme === 'glassmorphism' ? 'glass-button-primary' : 'neu-button-primary'}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Department
        </Button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <span className="ml-3 text-white/60">Loading departments...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="glass-card border-red-500/30">
          <CardContent className="p-4 text-center">
            <p className="text-red-400">{error}</p>
            <Button variant="ghost" onClick={fetchDepartments} className="mt-2">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-violet-400" />
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                      {departments.length}
                    </p>
                    <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <Users className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                      {departments.filter(d => d.is_active).length}
                    </p>
                    <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Active</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                      {departments.reduce((acc, d) => acc + d.employee_count, 0)}
                    </p>
                    <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Employees</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                <Input
                  placeholder="Search departments by name or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`pl-10 ${theme === 'glassmorphism' ? 'glass-input' : 'neu-input'}`}
                />
              </div>
            </CardContent>
          </Card>

          {/* Department Grid */}
          {filteredDepts.length === 0 ? (
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-8 text-center">
                <Building2 className={`w-12 h-12 mx-auto mb-4 ${theme === 'glassmorphism' ? 'text-white/30' : 'text-slate-300'}`} />
                <p className={`${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                  No departments found
                </p>
                {departments.length === 0 && (
                  <Button onClick={handleAddDept} className="mt-4">
                    Create First Department
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDepts.map((dept) => (
                <Card key={dept.id} className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-white" />
                      </div>
                      {getStatusBadge(dept.is_active)}
                    </div>
                    
                    <h3 className={`text-lg font-semibold mb-1 ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                      {dept.name}
                    </h3>
                    <p className={`text-sm mb-3 ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                      {dept.code}
                    </p>
                    
                    {dept.description && (
                      <p className={`text-sm mb-4 line-clamp-2 ${theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}`}>
                        {dept.description}
                      </p>
                    )}
                    
                    <div className="flex gap-2 pt-4 border-t border-white/10">
                      <Button variant="ghost" size="sm" className="flex-1 text-white/50 hover:text-white" onClick={() => handleViewDept(dept)}>
                        <Eye className="w-4 h-4 mr-1" /> View
                      </Button>
                      <Button variant="ghost" size="sm" className="text-white/50 hover:text-white" onClick={() => handleEditDept(dept)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}