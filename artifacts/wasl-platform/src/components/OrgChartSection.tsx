/**
 * OrgChartSection — glassmorphism-style interactive org chart
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

/* ════════════════════════════════════════════════════ photo lightbox ════ */

function PhotoLightbox({ url, name, onClose }: { url: string; name: string; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
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
        <img src={url} alt={name}
          className="w-64 h-64 rounded-2xl object-cover shadow-2xl border-4 border-white/20" />
        {name && <p className="text-white font-semibold text-lg text-center drop-shadow">{name}</p>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ avatar ══════ */

const PALETTE = ['#6D28D9','#2563EB','#0891B2','#059669','#D97706','#DC2626','#7C3AED','#DB2777'];
function pickColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return PALETTE[h % PALETTE.length];
}

function Avatar({
  node, size, editMode, onUploadPhoto, onRemovePhoto, onExpand,
}: {
  node: OrgNode; size: number; editMode?: boolean;
  onUploadPhoto?: (f: File) => void; onRemovePhoto?: () => void; onExpand?: () => void;
}) {
  const photoRef = useRef<HTMLInputElement>(null);
  const empty    = !node.name.trim();
  const hasPhoto = !!node.photoUrl;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editMode && onUploadPhoto) photoRef.current?.click();
    else if (!editMode && hasPhoto && onExpand) onExpand();
  };

  const inner = (() => {
    if (hasPhoto) {
      return (
        <img src={node.photoUrl!} alt={node.name}
          style={{ width: size, height: size }}
          className="rounded-full object-cover"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      );
    }
    if (empty) {
      return (
        <div style={{ width: size, height: size, background: '#f3f4f6', border: '1.5px dashed #d1d5db', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Network style={{ width: size * 0.4, height: size * 0.4, color: '#9ca3af' }} />
        </div>
      );
    }
    const initials = node.name.trim()
      .split(/\s+/).filter(Boolean).slice(0, 2)
      .map(w => w[0]?.toUpperCase() ?? '').join('');
    const col = pickColor(node.name);
    return (
      <div style={{ width: size, height: size, background: col, fontSize: size * 0.34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', flexShrink: 0, boxShadow: `0 0 20px ${col}60` }}>
        {initials || '?'}
      </div>
    );
  })();

  const canInteract = (editMode && !!onUploadPhoto) || (!editMode && hasPhoto && !!onExpand);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        disabled={!canInteract}
        style={{
          borderRadius: '50%',
          display: 'block',
          border: hasPhoto ? '2px solid #e5e7eb' : 'none',
          boxShadow: hasPhoto ? '0 2px 8px rgba(0,0,0,0.12)' : 'none',
          cursor: canInteract ? 'pointer' : 'default',
        }}
        className="relative group/av"
        onClick={handleClick}>
        {inner}
        {editMode && onUploadPhoto && (
          <div className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover/av:opacity-100 transition-opacity"
            style={{ background: 'rgba(0,0,0,0.5)' }}>
            <Camera className="w-3.5 h-3.5 text-white" />
          </div>
        )}
        {!editMode && hasPhoto && onExpand && (
          <div className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover/av:opacity-100 transition-opacity"
            style={{ background: 'rgba(0,0,0,0.4)' }}>
            <ZoomIn style={{ width: size * 0.28, height: size * 0.28, color: 'white' }} />
          </div>
        )}
        {onUploadPhoto && (
          <input ref={photoRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onUploadPhoto(f); e.target.value = ''; }} />
        )}
      </button>

      {editMode && hasPhoto && onRemovePhoto && (
        <button type="button"
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onRemovePhoto(); }}
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center shadow z-10 transition-colors"
          style={{ background: '#ef4444' }}
          title="Remove photo">
          <X className="w-2.5 h-2.5 text-white" />
        </button>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════ card face ═════ */

// Depth accent colours for the top strip
const DEPTH_ACCENT = ['#7c3aed', '#4f46e5', '#0284c7', '#0d9488', '#d97706'];
const depthAccent = (d: number) => DEPTH_ACCENT[Math.min(d, DEPTH_ACCENT.length - 1)];

// Light-mode card base styles
const lightCard: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
  borderRadius: 14,
  overflow: 'hidden',
};

const lightCardRoot: React.CSSProperties = {
  background: 'linear-gradient(150deg, #faf5ff 0%, #ffffff 60%)',
  border: '1.5px solid #ddd6fe',
  boxShadow: '0 0 0 4px rgba(124,58,237,0.07), 0 6px 24px rgba(109,40,217,0.10)',
  borderRadius: 14,
  overflow: 'hidden',
};

const lightCardOver: React.CSSProperties = {
  border: '1.5px solid #7c3aed',
  boxShadow: '0 0 0 3px rgba(124,58,237,0.15), 0 6px 20px rgba(109,40,217,0.12)',
  transform: 'scale(1.03)',
};

function CardFace({
  node, depth, editMode = false, isDragging = false, isOver = false,
  onEdit, onDelete, onAddChild, onAddSibling,
  onUploadPhoto, onRemovePhoto, onExpandPhoto,
}: {
  node: OrgNode; depth: number; editMode?: boolean;
  isDragging?: boolean; isOver?: boolean;
  onEdit?: () => void; onDelete?: () => void;
  onAddChild?: () => void; onAddSibling?: () => void;
  onUploadPhoto?: (f: File) => void; onRemovePhoto?: () => void;
  onExpandPhoto?: () => void;
}) {
  const empty = !node.name.trim();

  const baseStyle = depth === 0 ? lightCardRoot : lightCard;
  const cardStyle: React.CSSProperties = {
    ...baseStyle,
    ...(isOver && !isDragging ? lightCardOver : {}),
    ...(isDragging ? { opacity: 0, pointerEvents: 'none' } : {}),
    width: 176,
    transition: 'all 0.2s ease',
    cursor: editMode ? 'grab' : 'default',
    userSelect: 'none',
  };

  const accent = depthAccent(depth);

  /* Sibling button */
  const siblingBtn = (side: 'left' | 'right') => (
    <button
      type="button"
      onPointerDown={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); onAddSibling?.(); }}
      title={side === 'left' ? 'Add sibling to the left' : 'Add sibling to the right'}
      style={{
        position: 'absolute',
        top: 36,
        ...(side === 'left' ? { left: -20 } : { right: -20 }),
        zIndex: 20,
        width: 22, height: 22,
        borderRadius: '50%',
        background: '#ffffff',
        border: '1.5px dashed #d1d5db',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#9ca3af',
        cursor: 'pointer',
        transition: 'all 0.15s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = accent;
        (e.currentTarget as HTMLElement).style.color = accent;
        (e.currentTarget as HTMLElement).style.background = `${accent}10`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = '#d1d5db';
        (e.currentTarget as HTMLElement).style.color = '#9ca3af';
        (e.currentTarget as HTMLElement).style.background = '#ffffff';
      }}
    >
      <Plus style={{ width: 10, height: 10 }} />
    </button>
  );

  return (
    <div className="relative flex flex-col items-center gap-1.5" style={{ width: 176 }}>
      {/* Sibling buttons */}
      {editMode && onAddSibling && siblingBtn('left')}
      {editMode && onAddSibling && siblingBtn('right')}

      {/* Card */}
      <div style={cardStyle}>
        {/* coloured top accent strip */}
        <div style={{ height: 4, background: `linear-gradient(90deg, ${accent}, ${accent}99)` }} />

        {/* top-bar: grip + edit/delete */}
        {editMode && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px 0' }}>
            <GripVertical style={{ width: 13, height: 13, color: '#d1d5db' }} />
            <div style={{ display: 'flex', gap: 2 }}>
              {onEdit && (
                <button
                  onClick={e => { e.stopPropagation(); onEdit(); }}
                  title="Edit"
                  style={{ width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af', transition: 'all 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#7c3aed'; (e.currentTarget as HTMLElement).style.background = '#ede9fe'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9ca3af'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  <Pencil style={{ width: 10, height: 10 }} />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={e => { e.stopPropagation(); onDelete(); }}
                  title="Delete"
                  style={{ width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af', transition: 'all 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; (e.currentTarget as HTMLElement).style.background = '#fee2e2'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9ca3af'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  <Trash2 style={{ width: 10, height: 10 }} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* avatar */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: editMode ? 8 : 14, marginBottom: 10 }}>
          <Avatar
            node={node}
            size={depth === 0 ? 60 : 48}
            editMode={editMode}
            onUploadPhoto={onUploadPhoto}
            onRemovePhoto={onRemovePhoto}
            onExpand={onExpandPhoto}
          />
        </div>

        {/* text */}
        <div style={{ padding: '0 12px 14px', textAlign: 'center' }}>
          {empty ? (
            editMode ? (
              <button
                onClick={e => { e.stopPropagation(); onEdit?.(); }}
                style={{
                  fontSize: 11, fontWeight: 500,
                  border: '1px dashed #d1d5db',
                  borderRadius: 8, padding: '4px 12px',
                  width: '100%', color: '#9ca3af',
                  background: '#f9fafb', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}>
                + Add name
              </button>
            ) : (
              <p style={{ fontSize: 11, color: '#d1d5db' }}>—</p>
            )
          ) : (
            <>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#111827', lineHeight: 1.3, marginBottom: 2 }}>{node.name}</p>
              {node.title && (
                <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 5, lineHeight: 1.4 }}>{node.title}</p>
              )}
              {node.department && (
                <span style={{
                  display: 'inline-block', fontSize: 10, fontWeight: 600,
                  padding: '2px 8px', borderRadius: 99,
                  background: `${accent}14`,
                  border: `1px solid ${accent}30`,
                  color: accent,
                }}>
                  {node.department}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* add-child button */}
      {editMode && onAddChild && (
        <button
          onClick={e => { e.stopPropagation(); onAddChild(); }}
          title="Add direct report"
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 10, fontWeight: 500,
            border: '1px dashed #d1d5db',
            borderRadius: 99, padding: '3px 12px',
            color: '#9ca3af',
            background: '#ffffff',
            cursor: 'pointer', transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = accent;
            (e.currentTarget as HTMLElement).style.color = accent;
            (e.currentTarget as HTMLElement).style.background = `${accent}08`;
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = '#d1d5db';
            (e.currentTarget as HTMLElement).style.color = '#9ca3af';
            (e.currentTarget as HTMLElement).style.background = '#ffffff';
          }}>
          <Plus style={{ width: 10, height: 10 }} />
          Add report
        </button>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════ draggable node ══════════ */

function DndNode({
  node, depth, allNodes, editMode, activeId, overId,
  onEdit, onDelete, onAddChild, onAddSibling,
  onUploadPhoto, onRemovePhoto, onExpandPhoto,
}: {
  node: OrgNode; depth: number; allNodes: OrgNode[];
  editMode: boolean; activeId: string | null; overId: string | null;
  onEdit: () => void; onDelete: () => void;
  onAddChild: () => void; onAddSibling: () => void;
  onUploadPhoto: (f: File) => void; onRemovePhoto: () => void;
  onExpandPhoto: () => void;
}) {
  const desc = useMemo(
    () => activeId ? descendants(activeId, allNodes) : new Set<string>(),
    [activeId, allNodes],
  );

  const { attributes, listeners, setNodeRef: setDrag, isDragging } = useDraggable({ id: node.id, disabled: !editMode });
  const { setNodeRef: setDrop, isOver: rawIsOver } = useDroppable({ id: node.id, disabled: !editMode });

  const isOver = rawIsOver && !desc.has(node.id) && node.id !== activeId;
  const ref = (el: HTMLElement | null) => { setDrag(el); setDrop(el); };

  return (
    <div ref={ref} style={{ touchAction: editMode ? 'none' : 'auto' }} {...attributes} {...(editMode ? listeners : {})}>
      <CardFace
        node={node} depth={depth} editMode={editMode}
        isDragging={isDragging} isOver={isOver}
        onEdit={onEdit} onDelete={onDelete}
        onAddChild={onAddChild} onAddSibling={onAddSibling}
        onUploadPhoto={onUploadPhoto} onRemovePhoto={onRemovePhoto}
        onExpandPhoto={onExpandPhoto}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════ recursive tree ══════════ */

function OrgTree({
  node, allNodes, depth, editMode, activeId, overId,
  onEdit, onDelete, onAddChild, onAddSibling,
  onUploadPhoto, onRemovePhoto, onExpandPhoto,
}: {
  node: OrgNode; allNodes: OrgNode[]; depth: number;
  editMode: boolean; activeId: string | null; overId: string | null;
  onEdit: (n: OrgNode) => void; onDelete: (n: OrgNode) => void;
  onAddChild: (parentId: string) => void;
  onAddSibling: (parentId: string | null) => void;
  onUploadPhoto: (node: OrgNode, f: File) => void;
  onRemovePhoto: (node: OrgNode) => void;
  onExpandPhoto: (node: OrgNode) => void;
}) {
  const children = allNodes.filter(n => n.parentId === node.id);

  return (
    <div className="org-node">
      <DndNode
        node={node} depth={depth} allNodes={allNodes}
        editMode={editMode} activeId={activeId} overId={overId}
        onEdit={() => onEdit(node)} onDelete={() => onDelete(node)}
        onAddChild={() => onAddChild(node.id)}
        onAddSibling={() => onAddSibling(node.parentId ?? null)}
        onUploadPhoto={f => onUploadPhoto(node, f)}
        onRemovePhoto={() => onRemovePhoto(node)}
        onExpandPhoto={() => onExpandPhoto(node)}
      />
      {children.length > 0 && (
        <div className="org-children">
          {children.map(child => (
            <div key={child.id} className="org-child-col">
              <OrgTree
                node={child} allNodes={allNodes} depth={depth + 1}
                editMode={editMode} activeId={activeId} overId={overId}
                onEdit={onEdit} onDelete={onDelete}
                onAddChild={onAddChild} onAddSibling={onAddSibling}
                onUploadPhoto={onUploadPhoto} onRemovePhoto={onRemovePhoto}
                onExpandPhoto={onExpandPhoto}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════ root drop zone ════════════ */

function RootDropZone({ visible }: { visible: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: ROOT_DROP_ID });
  if (!visible) return null;
  return (
    <div ref={setNodeRef}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        borderRadius: 12, border: `2px dashed ${isOver ? '#7c3aed' : '#d1d5db'}`,
        padding: '10px 32px', marginBottom: 24, fontSize: 13, fontWeight: 500,
        background: isOver ? '#f5f3ff' : '#f9fafb',
        color: isOver ? '#7c3aed' : '#9ca3af',
        transition: 'all 0.2s',
      }}>
      <ArrowUpToLine style={{ width: 15, height: 15 }} />
      Drop here to make top level
    </div>
  );
}

/* ════════════════════════════════════════════ edit dialog ═══════════════ */

function NodeDialog({
  open, onClose, initial, allNodes, onSave, saving,
}: {
  open: boolean; onClose: () => void;
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
            {field('name', 'Full Name *', 'Ahmed Al-Omari')}
            {field('title', 'Job Title', 'Executive Director')}
            {field('department', 'Department', 'Operations')}
            {field('phone', 'Mobile', '+966 5x', 'ltr')}
          </div>
          {field('email', 'Email', 'name@bank.com', 'ltr')}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Reports To</label>
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

/* ════════════════════════════════════════════ main section ══════════════ */

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
    setNodes(next); save(next);
  };

  const handleRemovePhoto = (node: OrgNode) => {
    const next = nodes.map(n => n.id === node.id ? { ...n, photoUrl: null } : n);
    setNodes(next); save(next);
  };

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

  const handleAddSibling = (parentId: string | null) => {
    setDialog({ open: true, initial: { parentId } });
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
              Drag to rearrange · ✏ edit · ± left/right for sibling · ＋ below for report · 🔒 when done
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
            {/* ── light background ── */}
            <div
              className="overflow-x-auto rounded-b-xl"
              style={{ background: 'hsl(var(--muted) / 0.4)' }}>

              <div className="min-w-fit px-12 py-8 relative">
                <RootDropZone visible={editMode && !!activeId} />
                <div className="flex gap-16 items-start justify-center">
                  {roots.map(root => (
                    <OrgTree
                      key={root.id}
                      node={root} allNodes={nodes} depth={0}
                      editMode={editMode} activeId={activeId} overId={overId}
                      onEdit={n => setDialog({ open: true, initial: { ...n } })}
                      onDelete={handleDelete}
                      onAddChild={parentId => setDialog({ open: true, initial: { parentId } })}
                      onAddSibling={handleAddSibling}
                      onUploadPhoto={handleUploadPhoto}
                      onRemovePhoto={handleRemovePhoto}
                      onExpandPhoto={n => setLightbox(n)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <DragOverlay dropAnimation={null}>
              {activeNode && (
                <div style={{ transform: 'rotate(2deg)', opacity: 0.95, filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.18))' }}>
                  <CardFace node={activeNode} depth={1} editMode />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </CardContent>
      </Card>

      {dialog && (
        <NodeDialog
          open={dialog.open} onClose={() => setDialog(null)}
          initial={dialog.initial} allNodes={nodes}
          onSave={handleDialogSave} saving={updateBank.isPending}
        />
      )}

      {lightbox?.photoUrl && (
        <PhotoLightbox url={lightbox.photoUrl} name={lightbox.name} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}
