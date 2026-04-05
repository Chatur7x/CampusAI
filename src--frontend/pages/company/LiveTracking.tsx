import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/themes';
import {
  MapPin, Navigation, Clock, Users, Activity, AlertCircle,
  CheckCircle, Radio, Route, Smartphone, Pause, Play
} from 'lucide-react';
import { useGeoLocation, isWithinCampus, type Location } from '@/lib/geolocation';
import { toast } from 'sonner';

interface TrackedEmployee {
  id: string;
  name: string;
  avatar: string;
  role: string;
  location: Location;
  lastUpdate: string;
  status: 'active' | 'on_break' | 'offline';
  distance?: number;
  withinCampus?: boolean;
}

const mockTrackedEmployees: TrackedEmployee[] = [
  { id: '1', name: 'John Davis', avatar: 'JD', role: 'Sales Executive', location: { latitude: 17.5, longitude: 78.5, timestamp: Date.now() }, lastUpdate: '2 min ago', status: 'active' },
  { id: '2', name: 'Sarah Wilson', avatar: 'SW', role: 'Field Agent', location: { latitude: 17.48, longitude: 78.52, timestamp: Date.now() }, lastUpdate: '5 min ago', status: 'active' },
  { id: '3', name: 'Mike Chen', avatar: 'MC', role: 'Service Tech', location: { latitude: 17.52, longitude: 78.48, timestamp: Date.now() }, lastUpdate: '12 min ago', status: 'on_break' },
];

export default function LiveTracking() {
  const { theme } = useTheme();
  const geo = useGeoLocation();
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);

  const handleTrack = (employeeId: string, employeeName: string) => {
    setSelectedEmployee(employeeId);
    toast.info(`Now tracking ${employeeName}`);
  };

  const handleContact = (employeeId: string, employeeName: string) => {
    toast.success(`Contacting ${employeeName}...`);
  };

  const employeesWithLocation = useMemo(() => {
    return mockTrackedEmployees.map(emp => {
      const distance = Math.sqrt(
        Math.pow((emp.location.latitude - 17.5) * 111000, 2) +
        Math.pow((emp.location.longitude - 78.5) * 111000 * Math.cos(17.5 * Math.PI / 180), 2)
      );
      return {
        ...emp,
        distance: Math.round(distance),
        withinCampus: distance < 500,
      };
    });
  }, []);

  const stats = useMemo(() => ({
    total: employeesWithLocation.length,
    active: employeesWithLocation.filter(e => e.status === 'active').length,
    onBreak: employeesWithLocation.filter(e => e.status === 'on_break').length,
    withinCampus: employeesWithLocation.filter(e => e.withinCampus).length,
  }), [employeesWithLocation]);

  const getStatusBadge = (status: string, withinCampus?: boolean) => {
    if (status === 'offline') {
      return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Offline</Badge>;
    }
    if (status === 'on_break') {
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
        <Pause className="w-3 h-3 mr-1" /> On Break
      </Badge>;
    }
    if (withinCampus) {
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
        <CheckCircle className="w-3 h-3 mr-1" /> On Site
      </Badge>;
    }
    return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
      <Navigation className="w-3 h-3 mr-1" /> Field
    </Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
            Live Tracking
          </h1>
          <p className={`mt-1 ${theme === 'glassmorphism' ? 'text-white/60' : 'text-slate-500'}`}>
            Real-time location tracking for field employees
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => geo.getCurrentPosition()}
            className={theme === 'glassmorphism' ? 'glass-button-ghost' : 'neu-button'}
          >
            <Navigation className="w-4 h-4 mr-2" />
            Refresh My Location
          </Button>
        </div>
      </div>

      {geo.currentLocation && (
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isWithinCampus(geo.currentLocation).within 
                  ? 'bg-emerald-500/20' 
                  : 'bg-blue-500/20'
              }`}>
                <Navigation className={`w-5 h-5 ${
                  isWithinCampus(geo.currentLocation).within 
                    ? 'text-emerald-400' 
                    : 'text-blue-400'
                }`} />
              </div>
              <div className="flex-1">
                <p className={`font-medium ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                  Your Location
                </p>
                <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                  {geo.currentLocation.latitude.toFixed(6)}, {geo.currentLocation.longitude.toFixed(6)}
                  {geo.currentLocation.accuracy && ` (±${Math.round(geo.currentLocation.accuracy)}m)`}
                </p>
              </div>
              <Badge className={isWithinCampus(geo.currentLocation).within 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : 'bg-blue-500/20 text-blue-400'
              }>
                {isWithinCampus(geo.currentLocation).within 
                  ? `${isWithinCampus(geo.currentLocation).distance}m from campus`
                  : `${isWithinCampus(geo.currentLocation).distance}m away`
                }
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <Users className="w-8 h-8 mx-auto mb-2 text-violet-400" />
            <p className={`text-2xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
              {stats.total}
            </p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
              Tracked
            </p>
          </CardContent>
        </Card>
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <Activity className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
            <p className="text-2xl font-bold text-emerald-400">{stats.active}</p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
              Active
            </p>
          </CardContent>
        </Card>
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <MapPin className="w-8 h-8 mx-auto mb-2 text-blue-400" />
            <p className="text-2xl font-bold text-blue-400">{stats.withinCampus}</p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
              On Site
            </p>
          </CardContent>
        </Card>
        <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
          <CardContent className="p-4 text-center">
            <Pause className="w-8 h-8 mx-auto mb-2 text-amber-400" />
            <p className="text-2xl font-bold text-amber-400">{stats.onBreak}</p>
            <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
              On Break
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className={`h-[500px] ${theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}`}>
            <CardContent className="p-4 h-full">
              <div className={`h-full rounded-xl flex items-center justify-center ${
                theme === 'glassmorphism' 
                  ? 'bg-gradient-to-br from-slate-800/50 to-slate-900/50' 
                  : 'bg-gradient-to-br from-slate-100 to-slate-200'
              }`}>
                <div className="text-center">
                  <MapPin className={`w-16 h-16 mx-auto mb-4 ${
                    theme === 'glassmorphism' ? 'text-white/30' : 'text-slate-400'
                  }`} />
                  <p className={`text-lg ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                    Map View
                  </p>
                  <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/30' : 'text-slate-400'}`}>
                    Integrate with Mapbox or Google Maps
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h3 className={`text-lg font-semibold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
            Field Employees
          </h3>
          
          {employeesWithLocation.map((employee) => (
            <Card 
              key={employee.id} 
              className={`cursor-pointer transition-all ${
                theme === 'glassmorphism' ? 'glass-card' : 'neu-card'
              } ${selectedEmployee === employee.id ? 'ring-2 ring-violet-500' : ''}`}
              onClick={() => setSelectedEmployee(selectedEmployee === employee.id ? null : employee.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center font-bold text-white">
                      {employee.avatar}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 ${
                      employee.status === 'active' ? 'bg-emerald-400 border-slate-900' :
                      employee.status === 'on_break' ? 'bg-amber-400 border-slate-900' :
                      'bg-slate-400 border-slate-900'
                    }`}>
                      {employee.status === 'active' && (
                        <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                      {employee.name}
                    </p>
                    <p className={`text-sm truncate ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                      {employee.role}
                    </p>
                  </div>
                </div>

                {selectedEmployee === employee.id && (
                  <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className={theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}>
                        Location
                      </span>
                      <span className={theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}>
                        {employee.distance}m from office
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className={theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}>
                        Last Update
                      </span>
                      <span className={theme === 'glassmorphism' ? 'text-white/70' : 'text-slate-600'}>
                        {employee.lastUpdate}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}>
                        Status
                      </span>
                      {getStatusBadge(employee.status, employee.withinCampus)}
                    </div>
                    <div className="flex gap-2 mt-3">
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
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
        <CardContent className="p-6">
          <h3 className={`text-lg font-semibold mb-4 ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
            Location Permissions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`p-4 rounded-xl ${
              geo.permissionStatus === 'granted' ? 'bg-emerald-500/10' :
              geo.permissionStatus === 'denied' ? 'bg-red-500/10' :
              'bg-amber-500/10'
            }`}>
              <div className="flex items-center gap-3">
                {geo.permissionStatus === 'granted' ? (
                  <CheckCircle className="w-6 h-6 text-emerald-400" />
                ) : geo.permissionStatus === 'denied' ? (
                  <AlertCircle className="w-6 h-6 text-red-400" />
                ) : (
                  <Radio className="w-6 h-6 text-amber-400" />
                )}
                <div>
                  <p className={`font-medium ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                    Your Permission
                  </p>
                  <p className={`text-sm ${
                    geo.permissionStatus === 'granted' ? 'text-emerald-400' :
                    geo.permissionStatus === 'denied' ? 'text-red-400' :
                    'text-amber-400'
                  }`}>
                    {geo.permissionStatus === 'granted' ? 'Granted' :
                     geo.permissionStatus === 'denied' ? 'Denied' :
                     'Not Set'}
                  </p>
                </div>
              </div>
            </div>

            <div className={`p-4 rounded-xl ${theme === 'glassmorphism' ? 'bg-white/5' : 'bg-slate-100'}`}>
              <div className="flex items-center gap-3">
                <Activity className={`w-6 h-6 ${theme === 'glassmorphism' ? 'text-violet-400' : 'text-violet-600'}`} />
                <div>
                  <p className={`font-medium ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                    Tracking Status
                  </p>
                  <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                    {geo.isTracking ? 'Active' : 'Stopped'}
                  </p>
                </div>
              </div>
            </div>

            <div className={`p-4 rounded-xl ${theme === 'glassmorphism' ? 'bg-white/5' : 'bg-slate-100'}`}>
              <div className="flex items-center gap-3">
                <Clock className={`w-6 h-6 ${theme === 'glassmorphism' ? 'text-blue-400' : 'text-blue-600'}`} />
                <div>
                  <p className={`font-medium ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
                    Last Update
                  </p>
                  <p className={`text-sm ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
                    {geo.lastUpdate ? new Date(geo.lastUpdate).toLocaleTimeString() : 'Never'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4 mt-4">
            <Button
              onClick={() => geo.isTracking ? geo.stopTracking() : geo.startTracking()}
              className={`flex-1 ${geo.isTracking 
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                : theme === 'glassmorphism' ? 'glass-button-primary' : 'neu-button-primary'
              }`}
            >
              {geo.isTracking ? (
                <>
                  <Pause className="w-4 h-4 mr-2" />
                  Stop Tracking
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Tracking
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
