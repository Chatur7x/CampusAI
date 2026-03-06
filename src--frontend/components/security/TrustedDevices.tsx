import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Monitor, Smartphone, Tablet, Trash2, ShieldCheck, ShieldX, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Device {
  id: string;
  deviceName: string | null;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  isTrusted: boolean;
  lastUsedAt: string;
  createdAt: string;
}

export default function TrustedDevices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDevices = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/security/devices', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (json.success) setDevices(json.data || []);
    } catch (err) {
      toast.error('Failed to load devices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  const toggleTrust = async (deviceId: string, trusted: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch(`/api/security/devices/${deviceId}/trust`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ trusted }),
      });
      toast.success(`Device ${trusted ? 'trusted' : 'untrusted'}`);
      fetchDevices();
    } catch {
      toast.error('Failed to update device');
    }
  };

  const removeDevice = async (deviceId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch(`/api/security/devices/${deviceId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      toast.success('Device removed');
      fetchDevices();
    } catch {
      toast.error('Failed to remove device');
    }
  };

  const getDeviceIcon = (os: string | null) => {
    if (!os) return <Monitor className="w-5 h-5" />;
    const lower = os.toLowerCase();
    if (lower.includes('android') || lower.includes('ios')) return <Smartphone className="w-5 h-5" />;
    if (lower.includes('ipad')) return <Tablet className="w-5 h-5" />;
    return <Monitor className="w-5 h-5" />;
  };

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Monitor className="w-5 h-5 text-blue-400" />
          Trusted Devices
        </CardTitle>
        <CardDescription className="text-slate-400">
          Manage devices that have accessed your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : devices.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">No devices registered yet</p>
        ) : (
          <div className="space-y-3">
            {devices.map((device) => (
              <div
                key={device.id}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${device.isTrusted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                    {getDeviceIcon(device.os)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{device.deviceName || 'Unknown Device'}</p>
                    <p className="text-xs text-slate-400">
                      {device.browser} · {device.os} · IP: {device.ipAddress || 'N/A'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Last used: {new Date(device.lastUsedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={device.isTrusted ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-600/20 text-slate-400'}>
                    {device.isTrusted ? 'Trusted' : 'Untrusted'}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className={device.isTrusted ? 'text-amber-400 hover:bg-amber-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'}
                    onClick={() => toggleTrust(device.id, !device.isTrusted)}
                  >
                    {device.isTrusted ? <ShieldX className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-400 hover:bg-red-500/10" onClick={() => removeDevice(device.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
