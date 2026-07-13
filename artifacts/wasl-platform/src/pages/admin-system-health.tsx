import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { analytics } from '@/lib/analytics';
import { NavControls } from '@/components/NavControls';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Database, HardDrive, ShieldCheck, RefreshCw, CheckCircle2, AlertTriangle,
  XCircle, Activity, FileText, Users, Calendar, Package, Zap, Server,
  FolderOpen, Link2Off, GitBranch,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── API helper ─────────────────────────────────────────────────────────────

async function systemFetch(path: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? '';
  const res = await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Helpers ────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 90) return { text: 'text-green-500', bg: 'bg-green-500', ring: 'stroke-green-500' };
  if (score >= 70) return { text: 'text-yellow-500', bg: 'bg-yellow-500', ring: 'stroke-yellow-500' };
  return { text: 'text-red-500', bg: 'bg-red-500', ring: 'stroke-red-500' };
}

function ScoreRing({ score }: { score: number }) {
  const c = scoreColor(score);
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={136} height={136} className="-rotate-90">
        <circle cx={68} cy={68} r={r} fill="none" strokeWidth={8} className="stroke-foreground/10" />
        <circle
          cx={68} cy={68} r={r} fill="none" strokeWidth={8}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          className={cn('transition-all duration-1000', c.ring)}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={cn('text-3xl font-bold font-mono', c.text)}>{score}%</span>
        <span className="text-[10px] text-foreground/40 uppercase tracking-widest mt-0.5">Health</span>
      </div>
    </div>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label?: string }) {
  return ok ? (
    <span className="flex items-center gap-1 text-green-500 text-xs font-medium">
      <CheckCircle2 className="w-3.5 h-3.5" /> {label ?? 'OK'}
    </span>
  ) : (
    <span className="flex items-center gap-1 text-red-500 text-xs font-medium">
      <XCircle className="w-3.5 h-3.5" /> {label ?? 'Issue'}
    </span>
  );
}

function Stat({ label, value, icon: Icon, accent = false }: { label: string; value: string | number; icon: any; accent?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-foreground/5 last:border-0">
      <Icon className={cn('w-4 h-4 shrink-0', accent ? 'text-primary' : 'text-foreground/40')} />
      <span className="text-sm text-foreground/60 flex-1">{label}</span>
      <span className={cn('text-sm font-mono font-semibold', accent ? 'text-primary' : 'text-foreground')}>{value}</span>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdminSystemHealth() {
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const { data: health, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const data = await systemFetch('/system/health');
      analytics.trackEvent('System Health Check Executed', { score: data.healthScore });
      return data;
    },
    staleTime: 30_000,
  });

  const handleRefresh = () => {
    setLastRefreshed(new Date());
    refetch();
  };

  const db = health?.database;
  const stor = health?.storage;
  const integ = health?.integrity;
  const score = health?.healthScore ?? 0;

  return (
    <div className="min-h-screen p-6 md:p-8 space-y-8">
      <NavControls />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary" />
            System Health
          </h1>
          <p className="text-sm text-foreground/50 mt-1">
            Real-time diagnostics — storage, database, and integrity checks
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-foreground/40">
            Last checked: {lastRefreshed.toLocaleTimeString('en-US')}
          </span>
          <Button onClick={handleRefresh} variant="outline" size="sm" className="gap-2" disabled={isFetching}>
            <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error */}
      {isError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          Failed to load health data: {(error as Error).message}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-48 rounded-2xl bg-foreground/5 animate-pulse" />
          ))}
        </div>
      )}

      {health && (
        <>
          {/* Health score + top-level stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Score ring */}
            <Card className="glass-card flex flex-col items-center justify-center py-8 gap-3">
              <ScoreRing score={score} />
              <div className="text-center">
                <p className="text-xs text-foreground/40 uppercase tracking-wider">Overall Score</p>
                <p className={cn('text-sm font-semibold mt-0.5', scoreColor(score).text)}>
                  {score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : 'Needs Attention'}
                </p>
              </div>
            </Card>

            {/* Storage card */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-primary" /> Storage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <Stat label="Provider" value={stor?.provider ?? '—'} icon={Server} />
                <Stat label="Bucket" value={stor?.bucket ?? '—'} icon={FolderOpen} />
                <Stat label="Files" value={stor?.fileCount ?? 0} icon={FileText} accent />
                <Stat label="Total Size" value={`${stor?.totalSizeMB ?? 0} MB`} icon={HardDrive} accent />
                <Stat label="Upload Directory" value="supabase://wasl-documents" icon={FolderOpen} />
              </CardContent>
            </Card>

            {/* Database card */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Database className="w-4 h-4 text-primary" /> Database
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <Stat label="Status" value="Connected" icon={Zap} accent />
                <Stat label="Provider" value="PostgreSQL" icon={Server} />
                <Stat label="Banks" value={(db?.tables?.banksActive ?? 0) + (db?.tables?.banksArchived ?? 0)} icon={GitBranch} />
                <Stat label="Documents" value={(db?.tables?.filesActive ?? 0) + (db?.tables?.filesArchived ?? 0)} icon={FileText} />
                <Stat label="Users" value={db?.tables?.usersTotal ?? 0} icon={Users} />
              </CardContent>
            </Card>

            {/* Integrity card */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" /> Integrity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-foreground/70">
                    <GitBranch className="w-4 h-4" /> Orphan Records
                  </div>
                  <StatusBadge ok={!integ?.orphanFiles} label={String(integ?.orphanFiles ?? 0)} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-foreground/70">
                    <FileText className="w-4 h-4" /> Missing Files
                  </div>
                  <StatusBadge ok={!integ?.missingFiles} label={String(integ?.missingFiles ?? 0)} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-foreground/70">
                    <Link2Off className="w-4 h-4" /> Broken Links
                  </div>
                  <StatusBadge ok={!integ?.brokenLinks} label={String(integ?.brokenLinks ?? 0)} />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-foreground/70">
                    <AlertTriangle className="w-4 h-4" /> Last Report
                  </div>
                  <span className="text-xs text-foreground/50">
                    {health.reports?.lastReportDate
                      ? new Date(health.reports.lastReportDate).toLocaleDateString('en-US')
                      : 'Never'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed DB table breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="w-4 h-4 text-primary" /> Database Tables
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {[
                    { label: 'Banks (Active)', key: 'banksActive', icon: GitBranch },
                    { label: 'Banks (Archived)', key: 'banksArchived', icon: GitBranch },
                    { label: 'Products', key: 'productsTotal', icon: Package },
                    { label: 'Meetings (Active)', key: 'meetingsActive', icon: Calendar },
                    { label: 'Meetings (Archived)', key: 'meetingsArchived', icon: Calendar },
                    { label: 'Files (Active)', key: 'filesActive', icon: FileText },
                    { label: 'Files (Archived)', key: 'filesArchived', icon: FileText },
                    { label: 'Action Items', key: 'actionItemsTotal', icon: CheckCircle2 },
                    { label: 'Audit Log Entries', key: 'auditLogsTotal', icon: Activity },
                    { label: 'Users (Supabase Auth)', key: 'usersTotal', icon: Users },
                  ].map(({ label, key, icon: Icon }) => (
                    <div key={key} className="flex items-center gap-3 py-2 border-b border-foreground/5 last:border-0">
                      <Icon className="w-4 h-4 text-foreground/30 shrink-0" />
                      <span className="text-sm text-foreground/60 flex-1">{label}</span>
                      <Badge variant="outline" className="font-mono text-xs">
                        {db?.tables?.[key] ?? 0}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-primary" /> Storage Diagnostics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-1">
                  {[
                    { label: 'Storage Provider', value: stor?.provider ?? '—' },
                    { label: 'Bucket Name', value: stor?.bucket ?? '—' },
                    { label: 'Upload Directory', value: stor?.uploadDirectory ?? '—' },
                    { label: 'Files Tracked (DB)', value: String(stor?.fileCount ?? 0) },
                    { label: 'Total Storage Used', value: `${stor?.totalSizeMB ?? 0} MB` },
                    { label: 'Missing Files', value: String(integ?.missingFiles ?? 0) },
                    { label: 'Broken Links', value: String(integ?.brokenLinks ?? 0) },
                    { label: 'Orphan Records', value: String(integ?.orphanFiles ?? 0) },
                    { label: 'Health Score', value: `${stor?.healthScore ?? 100}%` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center gap-3 py-2 border-b border-foreground/5 last:border-0">
                      <span className="text-sm text-foreground/60 flex-1">{label}</span>
                      <span className="text-sm font-mono text-foreground">{value}</span>
                    </div>
                  ))}
                </div>

                {/* Storage bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-foreground/50">
                    <span>Storage Usage</span>
                    <span>{stor?.totalSizeMB ?? 0} / 500 MB</span>
                  </div>
                  <div className="h-2 rounded-full bg-foreground/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-700"
                      style={{ width: `${Math.min(100, ((stor?.totalSizeMB ?? 0) / 500) * 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
