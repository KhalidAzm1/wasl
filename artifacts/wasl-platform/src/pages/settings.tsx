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
  useListProducts,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Building2, Image as ImageIcon, Trash2, Edit, Plus, Save, UploadCloud, History, Archive, ScrollText, RotateCcw, Tag } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { useAuth } from '@/lib/authContext';
import type { Bank } from '@workspace/api-client-react';

export default function Settings() {
  return (
    <div className="p-8 pb-24 max-w-7xl mx-auto w-full space-y-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-l from-white to-white/60 mb-2">
            إعدادات النظام
          </h1>
          <p className="text-white/50 text-lg">إدارة البنوك والصور</p>
        </div>
        <NavControls />
      </header>

      <Tabs defaultValue="banks" className="w-full">
        <TabsList className="w-full justify-start border-b border-white/10 bg-transparent rounded-none p-0 h-auto mb-8 overflow-x-auto hide-scrollbar">
          <TabsTrigger value="banks" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 px-6 text-lg">البنوك وجهات التمويل</TabsTrigger>
          <TabsTrigger value="productTypes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 px-6 text-lg gap-2"><Tag className="w-4 h-4" /> أنواع المنتجات</TabsTrigger>
          <TabsTrigger value="updates" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 px-6 text-lg">التحديثات الأخيرة</TabsTrigger>
          <TabsTrigger value="activity" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 px-6 text-lg gap-2"><ScrollText className="w-4 h-4" /> سجل النشاطات</TabsTrigger>
          <TabsTrigger value="archive" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 px-6 text-lg gap-2"><Archive className="w-4 h-4" /> الأرشيف</TabsTrigger>
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

        <TabsContent value="activity">
          <ActivityLog />
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
      toast({ title: 'خطأ', description: 'يرجى تعبئة الحقول الأساسية (الاسم، التصنيف، الحالة)', variant: 'destructive' });
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
    };

    if (editingBank.id) {
      updateBank.mutate({ id: editingBank.id, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBanksQueryKey() });
          setIsModalOpen(false);
          toast({ title: 'تم الحفظ', description: 'تم تحديث بيانات البنك بنجاح' });
        }
      });
    } else {
      createBank.mutate({ data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListBanksQueryKey() });
          setIsModalOpen(false);
          toast({ title: 'تم الإضافة', description: 'تم إضافة البنك بنجاح' });
        }
      });
    }
  };

  if (isLoading) return <div>جاري التحميل...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">إدارة الجهات</h2>
        <Button onClick={() => { setEditingBank({ riskLevel: 'Low', priorityImpact: 'Unclassified' }); setIsModalOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" />
          إضافة جهة جديدة
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
                    if (confirm('هل أنت متأكد من الحذف؟')) {
                      deleteBank.mutate({ id: bank.id }, {
                        onSuccess: () => {
                          queryClient.invalidateQueries({ queryKey: getListBanksQueryKey() });
                          toast({ title: 'تم الحذف', description: 'تم حذف البنك بنجاح' });
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
                <ImageUploader bankId={bank.id} type="logo" label="الشعار" currentUrl={bank.logoUrl} />
                <ImageUploader bankId={bank.id} type="hero" label="صورة العرض" currentUrl={bank.heroImageUrl} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px] bg-card border-white/10 text-white" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingBank?.id ? 'تعديل جهة' : 'إضافة جهة جديدة'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-white/70">الاسم (عربي)</label>
                <Input value={editingBank?.nameAr || ''} onChange={e => setEditingBank({ ...editingBank, nameAr: e.target.value })} className="bg-white/5 border-white/10" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">الاسم (انجليزي)</label>
                <Input value={editingBank?.nameEn || ''} onChange={e => setEditingBank({ ...editingBank, nameEn: e.target.value })} className="bg-white/5 border-white/10" />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">التصنيف</label>
                <select className="flex h-10 w-full rounded-md border border-white/10 bg-card px-3 py-2 text-sm text-white focus:ring-2 focus:ring-primary"
                  value={editingBank?.category || ''} onChange={e => setEditingBank({ ...editingBank, category: e.target.value })}>
                  <option value="">اختر...</option>
                  <option value="Local Bank">بنك محلي (Local Bank)</option>
                  <option value="Financing Entity">جهة تمويل (Financing Entity)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-white/70">الحالة</label>
                <select className="flex h-10 w-full rounded-md border border-white/10 bg-card px-3 py-2 text-sm text-white focus:ring-2 focus:ring-primary"
                  value={editingBank?.status || ''} onChange={e => setEditingBank({ ...editingBank, status: e.target.value })}>
                  <option value="">اختر...</option>
                  <option value="Not Started">لم يبدأ</option>
                  <option value="In Progress">قيد التنفيذ</option>
                  <option value="Delayed">متأخر</option>
                  <option value="Completed">مكتمل</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70">أنواع المنتجات</label>
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
                  <span className="text-sm text-white/30">لا توجد أنواع منتجات بعد — أضفها من تبويب "أنواع المنتجات"</span>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} className="w-full gap-2"><Save className="w-4 h-4" /> حفظ البيانات</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RecentUpdates() {
  const { data: banks, isLoading: isLoadingBanks } = useListBanks();
  const { data: products, isLoading: isLoadingProducts } = useListProducts();

  if (isLoadingBanks || isLoadingProducts) return <div>جاري التحميل...</div>;

  type Row = { id: string; label: string; sub: string; updatedAt: string; kind: 'بنك' | 'منتج' };

  const bankRows: Row[] = (banks || []).map(b => ({
    id: b.id,
    label: b.nameAr,
    sub: b.nameEn,
    updatedAt: b.updatedAt,
    kind: 'بنك',
  }));

  const productRows: Row[] = (products || []).map(p => {
    const bank = (banks || []).find(b => b.id === p.bankId);
    return {
      id: `${p.bankId}-${p.id}`,
      label: `${p.productCode} — ${p.categoryStage}`,
      sub: bank ? bank.nameAr : p.bankId,
      updatedAt: p.updatedAt,
      kind: 'منتج',
    };
  });

  const rows = [...bankRows, ...productRows].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <History className="w-6 h-6 text-primary" />
        <div>
          <h2 className="text-2xl font-bold text-white">سجل كل التحديثات</h2>
          <p className="text-sm text-white/50">آخر تعديل لكل بنك ومنتج، مرتبة من الأحدث للأقدم.</p>
        </div>
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-0">
          <div className="divide-y divide-white/5">
            {rows.map(row => (
              <div key={`${row.kind}-${row.id}`} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`shrink-0 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${row.kind === 'بنك' ? 'bg-primary/20 text-primary' : 'bg-emerald-500/20 text-emerald-400'}`}>
                    {row.kind}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate">{row.label}</p>
                    <p className="text-sm text-white/40 truncate">{row.sub}</p>
                  </div>
                </div>
                <div className="shrink-0 text-sm text-white/60 font-mono">{formatDateTime(row.updatedAt)}</div>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="py-12 text-center text-white/30">لا توجد تحديثات مسجلة</div>
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
          toast({ title: 'تم الرفع', description: `تم تحديث ${label} بنجاح` });
        },
        onError: () => {
          toast({ title: 'خطأ', description: 'فشل في رفع الصورة', variant: 'destructive' });
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

  if (isLoading) return <div>جاري التحميل...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Tag className="w-6 h-6 text-primary" />
        <div>
          <h2 className="text-2xl font-bold text-white">كتالوج أنواع المنتجات</h2>
          <p className="text-sm text-white/50">القائمة المرجعية لأنواع المنتجات القابلة للربط مع كل بنك.</p>
        </div>
      </div>

      {!isSuperAdmin && (
        <p className="text-sm text-white/40">يمكن للمشرف العام فقط إضافة أو تعديل أنواع المنتجات.</p>
      )}

      {isSuperAdmin && (
        <div className="flex gap-2">
          <Input placeholder="اسم نوع المنتج الجديد" value={newName} onChange={e => setNewName(e.target.value)} className="bg-white/5 border-white/10" />
          <Button
            className="gap-2 shrink-0"
            disabled={!newName.trim() || createType.isPending}
            onClick={() => {
              createType.mutate({ data: { name: newName.trim() } }, {
                onSuccess: () => { setNewName(''); invalidate(); toast({ title: 'تمت الإضافة' }); },
                onError: (err: any) => toast({ title: 'خطأ', description: err?.message || 'فشلت الإضافة', variant: 'destructive' }),
              });
            }}
          >
            <Plus className="w-4 h-4" /> إضافة
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
                      }}>حفظ</Button>
                    ) : (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-white/50" onClick={() => { setEditingId(pt.id); setEditingName(pt.name); }}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    )}
                    {pt.isActive && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400/50 hover:text-red-400" onClick={() => {
                        if (confirm('تعطيل هذا النوع؟ ستبقى الربطات الحالية لكن لن يظهر عند الإضافة.')) {
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
              <div className="py-12 text-center text-white/30">لا توجد أنواع منتجات بعد</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ActivityLog() {
  const { data, isLoading } = useListAuditLogs({ limit: 100 });

  if (isLoading) return <div>جاري التحميل...</div>;

  const actionLabel: Record<string, string> = { CREATE: 'إضافة', UPDATE: 'تعديل', ARCHIVE: 'أرشفة', RESTORE: 'استعادة' };
  const entityLabel: Record<string, string> = { bank: 'بنك', document: 'مستند', meeting: 'اجتماع', product: 'منتج', productType: 'نوع منتج' };
  const actionColor: Record<string, string> = {
    CREATE: 'bg-emerald-500/20 text-emerald-400',
    UPDATE: 'bg-primary/20 text-primary',
    ARCHIVE: 'bg-red-500/20 text-red-400',
    RESTORE: 'bg-yellow-500/20 text-yellow-400',
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <ScrollText className="w-6 h-6 text-primary" />
        <div>
          <h2 className="text-2xl font-bold text-white">سجل النشاطات</h2>
          <p className="text-sm text-white/50">كل عمليات الإضافة والتعديل والأرشفة والاستعادة، مرتبة من الأحدث للأقدم.</p>
        </div>
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-0">
          <div className="divide-y divide-white/5">
            {(data?.items || []).map(entry => (
              <div key={entry.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`shrink-0 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full ${actionColor[entry.action] || 'bg-white/10 text-white/60'}`}>
                    {actionLabel[entry.action] || entry.action}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate">
                      {entityLabel[entry.entityType] || entry.entityType}
                      {entry.entityLabel ? ` — ${entry.entityLabel}` : ''}
                    </p>
                    <p className="text-sm text-white/40 truncate">{entry.userName || entry.userEmail || 'مستخدم غير معروف'}</p>
                  </div>
                </div>
                <div className="shrink-0 text-sm text-white/60 font-mono">{formatDateTime(entry.createdAt)}</div>
              </div>
            ))}
            {(!data?.items || data.items.length === 0) && (
              <div className="py-12 text-center text-white/30">لا توجد نشاطات مسجلة</div>
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

  if (isLoading) return <div>جاري التحميل...</div>;

  const banks = data?.banks || [];
  const documents = data?.documents || [];
  const meetings = data?.meetings || [];
  const isEmpty = banks.length === 0 && documents.length === 0 && meetings.length === 0;

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-center gap-3">
        <Archive className="w-6 h-6 text-primary" />
        <div>
          <h2 className="text-2xl font-bold text-white">الأرشيف</h2>
          <p className="text-sm text-white/50">العناصر المؤرشفة (المحذوفة) — يمكن استعادتها في أي وقت.</p>
        </div>
      </div>

      {isEmpty && <div className="py-12 text-center text-white/30">الأرشيف فارغ حالياً</div>}

      {banks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-white/80">البنوك ({banks.length})</h3>
          <div className="divide-y divide-white/5 rounded-xl border border-white/10 bg-white/5">
            {banks.map(b => (
              <div key={b.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="min-w-0">
                  <p className="font-medium text-white truncate">{b.nameAr} — {b.nameEn}</p>
                  <p className="text-sm text-white/40">أُرشف بواسطة {b.archivedBy || 'غير معروف'} في {formatDateTime(b.archivedAt || '')}</p>
                </div>
                <Button size="sm" variant="outline" className="gap-2 shrink-0" onClick={() => {
                  restoreBank.mutate({ id: b.id }, { onSuccess: () => { invalidate(); toast({ title: 'تمت الاستعادة' }); } });
                }}>
                  <RotateCcw className="w-4 h-4" /> استعادة
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {documents.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-white/80">المستندات ({documents.length})</h3>
          <div className="divide-y divide-white/5 rounded-xl border border-white/10 bg-white/5">
            {documents.map(d => (
              <div key={d.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="min-w-0">
                  <p className="font-medium text-white truncate">{d.title}</p>
                  <p className="text-sm text-white/40">أُرشف بواسطة {d.archivedBy || 'غير معروف'} في {formatDateTime(d.archivedAt || '')}</p>
                </div>
                <Button size="sm" variant="outline" className="gap-2 shrink-0" onClick={() => {
                  restoreDocument.mutate({ id: d.id }, { onSuccess: () => { invalidate(); toast({ title: 'تمت الاستعادة' }); } });
                }}>
                  <RotateCcw className="w-4 h-4" /> استعادة
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {meetings.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-white/80">الاجتماعات ({meetings.length})</h3>
          <div className="divide-y divide-white/5 rounded-xl border border-white/10 bg-white/5">
            {meetings.map(m => (
              <div key={m.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="min-w-0">
                  <p className="font-medium text-white truncate">{m.topic}</p>
                  <p className="text-sm text-white/40">أُرشف بواسطة {m.archivedBy || 'غير معروف'} في {formatDateTime(m.archivedAt || '')}</p>
                </div>
                <Button size="sm" variant="outline" className="gap-2 shrink-0" onClick={() => {
                  restoreMeeting.mutate({ id: m.id }, { onSuccess: () => { invalidate(); toast({ title: 'تمت الاستعادة' }); } });
                }}>
                  <RotateCcw className="w-4 h-4" /> استعادة
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
