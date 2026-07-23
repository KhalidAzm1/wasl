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
import { Trash2, Edit, Plus, Save, UploadCloud, Archive, RotateCcw, Tag } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { useAuth } from '@/lib/authContext';
import type { Bank } from '@workspace/api-client-react';
import { analytics } from '@/lib/analytics';

export default function Settings() {
  return (
    <div className="p-8 pb-24 max-w-7xl mx-auto w-full space-y-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-l from-foreground to-foreground/60 mb-2">
            Banks &amp; Products Management
          </h1>
          <p className="text-foreground/50 text-lg">Manage financing entities, product types and archive</p>
        </div>
        <NavControls />
      </header>

      <Tabs defaultValue="banks" className="w-full">
        <TabsList className="w-full justify-start border-b border-foreground/10 bg-transparent rounded-none p-0 h-auto mb-8 overflow-x-auto hide-scrollbar">
          <TabsTrigger value="banks" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 px-6 text-lg">Banks &amp; Financing Entities</TabsTrigger>
          <TabsTrigger value="productTypes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 px-6 text-lg gap-2"><Tag className="w-4 h-4" /> Product Types</TabsTrigger>
          <TabsTrigger value="archive" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 px-6 text-lg gap-2"><Archive className="w-4 h-4" /> Archive</TabsTrigger>
        </TabsList>

        <TabsContent value="banks">
          <BanksManager />
        </TabsContent>

        <TabsContent value="productTypes">
          <ProductTypesManager />
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
      // Detect status change before mutating
      const originalBank = banks?.find(b => b.id === editingBank.id);
      const oldStatus = originalBank?.status ?? '';
      const newStatus = payload.status ?? '';

      updateBank.mutate({ id: editingBank.id, data: payload }, {
        onSuccess: () => {
          analytics.bankUpdated({ bank_id: editingBank.id!, bank_name_en: payload.nameEn });
          if (oldStatus && newStatus && oldStatus !== newStatus) {
            analytics.bankStatusChanged({
              bank_id: editingBank.id!,
              bank_name_en: payload.nameEn,
              old_status: oldStatus,
              new_status: newStatus,
            });
          }
          queryClient.invalidateQueries({ queryKey: getListBanksQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(editingBank.id!) });
          setIsModalOpen(false);
          toast({ title: 'Saved', description: 'Bank data updated successfully' });
        }
      });
    } else {
      createBank.mutate({ data: payload }, {
        onSuccess: (created) => {
          analytics.bankCreated({ bank_id: created.id, bank_name_en: created.nameEn, bank_name_ar: created.nameAr, category: created.category });
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
        <h2 className="text-2xl font-bold text-foreground">Manage Entities</h2>
        <Button onClick={() => { setEditingBank({ riskLevel: 'Low', priorityImpact: 'Unclassified' }); setIsModalOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" />
          Add New Bank
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {banks?.map(bank => (
          <Card key={bank.id} className="bg-foreground/5 border-foreground/10 hover:border-foreground/20 transition-all flex flex-col">
            <CardContent className="p-6 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-lg bg-foreground/5 border border-foreground/10 flex items-center justify-center p-1 overflow-hidden">
                  <BankLogo src={bank.logoUrl} alt="Logo" />
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground/50 hover:text-foreground" onClick={() => { setEditingBank(bank); setIsModalOpen(true); }}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 dark:text-red-400/50 hover:text-red-600 dark:text-red-400" onClick={() => {
                    if (confirm('Are you sure you want to delete this bank?')) {
                      deleteBank.mutate({ id: bank.id }, {
                        onSuccess: () => {
                          analytics.bankDeleted({ bank_id: bank.id, bank_name_en: bank.nameEn });
                          queryClient.invalidateQueries({ queryKey: getListBanksQueryKey() });
                          toast({ title: 'Deleted', description: 'Bank moved to archive' });
                        },
                        onError: (e: any) => toast({ title: 'Failed to delete bank', description: e?.message, variant: 'destructive' }),
                      });
                    }
                  }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">{bank.nameAr}</h3>
              <p className="text-sm text-foreground/50 mb-6">{bank.nameEn}</p>

              <div className="mt-auto pt-4 border-t border-foreground/10 grid grid-cols-2 gap-2">
                <ImageUploader bankId={bank.id} type="logo" label="Logo" currentUrl={bank.logoUrl} />
                <ImageUploader bankId={bank.id} type="hero" label="Hero Image" currentUrl={bank.heroImageUrl} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px] bg-card border-foreground/10 text-foreground" dir="ltr">
          <DialogHeader className="shrink-0">
            <DialogTitle>{editingBank?.id ? 'Edit Bank' : 'Add New Bank'}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 min-h-0 -mx-6 px-6">
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-foreground/70">Name (Arabic)</label>
                <Input value={editingBank?.nameAr || ''} onChange={e => setEditingBank({ ...editingBank, nameAr: e.target.value })} className="bg-foreground/5 border-foreground/10" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-foreground/70">Name (English)</label>
                <Input value={editingBank?.nameEn || ''} onChange={e => setEditingBank({ ...editingBank, nameEn: e.target.value })} className="bg-foreground/5 border-foreground/10" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-foreground/70">Category</label>
                <select className="flex h-10 w-full rounded-md border border-foreground/10 bg-card px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary"
                  value={editingBank?.category || ''} onChange={e => setEditingBank({ ...editingBank, category: e.target.value })}>
                  <option value="">Select...</option>
                  <option value="Local Bank">Local Bank</option>
                  <option value="Financing Entity">Financing Entity</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-foreground/70">Status</label>
                <select className="flex h-10 w-full rounded-md border border-foreground/10 bg-card px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-primary"
                  value={editingBank?.status || ''} onChange={e => setEditingBank({ ...editingBank, status: e.target.value })}>
                  <option value="">Select...</option>
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Delayed">Delayed</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-foreground/70">Responsible Person</label>
                <Input value={editingBank?.responsiblePerson || ''} onChange={e => setEditingBank({ ...editingBank, responsiblePerson: e.target.value })} className="bg-foreground/5 border-foreground/10" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-foreground/70">Relationship Manager</label>
                <Input value={editingBank?.relationshipManager || ''} onChange={e => setEditingBank({ ...editingBank, relationshipManager: e.target.value })} className="bg-foreground/5 border-foreground/10" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-foreground/70">Email Address</label>
                <Input value={editingBank?.email || ''} onChange={e => setEditingBank({ ...editingBank, email: e.target.value })} className="bg-foreground/5 border-foreground/10" dir="ltr" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-foreground/70">Website</label>
                <Input value={editingBank?.website || ''} onChange={e => setEditingBank({ ...editingBank, website: e.target.value })} className="bg-foreground/5 border-foreground/10" dir="ltr" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-foreground/70">Last Meeting Date</label>
                <Input value={editingBank?.lastMeetingDate || ''} onChange={e => setEditingBank({ ...editingBank, lastMeetingDate: e.target.value })} className="bg-foreground/5 border-foreground/10" placeholder="YYYY-MM-DD" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-foreground/70">Next Meeting Date</label>
                <Input value={editingBank?.nextMeetingDate || ''} onChange={e => setEditingBank({ ...editingBank, nextMeetingDate: e.target.value })} className="bg-foreground/5 border-foreground/10" placeholder="YYYY-MM-DD" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-foreground/70">Next Meeting Topic</label>
              <Input value={editingBank?.nextMeetingTopic || ''} onChange={e => setEditingBank({ ...editingBank, nextMeetingTopic: e.target.value })} className="bg-foreground/5 border-foreground/10" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-foreground/70">Next Action</label>
              <Input value={editingBank?.nextAction || ''} onChange={e => setEditingBank({ ...editingBank, nextAction: e.target.value })} className="bg-foreground/5 border-foreground/10" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-foreground/70">Executive Summary</label>
              <Textarea value={editingBank?.executiveSummary || ''} onChange={e => setEditingBank({ ...editingBank, executiveSummary: e.target.value })} className="bg-foreground/5 border-foreground/10 h-24" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-foreground/70">Notes</label>
              <Textarea value={editingBank?.descriptionNotes || ''} onChange={e => setEditingBank({ ...editingBank, descriptionNotes: e.target.value })} className="bg-foreground/5 border-foreground/10 h-24" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-foreground/70">Product Types</label>
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
                        selected ? 'bg-primary text-foreground border-primary' : 'bg-foreground/5 text-foreground/60 border-foreground/10 hover:border-foreground/30'
                      }`}
                    >
                      {pt.name}
                    </button>
                  );
                })}
                {(!productTypes || productTypes.length === 0) && (
                  <span className="text-sm text-foreground/30">No product types yet — add them from the "Product Types" tab</span>
                )}
              </div>
            </div>
          </div>
          </div>
          <DialogFooter className="shrink-0 pt-4">
            <Button onClick={handleSave} className="w-full gap-2"><Save className="w-4 h-4" /> Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
        className={`w-full text-xs gap-2 ${currentUrl ? 'border-primary/50 text-primary/80' : 'border-foreground/10 text-foreground/50'}`}
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
          <h2 className="text-2xl font-bold text-foreground">Product Type Catalogue</h2>
          <p className="text-sm text-foreground/50">The reference list of product types that can be linked to each bank.</p>
        </div>
      </div>

      {!isSuperAdmin && (
        <p className="text-sm text-foreground/40">Only super admins can add or edit product types.</p>
      )}

      {isSuperAdmin && (
        <div className="flex gap-2">
          <Input placeholder="New product type name" value={newName} onChange={e => setNewName(e.target.value)} className="bg-foreground/5 border-foreground/10" />
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

      <Card className="bg-foreground/5 border-foreground/10">
        <CardContent className="p-0">
          <div className="divide-y divide-white/5">
            {(productTypes || []).map(pt => (
              <div key={pt.id} className="flex items-center justify-between gap-4 px-6 py-4">
                {editingId === pt.id ? (
                  <Input value={editingName} onChange={e => setEditingName(e.target.value)} className="bg-foreground/5 border-foreground/10 max-w-xs" />
                ) : (
                  <span className={`font-medium ${pt.isActive ? 'text-foreground' : 'text-foreground/30 line-through'}`}>{pt.name}</span>
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
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground/50" onClick={() => { setEditingId(pt.id); setEditingName(pt.name); }}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    )}
                    {pt.isActive && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 dark:text-red-400/50 hover:text-red-600 dark:text-red-400" onClick={() => {
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
              <div className="py-12 text-center text-foreground/30">No product types yet</div>
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
          <h2 className="text-2xl font-bold text-foreground">Archive</h2>
          <p className="text-sm text-foreground/50">Archived (deleted) items — they can be restored at any time.</p>
        </div>
      </div>

      {isEmpty && <div className="py-12 text-center text-foreground/30">The archive is currently empty</div>}

      {banks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-foreground/80">Banks ({banks.length})</h3>
          <div className="divide-y divide-white/5 rounded-xl border border-foreground/10 bg-foreground/5">
            {banks.map(b => (
              <div key={b.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{b.nameAr} — {b.nameEn}</p>
                  <p className="text-sm text-foreground/40">Archived by {b.archivedBy || 'Unknown'} on {formatDateTime(b.archivedAt || '')}</p>
                </div>
                <Button size="sm" variant="outline" className="gap-2 shrink-0" onClick={() => {
                  restoreBank.mutate({ id: b.id }, {
                    onSuccess: () => { analytics.bankRestored({ bank_id: b.id, bank_name_ar: b.nameAr }); invalidate(); toast({ title: 'Bank Restored', description: 'The bank has been restored successfully.' }); },
                    onError: (e: any) => toast({ title: 'Restore failed', description: e?.message, variant: 'destructive' }),
                  });
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
          <h3 className="text-lg font-bold text-foreground/80">Documents ({documents.length})</h3>
          <div className="divide-y divide-white/5 rounded-xl border border-foreground/10 bg-foreground/5">
            {documents.map(d => (
              <div key={d.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{d.title}</p>
                  <p className="text-sm text-foreground/40">Archived by {d.archivedBy || 'Unknown'} on {formatDateTime(d.archivedAt || '')}</p>
                </div>
                <Button size="sm" variant="outline" className="gap-2 shrink-0" onClick={() => {
                  restoreDocument.mutate({ id: d.id }, {
                    onSuccess: () => { analytics.documentRestored({ doc_id: d.id }); invalidate(); toast({ title: 'Document Restored', description: 'The document has been restored successfully.' }); },
                    onError: (e: any) => toast({ title: 'Restore failed', description: e?.message, variant: 'destructive' }),
                  });
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
          <h3 className="text-lg font-bold text-foreground/80">Meetings ({meetings.length})</h3>
          <div className="divide-y divide-white/5 rounded-xl border border-foreground/10 bg-foreground/5">
            {meetings.map(m => (
              <div key={m.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{m.topic}</p>
                  <p className="text-sm text-foreground/40">Archived by {m.archivedBy || 'Unknown'} on {formatDateTime(m.archivedAt || '')}</p>
                </div>
                <Button size="sm" variant="outline" className="gap-2 shrink-0" onClick={() => {
                  restoreMeeting.mutate({ id: m.id }, {
                    onSuccess: () => { analytics.meetingUpdated({ bank_id: '', meeting_id: m.id }); invalidate(); toast({ title: 'Meeting Restored', description: 'The meeting has been restored successfully.' }); },
                    onError: (e: any) => toast({ title: 'Restore failed', description: e?.message, variant: 'destructive' }),
                  });
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
