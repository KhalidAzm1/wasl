import React, { useState, useCallback, useRef } from 'react';
import { NavControls } from '@/components/NavControls';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Activity, Database, Gauge, Download, Printer, RefreshCw,
  CheckCircle2, AlertTriangle, TrendingUp, Timer,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGetAdminPerformanceStats } from '@workspace/api-client-react';

// Endpoints that are benchmarked with a timing probe
const BENCHMARK_ENDPOINTS = [
  { label: 'Dashboard Summary',        path: '/api/dashboard/summary' },
  { label: 'Banks List',               path: '/api/banks' },
  { label: 'Implementation Summary',   path: '/api/implementation/summary' },
  { label: 'Products List',            path: '/api/products' },
  { label: 'Meetings List',            path: '/api/meetings' },
  { label: 'Documents List',           path: '/api/documents' },
];

interface BenchmarkResult {
  label: string;
  path: string;
  duration: number;
  status: number;
}

export default function AdminPerformance() {
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [running, setRunning] = useState<string | null>(null); // current path being tested
  const [done, setDone] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const { data: dbStats, isLoading: dbLoading, refetch: refetchDb } = useGetAdminPerformanceStats();

  const runBenchmark = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setResults([]);
    setDone(false);
    const acc: BenchmarkResult[] = [];

    for (const ep of BENCHMARK_ENDPOINTS) {
      if (ctrl.signal.aborted) break;
      setRunning(ep.path);
      const t0 = performance.now();
      try {
        const res = await fetch(ep.path, { signal: ctrl.signal });
        const duration = Math.round(performance.now() - t0);
        acc.push({ ...ep, duration, status: res.status });
      } catch {
        const duration = Math.round(performance.now() - t0);
        acc.push({ ...ep, duration, status: 0 });
      }
      setResults([...acc]);
    }
    setRunning(null);
    setDone(true);
  }, []);

  const downloadCsv = useCallback(() => {
    const header = ['Endpoint', 'Path', 'Duration (ms)', 'HTTP Status', 'Rating'];
    const rows = results.map(r => [
      r.label, r.path,
      r.duration.toString(),
      r.status.toString(),
      r.duration < 200 ? 'Fast' : r.duration < 500 ? 'OK' : 'Slow',
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wasl-perf-${new Date().toLocaleDateString('en-US').replace(/\//g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results]);

  const avgDuration = results.length ? Math.round(results.reduce((s, r) => s + r.duration, 0) / results.length) : null;
  const maxDuration = results.length ? Math.max(...results.map(r => r.duration)) : null;
  const slowCount   = results.filter(r => r.duration > 500).length;

  const ratingColor = (ms: number) =>
    ms < 200 ? 'text-emerald-500' : ms < 500 ? 'text-yellow-500' : 'text-red-500';

  return (
    <div className="min-h-screen p-6 md:p-8 space-y-8 print:p-4">
      <NavControls />

      {/* Page header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Gauge className="w-6 h-6 text-primary" />
            Performance Monitor
          </h1>
          <p className="text-foreground/50 text-sm mt-1">
            Live API response times, database statistics, and system health
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2">
            <Printer className="w-4 h-4" /> Print PDF
          </Button>
          <Button
            variant="outline" size="sm"
            onClick={downloadCsv}
            disabled={results.length === 0}
            className="gap-2"
          >
            <Download className="w-4 h-4" /> Export CSV (Excel)
          </Button>
        </div>
      </div>

      {/* Summary KPIs — visible after benchmark */}
      {done && results.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Average', value: `${avgDuration}ms`, color: ratingColor(avgDuration!) },
            { label: 'Slowest', value: `${maxDuration}ms`, color: ratingColor(maxDuration!) },
            { label: 'Slow endpoints (>500ms)', value: slowCount.toString(), color: slowCount > 0 ? 'text-red-500' : 'text-emerald-500' },
          ].map(kpi => (
            <div key={kpi.label} className="p-5 rounded-2xl bg-foreground/5 border border-foreground/10 text-center">
              <p className={cn('text-3xl font-mono font-bold', kpi.color)}>{kpi.value}</p>
              <p className="text-xs text-foreground/40 mt-1">{kpi.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* API benchmark */}
      <Card className="glass-card">
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="w-4 h-4 text-primary" /> API Response Times
          </CardTitle>
          <Button
            size="sm" onClick={runBenchmark}
            disabled={running !== null}
            className="gap-2 print:hidden"
          >
            <RefreshCw className={cn('w-3 h-3', running && 'animate-spin')} />
            {running ? 'Running…' : 'Run Benchmark'}
          </Button>
        </CardHeader>
        <CardContent>
          {results.length === 0 && !running && (
            <p className="text-center py-8 text-foreground/30 text-sm">
              Click <strong>Run Benchmark</strong> to measure live API response times
            </p>
          )}

          <div className="space-y-1">
            {BENCHMARK_ENDPOINTS.map(ep => {
              const result = results.find(r => r.path === ep.path);
              const isActive = running === ep.path;
              const isSlow = result && result.duration > 500;
              return (
                <div key={ep.path} className="flex items-center gap-3 py-2.5 border-b border-foreground/5 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{ep.label}</p>
                    <p className="text-xs text-foreground/30 font-mono">{ep.path}</p>
                  </div>
                  {isActive && (
                    <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  )}
                  {result && (
                    <>
                      <Badge
                        variant={isSlow ? 'destructive' : result.duration < 200 ? 'default' : 'secondary'}
                        className="font-mono tabular-nums"
                      >
                        {result.duration}ms
                      </Badge>
                      {isSlow
                        ? <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                        : <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                    </>
                  )}
                  {!result && !isActive && <span className="text-xs text-foreground/20">—</span>}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Database statistics */}
      <Card className="glass-card">
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="w-4 h-4 text-primary" /> Database Tables
          </CardTitle>
          <Button
            size="sm" variant="outline"
            onClick={() => refetchDb()}
            disabled={dbLoading}
            className="gap-2 print:hidden"
          >
            <RefreshCw className={cn('w-3 h-3', dbLoading && 'animate-spin')} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {dbLoading && (
            <p className="text-center py-8 text-foreground/30 text-sm">Loading database statistics…</p>
          )}
          {dbStats?.tables && (
            <div className="space-y-1">
              {(dbStats.tables as { table: string; rowCount: number; size: string }[]).map(t => (
                <div key={t.table} className="flex items-center gap-3 py-2.5 border-b border-foreground/5 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium font-mono">{t.table}</p>
                    <p className="text-xs text-foreground/40">{t.rowCount.toLocaleString('en-US')} rows</p>
                  </div>
                  <span className="text-xs font-mono text-foreground/50 shrink-0">{t.size}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Optimizations in place */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="w-4 h-4 text-primary" /> Optimizations Active
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { title: 'Optimistic UI updates on implementation stages', desc: 'Changes appear instantly in the UI without waiting for the server.' },
            { title: 'Per-row loading indicators', desc: 'Only the row being updated shows a spinner — rest of the table stays interactive.' },
            { title: 'Debounced text saves (500ms)', desc: 'Owner and notes fields batch keystrokes before sending a network request.' },
            { title: 'React.memo on stage rows', desc: 'Unchanged rows skip re-rendering when sibling rows update.' },
            { title: 'DB indexes on bank_id, stage, completed', desc: 'Fast look-ups for implementation progress queries.' },
            { title: 'Single summary endpoint for dashboard', desc: 'All banks\' progress fetched in one call — no N+1 per bank card.' },
            { title: 'React Query 5-minute stale cache', desc: 'Repeated navigation re-uses cached responses.' },
          ].map(item => (
            <div key={item.title} className="flex items-start gap-3">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" />
              <div>
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-foreground/40">{item.desc}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Performance targets */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Timer className="w-4 h-4 text-primary" /> Performance Targets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            {[
              { label: 'Checkbox / Done toggle', target: '< 200ms', note: 'Optimistic — instant visual feedback' },
              { label: 'Status dropdown change', target: '< 300ms', note: 'Optimistic — server confirms in background' },
              { label: 'Text field save (blur)', target: '< 500ms', note: 'Debounced 500ms then API call' },
            ].map(t => (
              <div key={t.label} className="p-4 rounded-xl bg-foreground/5 border border-foreground/10">
                <p className="text-lg font-mono font-bold text-emerald-500">{t.target}</p>
                <p className="text-xs font-medium mt-1">{t.label}</p>
                <p className="text-[11px] text-foreground/40 mt-0.5">{t.note}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
