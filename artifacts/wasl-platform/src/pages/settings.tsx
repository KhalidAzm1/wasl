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
  useGetLookups,
  useUpdateLookups,
  getGetLookupsQueryKey
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Building2, Image as ImageIcon, Trash2, Edit, Plus, Save, UploadCloud } from 'lucide-react';
import type { Bank } from '@workspace/api-client-react';

export default function Settings() {
  return (
    <div className="p-8 pb-24 max-w-7xl mx-auto w-full space-y-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-l from-white to-white/60 mb-2">
            إعدادات النظام
          </h1>
          <p className="text-white/50 text-lg">إدارة البنوك والصور والقوائم المرجعية</p>
        </div>
        <NavControls />
      </header>

      <Tabs defaultValue="banks" className="w-full">
        <TabsList className="w-full justify-start border-b border-white/10 bg-transparent rounded-none p-0 h-auto mb-8">
          <TabsTrigger value="banks" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 px-6 text-lg">البنوك وجهات التمويل</TabsTrigger>
          <TabsTrigger value="lookups" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 px-6 text-lg">القوائم المرجعية</TabsTrigger>
        </TabsList>

        <TabsContent value="banks">
          <BanksManager />
        </TabsContent>

        <TabsContent value="lookups">
          <LookupsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BanksManager() {
  const { data: banks, isLoading } = useListBanks();
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
          </div>
          <DialogFooter>
            <Button onClick={handleSave} className="w-full gap-2"><Save className="w-4 h-4" /> حفظ البيانات</Button>
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

function LookupsManager() {
  const { data: lookups, isLoading } = useGetLookups();
  const updateLookups = useUpdateLookups();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [localLookups, setLocalLookups] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (lookups) {
      setLocalLookups({
        statuses: lookups.statuses.join('\n'),
        stages: lookups.stages.join('\n'),
        products: lookups.products.join('\n'),
        responsiblePersons: lookups.responsiblePersons.join('\n'),
        categories: lookups.categories.join('\n'),
      });
    }
  }, [lookups]);

  const handleSave = () => {
    const payload = {
      statuses: localLookups.statuses?.split('\n').map(s => s.trim()).filter(Boolean) || [],
      stages: localLookups.stages?.split('\n').map(s => s.trim()).filter(Boolean) || [],
      products: localLookups.products?.split('\n').map(s => s.trim()).filter(Boolean) || [],
      responsiblePersons: localLookups.responsiblePersons?.split('\n').map(s => s.trim()).filter(Boolean) || [],
      categories: localLookups.categories?.split('\n').map(s => s.trim()).filter(Boolean) || [],
    };

    updateLookups.mutate({ data: payload }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetLookupsQueryKey() });
        toast({ title: 'تم الحفظ', description: 'تم تحديث القوائم المرجعية بنجاح' });
      }
    });
  };

  if (isLoading) return <div>جاري التحميل...</div>;

  const fields = [
    { key: 'statuses', label: 'حالات المشاريع (Statuses)' },
    { key: 'stages', label: 'مراحل المنتجات (Stages)' },
    { key: 'products', label: 'أنواع المنتجات (Products)' },
    { key: 'responsiblePersons', label: 'المسؤولين (Responsible Persons)' },
    { key: 'categories', label: 'التصنيفات (Categories)' },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle>تعديل القوائم المرجعية</CardTitle>
          <p className="text-sm text-white/50">أدخل كل قيمة في سطر جديد.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {fields.map(field => (
            <div key={field.key} className="space-y-2">
              <label className="text-sm font-medium text-white/80">{field.label}</label>
              <Textarea 
                value={localLookups[field.key] || ''} 
                onChange={e => setLocalLookups({ ...localLookups, [field.key]: e.target.value })}
                className="bg-white/5 border-white/10 h-32 font-mono"
                dir="auto"
              />
            </div>
          ))}
          <Button onClick={handleSave} className="w-full gap-2" disabled={updateLookups.isPending}>
            <Save className="w-4 h-4" /> 
            {updateLookups.isPending ? 'جاري الحفظ...' : 'حفظ القوائم المرجعية'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
