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
import { Plus, Pencil, Trash2, Loader2, Network, UploadCloud, Camera } from 'lucide-react';

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

const PALETTE = ['#6D28D9','#2563EB','#0891B2','#059669','#D97706','#DC2626','#7C3AED','#DB2777'];
function pickColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return PALETTE[h % PALETTE.length];
}

function NodeAvatar({ node, size, isEmpty }: { node: OrgNode; size: number; isEmpty: boolean }) {
  const initials = node.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');

  if (!isEmpty && node.photoUrl) {
    return (
      <img
        src={node.photoUrl}
        alt={node.name}
        style={{ width: size, height: size }}
        className="rounded-full object-cover"
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }

  if (isEmpty) {
    return (
      <div
        style={{ width: size, height: size }}
        className="rounded-full bg-muted border-2 border-dashed border-foreground/20 flex items-center justify-center"
      >
        <Network className="w-5 h-5 text-foreground/20" />
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size, background: pickColor(node.name), fontSize: size * 0.34 }}
      className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
    >
      {initials || '?'}
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
    <div className="flex flex-col items-center" style={{ width: 168 }}>

      {/* ── Card body ──────────────────────────────────────────── */}
      <div className={cn(
        'relative w-full rounded-2xl border transition-shadow hover:shadow-lg',
        'bg-card border-border shadow-sm',
        // Root gets a primary-colour top accent bar via ring trick
        isRoot && 'ring-2 ring-primary/60',
        isEmpty && 'border-dashed border-foreground/20',
      )}>

        {/* Primary accent bar at top for root */}
        {isRoot && (
          <div className="absolute top-0 inset-x-0 h-1 rounded-t-2xl bg-primary" />
        )}

        {/* Edit / Delete — top-right, always visible */}
        <div className="absolute top-2.5 right-2.5 flex gap-1 z-10">
          <button
            onClick={onEdit}
            title="تعديل"
            className="w-6 h-6 rounded-md flex items-center justify-center bg-muted hover:bg-primary/15 hover:text-primary text-muted-foreground transition-colors"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={onDelete}
            title="حذف"
            className="w-6 h-6 rounded-md flex items-center justify-center bg-muted hover:bg-destructive/15 hover:text-destructive text-muted-foreground transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        {/* Avatar with upload overlay */}
        <div className="flex justify-center mt-5 mb-3">
          <button
            className="relative group/av rounded-full"
            title="رفع صورة"
            onClick={() => photoRef.current?.click()}
          >
            <NodeAvatar node={node} size={60} isEmpty={isEmpty} />
            {!isEmpty && (
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover/av:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-4 h-4 text-white" />
              </div>
            )}
          </button>
          <input ref={photoRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onUploadPhoto(f); e.target.value = ''; }} />
        </div>

        {/* Text */}
        <div className="px-3 pb-4 text-center">
          {isEmpty ? (
            <button
              onClick={onEdit}
              className="text-[11px] text-muted-foreground hover:text-primary transition-colors font-medium border border-dashed border-foreground/20 rounded-lg px-3 py-1.5 w-full"
            >
              + اضغط لإضافة اسم
            </button>
          ) : (
            <>
              <p className="text-[13px] font-bold text-foreground leading-snug">{node.name}</p>
              {node.title && (
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{node.title}</p>
              )}
              {node.department && (
                <span className="inline-block mt-1.5 text-[10px] font-semibold text-primary bg-primary/10 rounded-full px-2 py-0.5">
                  {node.department}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add child link */}
      <button
        onClick={onAddChild}
        className="mt-2 flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors"
      >
        <Plus className="w-3 h-3" />
        إضافة تابع
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
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">{label}</label>
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
          <DialogTitle className="flex items-center gap-2">
            <Network className="w-4 h-4 text-primary" />
            {initial.id ? 'تعديل الشخص' : 'إضافة شخص جديد'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            {field('name',       'الاسم *',              'أحمد العمري')}
            {field('title',      'المسمى الوظيفي',       'مدير تنفيذي')}
            {field('department', 'القسم / الإدارة',      'العمليات')}
            {field('phone',      'الجوال',               '+966 5x', 'ltr')}
          </div>
          {field('email', 'البريد الإلكتروني', 'name@bank.com', 'ltr')}

          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
              يتبع لـ (المدير المباشر)
            </label>
            <select
              value={form.parentId ?? ''}
              onChange={e => setForm(f => ({ ...f, parentId: e.target.value || null }))}
              className="w-full h-9 rounded-md border border-input bg-background text-sm px-2 text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">— مستوى أعلى (بدون مدير مباشر) —</option>
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
          <Button size="sm" disabled={saving} onClick={() => onSave({ ...form, id: initial.id } as any)}>
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

  // Persist the default template on first load
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
      <Card>
        {/* Header */}
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="w-4 h-4 text-primary" />
            الهيكل التنظيمي
            {(updateBank.isPending || uploadPhoto.isPending) && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground ml-1" />
            )}
            <Button
              size="sm"
              variant="outline"
              className="ml-auto h-7 text-xs gap-1.5"
              onClick={() => setDialog({ open: true, initial: { parentId: null } })}
            >
              <Plus className="w-3 h-3" />
              إضافة شخص
            </Button>
          </CardTitle>
        </CardHeader>

        {/* Chart area — uses bg-muted/40 so it adapts to dark/light */}
        <CardContent className="p-0">
          <div className="overflow-x-auto rounded-b-xl">
            <div
              className="min-w-fit px-12 py-10 bg-muted/30"
              style={{
                backgroundImage: 'radial-gradient(circle, hsl(var(--foreground)/0.05) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            >
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
