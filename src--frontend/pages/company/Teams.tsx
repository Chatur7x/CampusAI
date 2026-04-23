import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/themes';
import {
  Users, Search, Plus, Crown,
  Edit, Eye, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface Team {
  id: string;
  name: string;
  description: string | null;
  department_id: string;
  department_name: string;
  lead_name: string | null;
  member_count: number;
  created_at: string;
}

export default function CompanyTeams() {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [teams, setTeams] = useState<Team[]>([]);
  const [departments, setDepartments] = useState<string[]>(['All']);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch departments first
      const { data: deptData } = await supabase
        .from('departments')
        .select('id, name')
        .order('name');

      if (deptData) {
        setDepartments(['All', ...deptData.map(d => d.name)]);
      }

      // For now, teams table might not exist, show empty state
      // In a real scenario, you'd query a teams table
      setTeams([]);

    } catch (err: any) {
      console.error('Error fetching teams:', err);
      setError(err.message || 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const handleViewTeam = (team: Team) => {
    toast.info(`Viewing ${team?.name || 'Team'}`);
  };

  const handleEditTeam = (team: Team) => {
    toast.info(`Editing ${team?.name || 'Team'}`);
  };

  const handleAddTeam = () => {
    toast.info('Add team feature - opens modal for new team');
  };

  const filteredTeams = teams.filter(team => {
    const matchesSearch = team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (team.lead_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDepartment = selectedDepartment === 'All' || team.department_name === selectedDepartment;
    return matchesSearch && matchesDepartment;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
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
          onClick={handleAddTeam}
          className={theme === 'glassmorphism' ? 'glass-button-primary' : 'neu-button-primary'}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Team
        </Button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <span className="ml-3 text-white/60">Loading teams...</span>
        </div>
      )}

      {!loading && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-4 text-center">
                <Users className={`w-8 h-8 mx-auto mb-2 ${theme === 'glassmorphism' ? 'text-violet-400' : 'text-violet-600'}`} />
                <p className={`text-2xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                  {teams.length || '—'}
                </p>
                <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Total Teams</p>
              </CardContent>
            </Card>
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-4 text-center">
                <Crown className={`w-8 h-8 mx-auto mb-2 ${theme === 'glassmorphism' ? 'text-amber-400' : 'text-amber-600'}`} />
                <p className={`text-2xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                  {teams.filter(t => t.lead_name).length || '—'}
                </p>
                <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>With Leads</p>
              </CardContent>
            </Card>
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-4 text-center">
                <Users className={`w-8 h-8 mx-auto mb-2 ${theme === 'glassmorphism' ? 'text-emerald-400' : 'text-emerald-600'}`} />
                <p className={`text-2xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                  {teams.reduce((acc, t) => acc + t.member_count, 0) || '—'}
                </p>
                <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Total Members</p>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filter */}
          <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/50" />
                  <Input
                    placeholder="Search teams by name or lead..."
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

          {/* Teams List */}
          {filteredTeams.length === 0 ? (
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-12 text-center">
                <Users className={`w-16 h-16 mx-auto mb-4 ${theme === 'glassmorphism' ? 'text-white/20' : 'text-slate-300'}`} />
                <h3 className={`text-lg font-medium mb-2 ${theme === 'glassmorphism' ? 'text-white/80' : 'text-slate-700'}`}>
                  No Teams Yet
                </h3>
                <p className={`mb-4 ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                  Create your first team to organize employees and assign leads.
                </p>
                <Button onClick={handleAddTeam}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Team
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTeams.map((team) => (
                <Card key={team.id} className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                          <Users className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className={`font-semibold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                            {team.name}
                          </h3>
                          <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                            {team.department_name}
                          </p>
                        </div>
                      </div>
                      <Badge className={theme === 'glassmorphism' ? 'bg-white/10 text-white/70' : 'bg-slate-100 text-slate-600'}>
                        {team.member_count} members
                      </Badge>
                    </div>

                    {team.lead_name && (
                      <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-white/5">
                        <Crown className="w-4 h-4 text-amber-400" />
                        <span className={`text-sm ${theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}`}>
                          Lead: {team.lead_name}
                        </span>
                      </div>
                    )}

                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="text-white/50 hover:text-white" onClick={() => handleViewTeam(team)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-white/50 hover:text-white" onClick={() => handleEditTeam(team)}>
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