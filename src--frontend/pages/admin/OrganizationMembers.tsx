import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Users, UserPlus, Crown, Shield, UserCheck, 
  GraduationCap, Trash2, Mail, Search,
  Check, Copy
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useOrganization } from '@/lib/organization';

interface Member {
  id: string;
  user_id: string;
  role: string;
  email?: string;
  profile?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
    email?: string;
  };
  joined_at: string;
  is_active: boolean;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
}

export default function OrganizationMembersPage() {
  const { organization } = useOrganization();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [_loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useState(() => {
    if (organization) {
      loadMembers();
      loadInvitations();
    }
  });

  const loadMembers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_organizations')
        .select(`
          *,
          profile:profiles!user_id(id, first_name, last_name, avatar_url, email)
        `)
        .eq('organization_id', organization?.id);

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Failed to load members:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInvitations = async () => {
    try {
      const { data, error } = await supabase
        .from('organization_invitations')
        .select('*')
        .eq('organization_id', organization?.id);

      if (error) throw error;
      setInvitations(data || []);
    } catch (error) {
      console.error('Failed to load invitations:', error);
    }
  };

  const updateMemberRole = async (memberId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('user_organizations')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;
      toast.success('Role updated successfully');
      loadMembers();
    } catch (error) {
      toast.error('Failed to update role');
    }
  };

  const removeMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;
    
    try {
      const { error } = await supabase
        .from('user_organizations')
        .update({ is_active: false })
        .eq('id', memberId);

      if (error) throw error;
      toast.success('Member removed successfully');
      loadMembers();
    } catch (error) {
      toast.error('Failed to remove member');
    }
  };

  const sendInvitation = async (email: string, role: string) => {
    try {
      const { error } = await supabase
        .from('organization_invitations')
        .insert({
          organization_id: organization?.id,
          email,
          role,
        });

      if (error) throw error;
      toast.success(`Invitation sent to ${email}`);
      setShowInviteModal(false);
      loadInvitations();
    } catch (error) {
      toast.error('Failed to send invitation');
    }
  };

  const copyInviteLink = (invitationId: string) => {
    const link = `${window.location.origin}/join/${invitationId}`;
    navigator.clipboard.writeText(link);
    toast.success('Invite link copied to clipboard');
  };

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      OWNER: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
      ADMIN: 'bg-red-500/20 text-red-400 border-red-500/30',
      HR: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      FACULTY: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      EMPLOYEE: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      STUDENT: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    };
    return styles[role] || 'bg-slate-500/20 text-slate-400';
  };

  const getRoleIcon = (role: string) => {
    const icons: Record<string, any> = {
      OWNER: Crown,
      ADMIN: Shield,
      HR: Users,
      FACULTY: GraduationCap,
      EMPLOYEE: UserCheck,
      STUDENT: GraduationCap,
    };
    return icons[role] || Users;
  };

  const roleHierarchy = ['OWNER', 'ADMIN', 'HR', 'FACULTY', 'EMPLOYEE', 'STUDENT'];

  const filteredMembers = members.filter(m => {
    const name = `${m.profile?.first_name || ''} ${m.profile?.last_name || ''}`.toLowerCase();
    return name.includes(searchQuery.toLowerCase()) || 
           m.profile?.email?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (!organization) {
    return (
      <div className="p-6">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6 text-center text-slate-400">
            No organization selected
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Organization Members</h1>
          <p className="text-slate-400">Manage {organization.name} team members</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="border-slate-700">
            <Copy className="w-4 h-4 mr-2" />
            Copy Invite Link
          </Button>
          <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
            <DialogTrigger asChild>
              <Button className="bg-violet-600 hover:bg-violet-700">
                <UserPlus className="w-4 h-4 mr-2" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-900 border-slate-800">
              <InviteModal onInvite={sendInvitation} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {roleHierarchy.map(role => {
          const count = members.filter(m => m.role === role).length;
          if (count === 0 && role !== 'STUDENT') return null;
          const Icon = getRoleIcon(role);
          return (
            <Card key={role} className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${getRoleBadge(role)}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-white">{count}</p>
                    <p className="text-xs text-slate-400 capitalize">{role}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <Input
          placeholder="Search members..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-slate-800/50 border-slate-700/50"
        />
      </div>

      {/* Members List */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-0">
          <div className="divide-y divide-slate-700/50">
            {filteredMembers.map(member => {
              const RoleIcon = getRoleIcon(member.role);
              return (
                <div key={member.id} className="flex items-center justify-between p-4 hover:bg-slate-700/30">
                  <div className="flex items-center gap-4">
                    {member.profile?.avatar_url ? (
                      <img src={member.profile.avatar_url} className="w-10 h-10 rounded-full" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white font-bold">
                        {(member.profile?.first_name || 'U').charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="text-white font-medium">
                        {member.profile?.first_name} {member.profile?.last_name}
                      </p>
                      <p className="text-sm text-slate-400">{member.profile?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge className={getRoleBadge(member.role)}>
                      <RoleIcon className="w-3 h-3 mr-1" />
                      {member.role}
                    </Badge>
                    {member.role !== 'OWNER' && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            Change Role
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-slate-900 border-slate-800">
                          <DialogHeader>
                            <DialogTitle className="text-white">Change Role</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-2">
                            {roleHierarchy.filter(r => r !== 'OWNER').map(role => (
                              <button
                                key={role}
                                onClick={() => updateMemberRole(member.id, role)}
                                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                                  member.role === role 
                                    ? 'border-violet-500 bg-violet-500/10' 
                                    : 'border-slate-700 hover:border-slate-600'
                                }`}
                              >
                                <RoleIcon className="w-4 h-4" />
                                <span className="text-white">{role}</span>
                                {member.role === role && <Check className="w-4 h-4 ml-auto text-violet-400" />}
                              </button>
                            ))}
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                    {member.role !== 'OWNER' && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => removeMember(member.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {invitations.filter(i => i.status === 'PENDING').length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-lg">Pending Invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invitations.filter(i => i.status === 'PENDING').map(inv => (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30">
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-white">{inv.email}</p>
                      <p className="text-xs text-slate-400">
                        Expires {new Date(inv.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getRoleBadge(inv.role)}>{inv.role}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => copyInviteLink(inv.id)}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InviteModal({ onInvite }: { onInvite: (email: string, role: string) => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('STUDENT');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter an email address');
      return;
    }
    onInvite(email, role);
    setEmail('');
    setRole('STUDENT');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle className="text-white">Invite New Member</DialogTitle>
      </DialogHeader>
      <div className="space-y-2">
        <Label className="text-slate-400">Email Address</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@company.com"
          className="bg-slate-800 border-slate-700 text-white"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-slate-400">Role</Label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
        >
          <option value="ADMIN">Admin</option>
          <option value="HR">HR</option>
          <option value="FACULTY">Faculty</option>
          <option value="EMPLOYEE">Employee</option>
          <option value="STUDENT">Student</option>
        </select>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit" className="bg-violet-600 hover:bg-violet-700">
          <Mail className="w-4 h-4 mr-2" />
          Send Invitation
        </Button>
      </div>
    </form>
  );
}
