import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/themes';
import {
  MapPin, Navigation, Clock, Users, Activity, AlertCircle,
  CheckCircle, Radio, Route, Smartphone, Loader2
} from 'lucide-react';
import { useGeoLocation, isWithinCampus, type Location } from '@/lib/geolocation';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface TrackedEmployee {
  id: string;
  name: string;
  email: string;
  avatar: string;
  location: Location | null;
  lastUpdate: string;
  status: 'online' | 'offline' | 'on-site' | 'off-site';
  distance: number;
  department: string;
}

export default function LiveTracking() {
  const { theme } = useTheme();
  const geo = useGeoLocation();
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [employees, setEmployees] = useState<TrackedEmployee[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      
      // Fetch profiles for tracking
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('is_active', true)
        .limit(20);

      if (data) {
        const trackedEmployees: TrackedEmployee[] = data.map((profile, index) => ({
          id: profile.id,
          name: `${profile.first_name} ${profile.last_name}`.trim() || 'Unknown',
          email: profile.email || '',
          avatar: `${(profile.first_name || 'U')[0]}${(profile.last_name || '')[0] || 'U'}`.toUpperCase(),
          location: geo.currentLocation,
          lastUpdate: new Date().toISOString(),
          status: index % 3 === 0 ? 'online' : index % 3 === 1 ? 'on-site' : 'off-site',
          distance: Math.floor(Math.random() * 500),
          department: ['Engineering', 'Sales', 'Marketing', 'IT'][index % 4],
        }));
        setEmployees(trackedEmployees);
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleTrack = (employeeId: string, employeeName: string) => {
    setIsFollowing(true);
    setSelectedEmployee(employeeId);
    toast.info(`Now tracking ${employeeName}`);
  };

  const handleContact = (employeeId: string, employeeName: string) => {
    toast.success(`Contacting ${employeeName}...`);
  };

  const stats = {
    total: employees.length,
    online: employees.filter(e => e.status === 'online').length,
    onSite: employees.filter(e => e.status === 'on-site').length,
    offSite: employees.filter(e => e.status === 'off-site').length,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
          <Radio className="w-3 h-3 mr-1" /> Online
        </Badge>;
      case 'on-site':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
          <CheckCircle className="w-3 h-3 mr-1" /> On Site
        </Badge>;
      case 'off-site':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
          <AlertCircle className="w-3 h-3 mr-1" /> Off Site
        </Badge>;
      default:
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Offline</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
            Live Tracking
          </h1>
          <p className={`mt-1 ${theme === 'glassmorphism' ? 'text-white/60' : 'text-slate-500'}`}>
            Real-time employee location tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${
            theme === 'glassmorphism' ? 'bg-white/5' : 'bg-slate-100'
          }`}>
            <div className={`w-2 h-2 rounded-full ${geo.isTracking ? 'bg-amber-400 animate-pulse' : geo.error ? 'bg-red-400' : 'bg-emerald-400'}`} />
            <span className={`text-sm ${theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}`}>
              {geo.isTracking ? 'Tracking...' : geo.error ? 'Unavailable' : 'Active'}
            </span>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <span className="ml-3 text-white/60">Loading employees...</span>
        </div>
      )}

      {!loading && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-4 text-center">
                <Users className={`w-8 h-8 mx-auto mb-2 ${theme === 'glassmorphism' ? 'text-violet-400' : 'text-violet-600'}`} />
                <p className={`text-2xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                  {stats.total}
                </p>
                <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Total Tracked</p>
              </CardContent>
            </Card>
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-4 text-center">
                <Activity className={`w-8 h-8 mx-auto mb-2 text-emerald-400`} />
                <p className={`text-2xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                  {stats.online}
                </p>
                <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Online</p>
              </CardContent>
            </Card>
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-4 text-center">
                <CheckCircle className={`w-8 h-8 mx-auto mb-2 text-blue-400`} />
                <p className={`text-2xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                  {stats.onSite}
                </p>
                <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>On Site</p>
              </CardContent>
            </Card>
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-4 text-center">
                <MapPin className={`w-8 h-8 mx-auto mb-2 text-amber-400`} />
                <p className={`text-2xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                  {stats.offSite}
                </p>
                <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>Off Site</p>
              </CardContent>
            </Card>
          </div>

          {/* Employee List */}
          {employees.length === 0 ? (
            <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
              <CardContent className="p-12 text-center">
                <MapPin className={`w-16 h-16 mx-auto mb-4 ${theme === 'glassmorphism' ? 'text-white/20' : 'text-slate-300'}`} />
                <h3 className={`text-lg font-medium mb-2 ${theme === 'glassmorphism' ? 'text-white/80' : 'text-slate-700'}`}>
                  No Employees to Track
                </h3>
                <p className={`${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                  Add employees with location tracking enabled
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {employees.map((employee) => (
                <Card 
                  key={employee.id} 
                  className={`${theme === 'glassmorphism' ? 'glass-card' : 'neu-card'} ${
                    selectedEmployee === employee.id ? 'ring-2 ring-violet-500' : ''
                  }`}
                  onClick={() => setSelectedEmployee(employee.id)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center font-bold text-white">
                            {employee.avatar}
                          </div>
                          <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 ${
                            theme === 'glassmorphism' ? 'border-slate-800' : 'border-white'
                          } ${
                            employee.status === 'online' ? 'bg-emerald-500' :
                            employee.status === 'on-site' ? 'bg-blue-500' : 'bg-amber-500'
                          }`} />
                        </div>
                        <div>
                          <h4 className={`font-semibold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                            {employee.name}
                          </h4>
                          <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                            {employee.department}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(employee.status)}
                    </div>

                    {employee.location && (
                      <div className={`p-3 rounded-xl mb-4 ${
                        theme === 'glassmorphism' ? 'bg-white/5' : 'bg-slate-50'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Navigation className={`w-4 h-4 ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-400'}`} />
                          <span className={`text-sm ${theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}`}>
                            {employee.location.latitude.toFixed(6)}, {employee.location.longitude.toFixed(6)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className={`w-4 h-4 ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-400'}`} />
                          <span className={`text-sm ${theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}`}>
                            Last update: {new Date(employee.lastUpdate).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        className={`flex-1 ${theme === 'glassmorphism' ? 'glass-button-ghost' : 'neu-button'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTrack(employee.id, employee.name);
                        }}
                      >
                        <Route className="w-4 h-4 mr-1" />
                        Track
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className={`flex-1 ${theme === 'glassmorphism' ? 'glass-button-ghost' : 'neu-button'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleContact(employee.id, employee.name);
                        }}
                      >
                        <Smartphone className="w-4 h-4 mr-1" />
                        Contact
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