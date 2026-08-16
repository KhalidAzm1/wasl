import React, { useState, useRef, useCallback } from 'react';
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
  UserPlus, UploadCloud, ChevronLeft, ChevronRight,
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

// ── Depth-based card colors ───────────────────────────────────────────────────
// depth 0 = root: white card, blue border
// depth 1 = blue card, white text
// depth 2+ = light-blue card, dark text

function getCardStyle(depth: number) {
  if (depth === 0) return {
    card: 'bg-white border-2 border-blue-200 shadow-lg',
    name: 'text-slate-800',
    title: 'text-slate-500',
    dept: 'text-blue-500',
    avatarRing: 'ring-2 ring-blue-200 ring-offset-2 ring-offset-white',
  };
  if (depth === 1) return {
    card: 'bg-blue-500 border-0 shadow-md',
    name: 'text-white',
    title: 'text-blue-100',
    dept: 'text-blue-200',
    avatarRing: 'ring-2 ring-white ring-offset-2 ring-offset-blue-500',
  };
  return {
    card: 'bg-blue-50 border border-blue-200 shadow-sm',
    name: 'text-slate-700',
    title: 'text-slate-500',
    dept: 'text-blue-500',
    avatarRing: 'ring-2 ring-blue-200 ring-offset-2 ring-offset-blue-50',
  };
}

// ── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS: [string, string][] = [
  ['#2563EB', '#DBEAFE'], ['#7C3AED', '#EDE9FE'], ['#059669', '#D1FAE5'],
  ['#D97706', '#FEF3C7'], ['#DC2626', '#FEE2E2'], ['#0891B2', '#CFFAFE'],
  ['#4F46E5', '#E0E7FF'], ['#DB2777', '#FCE7F3'],
];
function getAvatarColor(name: string): [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function NodeAvatar({ node, size, ringClass }: { node: OrgNode; size: number; ringClass: string }) {
  const initials = node.name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
  const [fg, bg] = getAvatarColor(node.name);

  if (node.photoUrl) {
    return (
      <img
        src={node.photoUrl}
        alt={node.name}
        style={{ width: size, height: size }}
        className={cn('rounded-full object-cover', ringClass)}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.36 }}
      className={cn('rounded-full flex items-center justify-center font-bold shrink-0', ringClass)}
    >
      {initials || '?'}
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────

const CARD_WIDTH = 160;

function OrgCard({
  node, depth,
  onEdit, onDelete, onAddChild, onUploadPhoto,
  canMoveLeft, canMoveRight, onMoveLeft, onMoveRight,
}: {
  node: OrgNode;
  depth: number;
  onEdit?: () => void;
  onDelete?: () => void;
  onAddChild?: () => void;
  onUploadPhoto?: (f: File) => void;
  canMoveLeft?: boolean;
  canMoveRight?: boolean;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
}) {
  const photoRef = useRef<HTMLInputElement>(null);
  const style = getCardStyle(depth);
  const avatarSize = depth === 0 ? 72 : 60;

  return (
    <div className="group relative flex flex-col items-center" style={{ width: CARD_WIDTH }}>
      {/* Sibling reorder arrows — shown on hover */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none z-10 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ marginLeft: -28, marginRight: -28 }}>
        <button
          onClick={onMoveLeft}
          disabled={!canMoveLeft}
          className={cn(
            'pointer-events-auto w-6 h-6 rounded-full flex items-center justify-center shadow-md transition-all',
            canMoveLeft
              ? 'bg-white text-blue-500 hover:bg-blue-500 hover:text-white cursor-pointer'
              : 'bg-white/40 text-slate-300 cursor-not-allowed',
          )}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onMoveRight}
          disabled={!canMoveRight}
          className={cn(
            'pointer-events-auto w-6 h-6 rounded-full flex items-center justify-center shadow-md transition-all',
            canMoveRight
              ? 'bg-white text-blue-500 hover:bg-blue-500 hover:text-white cursor-pointer'
              : 'bg-white/40 text-slate-300 cursor-not-allowed',
          )}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Card body */}
      <div className={cn(
        'relative w-full rounded-2xl flex flex-col items-center pt-5 pb-3 px-2 transition-all',
        style.card,
      )}>
        {/* Avatar — upload on hover */}
        <button
          className="relative mb-2 shrink-0"
          title="Upload photo"
          onClick={() => onUploadPhoto && photoRef.current?.click()}
        >
          <NodeAvatar node={node} size={avatarSize} ringClass={style.avatarRing} />
          {onUploadPhoto && (
            <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <UploadCloud className="w-3.5 h-3.5 text-white" />
            </div>
          )}
        </button>
        {onUploadPhoto && (
          <input ref={photoRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onUploadPhoto(f); e.target.value = ''; }} />
        )}

        {/* Text */}
        <p className={cn('text-[13px] font-bold leading-tight text-center px-1', style.name)}>{node.name}</p>
        {node.title && <p className={cn('text-[11px] mt-0.5 text-center leading-snug px-1', style.title)}>{node.title}</p>}
        {node.department && <p className={cn('text-[10px] mt-0.5 font-semibold text-center', style.dept)}>{node.department}</p>}

        {/* Contact */}
        {(node.phone || node.email) && (
          <div className="flex items-center justify-center gap-2 mt-1.5 flex-wrap">
            {node.phone && (
              <a href={`tel:${node.phone}`} dir="ltr" onClick={e => e.stopPropagation()}
                className={cn('text-[10px] flex items-center gap-0.5 hover:underline', depth === 1 ? 'text-blue-100' : 'text-slate-400')}>
                <Phone className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate max-w-[72px]">{node.phone}</span>
              </a>
            )}
            {node.email && !node.phone && (
              <a href={`mailto:${node.email}`} onClick={e => e.stopPropagation()}
                className={cn('text-[10px] flex items-center gap-0.5 hover:underline', depth === 1 ? 'text-blue-100' : 'text-slate-400')}>
                <Mail className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate max-w-[80px]">{node.email}</span>
              </a>
            )}
          </div>
        )}

        {/* Action bar — shown on hover */}
        {(onEdit || onDelete) && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-2">
            {onEdit && (
              <button title="Edit" onClick={onEdit}
                className={cn(
                  'w-6 h-6 rounded-lg flex items-center justify-center transition-colors',
                  depth === 1
                    ? 'text-blue-200 hover:text-white hover:bg-white/20'
                    : 'text-foreground/30 hover:text-blue-500 hover:bg-blue-50',
                )}>
                <Pencil className="w-3 h-3" />
              </button>
            )}
            {onDelete && (
              <button title="Delete" onClick={onDelete}
                className={cn(
                  'w-6 h-6 rounded-lg flex items-center justify-center transition-colors',
                  depth === 1
                    ? 'text-blue-200 hover:text-white hover:bg-white/20'
                    : 'text-foreground/30 hover:text-red-400 hover:bg-red-50',
                )}>
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add child button — centred below card */}
      {onAddChild && (
        <button
          onClick={onAddChild}
          title="Add direct report"
          className="opacity-0 group-hover:opacity-100 transition-opacity mt-1 w-6 h-6 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center shadow-md z-10"
        >
          <UserPlus className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ── Recursive Tree ────────────────────────────────────────────────────────────

function OrgTree({
  node, allNodes, depth,
  onEdit, onDelete, onAddChild, onUploadPhoto, onSwapSibling,
  siblingIndex, siblingCount,
}: {
  node: OrgNode;
  allNodes: OrgNode[];
  depth: number;
  onEdit: (n: OrgNode) => void;
  onDelete: (n: OrgNode) => void;
  onAddChild: (parentId: string) => void;
  onUploadPhoto: (node: OrgNode, f: File) => void;
  onSwapSibling: (nodeId: string, direction: 'left' | 'right') => void;
  siblingIndex: number;
  siblingCount: number;
}) {
  const children = allNodes.filter(n => n.parentId === node.id);

  return (
    <div className="org-node">
      <OrgCard
        node={node}
        depth={depth}
        onEdit={() => onEdit(node)}
        onDelete={() => onDelete(node)}
        onAddChild={() => onAddChild(node.id)}
        onUploadPhoto={f => onUploadPhoto(node, f)}
        canMoveLeft={siblingIndex > 0}
        canMoveRight={siblingIndex < siblingCount - 1}
        onMoveLeft={() => onSwapSibling(node.id, 'left')}
        onMoveRight={() => onSwapSibling(node.id, 'right')}
      />
      {children.length > 0 && (
        <div className="org-children">
          {children.map((child, idx) => (
            <div key={child.id} className="org-child-col">
              <OrgTree
                node={child}
                allNodes={allNodes}
                depth={depth + 1}
                onEdit={onEdit}
                onDelete={onDelete}
                onAddChild={onAddChild}
                onUploadPhoto={onUploadPhoto}
                onSwapSibling={onSwapSibling}
                siblingIndex={idx}
                siblingCount={children.length}
              />
            </div>
          ))}
        </div>
      )}
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

  const field = (key: keyof OrgNode, label: string, placeholder?: string, dir?: 'ltr') => (
    <div className="space-y-1">
      <label className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider block">{label}</label>
      <Input
        value={(form[key] as string) ?? ''}
        placeholder={placeholder}
        dir={dir}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="bg-background border-foreground/10 text-sm h-8"
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
            {initial.id ? 'Edit Person' : 'Add Person'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="grid grid-cols-2 gap-3">
            {field('name', 'Full Name *', 'e.g. Ahmed Al-Harbi')}
            {field('title', 'Job Title', 'e.g. CEO')}
            {field('department', 'Department', 'e.g. Operations')}
            {field('phone', 'Phone', '+966 5x xxx xxxx', 'ltr')}
          </div>
          {field('email', 'Email', 'name@bank.com', 'ltr')}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider block">Reports To</label>
            <select
              value={form.parentId ?? ''}
              onChange={e => setForm(f => ({ ...f, parentId: e.target.value || null }))}
              className="w-full h-8 rounded-md border border-foreground/10 bg-background text-sm px-2 outline-none focus:border-primary/50"
            >
              <option value="">— Top level (no manager) —</option>
              {parentOptions.map(n => (
                <option key={n.id} value={n.id}>
                  {n.name}{n.title ? ` · ${n.title}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            disabled={!form.name?.trim() || saving}
            onClick={() => onSave({ ...form, id: initial.id } as any)}
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
            {initial.id ? 'Save Changes' : 'Add Person'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Section ──────────────────────────────────────────────────────────────

export function OrgChartSection({ bank }: { bank: any }) {
  const [nodes, setNodes] = useState<OrgNode[]>(() => bank.orgChart ?? []);
  const [dialog, setDialog] = useState<{ open: boolean; initial: Partial<OrgNode> & { id?: string } } | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateBank = useUpdateBank();
  const uploadPhoto = useSetOrgChartNodePhoto();

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
    // Re-parent children of deleted node up to its parent
    const next = nodes
      .filter(n => n.id !== node.id)
      .map(n => n.parentId === node.id ? { ...n, parentId: node.parentId ?? null } : n);
    setNodes(next);
    save(next);
  };

  const handleSwapSibling = (nodeId: string, direction: 'left' | 'right') => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const siblings = nodes.filter(n => n.parentId === node.parentId);
    const idx = siblings.findIndex(n => n.id === nodeId);
    const swapIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;

    // Swap positions in the main array
    const next = [...nodes];
    const aIdx = next.findIndex(n => n.id === siblings[idx].id);
    const bIdx = next.findIndex(n => n.id === siblings[swapIdx].id);
    [next[aIdx], next[bIdx]] = [next[bIdx], next[aIdx]];
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

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 border-b border-foreground/5">
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="w-4 h-4 text-primary" />
            Organizational Chart
            {(updateBank.isPending || uploadPhoto.isPending) && (
              <Loader2 className="w-3 h-3 animate-spin text-foreground/40 ml-1" />
            )}
            <button
              onClick={() => setDialog({ open: true, initial: { parentId: null } })}
              className="ml-auto flex items-center gap-1.5 text-xs text-primary hover:text-primary/70 font-medium transition-colors bg-primary/8 hover:bg-primary/15 px-2.5 py-1 rounded-lg"
            >
              <Plus className="w-3 h-3" /> Add Person
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
              <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center">
                <Network className="w-9 h-9 text-blue-200" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground/40">No org chart yet</p>
                <p className="text-xs text-foreground/25 mt-1">
                  Add the first person to start building the hierarchy
                </p>
              </div>
              <Button
                size="sm"
                className="bg-blue-500 hover:bg-blue-600 text-white shadow-sm"
                onClick={() => setDialog({ open: true, initial: { parentId: null } })}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Root Person
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto bg-slate-50/50">
              <div className="min-w-fit px-10 py-8">
                <div className="flex gap-16 items-start justify-center">
                  {roots.map((root, idx) => (
                    <OrgTree
                      key={root.id}
                      node={root}
                      allNodes={nodes}
                      depth={0}
                      onEdit={n => setDialog({ open: true, initial: { ...n } })}
                      onDelete={handleDelete}
                      onAddChild={parentId => setDialog({ open: true, initial: { parentId } })}
                      onUploadPhoto={handleUploadPhoto}
                      onSwapSibling={handleSwapSibling}
                      siblingIndex={idx}
                      siblingCount={roots.length}
                    />
                  ))}
                </div>
              </div>
            </div>
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
