/**
 * OrgChartSection — light-mode interactive org chart
 * Fixes: drag transform applied directly (no DragOverlay), inline card editing, contacts import
 */

import React, {
  useState, useRef, useCallback, useEffect, useMemo,
} from 'react';
import {
  DndContext, PointerSensor,
  useSensor, useSensors,
  useDraggable, useDroppable,
  type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  useUpdateBank, useSetOrgChartNodePhoto, useRestoreBankOrgChartPhotoSnapshot, getGetBankQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import {
  mergeContactsIntoOrgChart,
  type OrgChartImportContact,
  type OrgChartImportNode,
} from '@/lib/org-chart-import';
import {
  Plus, Pencil, Trash2, Loader2, Network, Camera,
  GripVertical, ArrowUpToLine, Lock, X, ZoomIn, Users,
  Phone, Mail,
  History,
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
  photoStoragePath?: string | null;
};

type InlineForm = { name: string; title: string; department: string; phone: string };

type BankContact = {
  name: string;
  title?: string | null;
  phone?: string | null;
  email?: string | null;
  department?: string | null;
  manager?: string | null;
  starred?: boolean;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors" onClick={onClose}>
        <X className="w-5 h-5" />
      </button>
      <div className="flex flex-col items-center gap-3 max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <img src={url} alt={name} className="w-64 h-64 rounded-2xl object-cover shadow-2xl border-4 border-white/20" />
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
    const initials = node.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
    const col = pickColor(node.name);
    return (
      <div style={{ width: size, height: size, background: col, fontSize: size * 0.34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'white', flexShrink: 0, boxShadow: `0 0 16px ${col}50` }}>
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
        style={{ borderRadius: '50%', display: 'block', border: hasPhoto ? '2px solid #e5e7eb' : 'none', boxShadow: hasPhoto ? '0 2px 8px rgba(0,0,0,0.12)' : 'none', cursor: canInteract ? 'pointer' : 'default' }}
        className="relative group/av"
        onClick={handleClick}>
        {inner}
        {editMode && onUploadPhoto && (
          <div className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover/av:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.4)' }}>
            <Camera className="w-3.5 h-3.5 text-white" />
          </div>
        )}
        {!editMode && hasPhoto && onExpand && (
          <div className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover/av:opacity-100 transition-opacity" style={{ background: 'rgba(0,0,0,0.35)' }}>
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

/* ════════════════════════════════════════════════ card styles ══════════ */

const DEPTH_ACCENT = ['#7c3aed', '#4f46e5', '#0284c7', '#0d9488', '#d97706'];
const depthAccent  = (d: number) => DEPTH_ACCENT[Math.min(d, DEPTH_ACCENT.length - 1)];
const ORG_CARD_WIDTH = 118;

const lightCard: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
  borderRadius: 14,
  overflow: 'hidden',
};
const lightCardRoot: React.CSSProperties = {
  background: 'var(--card)',
  border: '1.5px solid #ddd6fe',
  boxShadow: '0 0 0 4px rgba(124,58,237,0.07), 0 6px 24px rgba(109,40,217,0.10)',
  borderRadius: 14,
  overflow: 'hidden',
};
const lightCardOver: React.CSSProperties = {
  border: '1.5px solid #7c3aed',
  boxShadow: '0 0 0 3px rgba(124,58,237,0.15), 0 6px 20px rgba(109,40,217,0.12)',
};

/* ═══════════════════════════════════════════ inline edit card ══════════ */

function InlineEditCard({
  node, depth, onSave, onCancel,
}: {
  node: OrgNode; depth: number;
  onSave: (form: InlineForm) => void; onCancel: () => void;
}) {
  const accent = depthAccent(depth);
  const [form, setForm] = useState<InlineForm>({
    name: node.name, title: node.title ?? '', department: node.department ?? '', phone: node.phone ?? '',
  });
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => nameRef.current?.focus(), 50); }, []);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter')  { e.preventDefault(); onSave(form); }
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  };

  const base = depth === 0 ? lightCardRoot : lightCard;
  const inputSty: React.CSSProperties = {
    fontSize: 12, border: '1px solid var(--border)', borderRadius: 6,
    padding: '5px 8px', outline: 'none', width: '100%', color: 'var(--foreground)',
    background: 'var(--muted)', transition: 'border-color 0.15s',
  };

  return (
    <div style={{ width: 142 }} onPointerDown={e => e.stopPropagation()}>
      <div style={{ ...base, width: 142 }}>
        <div style={{ height: 4, background: `linear-gradient(90deg, ${accent}, ${accent}99)` }} />
        <div style={{ padding: '10px 10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            ref={nameRef}
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            onKeyDown={onKey}
            onFocus={e => (e.target.style.borderColor = accent)}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            placeholder="Name *"
            style={{ ...inputSty, fontWeight: 600 }}
          />
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            onKeyDown={onKey}
            onFocus={e => (e.target.style.borderColor = accent)}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            placeholder="Job Title"
            style={inputSty}
          />
          <input
            value={form.department}
            onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
            onKeyDown={onKey}
            onFocus={e => (e.target.style.borderColor = accent)}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            placeholder="Department"
            style={inputSty}
          />
          <input
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            onKeyDown={onKey}
            onFocus={e => (e.target.style.borderColor = accent)}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            placeholder="Phone"
            dir="ltr"
            style={inputSty}
          />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 2 }}>
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onCancel(); }}
              style={{ padding: '4px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--muted)', color: 'var(--muted-foreground)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onSave(form); }}
              style={{ padding: '4px 12px', borderRadius: 7, border: 'none', background: accent, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════ card face ═════ */

function CardFace({
  node, depth, editMode = false, isDragging = false, isOver = false,
  onInlineEdit, onEdit, onDelete, onAddChild, onAddSibling,
  onUploadPhoto, onRemovePhoto, onExpandPhoto,
}: {
  node: OrgNode; depth: number; editMode?: boolean;
  isDragging?: boolean; isOver?: boolean;
  onInlineEdit?: (id: string) => void;
  onEdit?: () => void; onDelete?: () => void;
  onAddChild?: () => void; onAddSibling?: () => void;
  onUploadPhoto?: (f: File) => void; onRemovePhoto?: () => void;
  onExpandPhoto?: () => void;
}) {
  const empty  = !node.name.trim();
  const accent = depthAccent(depth);

  const cardStyle: React.CSSProperties = {
    ...(depth === 0 ? lightCardRoot : lightCard),
    ...(isOver && !isDragging ? lightCardOver : {}),
    ...(isDragging ? { opacity: 0.55, transform: 'scale(0.95) rotate(1.5deg)', boxShadow: '0 12px 32px rgba(0,0,0,0.12)' } : {}),
    width: ORG_CARD_WIDTH,
    transition: isDragging ? 'none' : 'all 0.18s ease',
    cursor: editMode ? (isDragging ? 'grabbing' : 'grab') : 'default',
    userSelect: 'none',
  };

  const siblingBtn = (side: 'left' | 'right') => (
    <button
      type="button"
      onPointerDown={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); onAddSibling?.(); }}
      title={side === 'left' ? 'Add sibling left' : 'Add sibling right'}
      style={{
        position: 'absolute', top: 36,
        ...(side === 'left' ? { left: -20 } : { right: -20 }),
        zIndex: 20, width: 22, height: 22, borderRadius: '50%',
        background: 'var(--card)', border: '1.5px dashed var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--muted-foreground)', cursor: 'pointer', transition: 'all 0.15s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      }}
      onMouseEnter={e => { const t = e.currentTarget as HTMLElement; t.style.borderColor = accent; t.style.color = accent; t.style.background = `${accent}12`; }}
      onMouseLeave={e => { const t = e.currentTarget as HTMLElement; t.style.borderColor = 'var(--border)'; t.style.color = 'var(--muted-foreground)'; t.style.background = 'var(--card)'; }}>
      <Plus style={{ width: 10, height: 10 }} />
    </button>
  );

  return (
    <div className="relative flex flex-col items-center gap-1" style={{ width: ORG_CARD_WIDTH }}>
      {editMode && onAddSibling && siblingBtn('left')}
      {editMode && onAddSibling && siblingBtn('right')}

      <div style={cardStyle}>
        {/* coloured top accent strip */}
        <div style={{ height: 4, background: `linear-gradient(90deg, ${accent}, ${accent}99)`, flexShrink: 0 }} />

        {/* grip + edit/delete row */}
        {editMode && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px 0' }}>
            <GripVertical style={{ width: 13, height: 13, color: 'var(--border)' }} />
            <div style={{ display: 'flex', gap: 2 }}>
              {onEdit && (
                <button onClick={e => { e.stopPropagation(); onEdit(); }} title="Edit"
                  style={{ width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af', transition: 'all 0.15s' }}
                  onMouseEnter={e => { const t = e.currentTarget as HTMLElement; t.style.color = '#7c3aed'; t.style.background = '#ede9fe'; }}
                  onMouseLeave={e => { const t = e.currentTarget as HTMLElement; t.style.color = '#9ca3af'; t.style.background = 'transparent'; }}>
                  <Pencil style={{ width: 10, height: 10 }} />
                </button>
              )}
              {onDelete && (
                <button onClick={e => { e.stopPropagation(); onDelete(); }} title="Delete"
                  style={{ width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af', transition: 'all 0.15s' }}
                  onMouseEnter={e => { const t = e.currentTarget as HTMLElement; t.style.color = '#ef4444'; t.style.background = '#fee2e2'; }}
                  onMouseLeave={e => { const t = e.currentTarget as HTMLElement; t.style.color = '#9ca3af'; t.style.background = 'transparent'; }}>
                  <Trash2 style={{ width: 10, height: 10 }} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* avatar */}
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: editMode ? 6 : 10, marginBottom: 7 }}>
          <Avatar
            node={node}
              size={depth === 0 ? 36 : 29}
            editMode={editMode}
            onUploadPhoto={onUploadPhoto}
            onRemovePhoto={onRemovePhoto}
            onExpand={onExpandPhoto}
          />
        </div>

        {/* text content */}
        <div style={{ padding: '0 7px 9px', textAlign: 'center', minWidth: 0 }}>
          {empty ? (
            editMode ? (
              <button
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onInlineEdit?.(node.id); }}
                style={{ fontSize: 10, fontWeight: 500, border: '1px dashed var(--border)', borderRadius: 8, padding: '3px 8px', width: '100%', color: 'var(--muted-foreground)', background: 'var(--muted)', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { const t = e.currentTarget as HTMLElement; t.style.borderColor = accent; t.style.color = accent; }}
                onMouseLeave={e => { const t = e.currentTarget as HTMLElement; t.style.borderColor = 'var(--border)'; t.style.color = 'var(--muted-foreground)'; }}>
                + Add name
              </button>
            ) : (
              <p style={{ fontSize: 10, color: 'var(--muted-foreground)', opacity: 0.4 }}>—</p>
            )
          ) : (
            <>
              {node.title && <p style={{ fontSize: 10, color: 'var(--muted-foreground)', marginBottom: 2, lineHeight: 1.4 }}>{node.title}</p>}
              <p style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--card-foreground)', lineHeight: 1.25, marginBottom: 2, overflowWrap: 'anywhere' }}>{node.name}</p>
              {node.department && (
                <span style={{ display: 'inline-block', maxWidth: '100%', fontSize: 8, fontWeight: 600, padding: '1px 5px', borderRadius: 99, background: `${accent}14`, border: `1px solid ${accent}30`, color: accent, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {node.department}
                </span>
              )}
              {(node.phone || node.email) && (
                <div style={{ marginTop: 3, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                  {node.phone && (
                    <span style={{ fontSize: 9, color: 'var(--muted-foreground)', direction: 'ltr', display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Phone style={{ width: 8, height: 8, flexShrink: 0 }} />
                       {node.phone}
                    </span>
                  )}
                  {node.email && (
                    <span style={{ fontSize: 8, color: 'var(--muted-foreground)', opacity: 0.7, direction: 'ltr', display: 'flex', alignItems: 'center', gap: 2, maxWidth: '100%', overflow: 'hidden' }}>
                      <Mail style={{ width: 8, height: 8, flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.email}</span>
                    </span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* add-child button */}
      {editMode && onAddChild && (
        <button
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onAddChild(); }}
          title="Add report"
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 500, border: '1px dashed var(--border)', borderRadius: 99, padding: '3px 12px', color: 'var(--muted-foreground)', background: 'var(--card)', cursor: 'pointer', transition: 'all 0.15s' }}
          onMouseEnter={e => { const t = e.currentTarget as HTMLElement; t.style.borderColor = accent; t.style.color = accent; t.style.background = `${accent}08`; }}
          onMouseLeave={e => { const t = e.currentTarget as HTMLElement; t.style.borderColor = 'var(--border)'; t.style.color = 'var(--muted-foreground)'; t.style.background = 'var(--card)'; }}>
          <Plus style={{ width: 10, height: 10 }} />
          Add report
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════ draggable node (transform fix) ═ */

function DndNode({
  node, depth, allNodes, editMode, activeId, overId,
  inlineEditId, onInlineEdit,
  onEdit, onDelete, onAddChild, onAddSibling,
  onUploadPhoto, onRemovePhoto, onExpandPhoto,
}: {
  node: OrgNode; depth: number; allNodes: OrgNode[];
  editMode: boolean; activeId: string | null; overId: string | null;
  inlineEditId: string | null; onInlineEdit: (id: string) => void;
  onEdit: () => void; onDelete: () => void;
  onAddChild: () => void; onAddSibling: () => void;
  onUploadPhoto: (f: File) => void; onRemovePhoto: () => void;
  onExpandPhoto: () => void;
}) {
  const desc = useMemo(
    () => activeId ? descendants(activeId, allNodes) : new Set<string>(),
    [activeId, allNodes],
  );

  const {
    attributes, listeners, setNodeRef: setDrag,
    isDragging, transform,
  } = useDraggable({ id: node.id, disabled: !editMode });

  const { setNodeRef: setDrop, isOver: rawIsOver } = useDroppable({ id: node.id, disabled: !editMode });

  const isOver = rawIsOver && !desc.has(node.id) && node.id !== activeId;
  const ref    = (el: HTMLElement | null) => { setDrag(el); setDrop(el); };

  /* ── KEY FIX: apply transform directly so the card follows the cursor ── */
  const wrapStyle: React.CSSProperties = {
    touchAction: editMode ? 'none' : 'auto',
    ...(isDragging && transform
      ? { transform: CSS.Translate.toString(transform), zIndex: 1000, position: 'relative' }
      : {}),
  };

  return (
    <div ref={ref} style={wrapStyle} {...attributes} {...(editMode ? listeners : {})}>
      <CardFace
        node={node} depth={depth} editMode={editMode}
        isDragging={isDragging} isOver={isOver}
        onInlineEdit={onInlineEdit}
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
  inlineEditId, onInlineEdit, onInlineSave, onInlineCancel,
  onEdit, onDelete, onAddChild, onAddSibling,
  onUploadPhoto, onRemovePhoto, onExpandPhoto,
}: {
  node: OrgNode; allNodes: OrgNode[]; depth: number;
  editMode: boolean; activeId: string | null; overId: string | null;
  inlineEditId: string | null;
  onInlineEdit: (id: string) => void;
  onInlineSave: (id: string, form: InlineForm) => void;
  onInlineCancel: () => void;
  onEdit: (n: OrgNode) => void; onDelete: (n: OrgNode) => void;
  onAddChild: (parentId: string) => void;
  onAddSibling: (parentId: string | null) => void;
  onUploadPhoto: (node: OrgNode, f: File) => void;
  onRemovePhoto: (node: OrgNode) => void;
  onExpandPhoto: (node: OrgNode) => void;
}) {
  const children = allNodes.filter(n => n.parentId === node.id);
  const isInline = inlineEditId === node.id;

  return (
    <div className="org-node">
      {isInline ? (
        <InlineEditCard
          node={node} depth={depth}
          onSave={form => onInlineSave(node.id, form)}
          onCancel={onInlineCancel}
        />
      ) : (
        <DndNode
          node={node} depth={depth} allNodes={allNodes}
          editMode={editMode} activeId={activeId} overId={overId}
          inlineEditId={inlineEditId} onInlineEdit={onInlineEdit}
          onEdit={() => onEdit(node)} onDelete={() => onDelete(node)}
          onAddChild={() => onAddChild(node.id)}
          onAddSibling={() => onAddSibling(node.parentId ?? null)}
          onUploadPhoto={f => onUploadPhoto(node, f)}
          onRemovePhoto={() => onRemovePhoto(node)}
          onExpandPhoto={() => onExpandPhoto(node)}
        />
      )}
      {children.length > 0 && (
        <div className="org-children">
          {children.map(child => (
            <div key={child.id} className="org-child-col">
              <OrgTree
                node={child} allNodes={allNodes} depth={depth + 1}
                editMode={editMode} activeId={activeId} overId={overId}
                inlineEditId={inlineEditId}
                onInlineEdit={onInlineEdit} onInlineSave={onInlineSave} onInlineCancel={onInlineCancel}
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
        color: isOver ? '#7c3aed' : '#9ca3af', transition: 'all 0.2s',
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
            {field('name', 'Full Name *', 'e.g. Ahmed Al-Omari')}
            {field('title', 'Title', 'e.g. CEO')}
            {field('department', 'Department', 'e.g. Operations')}
            {field('phone', 'Phone', '+966 5x', 'ltr')}
          </div>
          {field('email', 'البريد الإلكتروني', 'name@bank.com', 'ltr')}
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
  const [nodes,        setNodes]        = useState<OrgNode[]>(() =>
    isFirst ? DEFAULT_NODES : (bank.orgChart ?? []),
  );
  const [editMode,     setEditMode]     = useState(false);
  const [activeId,     setActiveId]     = useState<string | null>(null);
  const [overId,       setOverId]       = useState<string | null>(null);
  const [dialog,       setDialog]       = useState<{ open: boolean; initial: Partial<OrgNode> & { id?: string } } | null>(null);
  const [lightbox,     setLightbox]     = useState<OrgNode | null>(null);
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { toast }   = useToast();
  const updateBank  = useUpdateBank();
  const uploadPhoto = useSetOrgChartNodePhoto();
  const restorePhotoSnapshot = useRestoreBankOrgChartPhotoSnapshot();
  const [restoreConfirmationOpen, setRestoreConfirmationOpen] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    if (isFirst) {
      updateBank.mutate({
        id: bank.id,
        data: { nameEn: bank.nameEn, nameAr: bank.nameAr, category: bank.category, status: bank.status, riskLevel: bank.riskLevel, priorityImpact: bank.priorityImpact, orgChart: DEFAULT_NODES },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = useCallback((next: OrgNode[], opts?: { onSuccess?: () => void }) => {
    updateBank.mutate(
      { id: bank.id, data: { nameEn: bank.nameEn, nameAr: bank.nameAr, category: bank.category, status: bank.status, riskLevel: bank.riskLevel, priorityImpact: bank.priorityImpact, orgChart: next } },
      {
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bank.id) }); opts?.onSuccess?.(); },
        onError: () => toast({ title: 'Failed to save. Please try again.', variant: 'destructive' }),
      },
    );
  }, [bank, updateBank, queryClient, toast]);

  /* ── contacts import ─────────────────────────────────────────────────── */
  const contacts: BankContact[] = bank.contacts ?? [];

  const importFromContacts = useCallback(() => {
    if (!contacts.length) return;

    const ts = Date.now();
    const sorted = [...contacts].sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0));
    const result = mergeContactsIntoOrgChart(
      nodes as OrgChartImportNode[],
      sorted as OrgChartImportContact[],
      (index) => `contact-${ts}-${index}`,
    );
    const next = result.nodes as OrgNode[];
    setNodes(next);
    save(next, {
      onSuccess: () => toast({
        title: '✓ Contacts imported safely',
        description: `${result.added} added, ${result.updated} updated. Existing photos and hierarchy were kept.`,
      }),
    });
  }, [contacts, nodes, save, toast]);

  /* ── inline edit handlers ────────────────────────────────────────────── */
  const handleInlineSave = useCallback((nodeId: string, form: InlineForm) => {
    const next = nodes.map(n =>
      n.id === nodeId
        ? { ...n, name: form.name.trim(), title: form.title.trim() || null, department: form.department.trim() || null, phone: form.phone.trim() || null }
        : n,
    );
    setNodes(next);
    setInlineEditId(null);
    save(next);
  }, [nodes, save]);

  const handleInlineCancel = useCallback(() => setInlineEditId(null), []);

  /* ── add sibling / child → creates node then opens inline edit ────────── */
  const handleAddSibling = useCallback((parentId: string | null) => {
    const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const next = [...nodes, { ...EMPTY_NODE, id, parentId }];
    setNodes(next);
    save(next, { onSuccess: () => setInlineEditId(id) });
  }, [nodes, save]);

  const handleAddChild = useCallback((parentId: string) => {
    const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const next = [...nodes, { ...EMPTY_NODE, id, parentId }];
    setNodes(next);
    save(next, { onSuccess: () => setInlineEditId(id) });
  }, [nodes, save]);

  /* ── drag handlers ───────────────────────────────────────────────────── */
  const handleDragStart = ({ active }: DragStartEvent) => { setActiveId(String(active.id)); setInlineEditId(null); };
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

  /* ── dialog save ─────────────────────────────────────────────────────── */
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
    const next = nodes.map(n => n.id === node.id ? { ...n, photoUrl: null, photoStoragePath: null } : n);
    setNodes(next); save(next);
  };

  const handleUploadPhoto = (node: OrgNode, file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      uploadPhoto.mutate(
        { id: bank.id, nodeId: node.id, data: { dataUrl: e.target?.result as string } },
        {
          onSuccess: (res: any) => {
            const next = nodes.map(n => n.id === node.id
              ? { ...n, photoUrl: res?.photoUrl ?? null, photoStoragePath: res?.storagePath ?? null }
              : n);
            setNodes(next); save(next);
          },
          onError: () => toast({ title: 'Photo upload failed. Please try again.', variant: 'destructive' }),
        },
      );
    };
    reader.readAsDataURL(file);
  };

  const restoreLatestPhotoSnapshot = () => {
    restorePhotoSnapshot.mutate({ id: bank.id }, {
      onSuccess: (restoredBank: any) => {
        const restoredNodes = (restoredBank.orgChart ?? []) as OrgNode[];
        setNodes(restoredNodes);
        setRestoreConfirmationOpen(false);
        queryClient.invalidateQueries({ queryKey: getGetBankQueryKey(bank.id) });
        toast({
          title: 'Chart restored',
          description: 'The latest saved chart with photos has been restored. You can now import contacts safely.',
        });
      },
      onError: () => toast({
        title: 'No saved chart was found',
        description: 'There is no earlier saved version with photos to restore.',
        variant: 'destructive',
      }),
    });
  };

  const roots = nodes.filter(n => !n.parentId);

  return (
    <>
      <Card>
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="w-4 h-4 text-primary" />
            Org Chart
            {(updateBank.isPending || uploadPhoto.isPending) && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground ml-1" />
            )}
            <div className="ml-auto flex items-center gap-2">
              {editMode && contacts.length > 0 && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                  onClick={importFromContacts} disabled={updateBank.isPending || restorePhotoSnapshot.isPending}>
                  <Users className="w-3 h-3" /> Import Contacts
                </Button>
              )}
              {editMode && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                  onClick={() => setRestoreConfirmationOpen(true)} disabled={restorePhotoSnapshot.isPending || updateBank.isPending}>
                  {restorePhotoSnapshot.isPending
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <History className="w-3 h-3" />}
                  Restore saved chart
                </Button>
              )}
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
                onClick={() => { setEditMode(v => !v); setInlineEditId(null); }}>
                {editMode ? <Lock className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="overflow-x-auto rounded-b-xl" style={{ background: 'hsl(var(--muted) / 0.4)' }}>
              <div className="min-w-max px-6 py-6 sm:px-8 sm:py-7">
                <RootDropZone visible={editMode && !!activeId} />
                <div className="flex gap-8 items-start justify-center">
                  {roots.map(root => (
                    <OrgTree
                      key={root.id}
                      node={root} allNodes={nodes} depth={0}
                      editMode={editMode} activeId={activeId} overId={overId}
                      inlineEditId={inlineEditId}
                      onInlineEdit={setInlineEditId}
                      onInlineSave={handleInlineSave}
                      onInlineCancel={handleInlineCancel}
                      onEdit={n => setDialog({ open: true, initial: { ...n } })}
                      onDelete={handleDelete}
                      onAddChild={handleAddChild}
                      onAddSibling={handleAddSibling}
                      onUploadPhoto={handleUploadPhoto}
                      onRemovePhoto={handleRemovePhoto}
                      onExpandPhoto={n => setLightbox(n)}
                    />
                  ))}
                </div>
              </div>
            </div>
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

      <AlertDialog open={restoreConfirmationOpen} onOpenChange={setRestoreConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore the saved chart?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces the current organization chart with the latest saved copy that contains profile photos.
              Your contacts list is not changed, and you can safely import it again afterward.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restorePhotoSnapshot.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={restoreLatestPhotoSnapshot} disabled={restorePhotoSnapshot.isPending}>
              Restore chart
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
