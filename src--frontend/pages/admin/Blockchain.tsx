import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { Link2, Shield, CheckCircle, AlertTriangle, RefreshCw, Copy } from 'lucide-react';
import { toast } from 'sonner';
import type { BlockchainStatus, Block, Attendance } from '@/types';
import { supabase } from '@/lib/supabase';

export default function BlockchainPage() {
  const [status, setStatus] = useState<BlockchainStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  type AttendanceRow = {
    id: string;
    student_id: string;
    date: string;
    status: string;
    method: string;
    blockchain_hash: string | null;
    previous_hash: string | null;
    nonce: number | null;
    created_at: string;
  };

  useEffect(() => {
    fetchBlockchainStatus();
  }, []);

  const fetchBlockchainStatus = async () => {
    try {
      setIsLoading(true);

      const attendanceQuery = supabase
        .from('attendance')
        .select('id, student_id, date, status, method, blockchain_hash, previous_hash, nonce, created_at', {
          count: 'exact',
        })
        .returns<AttendanceRow[]>() as any;

      const [recordsRes, auditRes] = await Promise.all([
        attendanceQuery
          .not('blockchain_hash', 'is', null)
          .order('created_at', { ascending: false })
          .limit(25),
        supabase.functions.invoke('analytics', {
          body: { reportType: 'blockchain_audit' },
        }).catch((e) => ({ data: null, error: e })), // Handle fetch errors gracefully
      ]);

      if (recordsRes.error) throw recordsRes.error;
      const auditError = (auditRes as any).error;
      
      // We don't throw auditError so the page can still load the blockchain explorer
      // even if the edge function is not deployed or fails.
      if (auditError) console.warn('Audit edge function error:', auditError);

      const records = (recordsRes.data || []) as AttendanceRow[];
      const count = recordsRes.count || records.length;

      const chain: Block[] = records.slice(0, 10).map((r, idx) => ({
        index: count - idx,
        timestamp: new Date(r.created_at as string).getTime(),
        data: { studentId: r.student_id, status: r.status, date: r.date },
        previousHash: r.previous_hash || 'GENESIS',
        hash: r.blockchain_hash || 'MISSING',
        nonce: r.nonce || 0,
      }));

      const recentRecords: Attendance[] = records.slice(0, 5).map((r) => ({
        id: r.id,
        studentId: r.student_id,
        date: r.date,
        status: r.status as any,
        method: r.method as any,
        blockchainHash: r.blockchain_hash || '',
        createdAt: r.created_at,
        updatedAt: r.created_at,
      }));

      const auditSummary = (auditRes?.data as { data?: { summary?: { invalidChains?: number } } } | undefined)?.data?.summary;
      const tamperedFromAudit = auditSummary?.invalidChains || 0;

      const hasBrokenLink = chain.some((b, idx) => idx > 0 && b.previousHash !== chain[idx - 1].hash);

      setStatus({
        status: !hasBrokenLink && tamperedFromAudit === 0 ? 'VALID' : 'TAMPERED',
        totalBlocks: count,
        verifiedRecords: count,
        tamperedBlocks: tamperedFromAudit + (hasBrokenLink ? 1 : 0),
        chain,
        recentRecords,
      });
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

  const integrityLabel = useMemo(() => {
    if (!status) return 'Unknown';
    return status.status === 'VALID' ? 'Chain Healthy' : 'Investigate Issues';
  }, [status]);

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
                <p className="text-xs text-slate-500">{integrityLabel}</p>
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
                      {record.studentId || 'Student'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {record.date ? new Date(record.date).toLocaleDateString() : ''}
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