import React, { useState } from 'react';
import { NavControls } from '@/components/NavControls';
import { useListAuditLogs } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/utils';
import { ShieldCheck, ChevronDown, Lock } from 'lucide-react';

const FIELD_LABELS: Record<string, string> = {
  nameEn: 'Name (English)',
  nameAr: 'Name (Arabic)',
  category: 'Category',
  status: 'Status',
  logoUrl: 'Logo',
  heroImageUrl: 'Hero Image',
  referenceLink: 'Reference Link',
  contacts: 'Contact Details',
  productTypeIds: 'Product Types',
  productCode: 'Product Code',
  categoryStage: 'Stage',
  progressPercent: 'Progress (%)',
  dateType: 'Date Type',
  dateValue: 'Date',
  responsiblePerson: 'Responsible Person',
  priorityImpact: 'Priority',
  descriptionNotes: 'Notes',
  riskLevel: 'Risk Level',
  name: 'Name',
  isActive: 'Active',
  date: 'Date',
  topic: 'Topic',
  summary: 'Meeting Summary',
  attendees: 'Attendees',
  description: 'Description',
  level: 'Level',
  dueDate: 'Due Date',
  owner: 'Owner',
  title: 'Title',
  docType: 'Document Type',
  link: 'Link',
};

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    if (typeof value[0] === 'object') return `${value.length} item(s)`;
    return value.join(', ');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function Security() {
  const { data, isLoading } = useListAuditLogs({ limit: 100 });
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  const actionLabel: Record<string, string> = { CREATE: 'Created', UPDATE: 'Updated', ARCHIVE: 'Archived', RESTORE: 'Restored' };
  const entityLabel: Record<string, string> = { bank: 'Bank', document: 'Document', meeting: 'Meeting', product: 'Product', productType: 'Product Type', actionItem: 'Action Item', risk: 'Risk' };
  const actionColor: Record<string, string> = {
    CREATE: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    UPDATE: 'bg-primary/20 text-primary',
    ARCHIVE: 'bg-red-500/20 text-red-600 dark:text-red-400',
    RESTORE: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
  };

  const items = data?.items || [];

  return (
    <div className="p-8 pb-24 max-w-5xl mx-auto w-full space-y-8">
      <header className="mb-8 flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-l from-white to-white/60 mb-2 flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-primary" />
            Security & Activity
          </h1>
          <p className="text-foreground/50 text-lg">System-wide audit trail and security access</p>
        </div>
        <NavControls />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Audit Log column */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-foreground/5 border-foreground/10 overflow-hidden">
            <CardHeader className="border-b border-foreground/10 bg-foreground/5 pb-4">
              <CardTitle className="text-xl">Activity Audit Log</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto hide-scrollbar">
                {items.map(entry => {
                  const details = entry.details && typeof entry.details === 'object' ? entry.details as Record<string, unknown> : null;
                  const hasDetails = !!details && Object.keys(details).length > 0;
                  const isExpanded = expandedId === entry.id;
                  
                  return (
                    <div key={entry.id}>
                      <button
                        type="button"
                        className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left hover:bg-foreground/5 transition-colors"
                        onClick={() => hasDetails && setExpandedId(isExpanded ? null : entry.id)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`shrink-0 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${actionColor[entry.action] || 'bg-foreground/10 text-foreground/60'}`}>
                            {actionLabel[entry.action] || entry.action}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate">
                              {entityLabel[entry.entityType] || entry.entityType}
                              {entry.entityLabel ? ` — ${entry.entityLabel}` : ''}
                            </p>
                            <p className="text-sm text-foreground/40 truncate">{entry.userName || entry.userEmail || 'Unknown user'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm text-foreground/60 font-mono">{formatDateTime(entry.createdAt)}</span>
                          {hasDetails && (
                            <ChevronDown className={`w-4 h-4 text-foreground/40 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          )}
                        </div>
                      </button>
                      
                      {isExpanded && details && (
                        <div className="px-6 pb-4 -mt-1 bg-foreground/[0.02]">
                          <div className="rounded-lg bg-foreground/5 border border-foreground/10 p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-2">
                            {Object.entries(details).map(([key, value]) => (
                              <div key={key} className="flex justify-between gap-4 text-sm">
                                <span className="text-foreground/40">{FIELD_LABELS[key] || key}</span>
                                <span className="text-foreground/80 truncate font-mono text-xs mt-0.5" title={String(value)}>{formatDetailValue(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <div className="py-12 text-center text-foreground/30">No updates recorded yet</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Security Info Sidebar */}
        <div className="space-y-6 lg:sticky lg:top-8">
          <Card className="bg-gradient-to-b from-primary/20 to-background border-primary/30 shadow-[0_0_30px_rgba(124,58,237,0.1)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Lock className="w-5 h-5" />
                Two-Factor Protection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-foreground/80 leading-relaxed">
              <p>
                Access to the <strong className="text-foreground">User Management</strong> portal is protected by an additional PIN-gated second factor.
              </p>
              <p className="text-foreground/60">
                This ensures that even if an administrator's primary session is compromised, critical user management functions remain secure.
              </p>
              <div className="p-3 bg-background/60 rounded-lg border border-foreground/10 text-foreground/50 text-xs">
                The PIN token is short-lived and cryptographically verified on every API request. It cannot be bypassed from the client side.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
