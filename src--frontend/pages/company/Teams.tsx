import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/themes';
import {
  Users, Search, Plus, Crown, MoreVertical,
  UserPlus, Mail, Calendar, Edit, Trash2, Eye
} from 'lucide-react';
import { toast } from 'sonner';

const mockTeams = [
  { id: 1, name: 'Frontend Warriors', lead: 'Sarah Smith', members: 8, department: 'Engineering', projects: 3, status: 'active' },
  { id: 2, name: 'Backend Knights', lead: 'Mike Johnson', members: 6, department: 'Engineering', projects: 2, status: 'active' },
  { id: 3, name: 'Design Studio', lead: 'Emily Brown', members: 4, department: 'Design', projects: 5, status: 'active' },
  { id: 4, name: 'Data Wizards', lead: 'David Wilson', members: 5, department: 'Analytics', projects: 4, status: 'active' },
  { id: 5, name: 'Mobile Squad', lead: 'Lisa Anderson', members: 4, department: 'Engineering', projects: 2, status: 'on-hold' },
];

const departments = ['All', 'Engineering', 'Design', 'Analytics', 'Product', 'HR'];

export default function CompanyTeams() {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);

  const filteredTeams = mockTeams.filter(team => {
    const matchesSearch = team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         team.lead.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDepartment = selectedDepartment === 'All' || team.department === selectedDepartment;
    return matchesSearch && matchesDepartment;
  });

  const handleViewTeam = (team: typeof mockTeams[0]) => {
    toast.info(`Viewing ${team.name} team`);
  };

  const handleEditTeam = (team: typeof mockTeams[0]) => {
    toast.info(`Editing ${team.name}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
            Teams
          </h1>
          <p className={`mt-1 ${theme === 'glassmorphism' ? 'text-white/60' : 'text-slate-500'}`}>
            Manage teams and team leads
          </p>
        </div>
        <Button 
          onClick={() => setShowAddModal(true)}
          className={theme === 'glassmorphism' ? 'glass-button-primary' : 'neu-button-primary'}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Team
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <p className={`text-2xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>12</p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Total Teams</p>
          </CardContent>
        </Card>
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">10</p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Active</p>
          </CardContent>
        </Card>
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">2</p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>On Hold</p>
          </CardContent>
        </Card>
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">47</p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Total Members</p>
          </CardContent>
        </Card>
      </div>

      <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
              <Input
                placeholder="Search teams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-10 ${theme === 'glassmorphism' ? 'glass-input' : 'neu-input'}`}
              />
            </div>
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
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTeams.map((team) => (
          <Card key={team.id} className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${
                  team.status === 'active' ? 'from-emerald-500 to-teal-500' : 'from-amber-500 to-orange-500'
                } flex items-center justify-center`}>
                  <Users className="w-6 h-6 text-white" />
                </div>
                <Badge className={team.status === 'active' 
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                }>
                  {team.status === 'active' ? 'Active' : 'On Hold'}
                </Badge>
              </div>
              
              <h3 className={`text-lg font-bold mb-1 ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                {team.name}
              </h3>
              <p className={`text-sm mb-4 ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                {team.department}
              </p>
              
              <div className="flex items-center gap-2 mb-4">
                <Crown className="w-4 h-4 text-amber-400" />
                <span className={`text-sm ${theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}`}>
                  {team.lead}
                </span>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className={`text-lg font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                      {team.members}
                    </p>
                    <p className={`text-xs ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Members</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-lg font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                      {team.projects}
                    </p>
                    <p className={`text-xs ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Projects</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" className="text-white/50 hover:text-white" onClick={() => handleViewTeam(team)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-white/50 hover:text-white" onClick={() => handleEditTeam(team)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
