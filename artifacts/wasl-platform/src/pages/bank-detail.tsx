import React, { useState } from 'react';
import { useParams, Link } from 'wouter';
import { BankLogo } from '@/components/BankLogo';
import { NavControls } from '@/components/NavControls';
import { 
  useGetBank, 
  useCreateProduct, useUpdateProduct, useDeleteProduct,
  useCreateMeeting, useUpdateMeeting, useDeleteMeeting,
  useCreateRisk, useUpdateRisk, useDeleteRisk,
  useCreateActionItem, useUpdateActionItem, useDeleteActionItem,
  useCreateDocument, useDeleteDocument,
  getGetBankQueryKey
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
import { formatDate, formatPercentage } from '@/lib/utils';
import { 
  ChevronRight, Building2, LayoutGrid, Calendar, AlertTriangle, 
  CheckSquare, FileText, Plus, Trash2, Edit, ExternalLink, Phone, User
} from 'lucide-react';

export default function BankDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: bank, isLoading } = useGetBank(id!, { query: { enabled: !!id, queryKey: getGetBankQueryKey(id!) } });

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!bank) return <div className="p-8 text-center text-white/50">البنك غير موجود</div>;

  const avgProgress = bank.products?.length 
    ? bank.products.reduce((acc, p) => acc + p.progressPercent, 0) / bank.products.length 
    : 0;

  return (
    <div className="p-8 pb-24 max-w-7xl mx-auto w-full space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-4 text-white/50 text-sm">
          <Link href="/" className="hover:text-white transition-colors">الرئيسية</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-white">{bank.nameAr}</span>
        </div>
        <NavControls />
      </div>

      <div className="relative rounded-3xl overflow-hidden glass-panel border border-white/10 p-8 flex flex-col md:flex-row gap-8 items-start md:items-center">
        {bank.heroImageUrl && (
          <div className="absolute inset-0 z-[-1] opacity-20 mix-blend-luminosity">
            <img src={bank.heroImageUrl} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
          </div>
        )}

        <div className="w-24 h-24 rounded-2xl bg-white/5 border border-white/10 p-2 flex items-center justify-center shadow-xl backdrop-blur-md shrink-0">
          <BankLogo src={bank.logoUrl} alt={bank.nameEn} />
        </div>

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white">{bank.nameAr}</h1>
            <Badge variant="outline" className="border-white/20 bg-white/5">{bank.category}</Badge>
            <Badge variant={bank.status === 'Completed' ? 'success' : 'default'}>{bank.status}</Badge>
            {bank.riskLevel === 'High' && <Badge variant="destructive">مخاطر عالية</Badge>}
            {bank.priorityImpact === 'HOT' && <Badge variant="warning">أولوية قصوى</Badge>}
          </div>
          <p className="text-white/50 text-lg">{bank.nameEn}</p>
        </div>

        <div className="flex gap-6 text-center shrink-0">
          <div className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
            <p className="text-white/40 text-sm mb-1">نسبة الإنجاز</p>
            <p className="text-2xl font-bold text-emerald-400 font-mono">{formatPercentage(avgProgress)}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full flex justify-start border-b border-white/10 bg-transparent rounded-none p-0 h-auto mb-8 overflow-x-auto hide-scrollbar">
          <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 px-6 text-lg gap-2">
            نظرة عامة
          </TabsTrigger>
          <TabsTrigger value="products" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 px-6 text-lg gap-2">
            <LayoutGrid className="w-4 h-4" /> المنتجات
          </TabsTrigger>
          <TabsTrigger value="meetings" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 px-6 text-lg gap-2">
            <Calendar className="w-4 h-4" /> الاجتماعات
          </TabsTrigger>
          <TabsTrigger value="actions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 px-6 text-lg gap-2">
            <CheckSquare className="w-4 h-4" /> الإجراءات
          </TabsTrigger>
          <TabsTrigger value="risks" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 px-6 text-lg gap-2">
            <AlertTriangle className="w-4 h-4" /> المخاطر
          </TabsTrigger>
          <TabsTrigger value="documents" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent pb-4 px-6 text-lg gap-2">
            <FileText className="w-4 h-4" /> المستندات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>الملخص التنفيذي</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-white/80 leading-relaxed whitespace-pre-wrap text-lg">
                    {bank.executiveSummary || 'لا يوجد ملخص.'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>ملاحظات الوصف</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-white/70 leading-relaxed whitespace-pre-wrap">
                    {bank.descriptionNotes || 'لا توجد ملاحظات.'}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>معلومات أساسية</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-white/40 mb-1">المسؤول</p>
                    <p className="font-medium">{bank.responsiblePerson || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-white/40 mb-1">تاريخ آخر اجتماع</p>
                    <p className="font-medium">{formatDate(bank.lastMeetingDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-white/40 mb-1">الاجتماع القادم</p>
                    <p className="font-medium">{formatDate(bank.nextMeetingDate)}</p>
                    {bank.nextMeetingTopic && <p className="text-sm text-white/60 mt-1">{bank.nextMeetingTopic}</p>}
                  </div>
                  {bank.referenceLink && (
                    <div>
                      <p className="text-sm text-white/40 mb-1">رابط مرجعي</p>
                      <a href={bank.referenceLink} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                        فتح الرابط <ExternalLink className="w-3 h-3" />
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
                      جهات الاتصال
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {bank.contacts.map((contact, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-white/5 border border-white/10">
                        <p className="font-medium">{contact.name}</p>
                        {contact.title && <p className="text-sm text-white/50">{contact.title}</p>}
                        {contact.phone && (
                          <a href={`tel:${contact.phone}`} className="text-sm text-primary flex items-center gap-1 mt-1 hover:underline" dir="ltr">
                            <Phone className="w-3 h-3" />
                            {contact.phone}
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
          queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bankId) });
          setIsOpen(false);
          toast({ title: 'تم الحفظ' });
        }
      });
    } else {
      createProduct.mutate({ data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bankId) });
          setIsOpen(false);
          toast({ title: 'تمت الإضافة' });
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">المنتجات المرتبطة</h3>
        <Button onClick={() => { setEditing({ progressPercent: 0 }); setIsOpen(true); }} size="sm" className="gap-2">
          <Plus className="w-4 h-4" /> إضافة منتج
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map(p => (
          <Card key={p.id} className="bg-white/5 border-white/10 hover:border-white/20 transition-all">
            <CardContent className="p-5 flex flex-col h-full">
              <div className="flex justify-between items-start mb-3">
                <Badge variant="outline">{p.productCode}</Badge>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-white/50" onClick={() => { setEditing({ ...p, progressPercent: p.progressPercent * 100 }); setIsOpen(true); }}><Edit className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400/50" onClick={() => {
                    if (confirm('تأكيد الحذف؟')) {
                      deleteProduct.mutate({ id: p.id }, {
                        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bankId) })
                      });
                    }
                  }}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
              <h4 className="font-bold text-lg mb-1">{p.categoryStage}</h4>
              <p className="text-sm text-white/50 mb-4">{p.status}</p>

              <div className="flex items-center gap-2 text-sm text-white/70 mb-4">
                <User className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="truncate">{p.responsiblePerson || 'غير محدد'}</span>
              </div>

              <div className="mt-auto pt-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-white/60">الإنجاز</span>
                  <span className="font-mono">{formatPercentage(p.progressPercent)}</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                  <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${p.progressPercent * 100}%` }} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {products.length === 0 && <div className="col-span-full py-8 text-center text-white/30">لا توجد منتجات مسجلة</div>}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>{editing?.id ? 'تعديل منتج' : 'إضافة منتج'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Input placeholder="كود المنتج" value={editing?.productCode || ''} onChange={e => setEditing({...editing, productCode: e.target.value})} />
            <Input placeholder="المرحلة/التصنيف" value={editing?.categoryStage || ''} onChange={e => setEditing({...editing, categoryStage: e.target.value})} />
            <Input placeholder="الحالة" value={editing?.status || ''} onChange={e => setEditing({...editing, status: e.target.value})} />
            <Input type="number" placeholder="نسبة الإنجاز (0-100)" value={editing?.progressPercent || 0} onChange={e => setEditing({...editing, progressPercent: e.target.value})} />
            <Input placeholder="المسؤول" value={editing?.responsiblePerson || ''} onChange={e => setEditing({...editing, responsiblePerson: e.target.value})} />
          </div>
          <DialogFooter><Button onClick={handleSave}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MeetingsTab({ bankId, meetings }: { bankId: string, meetings: any[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const queryClient = useQueryClient();
  const createMeeting = useCreateMeeting();
  const deleteMeeting = useDeleteMeeting();

  const handleSave = () => {
    createMeeting.mutate({ data: { bankId, topic: editing.topic, date: editing.date, summary: editing.summary } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bankId) });
        setIsOpen(false);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">سجل الاجتماعات</h3>
        <Button onClick={() => { setEditing({}); setIsOpen(true); }} size="sm" className="gap-2"><Plus className="w-4 h-4" /> اجتماع جديد</Button>
      </div>
      <div className="space-y-4">
        {meetings.map(m => (
          <div key={m.id} className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col md:flex-row gap-4">
            <div className="md:w-48 shrink-0 text-white/60">
              {formatDate(m.date)}
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-lg">{m.topic}</h4>
              <p className="text-white/70 mt-1">{m.summary || 'لا يوجد ملخص'}</p>
            </div>
            <Button variant="ghost" size="icon" className="text-red-400/50" onClick={() => deleteMeeting.mutate({ id: m.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bankId) }) })}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>إضافة اجتماع</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Input type="date" value={editing?.date || ''} onChange={e => setEditing({...editing, date: e.target.value})} />
            <Input placeholder="الموضوع" value={editing?.topic || ''} onChange={e => setEditing({...editing, topic: e.target.value})} />
            <Textarea placeholder="الملخص" value={editing?.summary || ''} onChange={e => setEditing({...editing, summary: e.target.value})} />
          </div>
          <DialogFooter><Button onClick={handleSave}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActionsTab({ bankId, actionItems }: { bankId: string, actionItems: any[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const queryClient = useQueryClient();
  const createAction = useCreateActionItem();
  const updateAction = useUpdateActionItem();
  const deleteAction = useDeleteActionItem();

  const handleSave = () => {
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
        <h3 className="text-xl font-bold">الإجراءات والقرارات</h3>
        <Button onClick={() => { setEditing({}); setIsOpen(true); }} size="sm" className="gap-2"><Plus className="w-4 h-4" /> إجراء جديد</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {actionItems.map(a => (
          <Card key={a.id} className="bg-white/5 border-white/10">
            <CardContent className="p-5">
              <div className="flex justify-between items-start mb-2">
                <Badge variant={a.status === 'Completed' ? 'success' : 'outline'}>{a.status}</Badge>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditing(a); setIsOpen(true); }}><Edit className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400/50" onClick={() => deleteAction.mutate({ id: a.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bankId) }) })}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
              <p className="text-lg mb-4">{a.description}</p>
              <div className="flex justify-between text-sm text-white/50">
                <span>{a.owner || 'غير محدد'}</span>
                <span>{formatDate(a.dueDate)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>{editing?.id ? 'تعديل' : 'إضافة'} إجراء</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea placeholder="الوصف" value={editing?.description || ''} onChange={e => setEditing({...editing, description: e.target.value})} />
            <Input placeholder="المسؤول" value={editing?.owner || ''} onChange={e => setEditing({...editing, owner: e.target.value})} />
            <Input type="date" value={editing?.dueDate || ''} onChange={e => setEditing({...editing, dueDate: e.target.value})} />
            <select className="flex h-10 w-full rounded-md border border-white/10 bg-card px-3 py-2 text-sm text-white" value={editing?.status || ''} onChange={e => setEditing({...editing, status: e.target.value})}>
              <option value="Pending">قيد الانتظار</option>
              <option value="Completed">مكتمل</option>
            </select>
          </div>
          <DialogFooter><Button onClick={handleSave}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RisksTab({ bankId, risks }: { bankId: string, risks: any[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const queryClient = useQueryClient();
  const createRisk = useCreateRisk();
  const deleteRisk = useDeleteRisk();

  const handleSave = () => {
    createRisk.mutate({ data: { bankId, description: editing.description, level: editing.level || 'Medium', status: editing.status || 'Open' } }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bankId) }); setIsOpen(false); }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">سجل المخاطر</h3>
        <Button onClick={() => { setEditing({}); setIsOpen(true); }} size="sm" className="gap-2"><Plus className="w-4 h-4" /> خطر جديد</Button>
      </div>
      <div className="space-y-4">
        {risks.map(r => (
          <div key={r.id} className="p-4 rounded-xl bg-white/5 border border-white/10 flex justify-between items-center">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Badge variant={r.level === 'High' ? 'destructive' : r.level === 'Medium' ? 'warning' : 'success'}>{r.level}</Badge>
                <span className="text-sm text-white/50">{r.status}</span>
              </div>
              <p className="text-lg">{r.description}</p>
            </div>
            <Button variant="ghost" size="icon" className="text-red-400/50" onClick={() => deleteRisk.mutate({ id: r.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bankId) }) })}><Trash2 className="w-4 h-4" /></Button>
          </div>
        ))}
      </div>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>إضافة خطر</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea placeholder="الوصف" value={editing?.description || ''} onChange={e => setEditing({...editing, description: e.target.value})} />
            <select className="flex h-10 w-full rounded-md border border-white/10 bg-card px-3 py-2 text-sm text-white" value={editing?.level || 'Medium'} onChange={e => setEditing({...editing, level: e.target.value})}>
              <option value="Low">منخفض</option>
              <option value="Medium">متوسط</option>
              <option value="High">عالي</option>
            </select>
          </div>
          <DialogFooter><Button onClick={handleSave}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DocumentsTab({ bankId, documents }: { bankId: string, documents: any[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const queryClient = useQueryClient();
  const createDoc = useCreateDocument();
  const deleteDoc = useDeleteDocument();

  const handleSave = () => {
    createDoc.mutate({ data: { bankId, title: editing.title, link: editing.link, docType: editing.docType } }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bankId) }); setIsOpen(false); }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold">المستندات والروابط</h3>
        <Button onClick={() => { setEditing({}); setIsOpen(true); }} size="sm" className="gap-2"><Plus className="w-4 h-4" /> مستند جديد</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {documents.map(d => (
          <Card key={d.id} className="bg-white/5 border-white/10 hover:border-white/20 transition-all cursor-pointer" onClick={() => d.link && window.open(d.link, '_blank')}>
            <CardContent className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-primary/70" />
                <div>
                  <h4 className="font-bold">{d.title}</h4>
                  <p className="text-sm text-white/50">{d.docType}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="text-red-400/50" onClick={(e) => { e.stopPropagation(); deleteDoc.mutate({ id: d.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bankId) }) }); }}><Trash2 className="w-4 h-4" /></Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>إضافة مستند / رابط</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <Input placeholder="عنوان المستند" value={editing?.title || ''} onChange={e => setEditing({...editing, title: e.target.value})} />
            <Input placeholder="الرابط (URL)" value={editing?.link || ''} onChange={e => setEditing({...editing, link: e.target.value})} />
            <Input placeholder="نوع المستند (عقد، تقرير...)" value={editing?.docType || ''} onChange={e => setEditing({...editing, docType: e.target.value})} />
          </div>
          <DialogFooter><Button onClick={handleSave}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
