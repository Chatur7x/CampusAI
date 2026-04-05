import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/themes';
import {
  Settings as SettingsIcon, Building2, Bell, Shield, Key,
  Palette, Globe, Save, User, Mail, Phone, MapPin
} from 'lucide-react';

const tabs = [
  { id: 'general', label: 'General', icon: Building2 },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'appearance', label: 'Appearance', icon: Palette },
];

export default function CompanySettings() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState({
    companyName: 'Google Inc.',
    industry: 'Technology',
    website: 'https://google.com',
    email: 'admin@google.com',
    phone: '+1 (555) 123-4567',
    address: '1600 Amphitheatre Parkway, Mountain View, CA',
    employeeIdPrefix: 'GOOG',
    timezone: 'America/Los_Angeles',
    dateFormat: 'MM/DD/YYYY',
    emailNotifications: true,
    pushNotifications: true,
    weeklyDigest: true,
    securityAlerts: true,
  });

  const handleSave = () => {
    alert('Settings saved successfully!');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
            Settings
          </h1>
          <p className={`mt-1 ${theme === 'glassmorphism' ? 'text-white/60' : 'text-slate-500'}`}>
            Manage your organization settings
          </p>
        </div>
        <Button 
          onClick={handleSave}
          className={theme === 'glassmorphism' ? 'glass-button-primary' : 'neu-button-primary'}
        >
          <Save className="w-4 h-4 mr-2" />
          Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4">
            <nav className="space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      activeTab === tab.id
                        ? theme === 'glassmorphism'
                          ? 'bg-white/10 text-white'
                          : 'bg-slate-200 text-slate-800'
                        : theme === 'glassmorphism'
                          ? 'text-white/70 hover:bg-white/5'
                          : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </CardContent>
        </Card>

        <div className="lg:col-span-3">
          {activeTab === 'general' && (
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-6">
                <h3 className={`text-lg font-semibold mb-6 ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                  General Settings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}`}>
                      Company Name
                    </label>
                    <Input
                      value={settings.companyName}
                      onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                      className={theme === 'glassmorphism' ? 'glass-input' : 'neu-input'}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}`}>
                      Industry
                    </label>
                    <Input
                      value={settings.industry}
                      onChange={(e) => setSettings({ ...settings, industry: e.target.value })}
                      className={theme === 'glassmorphism' ? 'glass-input' : 'neu-input'}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}`}>
                      Website
                    </label>
                    <Input
                      value={settings.website}
                      onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                      className={theme === 'glassmorphism' ? 'glass-input' : 'neu-input'}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}`}>
                      Employee ID Prefix
                    </label>
                    <Input
                      value={settings.employeeIdPrefix}
                      onChange={(e) => setSettings({ ...settings, employeeIdPrefix: e.target.value })}
                      className={theme === 'glassmorphism' ? 'glass-input' : 'neu-input'}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}`}>
                      Timezone
                    </label>
                    <select
                      value={settings.timezone}
                      onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                      className={`w-full px-4 py-2 rounded-xl border ${
                        theme === 'glassmorphism' 
                          ? 'bg-white/5 border-white/10 text-white' 
                          : 'bg-slate-100 border-slate-200 text-slate-800'
                      }`}
                    >
                      <option value="America/Los_Angeles">Pacific Time (PT)</option>
                      <option value="America/New_York">Eastern Time (ET)</option>
                      <option value="Europe/London">GMT</option>
                      <option value="Asia/Kolkata">India (IST)</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}`}>
                      Date Format
                    </label>
                    <select
                      value={settings.dateFormat}
                      onChange={(e) => setSettings({ ...settings, dateFormat: e.target.value })}
                      className={`w-full px-4 py-2 rounded-xl border ${
                        theme === 'glassmorphism' 
                          ? 'bg-white/5 border-white/10 text-white' 
                          : 'bg-slate-100 border-slate-200 text-slate-800'
                      }`}
                    >
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'profile' && (
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-6">
                <h3 className={`text-lg font-semibold mb-6 ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                  Contact Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}`}>
                      <Mail className="w-4 h-4 inline mr-1" /> Email
                    </label>
                    <Input
                      value={settings.email}
                      onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                      className={theme === 'glassmorphism' ? 'glass-input' : 'neu-input'}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}`}>
                      <Phone className="w-4 h-4 inline mr-1" /> Phone
                    </label>
                    <Input
                      value={settings.phone}
                      onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                      className={theme === 'glassmorphism' ? 'glass-input' : 'neu-input'}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={`block text-sm font-medium mb-2 ${theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}`}>
                      <MapPin className="w-4 h-4 inline mr-1" /> Address
                    </label>
                    <Input
                      value={settings.address}
                      onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                      className={theme === 'glassmorphism' ? 'glass-input' : 'neu-input'}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-6">
                <h3 className={`text-lg font-semibold mb-6 ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                  Notification Preferences
                </h3>
                <div className="space-y-4">
                  {[
                    { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive updates via email' },
                    { key: 'pushNotifications', label: 'Push Notifications', desc: 'Browser push notifications' },
                    { key: 'weeklyDigest', label: 'Weekly Digest', desc: 'Summary of weekly activity' },
                    { key: 'securityAlerts', label: 'Security Alerts', desc: 'Important security notifications' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between p-4 rounded-xl bg-white/5">
                      <div>
                        <p className={`font-medium ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                          {item.label}
                        </p>
                        <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                          {item.desc}
                        </p>
                      </div>
                      <button
                        onClick={() => setSettings({ ...settings, [item.key]: !settings[item.key as keyof typeof settings] })}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          settings[item.key as keyof typeof settings] ? 'bg-emerald-500' : 'bg-slate-600'
                        }`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                          settings[item.key as keyof typeof settings] ? 'translate-x-7' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'security' && (
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-6">
                <h3 className={`text-lg font-semibold mb-6 ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                  Security Settings
                </h3>
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
                    <div>
                      <p className={`font-medium ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                        Two-Factor Authentication
                      </p>
                      <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                        Add an extra layer of security
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className={theme === 'glassmorphism' ? 'glass-button-ghost' : 'neu-button'}>
                      Enable
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
                    <div>
                      <p className={`font-medium ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                        Change Password
                      </p>
                      <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                        Update your account password
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className={theme === 'glassmorphism' ? 'glass-button-ghost' : 'neu-button'}>
                      Update
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-4 rounded-xl bg-white/5">
                    <div>
                      <p className={`font-medium ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                        Active Sessions
                      </p>
                      <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                        Manage your active login sessions
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className={theme === 'glassmorphism' ? 'glass-button-ghost' : 'neu-button'}>
                      View All
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'appearance' && (
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-6">
                <h3 className={`text-lg font-semibold mb-6 ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                  Appearance
                </h3>
                <div className="space-y-6">
                  <div>
                    <label className={`block text-sm font-medium mb-3 ${theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}`}>
                      Theme
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <button className="p-4 rounded-xl bg-white/5 border-2 border-violet-500">
                        <div className="w-full h-20 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 mb-2" />
                        <p className="text-white font-medium">Glassmorphism</p>
                      </button>
                      <button className="p-4 rounded-xl bg-white/5 border border-white/10">
                        <div className="w-full h-20 rounded-lg bg-gradient-to-br from-slate-200 to-slate-300 mb-2" />
                        <p className={`font-medium ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>Neumorphism</p>
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-3 ${theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}`}>
                      Accent Color
                    </label>
                    <div className="flex gap-3">
                      {['violet', 'blue', 'emerald', 'amber', 'pink', 'cyan'].map((color) => (
                        <button
                          key={color}
                          className={`w-10 h-10 rounded-full bg-gradient-to-br ${
                            color === 'violet' ? 'from-violet-500 to-purple-500' :
                            color === 'blue' ? 'from-blue-500 to-cyan-500' :
                            color === 'emerald' ? 'from-emerald-500 to-teal-500' :
                            color === 'amber' ? 'from-amber-500 to-orange-500' :
                            color === 'pink' ? 'from-pink-500 to-rose-500' :
                            'from-cyan-500 to-blue-500'
                          } ${color === 'violet' ? 'ring-2 ring-white' : ''}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
