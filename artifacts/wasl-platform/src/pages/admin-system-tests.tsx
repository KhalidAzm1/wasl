import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { analytics } from '@/lib/analytics';
import { NavControls } from '@/components/NavControls';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'wouter';
import {
  Database, HardDrive, Upload, Download, ShieldCheck, Zap, Play,
  CheckCircle2, XCircle, AlertTriangle, Minus, FlaskConical, FileBarChart,
  Loader2, ChevronRight, Clock, ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────

interface TestResult {
  test: string;
  category: string;
  status: 'passed' | 'failed' | 'warning' | 'skipped';
  message: string;
  durationMs: number;
}

interface TestReport {
  id: string;
  suite: string;
  timestamp: string;
  durationMs: number;
  results: TestResult[];
  summary: { passed: number; failed: number; warnings: number; errors: number; score: number };
  recommendations: Array<{ severity: string; issue: string; fix: string }>;
}

// ── API helper ─────────────────────────────────────────────────────────────

async function runTestSuite(suite: string): Promise<TestReport> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? '';
  const res = await fetch('/api/system/tests/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ suite }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Components ─────────────────────────────────────────────────────────────

const STATUS_META = {
  passed: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10 border-green-500/20', label: 'Passed' },
  failed: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20', label: 'Failed' },
  warning: { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-500/10 border-yellow-500/20', label: 'Warning' },
  skipped: { icon: Minus, color: 'text-foreground/40', bg: 'bg-foreground/5 border-foreground/10', label: 'Skipped' },
};

function TestResultRow({ result }: { result: TestResult }) {
  const meta = STATUS_META[result.status];
  const Icon = meta.icon;
  return (
    <div className={cn('flex items-start gap-3 p-3 rounded-xl border transition-all', meta.bg)}>
      <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', meta.color)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">{result.test}</span>
          <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 opacity-60">
            {result.category}
          </Badge>
        </div>
        <p className="text-xs text-foreground/60 mt-0.5 leading-relaxed">{result.message}</p>
      </div>
      <span className="text-[10px] text-foreground/30 font-mono shrink-0">{result.durationMs}ms</span>
    </div>
  );
}

const SUITES = [
  { id: 'database', label: 'Database Test', icon: Database, desc: 'Table access, integrity, orphan records' },
  { id: 'storage', label: 'Storage Test', icon: HardDrive, desc: 'Bucket access, file consistency' },
  { id: 'upload', label: 'Upload Test', icon: Upload, desc: 'PDF, image, and Excel upload flows' },
  { id: 'download', label: 'Download Test', icon: Download, desc: 'Signed URL generation and access' },
  { id: 'auth', label: 'Auth Test', icon: ShieldCheck, desc: 'Auth service, roles, permissions' },
  { id: 'performance', label: 'Performance Test', icon: Zap, desc: 'DB and storage response times' },
  { id: 'all', label: 'Run All Tests', icon: Play, desc: 'All suites combined' },
];

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdminSystemTests() {
  const [report, setReport] = useState<TestReport | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const mutation = useMutation({
    mutationFn: runTestSuite,
    onSuccess: (data) => {
      setReport(data);
      analytics.trackEvent('Test Executed', {
        suite: data.suite,
        passed: data.summary.passed,
        failed: data.summary.failed,
        score: data.summary.score,
      });
      if (data.summary.failed > 0) {
        analytics.trackEvent('Test Failed', { suite: data.suite, failedCount: data.summary.failed });
      } else {
        analytics.trackEvent('Test Passed', { suite: data.suite });
      }
    },
    onError: (err) => {
      analytics.trackEvent('Test Failed', { error: (err as Error).message });
    },
  });

  const run = (suite: string) => {
    setReport(null);
    setActiveCategory('all');
    mutation.mutate(suite);
  };

  const categories = report
    ? ['all', ...new Set(report.results.map((r) => r.category))]
    : [];

  const filteredResults = report
    ? (activeCategory === 'all' ? report.results : report.results.filter((r) => r.category === activeCategory))
    : [];

  const score = report?.summary.score ?? 0;
  const scoreColor = score >= 90 ? 'text-green-500' : score >= 70 ? 'text-yellow-500' : 'text-red-500';

  return (
    <div className="min-h-screen p-6 md:p-8 space-y-8">
      <NavControls />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-primary" />
            System Tests
          </h1>
          <p className="text-sm text-foreground/50 mt-1">
            Run automated tests against every layer of the platform
          </p>
        </div>
        <Link href="/admin/system-tests/reports">
          <Button variant="outline" size="sm" className="gap-2">
            <ClipboardList className="w-4 h-4" /> Reports History
            <ChevronRight className="w-4 h-4 opacity-50" />
          </Button>
        </Link>
      </div>

      {/* Full system health check — hero button */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/30 p-6 md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(124,58,237,0.15),transparent_60%)] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold">Run Full System Health Check</h2>
            <p className="text-sm text-foreground/60 mt-1 max-w-lg">
              Uploads sample files (PDF, image, Excel), creates a test bank and product,
              verifies data integrity, downloads files, then automatically cleans up all test data.
              Generates a downloadable PDF report on completion.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {['Database', 'Storage', 'Auth', 'Upload', 'Download', 'Performance'].map((t) => (
                <Badge key={t} variant="outline" className="text-xs border-primary/30 text-primary/80">{t}</Badge>
              ))}
            </div>
          </div>
          <Button
            size="lg"
            onClick={() => run('full_health_check')}
            disabled={mutation.isPending}
            className="bg-primary hover:bg-primary/80 text-white font-bold px-8 py-4 rounded-2xl shadow-[0_0_30px_-5px_rgba(124,58,237,0.5)] transition-all hover:shadow-[0_0_40px_-5px_rgba(124,58,237,0.6)] shrink-0 h-auto"
          >
            {mutation.isPending && mutation.variables === 'full_health_check' ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Running…</>
            ) : (
              <><Play className="w-5 h-5" /> Run Full Check</>
            )}
          </Button>
        </div>
      </div>

      {/* Individual test suite buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {SUITES.map(({ id, label, icon: Icon, desc }) => (
          <button
            key={id}
            onClick={() => run(id)}
            disabled={mutation.isPending}
            className={cn(
              'glass-card flex flex-col items-center gap-2.5 p-4 rounded-2xl border cursor-pointer transition-all hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed text-center group',
              mutation.isPending && mutation.variables === id ? 'border-primary/60 bg-primary/10' : 'border-foreground/10',
            )}
          >
            {mutation.isPending && mutation.variables === id ? (
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            ) : (
              <Icon className="w-5 h-5 text-primary/70 group-hover:text-primary transition-colors" />
            )}
            <span className="text-xs font-semibold leading-tight">{label}</span>
            <span className="text-[10px] text-foreground/40 leading-tight hidden sm:block">{desc}</span>
          </button>
        ))}
      </div>

      {/* Running indicator */}
      {mutation.isPending && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
          <Loader2 className="w-5 h-5 animate-spin shrink-0" />
          <div>
            <p className="text-sm font-semibold">Running {mutation.variables} tests…</p>
            <p className="text-xs opacity-70 mt-0.5">This may take 10–30 seconds. Do not close the page.</p>
          </div>
        </div>
      )}

      {/* Error */}
      {mutation.isError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <XCircle className="w-4 h-4 inline mr-2" />
          Test run failed: {(mutation.error as Error).message}
        </div>
      )}

      {/* Results */}
      {report && (
        <div className="space-y-6">
          {/* Summary bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Passed', value: report.summary.passed, color: 'text-green-500', bg: 'bg-green-500/10 border-green-500/20' },
              { label: 'Failed', value: report.summary.failed, color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20' },
              { label: 'Warnings', value: report.summary.warnings, color: 'text-yellow-500', bg: 'bg-yellow-500/10 border-yellow-500/20' },
              { label: 'Score', value: `${report.summary.score}%`, color: scoreColor, bg: 'bg-primary/10 border-primary/20' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={cn('flex flex-col items-center py-4 rounded-2xl border', bg)}>
                <span className={cn('text-2xl font-bold font-mono', color)}>{value}</span>
                <span className="text-xs text-foreground/50 mt-1">{label}</span>
              </div>
            ))}
          </div>

          {/* Suite info */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-foreground/50">
            <span className="flex items-center gap-1.5">
              <FlaskConical className="w-3.5 h-3.5" />
              Suite: <strong className="text-foreground">{report.suite.replace(/_/g, ' ')}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Duration: <strong className="text-foreground">{(report.durationMs / 1000).toFixed(1)}s</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <FileBarChart className="w-3.5 h-3.5" />
              Report ID: <code className="text-foreground/70 text-xs">{report.id}</code>
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Test results */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      'px-3 py-1 rounded-lg text-xs font-medium transition-all',
                      activeCategory === cat
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'text-foreground/50 hover:text-foreground bg-foreground/5 border border-transparent',
                    )}
                  >
                    {cat === 'all' ? `All (${report.results.length})` : cat}
                  </button>
                ))}
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1 hide-scrollbar">
                {filteredResults.map((r, i) => (
                  <TestResultRow key={`${r.test}-${i}`} result={r} />
                ))}
              </div>
            </div>

            {/* Recommendations */}
            <div className="space-y-4">
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Recommendations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {report.recommendations.map((rec, i) => {
                    const sc = rec.severity === 'critical' ? 'text-red-500 bg-red-500/10 border-red-500/20'
                      : rec.severity === 'medium' ? 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20'
                      : 'text-foreground/50 bg-foreground/5 border-foreground/10';
                    return (
                      <div key={i} className={cn('p-3 rounded-xl border text-xs', sc)}>
                        <p className="font-semibold capitalize mb-1">{rec.severity}: {rec.issue}</p>
                        <p className="opacity-80">{rec.fix}</p>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Download report */}
              <Card className="glass-card border-primary/20">
                <CardContent className="pt-4 pb-4">
                  <p className="text-sm font-semibold mb-1">Report Saved</p>
                  <p className="text-xs text-foreground/50 mb-3">
                    This report has been saved and is available for download as a PDF.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={async () => {
                      const { data: { session } } = await supabase.auth.getSession();
                      const token = session?.access_token ?? '';
                      const link = document.createElement('a');
                      link.href = `/api/system/reports/${report.id}/download`;
                      link.setAttribute('download', `Wasl-System-Health-Report-${report.timestamp.substring(0, 10)}.pdf`);
                      // fetch with auth then blob-download
                      const r = await fetch(link.href, { headers: { Authorization: `Bearer ${token}` } });
                      const blob = await r.blob();
                      link.href = URL.createObjectURL(blob);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      analytics.trackEvent('File Downloaded', { type: 'pdf-report', reportId: report.id });
                    }}
                  >
                    <Download className="w-4 h-4" /> Download PDF Report
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
