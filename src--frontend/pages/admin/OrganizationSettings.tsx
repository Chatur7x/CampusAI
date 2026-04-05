import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Building2, Shield, Settings, Plus, 
  Edit, Copy
} from 'lucide-react';
import { toast } from 'sonner';
import { useOrganization, defaultSettings } from '@/lib/organization';

export default function OrganizationSettingsPage() {
  const { organization, organizations, updateOrganization, createOrganization, switchOrganization } = useOrganization();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: organization?.name || '',
    domain: organization?.domain || '',
    type: organization?.type || 'educational' as 'company' | 'educational',
    website: organization?.website || '',
    contactEmail: organization?.contactEmail || '',
    phone: organization?.phone || '',
    address: organization?.address || '',
  });

  const handleSave = async () => {
    try {
      setLoading(true);
      await updateOrganization(formData);
      toast.success('Organization updated successfully');
      setIsEditing(false);
    } catch (error) {
      toast.error('Failed to update organization');
    } finally {
      setLoading(false);
    }
  };

  if (!organization) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Organizations</h1>
          <p className="text-slate-400">No organization selected</p>
        </div>
        
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-6">
            <div className="text-center py-8">
              <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 mb-4">You are not part of any organization yet.</p>
              <Button onClick={() => setShowCreateModal(true)} className="bg-violet-600 hover:bg-violet-700">
                <Plus className="w-4 h-4 mr-2" />
                Create Organization
              </Button>
            </div>
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
          <h1 className="text-2xl font-bold text-white">Organization Settings</h1>
          <p className="text-slate-400">Manage your organization settings</p>
        </div>
        <div className="flex items-center gap-2">
          {organizations.length > 1 && (
            <div className="flex items-center gap-2 mr-4">
              <Label className="text-slate-400">Switch Org:</Label>
              <select
                value={organization.id}
                onChange={(e) => switchOrganization(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
              >
                {organizations.map(org => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>
            </div>
          )}
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)} variant="outline" className="border-slate-700">
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button onClick={() => setIsEditing(false)} variant="outline" className="border-slate-700">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={loading} className="bg-violet-600 hover:bg-violet-700">
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Organization Card */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <div className="flex items-center gap-4">
            {organization.logo ? (
              <img src={organization.logo} alt={organization.name} className="w-16 h-16 rounded-lg" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Building2 className="w-8 h-8 text-white" />
              </div>
            )}
            <div>
              <CardTitle className="text-white text-xl">{organization.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={organization.type === 'educational' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}>
                  {organization.type === 'educational' ? 'Educational' : 'Company'}
                </Badge>
                <span className="text-slate-400 text-sm">{organization.domain}</span>
                <Badge className={organization.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}>
                  {organization.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-slate-400">Organization Name</Label>
              {isEditing ? (
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-slate-900 border-slate-700 text-white"
                />
              ) : (
                <p className="text-white">{organization.name}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-400">Domain</Label>
              <p className="text-white flex items-center gap-2">
                @{organization.domain}
                <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(organization.domain)}>
                  <Copy className="w-4 h-4" />
                </Button>
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-400">Type</Label>
              {isEditing ? (
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'company' | 'educational' })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                >
                  <option value="educational">Educational Institution</option>
                  <option value="company">Company</option>
                </select>
              ) : (
                <p className="text-white capitalize">{organization.type}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-400">Website</Label>
              {isEditing ? (
                <Input
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="bg-slate-900 border-slate-700 text-white"
                />
              ) : (
                <p className="text-white">{organization.website || 'Not set'}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-400">Contact Email</Label>
              {isEditing ? (
                <Input
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  className="bg-slate-900 border-slate-700 text-white"
                />
              ) : (
                <p className="text-white">{organization.contactEmail || 'Not set'}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-slate-400">Phone</Label>
              {isEditing ? (
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="bg-slate-900 border-slate-700 text-white"
                />
              ) : (
                <p className="text-white">{organization.phone || 'Not set'}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Features Settings */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-violet-400" />
            Features & Settings
          </CardTitle>
          <CardDescription className="text-slate-400">
            Configure organization-specific features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white">Face Recognition</p>
              <p className="text-sm text-slate-400">Enable AI-powered face verification</p>
            </div>
            <Switch 
              checked={organization.settings.features.faceRecognition} 
              onCheckedChange={(checked) => {
                updateOrganization({
                  settings: {
                    ...organization.settings,
                    features: { ...organization.settings.features, faceRecognition: checked }
                  }
                } as any);
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white">Blockchain Verification</p>
              <p className="text-sm text-slate-400">Store attendance on blockchain</p>
            </div>
            <Switch 
              checked={organization.settings.features.blockchain} 
              onCheckedChange={(checked) => {
                updateOrganization({
                  settings: {
                    ...organization.settings,
                    features: { ...organization.settings.features, blockchain: checked }
                  }
                } as any);
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white">AI Analytics</p>
              <p className="text-sm text-slate-400">Predictive insights and risk detection</p>
            </div>
            <Switch 
              checked={organization.settings.features.aiAnalytics} 
              onCheckedChange={(checked) => {
                updateOrganization({
                  settings: {
                    ...organization.settings,
                    features: { ...organization.settings.features, aiAnalytics: checked }
                  }
                } as any);
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white">Geofencing</p>
              <p className="text-sm text-slate-400">Location-based attendance validation</p>
            </div>
            <Switch 
              checked={organization.settings.features.geofencing} 
              onCheckedChange={(checked) => {
                updateOrganization({
                  settings: {
                    ...organization.settings,
                    features: { ...organization.settings.features, geofencing: checked }
                  }
                } as any);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Attendance Rules */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-cyan-400" />
            Attendance Rules
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-400">Min Attendance %</Label>
              <Input
                type="number"
                value={organization.settings.attendance.minAttendancePercent}
                onChange={(e) => {
                  updateOrganization({
                    settings: {
                      ...organization.settings,
                      attendance: { ...organization.settings.attendance, minAttendancePercent: Number(e.target.value) }
                    }
                  } as any);
                }}
                className="bg-slate-900 border-slate-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-400">Late Threshold (min)</Label>
              <Input
                type="number"
                value={organization.settings.attendance.lateThresholdMinutes}
                onChange={(e) => {
                  updateOrganization({
                    settings: {
                      ...organization.settings,
                      attendance: { ...organization.settings.attendance, lateThresholdMinutes: Number(e.target.value) }
                    }
                  } as any);
                }}
                className="bg-slate-900 border-slate-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-400">Work Start</Label>
              <Input
                type="time"
                value={organization.settings.attendance.workingHoursStart}
                onChange={(e) => {
                  updateOrganization({
                    settings: {
                      ...organization.settings,
                      attendance: { ...organization.settings.attendance, workingHoursStart: e.target.value }
                    }
                  } as any);
                }}
                className="bg-slate-900 border-slate-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-400">Work End</Label>
              <Input
                type="time"
                value={organization.settings.attendance.workingHoursEnd}
                onChange={(e) => {
                  updateOrganization({
                    settings: {
                      ...organization.settings,
                      attendance: { ...organization.settings.attendance, workingHoursEnd: e.target.value }
                    }
                  } as any);
                }}
                className="bg-slate-900 border-slate-700 text-white"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white">Auto-mark Absent</p>
              <p className="text-sm text-slate-400">Mark absent after work hours if not checked in</p>
            </div>
            <Switch 
              checked={organization.settings.attendance.autoMarkAbsent} 
              onCheckedChange={(checked) => {
                updateOrganization({
                  settings: {
                    ...organization.settings,
                    attendance: { ...organization.settings.attendance, autoMarkAbsent: checked }
                  }
                } as any);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Create Organization Modal */}
      {showCreateModal && (
        <CreateOrganizationModal 
          onClose={() => setShowCreateModal(false)} 
          onCreate={async (data) => {
            await createOrganization(data);
            setShowCreateModal(false);
            toast.success('Organization created successfully');
          }}
        />
      )}
    </div>
  );
}

function CreateOrganizationModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: any) => void }) {
  const [formData, setFormData] = useState({
    name: '',
    domain: '',
    type: 'educational' as 'company' | 'educational',
    website: '',
    contactEmail: '',
    settings: defaultSettings,
  });
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!formData.name || !formData.domain) {
      toast.error('Please fill in required fields');
      return;
    }
    
    setLoading(true);
    try {
      await onCreate({
        ...formData,
        slug: formData.domain.split('.')[0].toLowerCase(),
      });
    } catch (error) {
      toast.error('Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-lg bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Create New Organization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-400">Organization Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Anurag Group of Institutions"
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-400">Domain *</Label>
            <Input
              value={formData.domain}
              onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
              placeholder="anurag.edu.in"
              className="bg-slate-800 border-slate-700 text-white"
            />
            <p className="text-xs text-slate-500">Users with emails ending in this domain will be associated</p>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-400">Type</Label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as 'company' | 'educational' })}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
            >
              <option value="educational">Educational Institution</option>
              <option value="company">Company</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-slate-400">Website</Label>
            <Input
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="https://www.example.com"
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-slate-400">Contact Email</Label>
            <Input
              value={formData.contactEmail}
              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
              placeholder="admin@example.com"
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={onClose} className="border-slate-700">
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={loading} className="bg-violet-600 hover:bg-violet-700">
              {loading ? 'Creating...' : 'Create Organization'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
