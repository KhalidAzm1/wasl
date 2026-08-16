/**
 * OrgChartSection — Lucidchart-style interactive org chart
 *
 * Modes:
 *   View mode  (default) — cards are read-only, clean look, tap photo to enlarge
 *   Edit mode  (pencil icon in header) — drag, edit, delete, add-child enabled
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
  GripVertical, ArrowUpToLine, Lock, X, ZoomIn,
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

/* ═══════════════════════════════════════════════════════ photo lightbox ══ */

function PhotoLightbox({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}>
      <button
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        onClick={onClose}>
        <X className="w-5 h-5" />
      </button>
      <div className="flex flex-col items-center gap-3 max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <img
          src={url}
          alt={name}
          className="w-64 h-64 rounded-2xl object-cover shadow-2xl border-4 border-white/20"
        />
        {name && (
          <p className="text-white font-semibold text-lg text-center drop-shadow">{name}</p>
        )}
      </div>
    </div>
  );
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

function Avatar({
  node, size, editMode, onUploadPhoto, onExpand,
}: {
  node: OrgNode;
  size: number;
  editMode?: boolean;
  onUploadPhoto?: (f: File) => void;
  onExpand?: () => void;
}) {
  const photoRef = useRef<HTMLInputElement>(null);
  const empty    = !node.name.trim();
  const hasPhoto = !empty && !!node.photoUrl;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editMode && onUploadPhoto) {
      photoRef.current?.click();
    } else if (!editMode && hasPhoto && onExpand) {
      onExpand();
    }
  };

  const inner = (() => {
    if (hasPhoto) {
      return (
        <img src={node.photoUrl!} alt={node.name}
          style={{ width: size, height: size }}
          className="rounded-full object-cover border-2 border-border shadow"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      );
    }
    if (empty) {
      return (
        <div style={{ width: size, height: size }}
          className="rounded-full bg-muted border-2 border-dashed border-border flex items-center justify-center">
          <Network className="text-muted-foreground/40" style={{ width: size * 0.4, height: size * 0.4 }} />
        </div>
      );
    }
    const initials = node.name.trim()
      .split(/\s+/).filter(Boolean).slice(0, 2)
      .map(w => w[0]?.toUpperCase() ?? '').join('');
    return (
      <div style={{ width: size, height: size, background: pickColor(node.name), fontSize: size * 0.34 }}
        className="rounded-full flex items-center justify-center font-bold text-white shadow border-2 border-white/20 shrink-0">
        {initials || '?'}
      </div>
    );
  })();

  const canInteract = (editMode && onUploadPhoto) || (!editMode && hasPhoto && onExpand);

  return (
    <button
      type="button"
      disabled={!canInteract}
      className={cn('relative group/av rounded-full block', canInteract ? 'cursor-pointer' : 'cursor-default')}
      onClick={handleClick}>
      {inner}
      {/* Edit overlay */}
      {editMode && onUploadPhoto && !empty && (
        <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover/av:opacity-100 transition-opacity flex items-center justify-center">
          <Camera className="w-3.5 h-3.5 text-white" />
        </div>
      )}
      {/* View overlay */}
      {!editMode && hasPhoto && onExpand && (
        <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover/av:opacity-100 transition-opacity flex items-center justify-center">
          <ZoomIn className="text-white" style={{ width: size * 0.28, height: size * 0.28 }} />
        </div>
      )}
      {onUploadPhoto && (
        <input ref={photoRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onUploadPhoto(f); e.target.value = ''; }} />
      )}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════ card face ══ */

function CardFace({
  node, depth, editMode = false, isDragging = false, isOver = false,
  onEdit, onDelete, onAddChild, onUploadPhoto, onExpandPhoto,
}: {
  node: OrgNode;
  depth: number;
  editMode?: boolean;
  isDragging?: boolean;
  isOver?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onAddChild?: () => void;
  onUploadPhoto?: (f: File) => void;
  onExpandPhoto?: () => void;
}) {
  const empty = !node.name.trim();

  // All cards use the same style — only root gets a top accent bar
  const cardCls = cn(
    'relative w-full rounded-xl bg-card border border-border transition-all select-none',
    depth === 0 && 'ring-2 ring-primary/30 shadow-md',
    depth > 0  && 'shadow-sm',
    isDragging  && 'opacity-0 pointer-events-none',
    isOver && !isDragging && 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-[1.03]',
    empty && 'border-dashed',
    editMode && 'cursor-grab active:cursor-grabbing',
  );

  return (
    <div className="flex flex-col items-center gap-1" style={{ width: 164 }}>
      {/* ── card box ── */}
      <div className={cardCls} style={{ width: 164 }}>
        {/* root accent strip */}
        {depth === 0 && (
          <div className="absolute top-0 inset-x-0 h-1 bg-primary rounded-t-xl" />
        )}

        {/* top-bar: grip + edit/delete (edit mode only) */}
        {editMode && (
          <div className="absolute top-0 inset-x-0 flex items-center justify-between px-2 pt-2">
            <div className="text-muted-foreground/30">
              <GripVertical className="w-3.5 h-3.5" />
            </div>
            <div className="flex gap-1">
              {onEdit && (
                <button onClick={e => { e.stopPropagation(); onEdit(); }}
                  title="Edit"
                  className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                  <Pencil className="w-3 h-3" />
                </button>
              )}
              {onDelete && (
                <button onClick={e => { e.stopPropagation(); onDelete(); }}
                  title="Delete"
                  className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* avatar */}
        <div className={cn('flex justify-center mb-2', editMode ? 'mt-7' : depth === 0 ? 'mt-5' : 'mt-4')}>
          <Avatar
            node={node}
            size={depth === 0 ? 64 : 52}
            editMode={editMode}
            onUploadPhoto={onUploadPhoto}
            onExpand={onExpandPhoto}
          />
        </div>

        {/* text */}
        <div className="px-3 pb-3 text-center">
          {empty ? (
            editMode ? (
              <button onClick={e => { e.stopPropagation(); onEdit?.(); }}
                className="text-[11px] font-medium border border-dashed border-foreground/20 rounded-lg px-3 py-1 w-full text-muted-foreground hover:text-primary transition-colors">
                + Add name
              </button>
            ) : (
              <p className="text-[11px] text-foreground/25">—</p>
            )
          ) : (
            <>
              <p className="text-[13px] font-bold leading-snug text-foreground">{node.name}</p>
              {node.title && (
                <p className="text-[11px] mt-0.5 text-muted-foreground">{node.title}</p>
              )}
              {node.department && (
                <span className="inline-block text-[10px] font-semibold mt-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {node.department}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── add-child button — outside the card box (edit mode only) ── */}
      {editMode && onAddChild && (
        <button
          onClick={e => { e.stopPropagation(); onAddChild(); }}
          title="Add direct report"
          className="flex items-center gap-1 text-[10px] font-medium rounded-full border border-dashed border-foreground/20 px-3 py-1 text-muted-foreground hover:text-primary hover:border-primary hover:bg-primary/5 transition-colors">
          <Plus className="w-2.5 h-2.5" />
          Add report
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════ draggable node ═════ */

function DndNode({
  node, depth, allNodes, editMode, activeId, overId,
  onEdit, onDelete, onAddChild, onUploadPhoto, onExpandPhoto,
}: {
  node: OrgNode;
  depth: number;
  allNodes: OrgNode[];
  editMode: boolean;
  activeId: string | null;
  overId: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onAddChild: () => void;
  onUploadPhoto: (f: File) => void;
  onExpandPhoto: () => void;
}) {
  const desc = useMemo(
    () => activeId ? descendants(activeId, allNodes) : new Set<string>(),
    [activeId, allNodes],
  );

  const { attributes, listeners, setNodeRef: setDrag, isDragging } = useDraggable({
    id: node.id,
    disabled: !editMode,
  });
  const { setNodeRef: setDrop, isOver: rawIsOver } = useDroppable({
    id: node.id,
    disabled: !editMode,
  });

  const isOver = rawIsOver && !desc.has(node.id) && node.id !== activeId;
  const ref = (el: HTMLElement | null) => { setDrag(el); setDrop(el); };

  return (
    <div ref={ref} style={{ touchAction: 'none' }} {...attributes} {...(editMode ? listeners : {})}>
      <CardFace
        node={node}
        depth={depth}
        editMode={editMode}
        isDragging={isDragging}
        isOver={isOver}
        onEdit={onEdit}
        onDelete={onDelete}
        onAddChild={onAddChild}
        onUploadPhoto={onUploadPhoto}
        onExpandPhoto={onExpandPhoto}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════ recursive tree ═════ */

function OrgTree({
  node, allNodes, depth, editMode, activeId, overId,
  onEdit, onDelete, onAddChild, onUploadPhoto, onExpandPhoto,
}: {
  node: OrgNode;
  allNodes: OrgNode[];
  depth: number;
  editMode: boolean;
  activeId: string | null;
  overId: string | null;
  onEdit: (n: OrgNode) => void;
  onDelete: (n: OrgNode) => void;
  onAddChild: (parentId: string) => void;
  onUploadPhoto: (node: OrgNode, f: File) => void;
  onExpandPhoto: (node: OrgNode) => void;
}) {
  const children = allNodes.filter(n => n.parentId === node.id);

  return (
    <div className="org-node">
      <DndNode
        node={node}
        depth={depth}
        allNodes={allNodes}
        editMode={editMode}
        activeId={activeId}
        overId={overId}
        onEdit={() => onEdit(node)}
        onDelete={() => onDelete(node)}
        onAddChild={() => onAddChild(node.id)}
        onUploadPhoto={f => onUploadPhoto(node, f)}
        onExpandPhoto={() => onExpandPhoto(node)}
      />
      {children.length > 0 && (
        <div className="org-children">
          {children.map(child => (
            <div key={child.id} className="org-child-col">
              <OrgTree
                node={child}
                allNodes={allNodes}
                depth={depth + 1}
                editMode={editMode}
                activeId={activeId}
                overId={overId}
                onEdit={onEdit}
                onDelete={onDelete}
                onAddChild={onAddChild}
                onUploadPhoto={onUploadPhoto}
                onExpandPhoto={onExpandPhoto}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════ root drop zone ═════ */

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
      Drop here to make top level
    </div>
  );
}

/* ═══════════════════════════════════════════════════ edit dialog ═════════ */

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
            {initial.id ? 'Edit Person' : 'Add New Person'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            {field('name',       'Full Name *',   'Ahmed Al-Omari')}
            {field('title',      'Job Title',     'Executive Director')}
            {field('department', 'Department',    'Operations')}
            {field('phone',      'Mobile',        '+966 5x', 'ltr')}
          </div>
          {field('email', 'Email', 'name@bank.com', 'ltr')}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
              Reports To
            </label>
            <select value={form.parentId ?? ''}
              onChange={e => setForm(f => ({ ...f, parentId: e.target.value || null }))}
              className="w-full h-9 rounded-md border border-input bg-background text-sm px-2 text-foreground outline-none focus:ring-2 focus:ring-primary/30">
              <option value="">— Top level (no manager) —</option>
              {parentOpts.map(n => (
                <option key={n.id} value={n.id}>
                  {n.name || '(empty)'}{n.title ? ` · ${n.title}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={saving}
            onClick={() => onSave({ ...form, id: initial.id } as any)}>
            {saving && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════ main section ════════ */

export function OrgChartSection({ bank }: { bank: any }) {
  const isFirst = (bank.orgChart ?? []).length === 0;
  const [nodes,    setNodes]    = useState<OrgNode[]>(() =>
    isFirst ? DEFAULT_NODES : (bank.orgChart ?? []),
  );
  const [editMode, setEditMode] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId,   setOverId]   = useState<string | null>(null);
  const [dialog,   setDialog]   = useState<{ open: boolean; initial: Partial<OrgNode> & { id?: string } } | null>(null);
  const [lightbox, setLightbox] = useState<OrgNode | null>(null);

  const queryClient = useQueryClient();
  const { toast }   = useToast();
  const updateBank  = useUpdateBank();
  const uploadPhoto = useSetOrgChartNodePhoto();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

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
      onError: () => toast({ title: 'Failed to save. Please try again.', variant: 'destructive' }),
    });
  }, [bank, updateBank, queryClient, toast]);

  /* ── DnD ── */
  const handleDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id));
  const handleDragOver  = ({ over }: DragOverEvent)    => setOverId(over ? String(over.id) : null);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null); setOverId(null);
    if (!over) return;
    const draggedId = String(active.id);
    const targetId  = String(over.id);
    if (draggedId === targetId) return;
    if (targetId === ROOT_DROP_ID) {
      const next = nodes.map(n => n.id === draggedId ? { ...n, parentId: null } : n);
      setNodes(next); save(next); return;
    }
    if (descendants(draggedId, nodes).has(targetId)) return;
    const next = nodes.map(n => n.id === draggedId ? { ...n, parentId: targetId } : n);
    setNodes(next); save(next);
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
    setNodes(next); save(next);
  };

  /* ── photo ── */
  const handleUploadPhoto = (node: OrgNode, file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      uploadPhoto.mutate(
        { id: bank.id, nodeId: node.id, data: { dataUrl: e.target?.result as string } },
        {
          onSuccess: (res: any) => {
            const next = nodes.map(n =>
              n.id === node.id ? { ...n, photoUrl: res?.photoUrl ?? null } : n,
            );
            setNodes(next); save(next);
          },
          onError: () => toast({ title: 'Photo upload failed. Please try again.', variant: 'destructive' }),
        },
      );
    };
    reader.readAsDataURL(file);
  };

  const roots      = nodes.filter(n => !n.parentId);
  const activeNode = activeId ? nodes.find(n => n.id === activeId) : null;

  return (
    <>
      <Card>
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="w-4 h-4 text-primary" />
            Organizational Chart
            {(updateBank.isPending || uploadPhoto.isPending) && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground ml-1" />
            )}
            <div className="ml-auto flex items-center gap-2">
              {editMode && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                  onClick={() => setDialog({ open: true, initial: { parentId: null } })}>
                  <Plus className="w-3 h-3" /> Add Person
                </Button>
              )}
              <Button
                size="sm"
                variant={editMode ? 'default' : 'ghost'}
                className={cn('h-7 w-7 p-0', editMode && 'bg-primary text-primary-foreground')}
                title={editMode ? 'Lock (view only)' : 'Edit chart'}
                onClick={() => setEditMode(v => !v)}>
                {editMode ? <Lock className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </CardTitle>
          {editMode && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Drag cards to rearrange · Click ✏ to edit · Click photo to change it · Click 🔒 when done
            </p>
          )}
        </CardHeader>

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
                <RootDropZone visible={editMode && !!activeId} />
                <div className="flex gap-16 items-start justify-center">
                  {roots.map(root => (
                    <OrgTree
                      key={root.id}
                      node={root}
                      allNodes={nodes}
                      depth={0}
                      editMode={editMode}
                      activeId={activeId}
                      overId={overId}
                      onEdit={n => setDialog({ open: true, initial: { ...n } })}
                      onDelete={handleDelete}
                      onAddChild={parentId => setDialog({ open: true, initial: { parentId } })}
                      onUploadPhoto={handleUploadPhoto}
                      onExpandPhoto={n => setLightbox(n)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <DragOverlay dropAnimation={null}>
              {activeNode && (
                <div className="rotate-1 opacity-90 drop-shadow-2xl pointer-events-none">
                  <CardFace node={activeNode} depth={1} editMode />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </CardContent>
      </Card>

      {/* Edit dialog */}
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

      {/* Photo lightbox */}
      {lightbox?.photoUrl && (
        <PhotoLightbox
          url={lightbox.photoUrl}
          name={lightbox.name}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}
