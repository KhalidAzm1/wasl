import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  useUpdateBank, useSetOrgChartNodePhoto, getGetBankQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Plus, Pencil, Trash2, Loader2, Network, UploadCloud } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

export type OrgNode = {
  id: string;
  name: string;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  department?: string | null;
  parentId?: string | null;
  photoUrl?: string | null;
};

const EMPTY_NODE: Omit<OrgNode, 'id'> = {
  name: '', title: '', phone: '', email: '', department: '', parentId: null, photoUrl: null,
};

// ── Default 6-node template ───────────────────────────────────────────────────

const DEFAULT_NODES: OrgNode[] = [
  { id: 'def-1', name: '', title: '', department: '', parentId: null },
  { id: 'def-2', name: '', title: '', department: '', parentId: 'def-1' },
  { id: 'def-3', name: '', title: '', department: '', parentId: 'def-1' },
  { id: 'def-4', name: '', title: '', department: '', parentId: 'def-1' },
  { id: 'def-5', name: '', title: '', department: '', parentId: 'def-2' },
  { id: 'def-6', name: '', title: '', department: '', parentId: 'def-3' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDescendantIds(nodeId: string, nodes: OrgNode[]): Set<string> {
  const result = new Set<string>();
  const queue = [nodeId];
  while (queue.length) {
    const id = queue.shift()!;
    result.add(id);
    nodes.filter(n => n.parentId === id).forEach(n => queue.push(n.id));
  }
  return result;
}

// ── Avatar ───────────────────────────────────────────────────────────────────

const PALETTE: string[] = [
  '#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#06B6D4','#6366F1','#EC4899',
];
function pickColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return PALETTE[h % PALETTE.length];
}

function NodeAvatar({ node, size }: { node: OrgNode; size: number }) {
  const isEmpty = !node.name.trim();
  const initials = node.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');

  if (!isEmpty && node.photoUrl) {
    return (
      <img src={node.photoUrl} alt={node.name}
        style={{ width: size, height: size }}
        className="rounded-full object-cover border-2 border-white shadow-sm"
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
    );
  }

  return (
    <div
      style={{
        width: size, height: size,
        background: isEmpty ? '#E5E7EB' : pickColor(node.name),
        fontSize: size * 0.35,
      }}
      className="rounded-full flex items-center justify-center font-bold text-white border-2 border-white shadow-sm shrink-0"
    >
      {isEmpty ? (
        <svg width={size * 0.45} height={size * 0.45} viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
          <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
      ) : (initials || '?')}
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────

function OrgCard({
  node, isRoot,
  onEdit, onDelete, onAddChild, onUploadPhoto,
}: {
  node: OrgNode;
  isRoot: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAddChild: () => void;
  onUploadPhoto: (f: File) => void;
}) {
  const photoRef = useRef<HTMLInputElement>(null);
  const isEmpty = !node.name.trim();

  return (
    <div className="flex flex-col items-center">
      {/* Card */}
      <div className={cn(
        'relative flex flex-col items-center rounded-2xl border-2 shadow-sm transition-shadow hover:shadow-md',
        isRoot
          ? 'border-blue-300 bg-blue-500'
          : isEmpty
            ? 'border-dashed border-gray-300 bg-white'
            : 'border-gray-200 bg-white',
      )} style={{ width: 156 }}>

        {/* Edit & Delete buttons — always visible top-right */}
        <div className="absolute top-2 right-2 flex gap-1">
          <button
            onClick={onEdit}
            title="تعديل"
            className={cn(
              'w-6 h-6 rounded-lg flex items-center justify-center transition-colors',
              isRoot
                ? 'bg-white/20 hover:bg-white/40 text-white'
                : 'bg-gray-100 hover:bg-blue-100 text-gray-400 hover:text-blue-500',
            )}
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={onDelete}
            title="حذف"
            className={cn(
              'w-6 h-6 rounded-lg flex items-center justify-center transition-colors',
              isRoot
                ? 'bg-white/20 hover:bg-red-500/80 text-white'
                : 'bg-gray-100 hover:bg-red-100 text-gray-400 hover:text-red-500',
            )}
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        {/* Avatar */}
        <button
          className="mt-5 mb-2.5 relative group/av"
          title="رفع صورة"
          onClick={() => photoRef.current?.click()}
        >
          <NodeAvatar node={node} size={56} />
          <div className="absolute inset-0 rounded-full bg-black/35 opacity-0 group-hover/av:opacity-100 transition-opacity flex items-center justify-center">
            <UploadCloud className="w-3.5 h-3.5 text-white" />
          </div>
        </button>
        <input ref={photoRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onUploadPhoto(f); e.target.value = ''; }} />

        {/* Text content */}
        <div className="px-3 pb-4 w-full text-center">
          {isEmpty ? (
            <button onClick={onEdit} className={cn('text-xs font-medium', isRoot ? 'text-blue-100' : 'text-gray-400')}>
              اضغط للإضافة
            </button>
          ) : (
            <>
              <p className={cn('text-[13px] font-bold leading-snug', isRoot ? 'text-white' : 'text-gray-800')}>
                {node.name}
              </p>
              {node.title && (
                <p className={cn('text-[11px] mt-0.5', isRoot ? 'text-blue-100' : 'text-gray-500')}>
                  {node.title}
                </p>
              )}
              {node.department && (
                <p className={cn('text-[10px] mt-0.5 font-semibold', isRoot ? 'text-blue-200' : 'text-blue-400')}>
                  {node.department}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add child — always visible, below card */}
      <button
        onClick={onAddChild}
        className="mt-1.5 flex items-center gap-1 text-[11px] text-gray-400 hover:text-blue-500 transition-colors font-medium"
      >
        <Plus className="w-3 h-3" /> إضافة تابع
      </button>
    </div>
  );
}

// ── Recursive Tree ────────────────────────────────────────────────────────────

function OrgTree({
  node, allNodes, depth,
  onEdit, onDelete, onAddChild, onUploadPhoto,
}: {
  node: OrgNode;
  allNodes: OrgNode[];
  depth: number;
  onEdit: (n: OrgNode) => void;
  onDelete: (n: OrgNode) => void;
  onAddChild: (parentId: string) => void;
  onUploadPhoto: (node: OrgNode, f: File) => void;
}) {
  const children = allNodes.filter(n => n.parentId === node.id);

  return (
    <div className="org-node">
      <OrgCard
        node={node}
        isRoot={depth === 0}
        onEdit={() => onEdit(node)}
        onDelete={() => onDelete(node)}
        onAddChild={() => onAddChild(node.id)}
        onUploadPhoto={f => onUploadPhoto(node, f)}
      />
      {children.length > 0 && (
        <div className="org-children">
          {children.map(child => (
            <div key={child.id} className="org-child-col">
              <OrgTree
                node={child}
                allNodes={allNodes}
                depth={depth + 1}
                onEdit={onEdit}
                onDelete={onDelete}
                onAddChild={onAddChild}
                onUploadPhoto={onUploadPhoto}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Edit Dialog ───────────────────────────────────────────────────────────────

function NodeDialog({
  open, onClose, initial, allNodes, onSave, saving,
}: {
  open: boolean;
  onClose: () => void;
  initial: Partial<OrgNode> & { id?: string };
  allNodes: OrgNode[];
  onSave: (data: Omit<OrgNode, 'id'> & { id?: string }) => void;
  saving?: boolean;
}) {
  const [form, setForm] = useState<Partial<OrgNode>>({ ...EMPTY_NODE, ...initial });
  useEffect(() => { if (open) setForm({ ...EMPTY_NODE, ...initial }); }, [open]);

  const field = (key: keyof OrgNode, label: string, placeholder?: string, dir?: 'ltr') => (
    <div className="space-y-1">
      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">{label}</label>
      <Input
        value={(form[key] as string) ?? ''}
        placeholder={placeholder}
        dir={dir}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="h-9 text-sm"
      />
    </div>
  );

  const selfAndDesc = new Set<string>();
  if (initial.id) getDescendantIds(initial.id, allNodes).forEach(id => selfAndDesc.add(id));
  const parentOptions = allNodes.filter(n => !selfAndDesc.has(n.id));

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{initial.id ? 'تعديل الشخص' : 'إضافة شخص جديد'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            {field('name', 'الاسم *', 'أحمد العمري')}
            {field('title', 'المسمى الوظيفي', 'مدير تنفيذي')}
            {field('department', 'القسم / الإدارة', 'العمليات')}
            {field('phone', 'الجوال', '+966 5x', 'ltr')}
          </div>
          {field('email', 'البريد الإلكتروني', 'name@bank.com', 'ltr')}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">يتبع لـ</label>
            <select
              value={form.parentId ?? ''}
              onChange={e => setForm(f => ({ ...f, parentId: e.target.value || null }))}
              className="w-full h-9 rounded-md border border-input bg-background text-sm px-2 outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">— مستوى أعلى (بدون مدير) —</option>
              {parentOptions.map(n => (
                <option key={n.id} value={n.id}>
                  {n.name || '(فارغ)'}{n.title ? ` · ${n.title}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>إلغاء</Button>
          <Button
            size="sm"
            disabled={saving}
            onClick={() => onSave({ ...form, id: initial.id } as any)}
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Section ──────────────────────────────────────────────────────────────

export function OrgChartSection({ bank }: { bank: any }) {
  const isFirstLoad = (bank.orgChart ?? []).length === 0;
  const [nodes, setNodes] = useState<OrgNode[]>(() =>
    isFirstLoad ? DEFAULT_NODES : (bank.orgChart ?? []),
  );
  const [dialog, setDialog] = useState<{ open: boolean; initial: Partial<OrgNode> & { id?: string } } | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateBank = useUpdateBank();
  const uploadPhoto = useSetOrgChartNodePhoto();

  // Save the default template immediately so it persists on refresh
  useEffect(() => {
    if (isFirstLoad) {
      updateBank.mutate({
        id: bank.id,
        data: {
          nameEn: bank.nameEn, nameAr: bank.nameAr,
          category: bank.category, status: bank.status,
          riskLevel: bank.riskLevel, priorityImpact: bank.priorityImpact,
          orgChart: DEFAULT_NODES,
        },
      });
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = useCallback((next: OrgNode[], opts?: { onSuccess?: () => void }) => {
    updateBank.mutate({
      id: bank.id,
      data: {
        nameEn: bank.nameEn, nameAr: bank.nameAr,
        category: bank.category, status: bank.status,
        riskLevel: bank.riskLevel, priorityImpact: bank.priorityImpact,
        orgChart: next,
      },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bank.id) });
        opts?.onSuccess?.();
      },
      onError: () => toast({ title: 'فشل الحفظ، حاول مجدداً', variant: 'destructive' }),
    });
  }, [bank, updateBank, queryClient, toast]);

  const handleDialogSave = (data: Omit<OrgNode, 'id'> & { id?: string }) => {
    let next: OrgNode[];
    if (data.id) {
      next = nodes.map(n => n.id === data.id ? { ...n, ...data, id: n.id } : n);
    } else {
      const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      next = [...nodes, { ...data, id } as OrgNode];
    }
    setNodes(next);
    save(next, { onSuccess: () => setDialog(null) });
  };

  const handleDelete = (node: OrgNode) => {
    const next = nodes
      .filter(n => n.id !== node.id)
      .map(n => n.parentId === node.id ? { ...n, parentId: node.parentId ?? null } : n);
    setNodes(next);
    save(next);
  };

  const handleUploadPhoto = (node: OrgNode, file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target?.result as string;
      uploadPhoto.mutate({ id: bank.id, nodeId: node.id, data: { dataUrl } }, {
        onSuccess: (res: any) => {
          const photoUrl = res?.photoUrl ?? null;
          const next = nodes.map(n => n.id === node.id ? { ...n, photoUrl } : n);
          setNodes(next);
          save(next);
        },
        onError: () => toast({ title: 'فشل رفع الصورة', variant: 'destructive' }),
      });
    };
    reader.readAsDataURL(file);
  };

  const roots = nodes.filter(n => !n.parentId);

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="w-4 h-4 text-primary" />
            الهيكل التنظيمي
            {(updateBank.isPending || uploadPhoto.isPending) && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400 ml-1" />
            )}
            <Button
              size="sm"
              variant="outline"
              className="ml-auto h-7 text-xs gap-1"
              onClick={() => setDialog({ open: true, initial: { parentId: null } })}
            >
              <Plus className="w-3 h-3" /> إضافة شخص
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto bg-gray-50/60">
            <div className="min-w-fit px-10 py-8">
              <div className="flex gap-14 items-start justify-center">
                {roots.map(root => (
                  <OrgTree
                    key={root.id}
                    node={root}
                    allNodes={nodes}
                    depth={0}
                    onEdit={n => setDialog({ open: true, initial: { ...n } })}
                    onDelete={handleDelete}
                    onAddChild={parentId => setDialog({ open: true, initial: { parentId } })}
                    onUploadPhoto={handleUploadPhoto}
                  />
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {dialog && (
        <NodeDialog
          open={dialog.open}
          onClose={() => setDialog(null)}
          initial={dialog.initial}
          allNodes={nodes}
          onSave={handleDialogSave}
          saving={updateBank.isPending}
        />
      )}
    </>
  );
}
