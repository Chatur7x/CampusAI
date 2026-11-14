import { Card, CardContent } from '@/components/ui/card';
import { useTheme } from '@/themes';
import { MapPin, ShieldAlert } from 'lucide-react';

export default function LiveTracking() {
  const { theme } = useTheme();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${theme === 'glassmorphism' ? 'text-white' : 'text-slate-800'}`}>
            Live Tracking
          </h1>
          <p className={`mt-1 ${theme === 'glassmorphism' ? 'text-white/60' : 'text-slate-500'}`}>
            Real-time location tracking
          </p>
        </div>
      </div>

      {/* Honest unavailable state — location data is not shared with the Company role */}
      <Card className={theme === 'glassmorphism' ? 'glass-card' : 'neu-card'}>
        <CardContent className="p-12 text-center">
          <MapPin className={`w-16 h-16 mx-auto mb-4 ${theme === 'glassmorphism' ? 'text-white/20' : 'text-slate-300'}`} />
          <h3 className={`text-lg font-medium mb-2 ${theme === 'glassmorphism' ? 'text-white/80' : 'text-slate-700'}`}>
            Live Location Is Not Available
          </h3>
          <p className={`max-w-md mx-auto ${theme === 'glassmorphism' ? 'text-white/50' : 'text-slate-500'}`}>
            Live location is not available. Location coordinates captured for attendance
            verification are private to the attendance system and are not shared with the
            Company portal, so individual real-time positions cannot be shown here.
          </p>
          <div className={`mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm ${
            theme === 'glassmorphism' ? 'bg-white/5 text-white/60' : 'bg-slate-100 text-slate-600'
          }`}>
            <ShieldAlert className="w-4 h-4" />
            Attendance sharing is limited to date, status and method — see the Attendance page.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
