import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/themes';
import {
  Building2, Search, Plus, Users, Briefcase,
  Edit, Trash2, Eye, MoreVertical, TrendingUp
} from 'lucide-react';

const mockDepartments = [
  { id: 1, name: 'Engineering', head: 'Sarah Smith', employees: 45, teams: 5, budget: '$2.4M', status: 'active' },
  { id: 2, name: 'Product', head: 'Mike Johnson', employees: 18, teams: 3, budget: '$1.2M', status: 'active' },
  { id: 3, name: 'Design', head: 'Emily Brown', employees: 12, teams: 2, budget: '$800K', status: 'active' },
  { id: 4, name: 'Analytics', head: 'David Wilson', employees: 15, teams: 2, budget: '$900K', status: 'active' },
  { id: 5, name: 'HR', head: 'Lisa Anderson', employees: 8, teams: 1, budget: '$400K', status: 'active' },
  { id: 6, name: 'Sales', head: 'James Wilson', employees: 35, teams: 4, budget: '$1.8M', status: 'active' },
];

export default function CompanyDepartments() {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const filteredDepts = mockDepartments.filter(dept =>
    dept.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dept.head.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
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
          onClick={() => setShowAddModal(true)}
          className={theme === 'glassmorphism' ? 'glass-button-primary' : 'neu-button-primary'}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Department
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <p className={`text-2xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>6</p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Departments</p>
          </CardContent>
        </Card>
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">133</p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Employees</p>
          </CardContent>
        </Card>
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">17</p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Teams</p>
          </CardContent>
        </Card>
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-violet-400">$7.5M</p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Total Budget</p>
          </CardContent>
        </Card>
      </div>

      <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
            <Input
              placeholder="Search departments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-10 ${theme === 'glassmorphism' ? 'glass-input' : 'neu-input'}`}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDepts.map((dept) => (
          <Card key={dept.id} className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center`}>
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  Active
                </Badge>
              </div>
              
              <h3 className={`text-lg font-bold mb-1 ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                {dept.name}
              </h3>
              
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-white/50" />
                <span className={`text-sm ${theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}`}>
                  {dept.head}
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="text-center p-2 rounded-lg bg-white/5">
                  <p className={`text-lg font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                    {dept.employees}
                  </p>
                  <p className={`text-xs ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Staff</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-white/5">
                  <p className={`text-lg font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                    {dept.teams}
                  </p>
                  <p className={`text-xs ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Teams</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-white/5">
                  <TrendingUp className="w-4 h-4 mx-auto mb-1 text-emerald-400" />
                  <p className={`text-xs ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>{dept.budget}</p>
                </div>
              </div>
              
              <div className="flex gap-2 pt-4 border-t border-white/10">
                <Button variant="ghost" size="sm" className="flex-1 text-white/50 hover:text-white">
                  <Eye className="w-4 h-4 mr-1" /> View
                </Button>
                <Button variant="ghost" size="sm" className="text-white/50 hover:text-white">
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
