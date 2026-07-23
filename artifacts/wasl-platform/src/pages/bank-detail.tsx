import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useLocation } from 'wouter';
import { BankLogo } from '@/components/BankLogo';
import { NavControls } from '@/components/NavControls';
import { 
  useGetBank, useListBanks,
  useCreateProduct, useUpdateProduct, useDeleteProduct,
  useCreateMeeting, useUpdateMeeting, useDeleteMeeting,
  useCreateRisk, useUpdateRisk, useDeleteRisk,
  useCreateActionItem, useUpdateActionItem, useDeleteActionItem,
  useCreateDocument, useUploadDocument, useDeleteDocument,
  useListDocuments, getGetBankQueryKey, getListDocumentsQueryKey, getListProductsQueryKey,
  useGetBankStagesV2, usePatchStageV2, useAddStageV2, useDeleteStageV2, useReorderStagesV2,
  useGetSubStagesV2, useAddSubStageV2, usePatchSubStageV2, useDeleteSubStageV2,
  type StageV2, type BankStagesViewV2, type PatchStageBodyV2,
  useProductStages, useAddProductStage, usePatchProductStage, useDeleteProductStage,
  getProductStagesQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { formatDate, formatDateTime, formatPercentage, getStatusColor, cn } from '@/lib/utils';
import { analytics } from '@/lib/analytics';
import { 
  ChevronRight, Building2, LayoutGrid, Calendar, AlertTriangle, 
  CheckSquare, FileText, Plus, Trash2, Edit, ExternalLink, Phone, User, UploadCloud, Paperclip,
  Maximize2, BarChart2, CheckCircle2, Circle, Ban, Clock, Flag, Loader2,
  GripVertical, SkipForward, Pencil, X, ChevronDown, ChevronUp, RotateCcw,
} from 'lucide-react';

// ── Product Stages Section ────────────────────────────────────────────────────
function ProductStagesSection({ product, bankId }: { product: any; bankId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: stages = [], isLoading } = useProductStages(product.id);
  const addStage = useAddProductStage();
  const patchStage = usePatchProductStage();
  const deleteStage = useDeleteProductStage();

  const [expanded, setExpanded] = useState(false);
  const [addingName, setAddingName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getProductStagesQueryKey(product.id) });
    queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bankId) });
    queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
  };

  const handleAdd = () => {
    if (!addingName.trim()) return;
    addStage.mutate({ productId: product.id, name: addingName.trim() }, {
      onSuccess: () => { setAddingName(''); setIsAdding(false); invalidateAll(); },
      onError: (e: any) => toast({ title: 'فشل الإضافة', description: e?.message, variant: 'destructive' }),
    });
  };

  const handleToggle = (stage: any) => {
    patchStage.mutate({ id: stage.id, productId: product.id, completed: !stage.completed }, {
      onSuccess: invalidateAll,
      onError: (e: any) => toast({ title: 'فشل التحديث', description: e?.message, variant: 'destructive' }),
    });
  };

  const handleRename = (stage: any) => {
    if (!editingName.trim() || editingName === stage.name) { setEditingId(null); return; }
    patchStage.mutate({ id: stage.id, productId: product.id, name: editingName.trim() }, {
      onSuccess: () => { setEditingId(null); invalidateAll(); },
      onError: (e: any) => toast({ title: 'فشل التعديل', description: e?.message, variant: 'destructive' }),
    });
  };

  const handleDelete = (stage: any) => {
    deleteStage.mutate({ id: stage.id, productId: product.id }, {
      onSuccess: invalidateAll,
      onError: (e: any) => toast({ title: 'فشل الحذف', description: e?.message, variant: 'destructive' }),
    });
  };

  const completed = stages.filter((s: any) => s.completed).length;
  const total = stages.length;

  return (
    <div className="border-t border-foreground/10 mt-3 pt-3">
      <button
        className="flex items-center justify-between w-full text-xs text-foreground/60 hover:text-foreground transition-colors gap-2"
        onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
      >
        <span className="flex items-center gap-1.5 font-medium">
          <CheckSquare className="w-3 h-3" />
          المراحل {total > 0 && <span className="text-primary font-semibold">{completed}/{total}</span>}
        </span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5" onClick={(e) => e.stopPropagation()}>
          {isLoading && <div className="text-xs text-foreground/30 py-2 text-center">جاري التحميل...</div>}

          {stages.map((stage: any) => (
            <div key={stage.id} className="flex items-center gap-2 group">
              {/* Checkbox */}
              <button
                onClick={() => handleToggle(stage)}
                className="shrink-0 w-4 h-4 rounded border border-foreground/30 flex items-center justify-center hover:border-primary transition-colors"
                style={{ background: stage.completed ? 'hsl(var(--primary))' : 'transparent' }}
              >
                {stage.completed && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
              </button>

              {/* Name — editable inline */}
              {editingId === stage.id ? (
                <input
                  autoFocus
                  className="flex-1 text-xs bg-foreground/5 border border-primary/40 rounded px-1.5 py-0.5 outline-none"
                  value={editingName}
                  onChange={e => setEditingName(e.target.value)}
                  onBlur={() => handleRename(stage)}
                  onKeyDown={e => { if (e.key === 'Enter') handleRename(stage); if (e.key === 'Escape') setEditingId(null); }}
                />
              ) : (
                <span
                  className={cn('flex-1 text-xs leading-snug', stage.completed ? 'line-through text-foreground/40' : 'text-foreground/80')}
                  onDoubleClick={() => { setEditingId(stage.id); setEditingName(stage.name); }}
                  title="انقر مرتين للتعديل"
                >
                  {stage.name}
                </span>
              )}

              {/* Actions (file + delete) */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <EntityAttachmentsButton entityType="product_stage" entityId={stage.id} label={stage.name} />
                <button
                  onClick={() => handleDelete(stage)}
                  className="w-5 h-5 rounded flex items-center justify-center text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  title="حذف المرحلة"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}

          {stages.length === 0 && !isLoading && (
            <div className="text-xs text-foreground/30 text-center py-1">لا توجد مراحل — أضف أولى المراحل</div>
          )}

          {/* Add stage row */}
          {isAdding ? (
            <div className="flex gap-1 mt-1">
              <input
                autoFocus
                className="flex-1 text-xs bg-foreground/5 border border-primary/40 rounded px-2 py-1 outline-none"
                placeholder="اسم المرحلة..."
                value={addingName}
                onChange={e => setAddingName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setIsAdding(false); setAddingName(''); } }}
              />
              <button
                onClick={handleAdd}
                disabled={addStage.isPending || !addingName.trim()}
                className="px-2 py-1 rounded text-xs bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/80 transition-colors"
              >
                {addStage.isPending ? '...' : 'إضافة'}
              </button>
              <button
                onClick={() => { setIsAdding(false); setAddingName(''); }}
                className="px-1.5 py-1 rounded text-xs text-foreground/50 hover:text-foreground hover:bg-foreground/10 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center gap-1 text-xs text-foreground/40 hover:text-primary transition-colors mt-1 w-full"
            >
              <Plus className="w-3 h-3" /> إضافة مرحلة
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Implementation progress badge (used in the bank header) ──────────────
function ImplProgressBadge({ bankId }: { bankId: string }) {
  const { data } = useGetBankStagesV2(bankId);
  if (!data) return null;
  const pct = data.completionPercentage;
  const color = pct === 100
    ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30'
    : pct >= 75
    ? 'bg-blue-500/20 text-blue-500 border-blue-500/30'
    : pct >= 50
    ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'
    : pct > 0
    ? 'bg-orange-500/20 text-orange-500 border-orange-500/30'
    : 'bg-foreground/5 text-foreground/40 border-foreground/10';
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold', color)}>
      <BarChart2 className="w-3 h-3" />
      {Math.round(pct)}% Implementation
    </span>
  );
}

// Generic attachment button + dialog for entities other than banks (products,
// meetings). Mirrors the bank Documents tab but scoped to a single
// entityType/entityId pair, since products/meetings don't have their own tab.
function EntityAttachmentsButton({ entityType, entityId, label }: { entityType: 'product' | 'meeting' | 'product_stage', entityId: number, label: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<{ name: string, title: string, docType: string, dataUrl: string } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const params = { entityType, entityId: String(entityId) };
  const { data: files } = useListDocuments(params, { query: { enabled: isOpen, queryKey: getListDocumentsQueryKey(params) } });
  const uploadDoc = useUploadDocument();
  const deleteDoc = useDeleteDocument();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey(params) });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadFile({ name: file.name, title: file.name, docType: '', dataUrl: event.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = () => {
    if (!uploadFile) return;
    uploadDoc.mutate({ data: { entityType, entityId: String(entityId), title: uploadFile.title, fileName: uploadFile.name, docType: uploadFile.docType, fileDataBase64: uploadFile.dataUrl } }, {
      onSuccess: () => {
        invalidate();
        setUploadFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        toast({ title: 'Upload Successful', description: 'The file has been uploaded successfully.' });
      },
      onError: (err: any) => {
        toast({ title: 'Upload Failed', description: err?.message || 'Failed to upload the file.', variant: 'destructive' });
      }
    });
  };

  const docs = files || [];

  return (
    <>
      <Button variant="ghost" size="icon" className="h-6 w-6 text-foreground/50" title="Attach file" onClick={(e) => { e.stopPropagation(); setIsOpen(true); }}>
        <Paperclip className="w-3 h-3" />
      </Button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent dir="ltr">
          <DialogHeader><DialogTitle>Attachments — {label}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
            <Button variant="outline" size="sm" className="gap-2 w-full" onClick={() => fileInputRef.current?.click()}>
              <UploadCloud className="w-4 h-4" /> Upload File
            </Button>
            {uploadFile && (
              <div className="p-3 rounded-xl bg-foreground/5 border border-primary/30 space-y-2">
                <span className="text-sm text-foreground/70">File: {uploadFile.name}</span>
                <Input placeholder="Title" value={uploadFile.title} onChange={e => setUploadFile({ ...uploadFile, title: e.target.value })} />
                <Input placeholder="Type (Contract, Report...)" value={uploadFile.docType} onChange={e => setUploadFile({ ...uploadFile, docType: e.target.value })} />
                {uploadDoc.isPending && (
                  <div className="w-full h-1 rounded-full overflow-hidden bg-primary/20">
                    <div className="h-full bg-primary rounded-full animate-pulse w-2/3" />
                  </div>
                )}
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleUpload} disabled={uploadDoc.isPending}>{uploadDoc.isPending ? 'Uploading...' : 'Confirm Upload'}</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setUploadFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>Cancel</Button>
                </div>
              </div>
            )}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {docs.map(d => (
                <div key={d.id} className="flex items-center justify-between p-3 rounded-xl bg-foreground/5 border border-foreground/10">
                  <div className="flex items-center gap-2 min-w-0 cursor-pointer" onClick={() => { const url = (d as any).fileUrl || d.oneDriveWebUrl || d.link; if (url) window.open(url, '_blank'); }}>
                    <FileText className="w-5 h-5 text-primary/70 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate text-sm">{d.title}</p>
                      {d.uploadedBy && <p className="text-xs text-foreground/30">Uploaded by {d.uploadedBy}</p>}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-red-600 dark:text-red-400/50 shrink-0" onClick={() => deleteDoc.mutate({ id: d.id }, {
                    onSuccess: () => { invalidate(); toast({ title: 'File archived' }); },
                    onError: (err: any) => toast({ title: 'Failed to delete file', description: err?.message, variant: 'destructive' }),
                  })}><Trash2 className="w-3 h-3" /></Button>
                </div>
              ))}
              {docs.length === 0 && <div className="py-6 text-center text-foreground/30 text-sm">No files attached yet</div>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function BankDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { data: bank, isLoading } = useGetBank(id!, { query: { enabled: !!id, queryKey: getGetBankQueryKey(id!) } });
  const { data: allBanks } = useListBanks();

  // Build sorted bank list for prev/next navigation (same order as dashboard default)
  const sortedBanks = React.useMemo(() => {
    if (!allBanks) return [];
    return [...allBanks].sort((a, b) => (a.nameEn ?? '').localeCompare(b.nameEn ?? ''));
  }, [allBanks]);

  const currentIdx = sortedBanks.findIndex(b => b.id === id);
  const prevBank = currentIdx > 0 ? sortedBanks[currentIdx - 1] : null;
  const nextBank = currentIdx < sortedBanks.length - 1 ? sortedBanks[currentIdx + 1] : null;

  // Keyboard navigation ← →
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft' && nextBank) navigate(`/bank/${nextBank.id}`);
      if (e.key === 'ArrowRight' && prevBank) navigate(`/bank/${prevBank.id}`);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prevBank, nextBank, navigate]);

  // Fire once when bank data first resolves for this page visit
  const firedRef = useRef(false);
  useEffect(() => {
    if (bank && !firedRef.current) {
      firedRef.current = true;
      analytics.bankOpened({
        bank_id: bank.id,
        bank_name_en: bank.nameEn,
        bank_name_ar: bank.nameAr,
        risk_level: bank.riskLevel ?? 'Unknown',
        priority_impact: bank.priorityImpact ?? 'Unknown',
      });
    }
  }, [bank]);

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!bank) return <div className="p-8 text-center text-foreground/50">Bank not found</div>;

  return (
    <div className="p-8 pb-24 max-w-7xl mx-auto w-full space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-4 text-foreground/50 text-sm">
          <Link href="/portfolio" className="hover:text-foreground transition-colors">Portfolio</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground">{bank.nameAr}</span>
          {sortedBanks.length > 1 && (
            <span className="text-foreground/30 text-xs">
              {currentIdx + 1} / {sortedBanks.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Prev / Next bank navigation */}
          <div className="flex items-center gap-1 border border-foreground/10 rounded-xl overflow-hidden bg-foreground/5">
            <button
              onClick={() => prevBank && navigate(`/bank/${prevBank.id}`)}
              disabled={!prevBank}
              title={prevBank ? `← ${prevBank.nameAr}` : undefined}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-foreground/60 hover:text-foreground hover:bg-foreground/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-3.5 h-3.5 rotate-180" />
              <span className="hidden sm:inline max-w-[100px] truncate">{prevBank?.nameAr ?? 'السابق'}</span>
            </button>
            <div className="w-px h-5 bg-foreground/10" />
            <button
              onClick={() => nextBank && navigate(`/bank/${nextBank.id}`)}
              disabled={!nextBank}
              title={nextBank ? `${nextBank.nameAr} →` : undefined}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-foreground/60 hover:text-foreground hover:bg-foreground/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <span className="hidden sm:inline max-w-[100px] truncate">{nextBank?.nameAr ?? 'التالي'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <NavControls />
        </div>
      </div>

      <div className="relative rounded-3xl overflow-hidden glass-panel border border-foreground/10 p-8 flex flex-col md:flex-row gap-8 items-start md:items-center">
        {bank.heroImageUrl && (
          <div className="absolute inset-0 z-[-1] opacity-20 mix-blend-luminosity">
            <img src={bank.heroImageUrl} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
          </div>
        )}

        <div className="w-24 h-24 rounded-2xl bg-foreground/5 border border-foreground/10 p-2 flex items-center justify-center shadow-xl backdrop-blur-md shrink-0">
          <BankLogo src={bank.logoUrl} alt={bank.nameEn} />
        </div>

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-foreground">{bank.nameAr}</h1>
            <Badge variant="outline" className="border-foreground/20 bg-foreground/5">{bank.category}</Badge>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-foreground/10 bg-foreground/5 text-xs font-semibold ${getStatusColor(bank.status).text}`}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${getStatusColor(bank.status).dot}`} />
              {bank.status}
            </span>
            <ImplProgressBadge bankId={bank.id} />
            {bank.riskLevel === 'High' && <Badge variant="destructive">High Risk</Badge>}
            {bank.priorityImpact === 'HOT' && <Badge variant="warning">Top Priority</Badge>}
          </div>
          <p className="text-foreground/50 text-lg">{bank.nameEn}</p>
        </div>

      </div>

      <Tabs defaultValue="overview" className="w-full" onValueChange={(tab) => analytics.bankDetailsViewed({ bank_id: bank.id, bank_name_en: bank.nameEn, tab })}>
        <TabsList className="w-full flex justify-start border-b border-foreground/10 bg-transparent rounded-none p-0 h-auto mb-8 overflow-x-auto hide-scrollbar">
          <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 px-6 text-lg gap-2">
            Overview
          </TabsTrigger>
          <TabsTrigger value="products" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 px-6 text-lg gap-2">
            <LayoutGrid className="w-4 h-4" /> Products
          </TabsTrigger>
          <TabsTrigger value="meetings" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 px-6 text-lg gap-2">
            <Calendar className="w-4 h-4" /> Meetings
          </TabsTrigger>
          <TabsTrigger value="actions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 px-6 text-lg gap-2">
            <CheckSquare className="w-4 h-4" /> Actions
          </TabsTrigger>
          <TabsTrigger value="documents" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 px-6 text-lg gap-2">
            <FileText className="w-4 h-4" /> Documents
          </TabsTrigger>
          <TabsTrigger value="implementation" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 px-6 text-lg gap-2">
            <BarChart2 className="w-4 h-4" /> Implementation Progress
          </TabsTrigger>
          <TabsTrigger value="risks" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 px-6 text-lg gap-2">
            <AlertTriangle className="w-4 h-4" /> Risks
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Executive Summary</CardTitle>
                  <button
                    type="button"
                    title="Enable Presentation Mode"
                    className="flex items-center gap-1.5 text-xs text-foreground/40 hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-primary/10"
                    onClick={() => analytics.executivePresentationModeEnabled({ bank_id: bank.id, bank_name: bank.nameEn })}
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Presentation</span>
                  </button>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground/80 leading-relaxed whitespace-pre-wrap text-lg">
                    {bank.executiveSummary || 'No summary available.'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Description Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground/70 leading-relaxed whitespace-pre-wrap">
                    {bank.descriptionNotes || 'No notes available.'}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Key Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-foreground/40 mb-1">Responsible Person</p>
                    <p className="font-medium">{bank.responsiblePerson || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-foreground/40 mb-1">Relationship Manager</p>
                    <p className="font-medium">{bank.relationshipManager || '-'}</p>
                  </div>
                  {bank.email && (
                    <div>
                      <p className="text-sm text-foreground/40 mb-1">Email</p>
                      <a href={`mailto:${bank.email}`} className="font-medium text-primary hover:underline" dir="ltr">
                        {bank.email}
                      </a>
                    </div>
                  )}
                  {bank.website && (
                    <div>
                      <p className="text-sm text-foreground/40 mb-1">Website</p>
                      <a href={bank.website} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline flex items-center gap-1" dir="ltr">
                        {bank.website} <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-foreground/40 mb-1">Last Meeting Date</p>
                    <p className="font-medium">{formatDate(bank.lastMeetingDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-foreground/40 mb-1">Next Meeting</p>
                    <p className="font-medium">{formatDate(bank.nextMeetingDate)}</p>
                    {bank.nextMeetingTopic && <p className="text-sm text-foreground/60 mt-1">{bank.nextMeetingTopic}</p>}
                  </div>
                  {bank.referenceLink && (
                    <div>
                      <p className="text-sm text-foreground/40 mb-1">Reference Link</p>
                      <a href={bank.referenceLink} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                        Open Link <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>

              {bank.contacts && bank.contacts.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5 text-primary" />
                      Contacts
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {bank.contacts.map((contact, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-foreground/5 border border-foreground/10">
                        <p className="font-medium">{contact.name}</p>
                        {contact.title && <p className="text-sm text-foreground/50">{contact.title}</p>}
                        {contact.phone && (
                          <a href={`tel:${contact.phone}`} className="text-sm text-primary flex items-center gap-1 mt-1 hover:underline" dir="ltr">
                            <Phone className="w-3 h-3" />
                            {contact.phone}
                          </a>
                        )}
                        {contact.email && (
                          <a href={`mailto:${contact.email}`} className="text-sm text-primary flex items-center gap-1 mt-1 hover:underline" dir="ltr">
                            {contact.email}
                          </a>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="products">
          <ProductsTab bankId={bank.id} products={bank.products || []} />
        </TabsContent>

        <TabsContent value="meetings">
          <MeetingsTab bankId={bank.id} meetings={bank.meetings || []} />
        </TabsContent>

        <TabsContent value="actions">
          <ActionsTab bankId={bank.id} actionItems={bank.actionItems || []} />
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsTab bankId={bank.id} documents={bank.documents || []} />
        </TabsContent>

        <TabsContent value="implementation">
          <ImplementationProgressTab bankId={bank.id} />
        </TabsContent>

        <TabsContent value="risks">
          <RisksTab bankId={bank.id} risks={bank.risks || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}


function ProductsTab({ bankId, products }: { bankId: string, products: any[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const handleSave = () => {
    if (createProduct.isPending || updateProduct.isPending) return;
    const payload = {
      bankId,
      productCode: editing.productCode,
      categoryStage: editing.categoryStage,
      status: editing.status,
      progressPercent: Number(editing.progressPercent) / 100,
      responsiblePerson: editing.responsiblePerson || undefined,
    };
    if (editing.id) {
      updateProduct.mutate({ id: editing.id, data: payload }, {
        onSuccess: () => {
          analytics.productUpdated({ bank_id: bankId, product_id: editing.id, product_code: payload.productCode });
          queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bankId) });
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          setIsOpen(false);
          toast({ title: 'Saved' });
        }
      });
    } else {
      createProduct.mutate({ data: payload }, {
        onSuccess: () => {
          analytics.productCreated({ bank_id: bankId, product_code: payload.productCode, category_stage: payload.categoryStage });
          queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bankId) });
          queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
          setIsOpen(false);
          toast({ title: 'Product Added' });
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">Associated Products</h3>
        <Button onClick={() => { setEditing({ progressPercent: 0 }); setIsOpen(true); }} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> Add Product
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map(p => (
          <Card key={p.id} className="bg-foreground/5 border-foreground/10 hover:border-foreground/20 transition-all" onClick={() => analytics.associatedProductViewed({ bank_id: bankId, product_id: p.id, product_code: p.productCode, category_stage: p.categoryStage })}>
            <CardContent className="p-5 flex flex-col h-full">
              <div className="flex justify-between items-start mb-3">
                <Badge variant="outline">{p.productCode}</Badge>
                <div className="flex gap-1">
                  <EntityAttachmentsButton entityType="product" entityId={p.id} label={p.productCode} />
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-foreground/50" onClick={() => { analytics.productOpened({ bank_id: bankId, product_id: p.id, product_code: p.productCode, category_stage: p.categoryStage }); setEditing({ ...p, progressPercent: p.progressPercent * 100 }); setIsOpen(true); }}><Edit className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-red-600 dark:text-red-400/50" onClick={() => {
                    if (confirm('Confirm deletion?')) {
                      deleteProduct.mutate({ id: p.id }, {
                        onSuccess: () => { analytics.productDeleted({ bank_id: bankId, product_id: p.id, product_code: p.productCode }); queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bankId) }); queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() }); toast({ title: 'Product archived' }); },
                        onError: (e: any) => toast({ title: 'Failed to delete product', description: e?.message, variant: 'destructive' }),
                      });
                    }
                  }}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
              <h4 className="font-bold text-lg mb-1">{p.categoryStage}</h4>
              <div className={`flex items-center gap-2 text-sm mb-4 font-medium ${getStatusColor(p.status).text}`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${getStatusColor(p.status).dot}`} />
                {p.status}
              </div>

              <div className="flex items-center gap-2 text-sm text-foreground/70 mb-4">
                <User className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate">{p.responsiblePerson || 'Unassigned'}</span>
              </div>

              <div className="mt-auto pt-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-foreground/60">Progress</span>
                  <span className="font-mono">{formatPercentage(p.progressPercent)}</span>
                </div>
                <div className="w-full bg-foreground/10 rounded-full h-2 overflow-hidden">
                  <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${p.progressPercent * 100}%` }} />
                </div>
              </div>

              <ProductStagesSection product={p} bankId={bankId} />
            </CardContent>
          </Card>
        ))}
        {products.length === 0 && <div className="col-span-full py-8 text-center text-foreground/30">No products recorded</div>}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent dir="ltr">
          <DialogHeader><DialogTitle>{editing?.id ? 'Edit Product' : 'Add Product'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Input placeholder="Product Code" value={editing?.productCode || ''} onChange={e => setEditing({...editing, productCode: e.target.value})} />
            <Input placeholder="Stage / Category" value={editing?.categoryStage || ''} onChange={e => setEditing({...editing, categoryStage: e.target.value})} />
            <Input placeholder="Status" value={editing?.status || ''} onChange={e => setEditing({...editing, status: e.target.value})} />
            <Input placeholder="Responsible Person" value={editing?.responsiblePerson || ''} onChange={e => setEditing({...editing, responsiblePerson: e.target.value})} />
            <p className="text-xs text-foreground/40">نسبة التقدم تُحسب تلقائياً من المراحل</p>
          </div>
          <DialogFooter><Button onClick={handleSave} disabled={createProduct.isPending || updateProduct.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MeetingsTab({ bankId, meetings }: { bankId: string, meetings: any[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createMeeting = useCreateMeeting();
  const deleteMeeting = useDeleteMeeting();

  const handleSave = () => {
    if (createMeeting.isPending) return;
    createMeeting.mutate({ data: { bankId, topic: editing.topic, date: editing.date, summary: editing.summary } }, {
      onSuccess: () => {
        analytics.meetingCreated({ bank_id: bankId, topic: editing.topic ?? '', date: editing.date ?? '' });
        queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bankId) });
        setIsOpen(false);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">Meeting Log</h3>
        <Button onClick={() => { setEditing({}); setIsOpen(true); }} size="sm" className="gap-2"><Plus className="w-4 h-4" /> New Meeting</Button>
      </div>
      <div className="space-y-4">
        {meetings.map(m => (
          <div key={m.id} className="p-4 rounded-xl bg-foreground/5 border border-foreground/10 flex flex-col md:flex-row gap-4 cursor-pointer" onClick={() => analytics.meetingOpened({ bank_id: bankId, meeting_id: m.id, topic: m.topic, date: m.date })}>
            <div className="md:w-48 shrink-0 text-foreground/60">
              {formatDate(m.date)}
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-lg">{m.topic}</h4>
              <p className="text-foreground/70 mt-1">{m.summary || 'No summary available'}</p>
              {m.updatedBy && (
                <p className="text-xs text-foreground/30 mt-2">Last updated by {m.updatedBy}{m.updatedAt ? ` — ${formatDateTime(m.updatedAt)}` : ''}</p>
              )}
            </div>
            <div className="flex items-start gap-1 shrink-0">
              <EntityAttachmentsButton entityType="meeting" entityId={m.id} label={m.topic} />
              <Button variant="ghost" size="icon" className="text-red-600 dark:text-red-400/50" onClick={(e) => { e.stopPropagation(); deleteMeeting.mutate({ id: m.id }, {
                onSuccess: () => { analytics.meetingDeleted({ bank_id: bankId, meeting_id: m.id, topic: m.topic }); queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bankId) }); toast({ title: 'Meeting archived' }); },
                onError: (err: any) => toast({ title: 'Failed to delete meeting', description: err?.message, variant: 'destructive' }),
              }); }}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent dir="ltr">
          <DialogHeader><DialogTitle>Add Meeting</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Input type="date" value={editing?.date || ''} onChange={e => setEditing({...editing, date: e.target.value})} />
            <Input placeholder="Topic" value={editing?.topic || ''} onChange={e => setEditing({...editing, topic: e.target.value})} />
            <Textarea placeholder="Summary" value={editing?.summary || ''} onChange={e => setEditing({...editing, summary: e.target.value})} />
          </div>
          <DialogFooter><Button onClick={handleSave} disabled={createMeeting.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActionsTab({ bankId, actionItems }: { bankId: string, actionItems: any[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createAction = useCreateActionItem();
  const updateAction = useUpdateActionItem();
  const deleteAction = useDeleteActionItem();

  const handleSave = () => {
    if (createAction.isPending || updateAction.isPending) return;
    const payload = { bankId, description: editing.description, owner: editing.owner, dueDate: editing.dueDate, status: editing.status || 'Pending' };
    if (editing.id) {
      updateAction.mutate({ id: editing.id, data: payload }, {
        onSuccess: () => {
          analytics.taskUpdated({ bank_id: bankId, task_id: editing.id, status: payload.status, description: payload.description });
          if (payload.status === 'Completed') {
            analytics.taskCompleted({ bank_id: bankId, task_id: editing.id, description: payload.description, owner: payload.owner });
          }
          queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bankId) });
          setIsOpen(false);
        },
      });
    } else {
      createAction.mutate({ data: payload }, {
        onSuccess: () => {
          analytics.taskCreated({ bank_id: bankId, description: payload.description, owner: payload.owner, due_date: payload.dueDate });
          queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bankId) });
          setIsOpen(false);
        },
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">Actions & Decisions</h3>
        <Button onClick={() => { setEditing({}); setIsOpen(true); }} size="sm" className="gap-2"><Plus className="w-4 h-4" /> New Action</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {actionItems.map(a => (
          <Card key={a.id} className="bg-foreground/5 border-foreground/10">
            <CardContent className="p-5">
              <div className="flex justify-between items-start mb-2">
                <Badge variant={a.status === 'Completed' ? 'success' : 'outline'}>{a.status}</Badge>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditing(a); setIsOpen(true); }}><Edit className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-red-600 dark:text-red-400/50" onClick={() => deleteAction.mutate({ id: a.id }, {
                    onSuccess: () => { analytics.taskDeleted({ bank_id: bankId, task_id: a.id }); queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bankId) }); toast({ title: 'Action archived' }); },
                    onError: (e: any) => toast({ title: 'Failed to delete action', description: e?.message, variant: 'destructive' }),
                  })}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
              <p className="text-lg mb-4">{a.description}</p>
              <div className="flex justify-between text-sm text-foreground/50">
                <span>{a.owner || 'Unassigned'}</span>
                <span>{formatDate(a.dueDate)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent dir="ltr">
          <DialogHeader><DialogTitle>{editing?.id ? 'Edit' : 'Add'} Action</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea placeholder="Description" value={editing?.description || ''} onChange={e => setEditing({...editing, description: e.target.value})} />
            <Input placeholder="Owner" value={editing?.owner || ''} onChange={e => setEditing({...editing, owner: e.target.value})} />
            <Input type="date" value={editing?.dueDate || ''} onChange={e => setEditing({...editing, dueDate: e.target.value})} />
            <select className="flex h-10 w-full rounded-md border border-foreground/10 bg-card px-3 py-2 text-sm text-foreground" value={editing?.status || ''} onChange={e => setEditing({...editing, status: e.target.value})}>
              <option value="Pending">Pending</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
          <DialogFooter><Button onClick={handleSave} disabled={createAction.isPending || updateAction.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RisksTab({ bankId, risks }: { bankId: string, risks: any[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createRisk = useCreateRisk();
  const deleteRisk = useDeleteRisk();

  const handleSave = () => {
    if (createRisk.isPending) return;
    createRisk.mutate({ data: { bankId, description: editing.description, level: editing.level || 'Medium', status: editing.status || 'Open' } }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bankId) }); setIsOpen(false); }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">Risk Register</h3>
        <Button onClick={() => { setEditing({}); setIsOpen(true); }} size="sm" className="gap-2"><Plus className="w-4 h-4" /> New Risk</Button>
      </div>
      <div className="space-y-4">
        {risks.map(r => (
          <div key={r.id} className="p-4 rounded-xl bg-foreground/5 border border-foreground/10 flex justify-between items-center">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Badge variant={r.level === 'High' ? 'destructive' : r.level === 'Medium' ? 'warning' : 'success'}>{r.level}</Badge>
                <span className="text-sm text-foreground/50">{r.status}</span>
              </div>
              <p className="text-lg">{r.description}</p>
            </div>
            <Button variant="ghost" size="icon" className="text-red-600 dark:text-red-400/50" onClick={() => deleteRisk.mutate({ id: r.id }, {
              onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bankId) }); toast({ title: 'Risk archived' }); },
              onError: (e: any) => toast({ title: 'Failed to delete risk', description: e?.message, variant: 'destructive' }),
            })}><Trash2 className="w-4 h-4" /></Button>
          </div>
        ))}
      </div>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent dir="ltr">
          <DialogHeader><DialogTitle>Add Risk</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea placeholder="Description" value={editing?.description || ''} onChange={e => setEditing({...editing, description: e.target.value})} />
            <select className="flex h-10 w-full rounded-md border border-foreground/10 bg-card px-3 py-2 text-sm text-foreground" value={editing?.level || 'Medium'} onChange={e => setEditing({...editing, level: e.target.value})}>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>
          <DialogFooter><Button onClick={handleSave} disabled={createRisk.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DocumentsTab({ bankId, documents }: { bankId: string, documents: any[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [uploadFile, setUploadFile] = useState<{ name: string, title: string, docType: string, dataUrl: string } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createDoc = useCreateDocument();
  const uploadDoc = useUploadDocument();
  const deleteDoc = useDeleteDocument();

  const handleSave = () => {
    if (createDoc.isPending) return;
    createDoc.mutate({ data: { bankId, title: editing.title, link: editing.link, docType: editing.docType } }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bankId) }); setIsOpen(false); }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadFile({ name: file.name, title: file.name, docType: '', dataUrl: event.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = () => {
    if (!uploadFile) return;
    uploadDoc.mutate({ data: { bankId, title: uploadFile.title, fileName: uploadFile.name, docType: uploadFile.docType, fileDataBase64: uploadFile.dataUrl } }, {
      onSuccess: () => {
        analytics.documentUploaded({ bank_id: bankId, file_name: uploadFile.name, doc_type: uploadFile.docType });
        queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bankId) });
        setUploadFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        toast({ title: 'Upload Successful', description: 'The document has been uploaded successfully.' });
      },
      onError: (err: any) => {
        toast({ title: 'Upload Failed', description: err?.message || 'Failed to upload the document.', variant: 'destructive' });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">Documents & Links</h3>
        <div className="flex gap-2">
          <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
          <Button variant="outline" size="sm" className="gap-2" onClick={() => fileInputRef.current?.click()}>
            <UploadCloud className="w-4 h-4" /> Upload File
          </Button>
          <Button onClick={() => { setEditing({}); setIsOpen(true); }} size="sm" className="gap-2">
            <Plus className="w-4 h-4" /> New Link
          </Button>
        </div>
      </div>

      {uploadFile && (
        <div className="p-4 rounded-xl bg-foreground/5 border border-primary/30 flex flex-col gap-3">
          <span className="text-sm text-foreground/70 shrink-0">File: {uploadFile.name}</span>
          {uploadDoc.isPending && (
            <div className="w-full h-1 rounded-full overflow-hidden bg-primary/20">
              <div className="h-full bg-primary rounded-full animate-pulse w-2/3" />
            </div>
          )}
          <div className="flex flex-col md:flex-row gap-3 md:items-center">
            <Input placeholder="Document Title" value={uploadFile.title} onChange={e => setUploadFile({ ...uploadFile, title: e.target.value })} className="max-w-xs" />
            <Input placeholder="Document Type (Contract, Report...)" value={uploadFile.docType} onChange={e => setUploadFile({ ...uploadFile, docType: e.target.value })} className="max-w-xs" />
            <div className="flex gap-2 md:ml-auto">
              <Button size="sm" onClick={handleUpload} disabled={uploadDoc.isPending}>{uploadDoc.isPending ? 'Uploading...' : 'Confirm Upload'}</Button>
              <Button size="sm" variant="ghost" onClick={() => { setUploadFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {documents.map(d => (
          <Card key={d.id} className="bg-foreground/5 border-foreground/10 hover:border-foreground/20 transition-all cursor-pointer" onClick={() => { const url = (d as any).fileUrl || d.oneDriveWebUrl || d.link; if (url) { analytics.documentDownloaded({ doc_id: d.id, bank_id: bankId, file_name: d.title, doc_type: d.docType ?? undefined, source: 'bank_documents' }); window.open(url, '_blank'); } }}>
            <CardContent className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-8 h-8 text-primary/70 shrink-0" />
                <div className="min-w-0">
                  <h4 className="font-bold truncate">{d.title}</h4>
                  <p className="text-sm text-foreground/50">{d.docType}</p>
                  {(d.uploadedBy || d.updatedBy) && (
                    <p className="text-xs text-foreground/30 mt-1">
                      {(d as any).fileUrl || d.oneDriveItemId ? 'Uploaded by' : 'Added by'} {d.uploadedBy || d.updatedBy}
                    </p>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="text-red-600 dark:text-red-400/50 shrink-0" onClick={(e) => { e.stopPropagation(); deleteDoc.mutate({ id: d.id }, {
                onSuccess: () => { analytics.documentDeleted({ doc_id: d.id, bank_id: bankId }); queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bankId) }); toast({ title: 'Document archived' }); },
                onError: (err: any) => toast({ title: 'Failed to delete document', description: err?.message, variant: 'destructive' }),
              }); }}><Trash2 className="w-4 h-4" /></Button>
            </CardContent>
          </Card>
        ))}
        {documents.length === 0 && <div className="col-span-full py-8 text-center text-foreground/30">No documents recorded</div>}
      </div>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent dir="ltr">
          <DialogHeader><DialogTitle>Add Document / Link</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Input placeholder="Document Title" value={editing?.title || ''} onChange={e => setEditing({...editing, title: e.target.value})} />
            <Input placeholder="URL" value={editing?.link || ''} onChange={e => setEditing({...editing, link: e.target.value})} />
            <Input placeholder="Document Type (Contract, Report...)" value={editing?.docType || ''} onChange={e => setEditing({...editing, docType: e.target.value})} />
          </div>
          <DialogFooter><Button onClick={handleSave} disabled={createDoc.isPending}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Implementation v2 — status config ────────────────────────────────────

const STATUS_CONFIG_V2 = {
  not_started: { label: 'Not Started', color: 'text-foreground/40', ring: 'border-foreground/20', rowBg: 'bg-foreground/5 border-foreground/10' },
  in_progress:  { label: 'In Progress', color: 'text-blue-500',      ring: 'border-blue-400',      rowBg: 'bg-blue-500/5 border-blue-500/20' },
  completed:    { label: 'Completed',   color: 'text-emerald-500',   ring: 'border-emerald-400',   rowBg: 'bg-emerald-500/5 border-emerald-500/20' },
  blocked:      { label: 'Blocked',     color: 'text-red-500',       ring: 'border-red-400',       rowBg: 'bg-red-500/5 border-red-500/20' },
  skipped:      { label: 'Skipped',     color: 'text-foreground/25', ring: 'border-foreground/10', rowBg: 'bg-foreground/3 border-foreground/5' },
} as const;

type StatusKey = keyof typeof STATUS_CONFIG_V2;

// ── Sub-stages panel ──────────────────────────────────────────────────────

function SubStagesPanel({ stageId }: { stageId: number }) {
  const { data: subs, isLoading } = useGetSubStagesV2(stageId);
  const addSub = useAddSubStageV2();
  const patchSub = usePatchSubStageV2();
  const deleteSub = useDeleteSubStageV2();
  const [newName, setNewName] = useState('');
  const { toast } = useToast();

  if (isLoading) return <div className="py-2 text-xs text-foreground/30 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</div>;

  const items = subs ?? [];
  return (
    <div className="mt-3 space-y-1.5">
      {items.map((sub) => (
        <div key={sub.id} className={cn('flex items-center gap-2 rounded-xl px-3 py-1.5 border text-xs', sub.skipped ? 'border-foreground/5 bg-foreground/3 opacity-50' : sub.completed ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-foreground/10 bg-foreground/5')}>
          <input
            type="checkbox"
            checked={sub.completed}
            className="w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer"
            onChange={(e) => {
              const checked = e.target.checked;
              patchSub.mutate({ subStageId: sub.id, stageId, data: { completed: checked, status: checked ? 'completed' : 'not_started' } }, {
                onError: () => toast({ title: 'Failed to save', variant: 'destructive' }),
              });
            }}
          />
          <span className={cn('flex-1', sub.skipped ? 'line-through text-foreground/30' : sub.completed ? 'text-foreground/60' : '')}>{sub.name}</span>
          <button
            onClick={() => deleteSub.mutate({ subStageId: sub.id, stageId }, { onError: () => toast({ title: 'Failed to delete', variant: 'destructive' }) })}
            className="text-foreground/20 hover:text-red-500 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      <div className="flex gap-1.5 mt-1">
        <Input
          placeholder="Add sub-stage…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="h-7 text-xs bg-background/50 border-foreground/10 rounded-lg"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newName.trim()) {
              addSub.mutate({ stageId, name: newName.trim() }, {
                onSuccess: () => setNewName(''),
                onError: () => toast({ title: 'Failed to add sub-stage', variant: 'destructive' }),
              });
            }
          }}
        />
        <Button
          variant="ghost" size="sm"
          disabled={!newName.trim() || addSub.isPending}
          className="h-7 px-2 text-xs shrink-0"
          onClick={() => {
            if (!newName.trim()) return;
            addSub.mutate({ stageId, name: newName.trim() }, {
              onSuccess: () => setNewName(''),
              onError: () => toast({ title: 'Failed to add sub-stage', variant: 'destructive' }),
            });
          }}
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

// ── Sortable stage row (v2) ───────────────────────────────────────────────

interface StageRowV2Props {
  stage: StageV2;
  index: number;
  isUpdating: boolean;
  onPatch: (stageId: number, data: PatchStageBodyV2) => void;
  onDelete: (stageId: number) => void;
}

const SortableStageRowV2 = React.memo(function SortableStageRowV2({ stage: s, index, isUpdating, onPatch, onDelete }: StageRowV2Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: s.id });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 20 : 1 };

  const [notesOpen, setNotesOpen] = useState(false);
  const [subsOpen, setSubsOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const renameRef = useRef<HTMLInputElement>(null);
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const cfgKey = (s.skipped ? 'skipped' : s.status) as StatusKey;
  const cfg = STATUS_CONFIG_V2[cfgKey] ?? STATUS_CONFIG_V2.not_started;

  const debounce = (key: string, fn: () => void, ms = 500) => {
    const t = debounceTimers.current.get(key);
    if (t) clearTimeout(t);
    debounceTimers.current.set(key, setTimeout(() => { fn(); debounceTimers.current.delete(key); }, ms));
  };

  const statusButton = (label: string, status: string, icon: React.ReactNode, activeColor: string) => (
    <button
      key={status}
      disabled={isUpdating || s.skipped}
      onClick={() => {
        const data: PatchStageBodyV2 = { status, skipped: false };
        if (status === 'completed') { data.completed = true; data.completedAt = data.completedAt ?? new Date().toISOString().split('T')[0]; }
        else data.completed = false;
        onPatch(s.id, data);
      }}
      className={cn(
        'flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium border transition-all shrink-0',
        (s.status === status && !s.skipped) ? `${activeColor} border-current/30 shadow-sm` : 'border-foreground/10 text-foreground/40 hover:text-foreground hover:border-foreground/20',
        'disabled:opacity-40 disabled:cursor-not-allowed',
      )}
    >
      {icon}{label}
    </button>
  );

  return (
    <div ref={setNodeRef} style={style} className={cn('rounded-2xl border p-4 transition-all', cfg.rowBg, s.skipped ? 'opacity-60' : '')}>
      <div className="flex flex-col gap-3">
        {/* Top row: drag handle + index + name + badges + delete */}
        <div className="flex items-start gap-2">
          <button {...listeners} {...attributes} className="mt-1 cursor-grab active:cursor-grabbing p-0.5 text-foreground/25 hover:text-foreground/60 shrink-0">
            <GripVertical className="w-4 h-4" />
          </button>

          <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 shrink-0 mt-0.5', cfg.ring, s.completed ? 'bg-emerald-500/20' : 'bg-foreground/5')}>
            {s.completed && !s.skipped ? <span className="text-emerald-500">✓</span> : <span className={cfg.color}>{index + 1}</span>}
          </div>

          {/* Name — click to rename */}
          <div className="flex-1 min-w-0">
            {renaming ? (
              <input
                ref={renameRef}
                defaultValue={s.name}
                autoFocus
                className="w-full text-sm font-semibold bg-background/70 border border-primary/30 rounded-lg px-2 py-0.5 focus:outline-none"
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.name) onPatch(s.id, { name: v }); setRenaming(false); }}
                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setRenaming(false); }}
              />
            ) : (
              <button onClick={() => setRenaming(true)} className="text-left group/rename w-full">
                <p className={cn('font-semibold text-sm leading-tight flex items-center gap-1.5', s.skipped ? 'line-through text-foreground/30' : '')}>
                  {s.name}
                  <Pencil className="w-3 h-3 opacity-0 group-hover/rename:opacity-40 transition-opacity" />
                </p>
              </button>
            )}
            {s.daysInProgress !== null && s.daysInProgress > 0 && !s.skipped && (
              <p className="text-[11px] text-blue-400 flex items-center gap-0.5 mt-0.5">
                <Clock className="w-2.5 h-2.5" />{s.daysInProgress}d in progress
              </p>
            )}
          </div>

          {/* Badges */}
          <div className="flex items-center gap-1.5 shrink-0">
            {s.skipped && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-foreground/10 text-foreground/40 border border-foreground/15">Skipped</span>}
            {s.percentage > 0 && !s.skipped && (
              <span className="text-[10px] font-mono text-foreground/30">{Math.round(s.percentage)}%</span>
            )}
            {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary/60" />}
          </div>

          {/* Delete */}
          <button
            onClick={() => onDelete(s.id)}
            disabled={isUpdating}
            className="p-1 text-foreground/20 hover:text-red-500 transition-colors shrink-0 disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Status buttons row */}
        <div className="flex flex-wrap gap-1.5 pl-10">
          {statusButton('Not Started', 'not_started', <Circle className="w-3 h-3" />, 'text-foreground/50')}
          {statusButton('In Progress', 'in_progress', <Loader2 className={cn('w-3 h-3', s.status === 'in_progress' && !s.skipped ? 'animate-spin' : '')} />, 'text-blue-500')}
          {statusButton('Completed',   'completed',   <CheckCircle2 className="w-3 h-3" />, 'text-emerald-500')}
          {statusButton('Blocked',     'blocked',     <Ban className="w-3 h-3" />, 'text-red-500')}

          {/* Skip / Restore toggle */}
          {s.skipped ? (
            <button
              disabled={isUpdating}
              onClick={() => onPatch(s.id, { skipped: false, status: 'not_started' })}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium border text-amber-500 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 transition-all disabled:opacity-40"
            >
              <RotateCcw className="w-3 h-3" />Restore
            </button>
          ) : (
            <button
              disabled={isUpdating}
              onClick={() => {
                onPatch(s.id, { skipped: true, status: 'skipped', completed: false });
                analytics.stageSkipped({ bank_id: s.bankId, stage_id: s.id, stage_name: s.name });
              }}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium border text-foreground/40 border-foreground/10 hover:text-foreground/60 hover:border-foreground/20 transition-all disabled:opacity-40"
            >
              <SkipForward className="w-3 h-3" />Skip
            </button>
          )}
        </div>

        {/* Date + Owner row */}
        <div className="flex flex-wrap gap-2 pl-10">
          <Input
            type="date"
            defaultValue={s.completedAt ?? ''}
            key={`date-${s.id}-${s.completedAt}`}
            disabled={isUpdating || s.skipped}
            className="h-8 text-xs bg-background/50 border-foreground/10 rounded-lg w-36 disabled:opacity-50"
            onBlur={(e) => { const v = e.target.value || null; if (v !== (s.completedAt ?? null)) onPatch(s.id, { completedAt: v }); }}
          />
          <Input
            key={`owner-${s.id}-${s.updatedAt}`}
            placeholder="Owner / responsible…"
            defaultValue={s.owner ?? ''}
            disabled={isUpdating || s.skipped}
            className="h-8 text-xs bg-background/50 border-foreground/10 rounded-lg flex-1 min-w-[140px] disabled:opacity-50"
            onBlur={(e) => { const v = e.target.value || null; if (v !== (s.owner ?? null)) debounce(`owner-${s.id}`, () => onPatch(s.id, { owner: v })); }}
          />

          {/* Notes toggle */}
          <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs text-foreground/40 shrink-0" onClick={() => setNotesOpen(p => !p)}>
            <FileText className="w-3 h-3 mr-1" />{notesOpen ? 'Hide' : 'Notes'}
            {s.notes ? <span className="ml-1 w-1.5 h-1.5 rounded-full bg-primary/60 inline-block" /> : null}
          </Button>
          {/* Sub-stages toggle */}
          <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs text-foreground/40 shrink-0" onClick={() => setSubsOpen(p => !p)}>
            <CheckSquare className="w-3 h-3 mr-1" />Sub-stages
            {subsOpen ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
          </Button>
        </div>

        {/* Notes */}
        {notesOpen && (
          <div className="pt-2 pl-10 border-t border-foreground/10">
            <Textarea
              key={`notes-${s.id}-${s.updatedAt}`}
              placeholder="Add notes…"
              defaultValue={s.notes ?? ''}
              disabled={s.skipped}
              className="text-sm bg-background/50 border-foreground/10 rounded-xl min-h-[80px] resize-none disabled:opacity-50"
              onBlur={(e) => { const v = e.target.value || null; if (v !== (s.notes ?? null)) debounce(`notes-${s.id}`, () => onPatch(s.id, { notes: v })); }}
            />
          </div>
        )}

        {/* Sub-stages */}
        {subsOpen && (
          <div className="pl-10">
            <SubStagesPanel stageId={s.id} />
          </div>
        )}
      </div>
    </div>
  );
});

// ── ImplementationProgressTab (v2) ────────────────────────────────────────

function ImplementationProgressTab({ bankId }: { bankId: string }) {
  const { toast } = useToast();
  const { data, isLoading } = useGetBankStagesV2(bankId);
  const patchStage = usePatchStageV2(bankId);
  const addStage = useAddStageV2(bankId);
  const deleteStage = useDeleteStageV2(bankId);
  const reorderStages = useReorderStagesV2(bankId);

  const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set());
  const [newStageName, setNewStageName] = useState('');
  const [addingStage, setAddingStage] = useState(false);

  // Optimistic list order for DnD
  const [localOrder, setLocalOrder] = useState<number[] | null>(null);

  const stages: StageV2[] = data?.stages ?? [];
  // Merge server order with local override (for smooth DnD)
  const displayStages = localOrder
    ? localOrder.map(id => stages.find(s => s.id === id)).filter(Boolean) as StageV2[]
    : stages;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = displayStages.map(s => s.id);
    const oldIdx = ids.indexOf(Number(active.id));
    const newIdx = ids.indexOf(Number(over.id));
    if (oldIdx === -1 || newIdx === -1) return;
    const newOrder = arrayMove(ids, oldIdx, newIdx);
    setLocalOrder(newOrder);
    reorderStages.mutate({ orderedIds: newOrder }, {
      onSuccess: () => {
        setLocalOrder(null);
        analytics.stageReordered({ bank_id: bankId, stage_count: newOrder.length });
      },
      onError: (err: any) => {
        // Roll back to server order
        setLocalOrder(null);
        toast({
          title: 'Failed to reorder stages',
          description: err?.message || 'The order was not saved. Your original order has been restored.',
          variant: 'destructive',
        });
      },
    });
  }, [displayStages, reorderStages, bankId, toast]);

  const handlePatch = useCallback((stageId: number, patch: PatchStageBodyV2) => {
    setUpdatingIds(prev => new Set([...prev, stageId]));
    const stageName = stages.find(x => x.id === stageId)?.name ?? 'stage';
    patchStage.mutate({ stageId, data: patch }, {
      onSuccess: () => setUpdatingIds(prev => { const n = new Set(prev); n.delete(stageId); return n; }),
      onError: (err: any) => {
        setUpdatingIds(prev => { const n = new Set(prev); n.delete(stageId); return n; });
        toast({
          title: `Could not save "${stageName}"`,
          description: err?.message || 'The server rejected the change. Your edit was not applied — please try again.',
          variant: 'destructive',
        });
      },
    });
  }, [patchStage, stages, toast]);

  const handleDelete = useCallback((stageId: number) => {
    const s = stages.find(x => x.id === stageId);

    // Guard: block deleting the only remaining non-skipped stage so banks
    // never end up with an all-skipped (or empty) implementation plan.
    const activeStages = stages.filter(x => !x.skipped);
    if (activeStages.length === 1 && activeStages[0].id === stageId) {
      toast({
        title: 'Cannot delete the last active stage',
        description: 'At least one non-skipped stage must remain. Mark this stage as "Skipped" instead, or add another stage first.',
        variant: 'destructive',
      });
      return;
    }

    setUpdatingIds(prev => new Set([...prev, stageId]));
    deleteStage.mutate({ stageId }, {
      onSuccess: () => {
        setUpdatingIds(prev => { const n = new Set(prev); n.delete(stageId); return n; });
        toast({ title: 'Stage deleted' });
        if (s) analytics.stageDeleted({ bank_id: bankId, stage_id: stageId, stage_name: s.name });
      },
      onError: (err: any) => {
        setUpdatingIds(prev => { const n = new Set(prev); n.delete(stageId); return n; });
        toast({
          title: `Could not delete "${s?.name ?? 'stage'}"`,
          description: err?.message || 'The server could not complete the deletion. Please try again.',
          variant: 'destructive',
        });
      },
    });
  }, [deleteStage, stages, bankId, toast]);

  const handleAddStage = () => {
    const name = newStageName.trim();
    if (!name) return;
    addStage.mutate({ name }, {
      onSuccess: () => {
        setNewStageName('');
        setAddingStage(false);
        toast({ title: 'Stage added' });
        analytics.stageAdded({ bank_id: bankId, stage_name: name });
      },
      onError: () => toast({ title: 'Failed to add stage', variant: 'destructive' }),
    });
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-16 gap-3 text-foreground/40">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span>Loading implementation progress…</span>
    </div>
  );

  const pct = data?.completionPercentage ?? 0;
  const completedCount = data?.completedStages ?? 0;
  const totalCount = data?.totalStages ?? 0;
  const skippedCount = data?.skippedStages ?? 0;
  const remaining = data?.remainingStages ?? 0;
  const currentStageName = data?.currentStageName ?? null;
  const isBlocked = data?.isBlocked ?? false;
  const percentageMode = data?.percentageMode ?? 'dynamic';
  const progressColor = pct === 100 ? 'bg-emerald-500' : isBlocked ? 'bg-red-500' : pct >= 75 ? 'bg-blue-500' : pct >= 50 ? 'bg-yellow-500' : pct >= 25 ? 'bg-orange-500' : 'bg-foreground/30';

  return (
    <div className="space-y-8">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Completion */}
        <div className="col-span-2 p-5 rounded-2xl bg-foreground/5 border border-foreground/10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground/50 font-medium">Overall Completion</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-foreground/15 text-foreground/40 uppercase tracking-widest">
                {percentageMode}
              </span>
              <span className="text-2xl font-mono font-bold">{Math.round(pct)}%</span>
            </div>
          </div>
          <div className="w-full h-3 rounded-full bg-foreground/10 overflow-hidden">
            <div className={cn('h-full rounded-full transition-all duration-700', progressColor)} style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs text-foreground/40">
            <span>{completedCount}/{totalCount} stages completed</span>
            {skippedCount > 0 && <span className="text-foreground/30">{skippedCount} skipped</span>}
            <span>{remaining} remaining</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-foreground/5 border border-foreground/10 flex flex-col justify-center gap-1">
          <span className="text-xs text-foreground/40 uppercase tracking-widest font-semibold">Current Stage</span>
          <span className="font-semibold text-sm leading-snug">
            {isBlocked ? <span className="text-red-400">⛔ Blocked</span> : currentStageName ?? (pct === 100 ? '✓ All Complete' : 'Not Started')}
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-foreground/5 border border-foreground/10 flex flex-col justify-center gap-1">
          <span className="text-xs text-foreground/40 uppercase tracking-widest font-semibold">Remaining</span>
          <span className="font-mono text-2xl font-bold">{remaining}</span>
          {skippedCount > 0 && <span className="text-xs text-foreground/30">{skippedCount} skipped</span>}
        </div>
      </div>

      {/* Timeline strip */}
      <div className="p-5 rounded-2xl bg-foreground/5 border border-foreground/10 overflow-x-auto">
        <p className="text-xs text-foreground/40 uppercase tracking-widest font-semibold mb-4">Implementation Timeline</p>
        <div className="flex items-center min-w-max gap-0">
          {displayStages.map((s, idx) => {
            const cfgKey = (s.skipped ? 'skipped' : s.status) as StatusKey;
            const cfg = STATUS_CONFIG_V2[cfgKey] ?? STATUS_CONFIG_V2.not_started;
            return (
              <React.Fragment key={s.id}>
                <div className="flex flex-col items-center gap-2 w-[100px]">
                  <div className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center border-2 text-xs font-bold transition-all',
                    s.status === 'in_progress' && !s.skipped ? 'scale-110 shadow-[0_0_12px_0_rgba(59,130,246,0.5)]' : '',
                    cfg.ring,
                    s.skipped ? 'bg-foreground/5' : s.completed ? 'bg-emerald-500/20' : s.status === 'in_progress' ? 'bg-blue-500/20' : s.status === 'blocked' ? 'bg-red-500/20' : 'bg-foreground/5',
                  )}>
                    {s.skipped ? <SkipForward className="w-3.5 h-3.5 text-foreground/25" /> : s.completed ? <span className="text-emerald-500">✓</span> : <span className={cfg.color}>{idx + 1}</span>}
                  </div>
                  <div className="text-center">
                    <p className={cn('text-[10px] font-semibold leading-tight text-center max-w-[90px]', cfg.color, s.skipped ? 'line-through' : '')}>{s.name}</p>
                    {s.completedAt && !s.skipped && <p className="text-[9px] text-foreground/30 mt-0.5">{s.completedAt}</p>}
                  </div>
                </div>
                {idx < displayStages.length - 1 && (
                  <div className={cn('flex-1 h-0.5 min-w-[12px] transition-all', s.completed && !s.skipped ? 'bg-emerald-500/60' : s.skipped ? 'bg-foreground/5' : 'bg-foreground/10')} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* DnD stage list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-foreground/40 uppercase tracking-widest font-semibold">Stage Details</p>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-3 text-xs"
            onClick={() => setAddingStage(true)}
          >
            <Plus className="w-3 h-3 mr-1" /> Add Stage
          </Button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={displayStages.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {displayStages.map((s, idx) => (
                <SortableStageRowV2
                  key={s.id}
                  stage={s}
                  index={idx}
                  isUpdating={updatingIds.has(s.id)}
                  onPatch={handlePatch}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Add stage inline form */}
        {addingStage && (
          <div className="flex gap-2 p-3 rounded-2xl border border-primary/20 bg-primary/5">
            <Input
              autoFocus
              placeholder="New stage name…"
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
              className="h-9 text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddStage(); if (e.key === 'Escape') { setAddingStage(false); setNewStageName(''); } }}
            />
            <Button size="sm" className="h-9 shrink-0" disabled={!newStageName.trim() || addStage.isPending} onClick={handleAddStage}>
              {addStage.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
            </Button>
            <Button size="sm" variant="ghost" className="h-9 shrink-0" onClick={() => { setAddingStage(false); setNewStageName(''); }}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
