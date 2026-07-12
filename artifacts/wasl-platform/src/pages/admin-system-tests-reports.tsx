import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { analytics } from '@/lib/analytics';
import { NavControls } from '@/components/NavControls';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'wouter';
import {
  ClipboardList, Download, Trash2, ChevronLeft, Eye, CheckCircle2,
  XCircle, AlertTriangle, Clock, FlaskConical, RefreshCw, FileBarChart,
  Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────

interface ReportSummary {
  id: string;
  suite: string;
  timestamp: string;
  score: number;
  passed: number;
  failed: number;
  warnings: number;
  durationMs: number;
}

interface TestResult {
  test: string;
  category: string;
  status: 'passed' | 'failed' | 'warning' | 'skipped';
  message: string;
  durationMs: number;
}

interface FullReport extends ReportSummary {
  results: TestResult[];
  recommendations: Array<{ severity: string; issue: string; fix: string }>;
  environment: string;
  appVersion: string;
}

// ── API helper ─────────────────────────────────────────────────────────────

async function systemFetch(path: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? '';
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(options.headers ?? {}) },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.ok;
}

async function fetchReports(): Promise<ReportSummary[]> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? '';
  const res = await fetch('/api/system/reports', { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function fetchReport(id: string): Promise<FullReport> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? '';
  const res = await fetch(`/api/system/reports/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function downloadReportPdf(id: string, date: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? '';
  const res = await fetch(`/api/system/reports/${id}/download`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Wasl-System-Health-Report-${date}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  analytics.trackEvent('File Downloaded', { type: 'pdf-report', reportId: id });
}

// ── Components ─────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 90 ? 'bg-green-500/15 text-green-400 border-green-500/30'
    : score >= 70 ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
    : 'bg-red-500/15 text-red-400 border-red-500/30';
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-lg border text-xs font-bold font-mono', color)}>
      {score}%
    </span>
  );
}

function ReportRow({
  report,
  onDelete,
  isDeleting,
}: {
  report: ReportSummary;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [fullReport, setFullReport] = useState<FullReport | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const handleExpand = async () => {
    if (!expanded && !fullReport) {
      setLoadingDetail(true);
      try {
        const data = await fetchReport(report.id);
        setFullReport(data);
      } catch {
        // ignore
      }
      setLoadingDetail(false);
    }
    setExpanded(!expanded);
    analytics.trackEvent('File Opened', { type: 'report', reportId: report.id });
  };

  const date = new Date(report.timestamp);

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Row header */}
      <div className="flex items-center gap-4 p-4">
        <div className="flex flex-col items-center gap-1 min-w-[80px]">
          <ScoreBadge score={report.score} />
          <span className="text-[10px] text-foreground/40 font-mono">score</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold capitalize">{report.suite.replace(/_/g, ' ')}</span>
            <span className="text-xs text-foreground/40">{date.toLocaleDateString()} {date.toLocaleTimeString()}</span>
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-xs text-green-500">
              <CheckCircle2 className="w-3 h-3" /> {report.passed}
            </span>
            <span className="flex items-center gap-1 text-xs text-red-500">
              <XCircle className="w-3 h-3" /> {report.failed}
            </span>
            <span className="flex items-center gap-1 text-xs text-yellow-500">
              <AlertTriangle className="w-3 h-3" /> {report.warnings}
            </span>
            <span className="flex items-center gap-1 text-xs text-foreground/40">
              <Clock className="w-3 h-3" /> {(report.durationMs / 1000).toFixed(1)}s
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 h-8 px-3"
            onClick={handleExpand}
          >
            {loadingDetail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 h-8 px-3"
            onClick={() => downloadReportPdf(report.id, report.timestamp.substring(0, 10))}
          >
            <Download className="w-3.5 h-3.5" /> PDF
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-red-600/60 hover:text-red-600 hover:bg-red-600/10"
            onClick={() => {
              if (confirm('Delete this report?')) onDelete(report.id);
            }}
            disabled={isDeleting}
          >
            {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && fullReport && (
        <div className="border-t border-foreground/10 px-4 pb-4">
          <div className="pt-4 space-y-2 max-h-80 overflow-y-auto hide-scrollbar">
            {fullReport.results.map((r, i) => {
              const Icon = r.status === 'passed' ? CheckCircle2 : r.status === 'failed' ? XCircle : r.status === 'warning' ? AlertTriangle : Clock;
              const color = r.status === 'passed' ? 'text-green-500' : r.status === 'failed' ? 'text-red-500' : r.status === 'warning' ? 'text-yellow-500' : 'text-foreground/40';
              return (
                <div key={i} className="flex items-start gap-2.5 text-xs py-1.5 border-b border-foreground/5 last:border-0">
                  <Icon className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', color)} />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{r.test}</span>
                    <span className="text-foreground/40 ml-2">({r.category})</span>
                    <p className="text-foreground/50 mt-0.5 leading-relaxed">{r.message}</p>
                  </div>
                  <span className="text-foreground/30 font-mono shrink-0">{r.durationMs}ms</span>
                </div>
              );
            })}
          </div>

          {fullReport.recommendations.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold text-foreground/60 uppercase tracking-wider">Recommendations</p>
              {fullReport.recommendations.map((rec, i) => {
                const sc = rec.severity === 'critical' ? 'text-red-500' : rec.severity === 'medium' ? 'text-yellow-500' : 'text-foreground/50';
                return (
                  <div key={i} className="text-xs">
                    <span className={cn('font-semibold capitalize', sc)}>{rec.severity}: </span>
                    <span className="text-foreground/60">{rec.issue}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdminSystemTestsReports() {
  const queryClient = useQueryClient();

  const { data: reports, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['system-reports'],
    queryFn: fetchReports,
    staleTime: 30_000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await systemFetch(`/system/reports/${id}`, { method: 'DELETE' });
      analytics.trackEvent('File Deleted', { type: 'report', reportId: id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-reports'] });
    },
  });

  const totalReports = reports?.length ?? 0;
  const avgScore = totalReports
    ? Math.round(reports!.reduce((s, r) => s + r.score, 0) / totalReports)
    : 0;
  const lastRun = reports?.[0]?.timestamp
    ? new Date(reports[0].timestamp).toLocaleString()
    : 'Never';

  return (
    <div className="min-h-screen p-6 md:p-8 space-y-8">
      <NavControls />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin/system-tests">
              <button className="text-foreground/40 hover:text-foreground transition-colors flex items-center gap-1 text-sm">
                <ChevronLeft className="w-4 h-4" /> Tests
              </button>
            </Link>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            Test Reports
          </h1>
          <p className="text-sm text-foreground/50 mt-1">
            View, download, and manage past system health reports
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm" className="gap-2" disabled={isFetching}>
          <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Reports', value: totalReports, icon: FileBarChart },
          { label: 'Average Score', value: totalReports ? `${avgScore}%` : '—', icon: CheckCircle2 },
          { label: 'Last Run', value: reports?.[0] ? new Date(reports[0].timestamp).toLocaleDateString() : '—', icon: Clock },
          { label: 'Report Storage', value: `${totalReports} file(s)`, icon: FlaskConical },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="glass-card">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <Icon className="w-5 h-5 text-primary/60 shrink-0" />
              <div>
                <p className="text-xs text-foreground/40">{label}</p>
                <p className="text-sm font-bold font-mono">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Error */}
      {isError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          Failed to load reports: {(error as Error).message}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-foreground/5 animate-pulse" />
          ))}
        </div>
      )}

      {/* Reports list */}
      {!isLoading && reports && (
        <>
          {reports.length === 0 ? (
            <div className="py-24 text-center space-y-4">
              <ClipboardList className="w-12 h-12 text-foreground/20 mx-auto" />
              <p className="text-foreground/40 text-lg">No reports yet</p>
              <p className="text-foreground/30 text-sm max-w-sm mx-auto">
                Run a test suite from the{' '}
                <Link href="/admin/system-tests">
                  <span className="text-primary underline cursor-pointer">System Tests</span>
                </Link>{' '}
                page to generate your first report.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-foreground/50">{totalReports} report(s) — newest first</p>
                <p className="text-xs text-foreground/30">Last run: {lastRun}</p>
              </div>
              {reports.map((report) => (
                <ReportRow
                  key={report.id}
                  report={report}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  isDeleting={deleteMutation.isPending && deleteMutation.variables === report.id}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
