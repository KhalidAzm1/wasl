/**
 * OrgChartSection — Lucidchart-style interactive org chart
 *
 * Cards:
 *   depth 0  → bg-card  +  ring-primary (root / CEO)
 *   depth 1  → bg-primary  text-primary-foreground
 *   depth 2+ → bg-primary/15  border-primary/30
 *
 * Interactions:
 *   • ✏ Edit button inside card (always visible, top-right)
 *   • 🗑 Delete button inside card (always visible, top-right)
 *   • ➕ Add-child button inside card (always visible, bottom-center)
 *   • Drag entire card → drop ON another card → reparent
 *   • Drag to grey "Root" banner (visible while dragging) → make root
 */

import React, {
  useState, useRef, useCallback, useEffect, useMemo,
} from 'react';
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors,
  useDraggable, useDroppable,
  type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from '@dnd-kit/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  useUpdateBank, useSetOrgChartNodePhoto, getGetBankQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import {
  Plus, Pencil, Trash2, Loader2, Network, Camera,
  GripVertical, ArrowUpToLine,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════ types ══════ */

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

const ROOT_DROP_ID = '__root__';

/* ─── default 6-node template ─────────────────────────────────────────── */
const DEFAULT_NODES: OrgNode[] = [
  { id: 'def-1', name: '', title: '', department: '', parentId: null },
  { id: 'def-2', name: '', title: '', department: '', parentId: 'def-1' },
  { id: 'def-3', name: '', title: '', department: '', parentId: 'def-1' },
  { id: 'def-4', name: '', title: '', department: '', parentId: 'def-1' },
  { id: 'def-5', name: '', title: '', department: '', parentId: 'def-2' },
  { id: 'def-6', name: '', title: '', department: '', parentId: 'def-3' },
];

/* ═══════════════════════════════════════════════════════════ helpers ════ */

function descendants(nodeId: string, nodes: OrgNode[]): Set<string> {
  const out = new Set<string>();
  const q = [nodeId];
  while (q.length) {
    const id = q.shift()!;
    out.add(id);
    nodes.filter(n => n.parentId === id).forEach(n => q.push(n.id));
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════ avatar ═════ */

const PALETTE = [
  '#6D28D9','#2563EB','#0891B2','#059669',
  '#D97706','#DC2626','#7C3AED','#DB2777',
];
function pickColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return PALETTE[h % PALETTE.length];
}

function Avatar({ node, size }: { node: OrgNode; size: number }) {
  const empty = !node.name.trim();
  const initials = node.name.trim()
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '').join('');

  if (!empty && node.photoUrl) {
    return (
      <img src={node.photoUrl} alt={node.name}
        style={{ width: size, height: size }}
        className="rounded-full object-cover border-2 border-white/30 shadow"
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
    );
  }
  if (empty) {
    return (
      <div style={{ width: size, height: size }}
        className="rounded-full bg-foreground/8 border-2 border-dashed border-foreground/20 flex items-center justify-center">
        <Network className="text-foreground/25" style={{ width: size * 0.4, height: size * 0.4 }} />
      </div>
    );
  }
  return (
    <div style={{ width: size, height: size, background: pickColor(node.name), fontSize: size * 0.34 }}
      className="rounded-full flex items-center justify-center font-bold text-white shadow border-2 border-white/20 shrink-0">
      {initials || '?'}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ card face ══ */

/** Pure visual card — no DnD wiring, used in DragOverlay too */
function CardFace({
  node, depth, isDragging = false, isOver = false,
  onEdit, onDelete, onAddChild, onUploadPhoto,
}: {
  node: OrgNode;
  depth: number;
  isDragging?: boolean;
  isOver?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onAddChild?: () => void;
  onUploadPhoto?: (f: File) => void;
}) {
  const photoRef = useRef<HTMLInputElement>(null);
  const empty = !node.name.trim();

  // depth-based background
  const cardCls = cn(
    'relative w-full rounded-xl border transition-all',
    depth === 0 && 'bg-card border-primary/40 ring-2 ring-primary/30 shadow-md',
    depth === 1 && 'bg-primary border-primary shadow-md',
    depth >= 2 && 'bg-primary/10 border-primary/25 shadow-sm',
    isDragging && 'opacity-0 pointer-events-none',
    isOver && !isDragging && 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-[1.03]',
    empty && depth !== 1 && 'border-dashed border-foreground/25',
  );

  const nameCls   = cn('text-[13px] font-bold leading-snug', depth === 1 ? 'text-primary-foreground' : 'text-foreground');
  const titleCls  = cn('text-[11px] mt-0.5', depth === 1 ? 'text-primary-foreground/70' : 'text-muted-foreground');
  const deptCls   = cn('text-[10px] font-semibold mt-1 px-2 py-0.5 rounded-full',
    depth === 1
      ? 'bg-white/20 text-primary-foreground'
      : 'bg-primary/10 text-primary');
  const btnBase   = cn('w-6 h-6 rounded-md flex items-center justify-center transition-colors');
  const editBtn   = cn(btnBase,
    depth === 1
      ? 'text-primary-foreground/60 hover:text-primary-foreground hover:bg-white/20'
      : 'text-muted-foreground hover:text-primary hover:bg-primary/10');
  const delBtn    = cn(btnBase,
    depth === 1
      ? 'text-primary-foreground/60 hover:text-red-300 hover:bg-red-500/20'
      : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10');

  return (
    <div className={cardCls} style={{ width: 164 }}>

      {/* ── top strip: grip  +  edit/delete ── */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-2 pt-2">
        {/* drag grip — rendered here so the parent can attach listeners */}
        <div className={cn('drag-grip cursor-grab active:cursor-grabbing',
          depth === 1 ? 'text-primary-foreground/40' : 'text-foreground/25')}>
          <GripVertical className="w-3.5 h-3.5" />
        </div>
        <div className="flex gap-1">
          {onEdit && (
            <button onClick={e => { e.stopPropagation(); onEdit(); }} title="تعديل" className={editBtn}>
              <Pencil className="w-3 h-3" />
            </button>
          )}
          {onDelete && (
            <button onClick={e => { e.stopPropagation(); onDelete(); }} title="حذف" className={delBtn}>
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* ── avatar ── */}
      <div className="flex justify-center mt-7 mb-2">
        <button className="relative group/av rounded-full" title="رفع صورة"
          onClick={e => { e.stopPropagation(); onUploadPhoto && photoRef.current?.click(); }}>
          <Avatar node={node} size={depth === 0 ? 64 : 54} />
          {onUploadPhoto && !empty && (
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover/av:opacity-100 transition-opacity flex items-center justify-center">
              <Camera className="w-3.5 h-3.5 text-white" />
            </div>
          )}
        </button>
        {onUploadPhoto && (
          <input ref={photoRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onUploadPhoto(f); e.target.value = ''; }} />
        )}
      </div>

      {/* ── text ── */}
      <div className="px-3 pb-3 text-center">
        {empty ? (
          <button onClick={e => { e.stopPropagation(); onEdit?.(); }}
            className={cn('text-[11px] font-medium border border-dashed rounded-lg px-3 py-1 w-full transition-colors',
              depth === 1
                ? 'border-primary-foreground/30 text-primary-foreground/50 hover:text-primary-foreground'
                : 'border-foreground/20 text-muted-foreground hover:text-primary')}>
            + أضف اسماً
          </button>
        ) : (
          <>
            <p className={nameCls}>{node.name}</p>
            {node.title && <p className={titleCls}>{node.title}</p>}
            {node.department && <span className={deptCls}>{node.department}</span>}
          </>
        )}
      </div>

      {/* ── add-child button ── */}
      {onAddChild && (
        <div className="flex justify-center pb-2">
          <button
            onClick={e => { e.stopPropagation(); onAddChild(); }}
            title="إضافة تابع مباشر"
            className={cn('flex items-center gap-0.5 text-[10px] font-medium rounded-full px-2 py-0.5 transition-colors',
              depth === 1
                ? 'text-primary-foreground/50 hover:text-primary-foreground hover:bg-white/10'
                : 'text-muted-foreground hover:text-primary hover:bg-primary/10')}>
            <Plus className="w-2.5 h-2.5" />
            إضافة تابع
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ draggable node ══ */

function DndNode({
  node, depth, allNodes, activeId, overId,
  onEdit, onDelete, onAddChild, onUploadPhoto,
}: {
  node: OrgNode;
  depth: number;
  allNodes: OrgNode[];
  activeId: string | null;
  overId: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onAddChild: () => void;
  onUploadPhoto: (f: File) => void;
}) {
  const desc = useMemo(() => activeId ? descendants(activeId, allNodes) : new Set<string>(), [activeId, allNodes]);

  const {
    attributes, listeners,
    setNodeRef: setDrag,
    isDragging,
  } = useDraggable({ id: node.id });

  const {
    setNodeRef: setDrop,
    isOver: rawIsOver,
  } = useDroppable({ id: node.id });

  // only highlight if this node is NOT a descendant of the dragged node
  const isOver = rawIsOver && !desc.has(node.id) && node.id !== activeId;

  const ref = (el: HTMLElement | null) => { setDrag(el); setDrop(el); };

  return (
    <div ref={ref} style={{ touchAction: 'none' }}
      {...attributes} {...listeners}
      className="cursor-grab active:cursor-grabbing">
      <CardFace
        node={node}
        depth={depth}
        isDragging={isDragging}
        isOver={isOver}
        onEdit={onEdit}
        onDelete={onDelete}
        onAddChild={onAddChild}
        onUploadPhoto={onUploadPhoto}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ recursive tree ══ */

function OrgTree({
  node, allNodes, depth, activeId, overId,
  onEdit, onDelete, onAddChild, onUploadPhoto,
}: {
  node: OrgNode;
  allNodes: OrgNode[];
  depth: number;
  activeId: string | null;
  overId: string | null;
  onEdit: (n: OrgNode) => void;
  onDelete: (n: OrgNode) => void;
  onAddChild: (parentId: string) => void;
  onUploadPhoto: (node: OrgNode, f: File) => void;
}) {
  const children = allNodes.filter(n => n.parentId === node.id);

  return (
    <div className="org-node">
      <DndNode
        node={node}
        depth={depth}
        allNodes={allNodes}
        activeId={activeId}
        overId={overId}
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
                activeId={activeId}
                overId={overId}
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

/* ═══════════════════════════════════════════════════════ root drop zone ══ */

function RootDropZone({ visible }: { visible: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: ROOT_DROP_ID });
  if (!visible) return null;
  return (
    <div ref={setNodeRef}
      className={cn(
        'flex items-center justify-center gap-2 rounded-xl border-2 border-dashed px-8 py-3 text-sm font-medium mb-6 transition-all',
        isOver
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-foreground/15 text-foreground/30',
      )}>
      <ArrowUpToLine className="w-4 h-4" />
      أسقط هنا لجعله مستوى أعلى
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ edit dialog ════ */

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
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
        {label}
      </label>
      <Input value={(form[key] as string) ?? ''} placeholder={placeholder} dir={dir}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="h-9 text-sm" />
    </div>
  );

  const selfDesc = new Set<string>();
  if (initial.id) descendants(initial.id, allNodes).forEach(id => selfDesc.add(id));
  const parentOpts = allNodes.filter(n => !selfDesc.has(n.id));

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
            {field('name',       'الاسم *',           'أحمد العمري')}
            {field('title',      'المسمى الوظيفي',    'مدير تنفيذي')}
            {field('department', 'القسم / الإدارة',   'العمليات')}
            {field('phone',      'الجوال',            '+966 5x', 'ltr')}
          </div>
          {field('email', 'البريد الإلكتروني', 'name@bank.com', 'ltr')}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
              يتبع لـ (المدير المباشر)
            </label>
            <select value={form.parentId ?? ''}
              onChange={e => setForm(f => ({ ...f, parentId: e.target.value || null }))}
              className="w-full h-9 rounded-md border border-input bg-background text-sm px-2 text-foreground outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">— مستوى أعلى (بدون مدير) —</option>
              {parentOpts.map(n => (
                <option key={n.id} value={n.id}>
                  {n.name || '(فارغ)'}{n.title ? ` · ${n.title}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>إلغاء</Button>
          <Button size="sm" disabled={saving}
            onClick={() => onSave({ ...form, id: initial.id } as any)}>
            {saving && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════ main section ═══ */

export function OrgChartSection({ bank }: { bank: any }) {
  const isFirst = (bank.orgChart ?? []).length === 0;
  const [nodes, setNodes] = useState<OrgNode[]>(() =>
    isFirst ? DEFAULT_NODES : (bank.orgChart ?? []),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId,   setOverId]   = useState<string | null>(null);
  const [dialog,   setDialog]   = useState<{ open: boolean; initial: Partial<OrgNode> & { id?: string } } | null>(null);

  const queryClient = useQueryClient();
  const { toast }   = useToast();
  const updateBank  = useUpdateBank();
  const uploadPhoto = useSetOrgChartNodePhoto();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // persist default template on first load
  useEffect(() => {
    if (isFirst) {
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

  /* ── DnD handlers ── */
  const handleDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id));
  const handleDragOver  = ({ over }: DragOverEvent)    => setOverId(over ? String(over.id) : null);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    setOverId(null);
    if (!over) return;

    const draggedId = String(active.id);
    const targetId  = String(over.id);
    if (draggedId === targetId) return;

    if (targetId === ROOT_DROP_ID) {
      const next = nodes.map(n => n.id === draggedId ? { ...n, parentId: null } : n);
      setNodes(next);
      save(next);
      return;
    }

    // prevent cycles
    if (descendants(draggedId, nodes).has(targetId)) return;

    const next = nodes.map(n => n.id === draggedId ? { ...n, parentId: targetId } : n);
    setNodes(next);
    save(next);
  };

  /* ── dialog save ── */
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

  /* ── delete ── */
  const handleDelete = (node: OrgNode) => {
    const next = nodes
      .filter(n => n.id !== node.id)
      .map(n => n.parentId === node.id ? { ...n, parentId: node.parentId ?? null } : n);
    setNodes(next);
    save(next);
  };

  /* ── photo upload ── */
  const handleUploadPhoto = (node: OrgNode, file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      uploadPhoto.mutate({ id: bank.id, nodeId: node.id, data: { dataUrl: e.target?.result as string } }, {
        onSuccess: (res: any) => {
          const next = nodes.map(n => n.id === node.id ? { ...n, photoUrl: res?.photoUrl ?? null } : n);
          setNodes(next);
          save(next);
        },
        onError: () => toast({ title: 'فشل رفع الصورة', variant: 'destructive' }),
      });
    };
    reader.readAsDataURL(file);
  };

  const roots      = nodes.filter(n => !n.parentId);
  const activeNode = activeId ? nodes.find(n => n.id === activeId) : null;

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
            <Button size="sm" variant="outline" className="ml-auto h-7 text-xs gap-1.5"
              onClick={() => setDialog({ open: true, initial: { parentId: null } })}>
              <Plus className="w-3 h-3" /> إضافة شخص
            </Button>
          </CardTitle>
        </CardHeader>

        {/* Chart canvas */}
        <CardContent className="p-0">
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="overflow-x-auto rounded-b-xl"
              style={{
                background: 'hsl(var(--muted)/0.3)',
                backgroundImage: 'radial-gradient(circle, hsl(var(--foreground)/0.06) 1px, transparent 1px)',
                backgroundSize: '22px 22px',
              }}>
              <div className="min-w-fit px-12 py-8">

                {/* Root drop zone — only visible while dragging */}
                <RootDropZone visible={!!activeId} />

                <div className="flex gap-16 items-start justify-center">
                  {roots.map(root => (
                    <OrgTree
                      key={root.id}
                      node={root}
                      allNodes={nodes}
                      depth={0}
                      activeId={activeId}
                      overId={overId}
                      onEdit={n => setDialog({ open: true, initial: { ...n } })}
                      onDelete={handleDelete}
                      onAddChild={parentId => setDialog({ open: true, initial: { parentId } })}
                      onUploadPhoto={handleUploadPhoto}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Ghost card while dragging */}
            <DragOverlay dropAnimation={null}>
              {activeNode && (
                <div className="rotate-1 opacity-90 drop-shadow-2xl pointer-events-none">
                  <CardFace node={activeNode} depth={nodes.find(n => n.id === activeNode.id) ? 1 : 0} />
                </div>
              )}
            </DragOverlay>
          </DndContext>
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
