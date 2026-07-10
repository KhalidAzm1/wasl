import React, { useRef, useState } from 'react';
import { BankLogo } from '@/components/BankLogo';
import { NavControls } from '@/components/NavControls';
import { 
  useListBanks, 
  useCreateBank, 
  useUpdateBank, 
  useDeleteBank, 
  useSetBankLogo, 
  useSetBankHeroImage, 
  getListBanksQueryKey,
  getGetBankQueryKey,
  useListProductTypes,
  useCreateProductType,
  useUpdateProductType,
  useDeactivateProductType,
  getListProductTypesQueryKey,
  useListAuditLogs,
  useGetArchive,
  useRestoreBank,
  useRestoreDocument,
  useRestoreMeeting,
  getGetArchiveQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Building2, Image as ImageIcon, Trash2, Edit, Plus, Save, UploadCloud, History, Archive, ScrollText, RotateCcw, Tag, ChevronDown } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { useAuth } from '@/lib/authContext';
import type { Bank } from '@workspace/api-client-react';

export default function Settings() {
  return (
    <div className="p-8 pb-24 max-w-7xl mx-auto w-full space-y-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-l from-white to-white/60 mb-2">
            System Settings
          </h1>
          <p className="text-white/50 text-lg">Manage banks and images</p>
        </div>
        <NavControls />
      </header>

      <Tabs defaultValue="banks" className="w-full">
        <TabsList className="w-full justify-start border-b border-white/10 bg-transparent rounded-none p-0 h-auto mb-8 overflow-x-auto hide-scrollbar">
          <TabsTrigger value="banks" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 px-6 text-lg">Banks &amp; Financing Entities</TabsTrigger>
          <TabsTrigger value="productTypes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 px-6 text-lg gap-2"><Tag className="w-4 h-4" /> Product Types</TabsTrigger>
          <TabsTrigger value="updates" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 px-6 text-lg gap-2"><ScrollText className="w-4 h-4" /> Recent Updates</TabsTrigger>
          <TabsTrigger value="archive" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 px-6 text-lg gap-2"><Archive className="w-4 h-4" /> Archive</TabsTrigger>
        </TabsList>

        <TabsContent value="banks">
          <BanksManager />
        </TabsContent>

        <TabsContent value="productTypes">
          <ProductTypesManager />
        </TabsContent>

        <TabsContent value="updates">
          <RecentUpdates />
        </TabsContent>

        <TabsContent value="archive">
          <ArchiveManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BanksManager() {
  const { data: banks, isLoading } = useListBanks();
  const { data: productTypes } = useListProductTypes();
  const [editingBank, setEditingBank] = useState<Partial<Bank> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createBank = useCreateBank();
  const updateBank = useUpdateBank();
  const deleteBank = useDeleteBank();

  const handleSave = () => {
    if (!editingBank?.nameEn || !editingBank?.nameAr || !editingBank?.category || !editingBank?.status) {
      toast({ title: 'Validation Error', description: 'Please fill in the required fields (name, category, status)', variant: 'destructive' });
      return;
    }

    const payload = {
      nameEn: editingBank.nameEn,
      nameAr: editingBank.nameAr,
      category: editingBank.category,
      status: editingBank.status,
      riskLevel: editingBank.riskLevel || 'Low',
      priorityImpact: editingBank.priorityImpact || 'Unclassified',
      productTypeIds: editingBank.productTypeIds || [],
      responsiblePerson: editingBank.responsiblePerson?.trim() ? editingBank.responsiblePerson : null,
      relationshipManager: editingBank.relationshipManager?.trim() ? editingBank.relationshipManager : null,
      email: editingBank.email?.trim() ? editingBank.email : null,
      website: editingBank.website?.trim() ? editingBank.website : null,
      executiveSummary: editingBank.executiveSummary || undefined,
      descriptionNotes: editingBank.descriptionNotes || undefined,
      lastMeetingDate: editingBank.lastMeetingDate || undefined,
      lastMeetingSummary: editingBank.lastMeetingSummary || undefined,
      nextMeetingDate: editingBank.nextMeetingDate || undefined,
      nextMeetingTopic: editingBank.nextMeetingTopic || undefined,
      nextAction: editingBank.nextAction || undefined,
    };

    if (editingBank.id) {
      updateBank.mutate({ id: editingBank.id, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBanksQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(editingBank.id!) });
          setIsModalOpen(false);
          toast({ title: 'Saved', description: 'Bank data updated successfully' });
        }
      });
    } else {
      createBank.mutate({ data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBanksQueryKey() });
          setIsModalOpen(false);
          toast({ title: 'Added', description: 'Bank added successfully' });
        }
      });
    }
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Manage Entities</h2>
        <Button onClick={() => { setEditingBank({ riskLevel: 'Low', priorityImpact: 'Unclassified' }); setIsModalOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" />
          Add New Bank
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {banks?.map(bank => (
          <Card key={bank.id} className="bg-white/5 border-white/10 hover:border-white/20 transition-all flex flex-col">
            <CardContent className="p-6 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center p-1 overflow-hidden">
                  <BankLogo src={bank.logoUrl} alt="Logo" />
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-white/50 hover:text-white" onClick={() => { setEditingBank(bank); setIsModalOpen(true); }}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400/50 hover:text-red-400" onClick={() => {
                    if (confirm('Are you sure you want to delete this bank?')) {
                      deleteBank.mutate({ id: bank.id }, {
                        onSuccess: () => {
                          queryClient.invalidateQueries({ queryKey: getListBanksQueryKey() });
                          toast({ title: 'Deleted', description: 'Bank deleted successfully' });
                        }
                      });
                    }
                  }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">{bank.nameAr}</h3>
              <p className="text-sm text-white/50 mb-6">{bank.nameEn}</p>

              <div className="mt-auto pt-4 border-t border-white/10 grid grid-cols-2 gap-2">
                <ImageUploader bankId={bank.id} type="logo" label="Logo" currentUrl={bank.logoUrl} />
                <ImageUploader bankId={bank.id} type="hero" label="Hero Image" currentUrl={bank.heroImageUrl} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px] bg-card border-white/10 text-white" dir="ltr">
          <DialogHeader>
            <DialogTitle>{editingBank?.id ? 'Edit Bank' : 'Add New Bank'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-white/70">Name (Arabic)</label>
                <Input value={editingBank?.nameAr || ''} onChange={e => setEditingBank({ ...editingBank, nameAr: e.target.value })} className="bg-white/5 border-white/10" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">Name (English)</label>
                <Input value={editingBank?.nameEn || ''} onChange={e => setEditingBank({ ...editingBank, nameEn: e.target.value })} className="bg-white/5 border-white/10" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">Category</label>
                <select className="flex h-10 w-full rounded-md border border-white/10 bg-card px-3 py-2 text-sm text-white focus:ring-2 focus:ring-primary"
                  value={editingBank?.category || ''} onChange={e => setEditingBank({ ...editingBank, category: e.target.value })}>
                  <option value="">Select...</option>
                  <option value="Local Bank">Local Bank</option>
                  <option value="Financing Entity">Financing Entity</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">Status</label>
                <select className="flex h-10 w-full rounded-md border border-white/10 bg-card px-3 py-2 text-sm text-white focus:ring-2 focus:ring-primary"
                  value={editingBank?.status || ''} onChange={e => setEditingBank({ ...editingBank, status: e.target.value })}>
                  <option value="">Select...</option>
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Delayed">Delayed</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">Responsible Person</label>
                <Input value={editingBank?.responsiblePerson || ''} onChange={e => setEditingBank({ ...editingBank, responsiblePerson: e.target.value })} className="bg-white/5 border-white/10" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">Relationship Manager</label>
                <Input value={editingBank?.relationshipManager || ''} onChange={e => setEditingBank({ ...editingBank, relationshipManager: e.target.value })} className="bg-white/5 border-white/10" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">Email Address</label>
                <Input value={editingBank?.email || ''} onChange={e => setEditingBank({ ...editingBank, email: e.target.value })} className="bg-white/5 border-white/10" dir="ltr" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">Website</label>
                <Input value={editingBank?.website || ''} onChange={e => setEditingBank({ ...editingBank, website: e.target.value })} className="bg-white/5 border-white/10" dir="ltr" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">Last Meeting Date</label>
                <Input value={editingBank?.lastMeetingDate || ''} onChange={e => setEditingBank({ ...editingBank, lastMeetingDate: e.target.value })} className="bg-white/5 border-white/10" placeholder="YYYY-MM-DD" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">Next Meeting Date</label>
                <Input value={editingBank?.nextMeetingDate || ''} onChange={e => setEditingBank({ ...editingBank, nextMeetingDate: e.target.value })} className="bg-white/5 border-white/10" placeholder="YYYY-MM-DD" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70">Next Meeting Topic</label>
              <Input value={editingBank?.nextMeetingTopic || ''} onChange={e => setEditingBank({ ...editingBank, nextMeetingTopic: e.target.value })} className="bg-white/5 border-white/10" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70">Next Action</label>
              <Input value={editingBank?.nextAction || ''} onChange={e => setEditingBank({ ...editingBank, nextAction: e.target.value })} className="bg-white/5 border-white/10" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70">Executive Summary</label>
              <Textarea value={editingBank?.executiveSummary || ''} onChange={e => setEditingBank({ ...editingBank, executiveSummary: e.target.value })} className="bg-white/5 border-white/10 h-24" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70">Notes</label>
              <Textarea value={editingBank?.descriptionNotes || ''} onChange={e => setEditingBank({ ...editingBank, descriptionNotes: e.target.value })} className="bg-white/5 border-white/10 h-24" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70">Product Types</label>
              <div className="flex flex-wrap gap-2">
                {(productTypes || []).filter(pt => pt.isActive).map(pt => {
                  const selected = (editingBank?.productTypeIds || []).includes(pt.id);
                  return (
                    <button
                      key={pt.id}
                      type="button"
                      onClick={() => {
                        const current = editingBank?.productTypeIds || [];
                        const next = selected ? current.filter(id => id !== pt.id) : [...current, pt.id];
                        setEditingBank({ ...editingBank, productTypeIds: next });
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        selected ? 'bg-primary text-white border-primary' : 'bg-white/5 text-white/60 border-white/10 hover:border-white/30'
                      }`}
                    >
                      {pt.name}
                    </button>
                  );
                })}
                {(!productTypes || productTypes.length === 0) && (
                  <span className="text-sm text-white/30">No product types yet — add them from the "Product Types" tab</span>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} className="w-full gap-2"><Save className="w-4 h-4" /> Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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

function RecentUpdates() {
  const { data, isLoading } = useListAuditLogs({ limit: 100 });
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (isLoading) return <div>Loading...</div>;

  const actionLabel: Record<string, string> = { CREATE: 'Created', UPDATE: 'Updated', ARCHIVE: 'Archived', RESTORE: 'Restored' };
  const entityLabel: Record<string, string> = { bank: 'Bank', document: 'Document', meeting: 'Meeting', product: 'Product', productType: 'Product Type', actionItem: 'Action Item', risk: 'Risk' };
  const actionColor: Record<string, string> = {
    CREATE: 'bg-emerald-500/20 text-emerald-400',
    UPDATE: 'bg-primary/20 text-primary',
    ARCHIVE: 'bg-red-500/20 text-red-400',
    RESTORE: 'bg-yellow-500/20 text-yellow-400',
  };

  const items = data?.items || [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <History className="w-6 h-6 text-primary" />
        <div>
          <h2 className="text-2xl font-bold text-white">Recent Updates</h2>
          <p className="text-sm text-white/50">All create, update, archive, and restore operations — sorted newest first. Click the arrow to view details.</p>
        </div>
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-0">
          <div className="divide-y divide-white/5">
            {items.map(entry => {
              const details = entry.details && typeof entry.details === 'object' ? entry.details as Record<string, unknown> : null;
              const hasDetails = !!details && Object.keys(details).length > 0;
              const isExpanded = expandedId === entry.id;
              return (
                <div key={entry.id}>
                  <button
                    type="button"
                    className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left hover:bg-white/5 transition-colors"
                    onClick={() => hasDetails && setExpandedId(isExpanded ? null : entry.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`shrink-0 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${actionColor[entry.action] || 'bg-white/10 text-white/60'}`}>
                        {actionLabel[entry.action] || entry.action}
                      </span>
                      <div className="min-w-0">
                        <p className="font-medium text-white truncate">
                          {entityLabel[entry.entityType] || entry.entityType}
                          {entry.entityLabel ? ` — ${entry.entityLabel}` : ''}
                        </p>
                        <p className="text-sm text-white/40 truncate">{entry.userName || entry.userEmail || 'Unknown user'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm text-white/60 font-mono">{formatDateTime(entry.createdAt)}</span>
                      {hasDetails && (
                        <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      )}
                    </div>
                  </button>
                  {isExpanded && details && (
                    <div className="px-6 pb-4 -mt-1">
                      <div className="rounded-lg bg-black/20 border border-white/10 p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                        {Object.entries(details).map(([key, value]) => (
                          <div key={key} className="flex justify-between gap-4 text-sm">
                            <span className="text-white/40">{FIELD_LABELS[key] || key}</span>
                            <span className="text-white/80 truncate">{formatDetailValue(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {items.length === 0 && (
              <div className="py-12 text-center text-white/30">No updates recorded yet</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ImageUploader({ bankId, type, label, currentUrl }: { bankId: string, type: 'logo' | 'hero', label: string, currentUrl?: string | null }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setLogo = useSetBankLogo();
  const setHero = useSetBankHeroImage();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      
      const mutation = type === 'logo' ? setLogo : setHero;
      mutation.mutate({ id: bankId, data: { dataUrl } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBanksQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bankId) });
          toast({ title: 'Uploaded', description: `${label} updated successfully` });
        },
        onError: () => {
          toast({ title: 'Error', description: 'Failed to upload image', variant: 'destructive' });
        }
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
      <Button 
        variant="outline" 
        size="sm" 
        className={`w-full text-xs gap-2 ${currentUrl ? 'border-primary/50 text-primary/80' : 'border-white/10 text-white/50'}`}
        onClick={() => fileInputRef.current?.click()}
        disabled={setLogo.isPending || setHero.isPending}
      >
        <UploadCloud className="w-3 h-3" />
        {label}
      </Button>
    </div>
  );
}

function ProductTypesManager() {
  const { role } = useAuth();
  const isSuperAdmin = role === 'super_admin';
  const { data: productTypes, isLoading } = useListProductTypes({ includeInactive: true });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createType = useCreateProductType();
  const updateType = useUpdateProductType();
  const deactivateType = useDeactivateProductType();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListProductTypesQueryKey() });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Tag className="w-6 h-6 text-primary" />
        <div>
          <h2 className="text-2xl font-bold text-white">Product Type Catalogue</h2>
          <p className="text-sm text-white/50">The reference list of product types that can be linked to each bank.</p>
        </div>
      </div>

      {!isSuperAdmin && (
        <p className="text-sm text-white/40">Only super admins can add or edit product types.</p>
      )}

      {isSuperAdmin && (
        <div className="flex gap-2">
          <Input placeholder="New product type name" value={newName} onChange={e => setNewName(e.target.value)} className="bg-white/5 border-white/10" />
          <Button
            className="gap-2 shrink-0"
            disabled={!newName.trim() || createType.isPending}
            onClick={() => {
              createType.mutate({ data: { name: newName.trim() } }, {
                onSuccess: () => { setNewName(''); invalidate(); toast({ title: 'Added' }); },
                onError: (err: any) => toast({ title: 'Error', description: err?.message || 'Failed to add product type', variant: 'destructive' }),
              });
            }}
          >
            <Plus className="w-4 h-4" /> Add
          </Button>
        </div>
      )}

      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-0">
          <div className="divide-y divide-white/5">
            {(productTypes || []).map(pt => (
              <div key={pt.id} className="flex items-center justify-between gap-4 px-6 py-4">
                {editingId === pt.id ? (
                  <Input value={editingName} onChange={e => setEditingName(e.target.value)} className="bg-white/5 border-white/10 max-w-xs" />
                ) : (
                  <span className={`font-medium ${pt.isActive ? 'text-white' : 'text-white/30 line-through'}`}>{pt.name}</span>
                )}
                {isSuperAdmin && (
                  <div className="flex gap-1 shrink-0">
                    {editingId === pt.id ? (
                      <Button size="sm" onClick={() => {
                        updateType.mutate({ id: pt.id, data: { name: editingName.trim() } }, {
                          onSuccess: () => { setEditingId(null); invalidate(); },
                        });
                      }}>Save</Button>
                    ) : (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-white/50" onClick={() => { setEditingId(pt.id); setEditingName(pt.name); }}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    )}
                    {pt.isActive && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400/50 hover:text-red-400" onClick={() => {
                        if (confirm('Deactivate this product type? Existing links will be preserved but it will no longer appear when adding new entries.')) {
                          deactivateType.mutate({ id: pt.id }, { onSuccess: invalidate });
                        }
                      }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {(!productTypes || productTypes.length === 0) && (
              <div className="py-12 text-center text-white/30">No product types yet</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ArchiveManager() {
  const { data, isLoading } = useGetArchive();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const restoreBank = useRestoreBank();
  const restoreDocument = useRestoreDocument();
  const restoreMeeting = useRestoreMeeting();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetArchiveQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListBanksQueryKey() });
  };

  if (isLoading) return <div>Loading...</div>;

  const banks = data?.banks || [];
  const documents = data?.documents || [];
  const meetings = data?.meetings || [];
  const isEmpty = banks.length === 0 && documents.length === 0 && meetings.length === 0;

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-center gap-3">
        <Archive className="w-6 h-6 text-primary" />
        <div>
          <h2 className="text-2xl font-bold text-white">Archive</h2>
          <p className="text-sm text-white/50">Archived (deleted) items — they can be restored at any time.</p>
        </div>
      </div>

      {isEmpty && <div className="py-12 text-center text-white/30">The archive is currently empty</div>}

      {banks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-white/80">Banks ({banks.length})</h3>
          <div className="divide-y divide-white/5 rounded-xl border border-white/10 bg-white/5">
            {banks.map(b => (
              <div key={b.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="min-w-0">
                  <p className="font-medium text-white truncate">{b.nameAr} — {b.nameEn}</p>
                  <p className="text-sm text-white/40">Archived by {b.archivedBy || 'Unknown'} on {formatDateTime(b.archivedAt || '')}</p>
                </div>
                <Button size="sm" variant="outline" className="gap-2 shrink-0" onClick={() => {
                  restoreBank.mutate({ id: b.id }, { onSuccess: () => { invalidate(); toast({ title: 'Restored' }); } });
                }}>
                  <RotateCcw className="w-4 h-4" /> Restore
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {documents.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-white/80">Documents ({documents.length})</h3>
          <div className="divide-y divide-white/5 rounded-xl border border-white/10 bg-white/5">
            {documents.map(d => (
              <div key={d.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="min-w-0">
                  <p className="font-medium text-white truncate">{d.title}</p>
                  <p className="text-sm text-white/40">Archived by {d.archivedBy || 'Unknown'} on {formatDateTime(d.archivedAt || '')}</p>
                </div>
                <Button size="sm" variant="outline" className="gap-2 shrink-0" onClick={() => {
                  restoreDocument.mutate({ id: d.id }, { onSuccess: () => { invalidate(); toast({ title: 'Restored' }); } });
                }}>
                  <RotateCcw className="w-4 h-4" /> Restore
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {meetings.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-white/80">Meetings ({meetings.length})</h3>
          <div className="divide-y divide-white/5 rounded-xl border border-white/10 bg-white/5">
            {meetings.map(m => (
              <div key={m.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="min-w-0">
                  <p className="font-medium text-white truncate">{m.topic}</p>
                  <p className="text-sm text-white/40">Archived by {m.archivedBy || 'Unknown'} on {formatDateTime(m.archivedAt || '')}</p>
                </div>
                <Button size="sm" variant="outline" className="gap-2 shrink-0" onClick={() => {
                  restoreMeeting.mutate({ id: m.id }, { onSuccess: () => { invalidate(); toast({ title: 'Restored' }); } });
                }}>
                  <RotateCcw className="w-4 h-4" /> Restore
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
