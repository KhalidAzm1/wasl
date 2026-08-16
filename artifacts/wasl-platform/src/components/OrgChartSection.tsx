import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable,
  type DragStartEvent, type DragOverEvent, type DragEndEvent,
} from '@dnd-kit/core';
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
import {
  Plus, Pencil, Trash2, Loader2, Network, Phone, Mail,
  UserPlus, UploadCloud, GripVertical, CornerDownLeft,
} from 'lucide-react';

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

const ROOT_ZONE_ID = '__root_zone__';

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

const COLORS: [string, string][] = [
  ['#3B82F6', '#EFF6FF'], ['#8B5CF6', '#F5F3FF'], ['#10B981', '#ECFDF5'],
  ['#F59E0B', '#FFFBEB'], ['#EF4444', '#FEF2F2'], ['#06B6D4', '#ECFEFF'],
  ['#6366F1', '#EEF2FF'], ['#EC4899', '#FDF2F8'],
];
function getColor(name: string): [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return COLORS[h % COLORS.length];
}

function NodeAvatar({ node, size = 52 }: { node: OrgNode; size?: number }) {
  const initials = node.name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
  const [fg, bg] = getColor(node.name);
  const px = size + 'px';
  if (node.photoUrl) {
    return (
      <img src={node.photoUrl} alt={node.name}
        style={{ width: px, height: px }}
        className="rounded-full object-cover border-2 border-background shadow"
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
    );
  }
  return (
    <div style={{ width: px, height: px, background: bg, color: fg, fontSize: size * 0.34 + 'px' }}
      className="rounded-full flex items-center justify-center font-bold border-2 border-background shadow shrink-0">
      {initials || '?'}
    </div>
  );
}

// ── Card (pure visual, no DnD) ────────────────────────────────────────────────

function OrgCardFace({
  node, depth, dragHandleProps, onEdit, onDelete, onAddChild, onUploadPhoto, isDragging, isOver,
}: {
  node: OrgNode;
  depth: number;
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
  onEdit?: () => void;
  onDelete?: () => void;
  onAddChild?: () => void;
  onUploadPhoto?: (f: File) => void;
  isDragging?: boolean;
  isOver?: boolean;
}) {
  const photoRef = useRef<HTMLInputElement>(null);
  const isRoot = depth === 0;

  return (
    <div className={cn(
      'group relative rounded-xl border flex flex-col items-center text-center select-none transition-all',
      isRoot ? 'bg-primary/10 border-primary/30 shadow-sm' : 'bg-card border-foreground/10 shadow-sm',
      isDragging && 'opacity-40',
      isOver && !isDragging && 'ring-2 ring-primary ring-offset-1 ring-offset-background scale-[1.03] shadow-lg',
    )} style={{ width: '172px' }}>

      {/* Drag handle */}
      {dragHandleProps && (
        <div
          {...dragHandleProps}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-foreground/25 hover:text-foreground/60 touch-none"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>
      )}

      {/* Avatar */}
      <button className="mt-4 mb-3 relative" title="Upload photo"
        onClick={() => onUploadPhoto && photoRef.current?.click()}>
        <NodeAvatar node={node} size={isRoot ? 64 : 52} />
        {onUploadPhoto && (
          <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <UploadCloud className="w-4 h-4 text-white" />
          </div>
        )}
      </button>
      {onUploadPhoto && (
        <input ref={photoRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onUploadPhoto(f); e.target.value = ''; }} />
      )}

      {/* Name / Title / Dept */}
      <div className="px-3 pb-1 w-full">
        <p className={cn('font-bold leading-tight', isRoot ? 'text-sm' : 'text-xs')}>{node.name}</p>
        {node.title && <p className={cn('text-foreground/50 mt-0.5', isRoot ? 'text-xs' : 'text-[10px]')}>{node.title}</p>}
        {node.department && <p className="text-[10px] text-primary/60 mt-0.5 font-medium">{node.department}</p>}
      </div>

      {/* Phone / Email */}
      {(node.phone || node.email) && (
        <div className="flex items-center justify-center gap-2 px-3 pb-2 mt-0.5">
          {node.phone && (
            <a href={`tel:${node.phone}`} title={node.phone} dir="ltr"
              className="text-[10px] text-foreground/40 hover:text-primary flex items-center gap-0.5"
              onClick={e => e.stopPropagation()}>
              <Phone className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate max-w-[80px]">{node.phone}</span>
            </a>
          )}
          {node.email && !node.phone && (
            <a href={`mailto:${node.email}`} title={node.email}
              className="text-[10px] text-foreground/40 hover:text-primary flex items-center gap-0.5"
              onClick={e => e.stopPropagation()}>
              <Mail className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate max-w-[90px]">{node.email}</span>
            </a>
          )}
        </div>
      )}

      {/* Action buttons */}
      {(onEdit || onDelete || onAddChild) && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 pb-2 mt-0.5">
          {onAddChild && (
            <button title="Add child" onClick={onAddChild}
              className="w-6 h-6 rounded-lg flex items-center justify-center text-foreground/30 hover:text-primary hover:bg-primary/10 transition-colors">
              <UserPlus className="w-3 h-3" />
            </button>
          )}
          {onEdit && (
            <button title="Edit" onClick={onEdit}
              className="w-6 h-6 rounded-lg flex items-center justify-center text-foreground/30 hover:text-blue-400 hover:bg-blue-400/10 transition-colors">
              <Pencil className="w-3 h-3" />
            </button>
          )}
          {onDelete && (
            <button title="Delete" onClick={onDelete}
              className="w-6 h-6 rounded-lg flex items-center justify-center text-foreground/30 hover:text-red-400 hover:bg-red-400/10 transition-colors">
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── DnD-aware node ────────────────────────────────────────────────────────────

function DraggableDroppableNode({
  node, depth, activeId, overId, allNodes,
  onEdit, onDelete, onAddChild, onUploadPhoto,
  children,
}: {
  node: OrgNode;
  depth: number;
  activeId: string | null;
  overId: string | null;
  allNodes: OrgNode[];
  onEdit: () => void;
  onDelete: () => void;
  onAddChild: () => void;
  onUploadPhoto: (f: File) => void;
  children?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: node.id });
  const { setNodeRef: setDropRef, isOver: dndIsOver } = useDroppable({ id: node.id });

  // Don't highlight a node as drop target if it's a descendant of the dragged node
  const isDescendantOfActive = useMemo(() => {
    if (!activeId) return false;
    return getDescendantIds(activeId, allNodes).has(node.id);
  }, [activeId, allNodes, node.id]);

  const isOver = dndIsOver && !isDescendantOfActive && node.id !== activeId;

  const combinedRef = (el: HTMLElement | null) => {
    setDragRef(el);
    setDropRef(el);
  };

  return (
    <div ref={combinedRef} className="org-node">
      <OrgCardFace
        node={node}
        depth={depth}
        dragHandleProps={{ ...attributes, ...listeners }}
        onEdit={onEdit}
        onDelete={onDelete}
        onAddChild={onAddChild}
        onUploadPhoto={onUploadPhoto}
        isDragging={isDragging}
        isOver={isOver}
      />
      {children}
    </div>
  );
}

// ── Recursive Tree ────────────────────────────────────────────────────────────

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
    <DraggableDroppableNode
      node={node}
      depth={depth}
      activeId={activeId}
      overId={overId}
      allNodes={allNodes}
      onEdit={() => onEdit(node)}
      onDelete={() => onDelete(node)}
      onAddChild={() => onAddChild(node.id)}
      onUploadPhoto={f => onUploadPhoto(node, f)}
    >
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
    </DraggableDroppableNode>
  );
}

// ── Root Drop Zone ────────────────────────────────────────────────────────────

function RootDropZone({ activeId }: { activeId: string | null }) {
  const { setNodeRef, isOver } = useDroppable({ id: ROOT_ZONE_ID });
  if (!activeId) return null;
  return (
    <div ref={setNodeRef} className={cn(
      'flex items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-3 text-sm font-medium transition-all mb-4',
      isOver
        ? 'border-primary bg-primary/10 text-primary'
        : 'border-foreground/15 text-foreground/30'
    )}>
      <CornerDownLeft className="w-4 h-4" />
      Drop here to make Root
    </div>
  );
}

// ── Node Edit Dialog ──────────────────────────────────────────────────────────

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
  React.useEffect(() => { if (open) setForm({ ...EMPTY_NODE, ...initial }); }, [open, initial]);

  const field = (key: keyof OrgNode, label: string, dir?: 'ltr') => (
    <div className="space-y-1">
      <label className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider block">{label}</label>
      <Input value={(form[key] as string) ?? ''} dir={dir}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="bg-background border-foreground/10 text-sm h-8" />
    </div>
  );

  const selfAndDesc = new Set<string>();
  if (initial.id) getDescendantIds(initial.id, allNodes).forEach(id => selfAndDesc.add(id));
  const parentOptions = allNodes.filter(n => !selfAndDesc.has(n.id));

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{initial.id ? 'Edit Node' : 'Add Node'}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            {field('name', 'Full Name *')}
            {field('title', 'Title / Role')}
            {field('department', 'Department')}
            {field('phone', 'Phone', 'ltr')}
          </div>
          {field('email', 'Email', 'ltr')}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider block">Reports To</label>
            <select value={form.parentId ?? ''}
              onChange={e => setForm(f => ({ ...f, parentId: e.target.value || null }))}
              className="w-full h-8 rounded-md border border-foreground/10 bg-background text-sm px-2 outline-none focus:border-primary/50">
              <option value="">— Root (no parent) —</option>
              {parentOptions.map(n => (
                <option key={n.id} value={n.id}>{n.name}{n.title ? ` · ${n.title}` : ''}</option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!form.name?.trim() || saving}
            onClick={() => onSave({ ...form, id: initial.id } as any)}>
            {saving && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
            {initial.id ? 'Save Changes' : 'Add Node'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Section ──────────────────────────────────────────────────────────────

export function OrgChartSection({ bank }: { bank: any }) {
  const [nodes, setNodes] = useState<OrgNode[]>(() => bank.orgChart ?? []);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ open: boolean; initial: Partial<OrgNode> & { id?: string } } | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateBank = useUpdateBank();
  const uploadPhoto = useSetOrgChartNodePhoto();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

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
      onError: () => toast({ title: 'Failed to save org chart', variant: 'destructive' }),
    });
  }, [bank, updateBank, queryClient, toast]);

  // ── DnD events ──
  const handleDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id));
  const handleDragOver = ({ over }: DragOverEvent) => setOverId(over ? String(over.id) : null);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    setOverId(null);
    if (!over) return;

    const draggedId = String(active.id);
    const targetId = String(over.id);
    if (draggedId === targetId) return;

    if (targetId === ROOT_ZONE_ID) {
      // Make it a root node
      const next = nodes.map(n => n.id === draggedId ? { ...n, parentId: null } : n);
      setNodes(next);
      save(next);
      return;
    }

    // Prevent dropping onto a descendant (would create a cycle)
    const descendants = getDescendantIds(draggedId, nodes);
    if (descendants.has(targetId)) return;

    const next = nodes.map(n => n.id === draggedId ? { ...n, parentId: targetId } : n);
    setNodes(next);
    save(next);
  };

  // ── Dialog actions ──
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
        onError: () => toast({ title: 'Failed to upload photo', variant: 'destructive' }),
      });
    };
    reader.readAsDataURL(file);
  };

  const roots = nodes.filter(n => !n.parentId);
  const activeNode = activeId ? nodes.find(n => n.id === activeId) : null;

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="w-4 h-4 text-primary" />
            Organizational Chart
            {(updateBank.isPending || uploadPhoto.isPending) && (
              <Loader2 className="w-3 h-3 animate-spin text-foreground/40 ml-1" />
            )}
            <button onClick={() => setDialog({ open: true, initial: { parentId: null } })}
              className="ml-auto flex items-center gap-1 text-xs text-primary hover:text-primary/70 font-medium transition-colors">
              <Plus className="w-3 h-3" /> Add Node
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-foreground/5 flex items-center justify-center">
                <Network className="w-7 h-7 text-foreground/15" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground/40">No org chart yet</p>
                <p className="text-xs text-foreground/25 mt-1">Add the first node to start building the hierarchy</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setDialog({ open: true, initial: { parentId: null } })}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Root Node
              </Button>
            </div>
          ) : (
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
              <div className="overflow-x-auto">
                <div className="min-w-fit px-6 py-4">
                  {/* Root drop zone — shows only while dragging */}
                  <RootDropZone activeId={activeId} />

                  {/* Tree */}
                  <div className="flex gap-12 items-start justify-center">
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
                  <div className="rotate-2 opacity-90 pointer-events-none drop-shadow-xl">
                    <OrgCardFace node={activeNode} depth={0} />
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}
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
