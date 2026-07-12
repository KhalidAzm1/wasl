import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'wouter';
import { BankLogo } from '@/components/BankLogo';
import { NavControls } from '@/components/NavControls';
import { 
  useGetBank, 
  useCreateProduct, useUpdateProduct, useDeleteProduct,
  useCreateMeeting, useUpdateMeeting, useDeleteMeeting,
  useCreateRisk, useUpdateRisk, useDeleteRisk,
  useCreateActionItem, useUpdateActionItem, useDeleteActionItem,
  useCreateDocument, useUploadDocument, useDeleteDocument,
  useListDocuments, getGetBankQueryKey, getListDocumentsQueryKey, getListProductsQueryKey
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { formatDate, formatDateTime, formatPercentage, getStatusColor } from '@/lib/utils';
import { analytics } from '@/lib/analytics';
import { 
  ChevronRight, Building2, LayoutGrid, Calendar, AlertTriangle, 
  CheckSquare, FileText, Plus, Trash2, Edit, ExternalLink, Phone, User, UploadCloud, Paperclip
} from 'lucide-react';

// Generic attachment button + dialog for entities other than banks (products,
// meetings). Mirrors the bank Documents tab but scoped to a single
// entityType/entityId pair, since products/meetings don't have their own tab.
function EntityAttachmentsButton({ entityType, entityId, label }: { entityType: 'product' | 'meeting', entityId: number, label: string }) {
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
  const { data: bank, isLoading } = useGetBank(id!, { query: { enabled: !!id, queryKey: getGetBankQueryKey(id!) } });

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

  const avgProgress = bank.products?.length 
    ? bank.products.reduce((acc, p) => acc + p.progressPercent, 0) / bank.products.length 
    : 0;

  return (
    <div className="p-8 pb-24 max-w-7xl mx-auto w-full space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-4 text-foreground/50 text-sm">
          <Link href="/portfolio" className="hover:text-foreground transition-colors">Portfolio</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-foreground">{bank.nameAr}</span>
        </div>
        <NavControls />
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
            {bank.riskLevel === 'High' && <Badge variant="destructive">High Risk</Badge>}
            {bank.priorityImpact === 'HOT' && <Badge variant="warning">Top Priority</Badge>}
          </div>
          <p className="text-foreground/50 text-lg">{bank.nameEn}</p>
        </div>

        <div className="flex gap-6 text-center shrink-0">
          <div className="px-6 py-3 rounded-xl bg-foreground/5 border border-foreground/10 backdrop-blur-md">
            <p className="text-foreground/40 text-sm mb-1">Completion</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">{formatPercentage(avgProgress)}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
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
          <TabsTrigger value="risks" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 px-6 text-lg gap-2">
            <AlertTriangle className="w-4 h-4" /> Risks
          </TabsTrigger>
          <TabsTrigger value="documents" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 px-6 text-lg gap-2">
            <FileText className="w-4 h-4" /> Documents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Executive Summary</CardTitle>
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

        <TabsContent value="risks">
          <RisksTab bankId={bank.id} risks={bank.risks || []} />
        </TabsContent>

        <TabsContent value="documents">
          <DocumentsTab bankId={bank.id} documents={bank.documents || []} />
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
          <Card key={p.id} className="bg-foreground/5 border-foreground/10 hover:border-foreground/20 transition-all">
            <CardContent className="p-5 flex flex-col h-full">
              <div className="flex justify-between items-start mb-3">
                <Badge variant="outline">{p.productCode}</Badge>
                <div className="flex gap-1">
                  <EntityAttachmentsButton entityType="product" entityId={p.id} label={p.productCode} />
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-foreground/50" onClick={() => { setEditing({ ...p, progressPercent: p.progressPercent * 100 }); setIsOpen(true); }}><Edit className="w-3 h-3" /></Button>
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
            <Input type="number" placeholder="Progress % (0-100)" value={editing?.progressPercent || 0} onChange={e => setEditing({...editing, progressPercent: e.target.value})} />
            <Input placeholder="Responsible Person" value={editing?.responsiblePerson || ''} onChange={e => setEditing({...editing, responsiblePerson: e.target.value})} />
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
          <div key={m.id} className="p-4 rounded-xl bg-foreground/5 border border-foreground/10 flex flex-col md:flex-row gap-4">
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
              <Button variant="ghost" size="icon" className="text-red-600 dark:text-red-400/50" onClick={() => deleteMeeting.mutate({ id: m.id }, {
                onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bankId) }); toast({ title: 'Meeting archived' }); },
                onError: (e: any) => toast({ title: 'Failed to delete meeting', description: e?.message, variant: 'destructive' }),
              })}>
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
      updateAction.mutate({ id: editing.id, data: payload }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bankId) }); setIsOpen(false); } });
    } else {
      createAction.mutate({ data: payload }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bankId) }); setIsOpen(false); } });
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
                    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bankId) }); toast({ title: 'Action archived' }); },
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
          <Card key={d.id} className="bg-foreground/5 border-foreground/10 hover:border-foreground/20 transition-all cursor-pointer" onClick={() => { const url = (d as any).fileUrl || d.oneDriveWebUrl || d.link; if (url) window.open(url, '_blank'); }}>
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
