import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { Link2, Shield, CheckCircle, AlertTriangle, RefreshCw, Copy } from 'lucide-react';
import { toast } from 'sonner';
import type { BlockchainStatus, Block } from '@/types';

export default function BlockchainPage() {
  const [status, setStatus] = useState<BlockchainStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  useEffect(() => {
    fetchBlockchainStatus();
  }, []);

  const fetchBlockchainStatus = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_URL}/blockchain/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStatus(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching blockchain status:', error);
      toast.error('Failed to load blockchain data');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const truncateHash = (hash: string) => {
    return hash.substring(0, 16) + '...' + hash.substring(hash.length - 16);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Blockchain Explorer</h1>
          <p className="text-slate-400">View and verify blockchain records</p>
        </div>
        <Button variant="outline" onClick={fetchBlockchainStatus} className="border-slate-700">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                status?.status === 'VALID' ? 'bg-emerald-500/10' : 'bg-red-500/10'
              }`}>
                <Shield className={`w-6 h-6 ${
                  status?.status === 'VALID' ? 'text-emerald-400' : 'text-red-400'
                }`} />
              </div>
              <div>
                <p className="text-sm text-slate-400">Chain Status</p>
                <p className={`text-lg font-semibold ${
                  status?.status === 'VALID' ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {status?.status || 'Unknown'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Link2 className="w-6 h-6 text-violet-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Total Blocks</p>
                <p className="text-lg font-semibold text-white">{status?.totalBlocks || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Verified Records</p>
                <p className="text-lg font-semibold text-white">{status?.verifiedRecords || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Tampered Blocks</p>
                <p className="text-lg font-semibold text-white">{status?.tamperedBlocks || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Blocks */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Recent Blocks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {status?.chain.slice().reverse().map((block: Block) => (
              <div
                key={block.hash}
                className="p-4 rounded-lg bg-slate-800/50 border border-slate-700"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-violet-500/10 text-violet-400 border-violet-500/20">
                      Block #{block.index}
                    </Badge>
                    <span className="text-sm text-slate-400">
                      {new Date(block.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400"
                    onClick={() => copyToClipboard(block.hash)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-2 font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 w-24">Hash:</span>
                    <span className="text-emerald-400">{truncateHash(block.hash)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 w-24">Previous:</span>
                    <span className="text-slate-400">{truncateHash(block.previousHash)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 w-24">Nonce:</span>
                    <span className="text-slate-400">{block.nonce}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Records */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Recent Verified Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {status?.recentRecords.slice(0, 5).map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <div>
                    <p className="text-sm text-white">
                      {record.student?.user?.profile?.firstName} {record.student?.user?.profile?.lastName}
                    </p>
                    <p className="text-xs text-slate-400">
                      {record.student?.enrollmentId} • {new Date(record.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={record.status === 'PRESENT' ? 'default' : 'secondary'}
                    className={
                      record.status === 'PRESENT'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/20 text-red-400'
                    }
                  >
                    {record.status}
                  </Badge>
                  <span className="text-xs text-slate-500 font-mono">
                    {record.blockchainHash?.substring(0, 8)}...
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}