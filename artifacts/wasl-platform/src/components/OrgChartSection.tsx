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
  Plus, Pencil, Trash2, Loader2, Network, Phone, Mail, UserPlus, UploadCloud,
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
  name: '',
  title: '',
  phone: '',
  email: '',
  department: '',
  parentId: null,
  photoUrl: null,
};

// ── Avatar ───────────────────────────────────────────────────────────────────

const COLORS = [
  ['#3B82F6','#EFF6FF'], ['#8B5CF6','#F5F3FF'], ['#10B981','#ECFDF5'],
  ['#F59E0B','#FFFBEB'], ['#EF4444','#FEF2F2'], ['#06B6D4','#ECFEFF'],
  ['#6366F1','#EEF2FF'], ['#EC4899','#FDF2F8'],
];

function getColor(name: string): [string, string] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return COLORS[h % COLORS.length] as [string, string];
}

function NodeAvatar({ node, size = 56 }: { node: OrgNode; size?: number }) {
  const initials = node.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');

  const [fg, bg] = getColor(node.name);
  const px = size + 'px';

  if (node.photoUrl) {
    return (
      <img
        src={node.photoUrl}
        alt={node.name}
        style={{ width: px, height: px }}
        className="rounded-full object-cover border-2 border-background shadow"
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }

  return (
    <div
      style={{ width: px, height: px, background: bg, color: fg, fontSize: size * 0.34 + 'px' }}
      className="rounded-full flex items-center justify-center font-bold border-2 border-background shadow shrink-0"
    >
      {initials || '?'}
    </div>
  );
}

// ── Node Card ─────────────────────────────────────────────────────────────────

function OrgNodeCard({
  node, depth, onEdit, onDelete, onAddChild, onUploadPhoto,
}: {
  node: OrgNode;
  depth: number;
  onEdit: () => void;
  onDelete: () => void;
  onAddChild: () => void;
  onUploadPhoto: (file: File) => void;
}) {
  const photoRef = useRef<HTMLInputElement>(null);
  const isRoot = depth === 0;

  return (
    <div
      className={cn(
        'group relative rounded-xl border flex flex-col items-center text-center select-none transition-shadow hover:shadow-md',
        isRoot
          ? 'bg-primary/10 border-primary/30 shadow-sm'
          : 'bg-card border-foreground/10 shadow-sm',
      )}
      style={{ width: '172px' }}
    >
      {/* Photo — click avatar area to upload */}
      <button
        className="mt-4 mb-3 relative"
        title="Click to upload photo"
        onClick={() => photoRef.current?.click()}
      >
        <NodeAvatar node={node} size={isRoot ? 64 : 52} />
        <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <UploadCloud className="w-4 h-4 text-white" />
        </div>
      </button>
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onUploadPhoto(f); e.target.value = ''; }}
      />

      {/* Name / Title / Dept */}
      <div className="px-3 pb-1 w-full">
        <p className={cn('font-bold leading-tight', isRoot ? 'text-sm' : 'text-xs')}>{node.name}</p>
        {node.title && (
          <p className={cn('text-foreground/50 mt-0.5 leading-tight', isRoot ? 'text-xs' : 'text-[10px]')}>
            {node.title}
          </p>
        )}
        {node.department && (
          <p className="text-[10px] text-primary/60 mt-0.5 font-medium leading-tight">{node.department}</p>
        )}
      </div>

      {/* Contact row */}
      {(node.phone || node.email) && (
        <div className="flex items-center justify-center gap-2 px-3 pb-2 mt-1">
          {node.phone && (
            <a
              href={`tel:${node.phone}`}
              title={node.phone}
              className="text-[10px] text-foreground/40 hover:text-primary flex items-center gap-0.5 leading-none"
              dir="ltr"
              onClick={e => e.stopPropagation()}
            >
              <Phone className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate max-w-[80px]">{node.phone}</span>
            </a>
          )}
          {node.email && !node.phone && (
            <a
              href={`mailto:${node.email}`}
              title={node.email}
              className="text-[10px] text-foreground/40 hover:text-primary flex items-center gap-0.5 leading-none"
              onClick={e => e.stopPropagation()}
            >
              <Mail className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate max-w-[90px]">{node.email}</span>
            </a>
          )}
        </div>
      )}

      {/* Action buttons — appear on hover */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 pb-2 mt-0.5">
        <button
          title="Add child"
          onClick={onAddChild}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-foreground/30 hover:text-primary hover:bg-primary/10 transition-colors"
        >
          <UserPlus className="w-3 h-3" />
        </button>
        <button
          title="Edit"
          onClick={onEdit}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-foreground/30 hover:text-blue-400 hover:bg-blue-400/10 transition-colors"
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          title="Delete"
          onClick={onDelete}
          className="w-6 h-6 rounded-lg flex items-center justify-center text-foreground/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ── Recursive Tree ───────────────────────────────────────────────────────────

function OrgTree({
  node, allNodes, depth = 0, onEdit, onDelete, onAddChild, onUploadPhoto,
}: {
  node: OrgNode;
  allNodes: OrgNode[];
  depth?: number;
  onEdit: (n: OrgNode) => void;
  onDelete: (n: OrgNode) => void;
  onAddChild: (parentId: string) => void;
  onUploadPhoto: (node: OrgNode, file: File) => void;
}) {
  const children = allNodes.filter(n => n.parentId === node.id);

  return (
    <div className="org-node">
      <OrgNodeCard
        node={node}
        depth={depth}
        onEdit={() => onEdit(node)}
        onDelete={() => onDelete(node)}
        onAddChild={() => onAddChild(node.id)}
        onUploadPhoto={file => onUploadPhoto(node, file)}
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
  const isEdit = !!initial.id;

  React.useEffect(() => {
    if (open) setForm({ ...EMPTY_NODE, ...initial });
  }, [open, initial]);

  const field = (key: keyof OrgNode, label: string, dir?: 'ltr') => (
    <div className="space-y-1">
      <label className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider block">{label}</label>
      <Input
        value={(form[key] as string) ?? ''}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="bg-background border-foreground/10 text-sm h-8"
        dir={dir}
      />
    </div>
  );

  const selfAndDescendants = new Set<string>();
  if (initial.id) {
    const collect = (id: string) => {
      selfAndDescendants.add(id);
      allNodes.filter(n => n.parentId === id).forEach(n => collect(n.id));
    };
    collect(initial.id);
  }
  const parentOptions = allNodes.filter(n => !selfAndDescendants.has(n.id));

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Node' : 'Add Node'}</DialogTitle>
        </DialogHeader>
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
            <select
              value={form.parentId ?? ''}
              onChange={e => setForm(f => ({ ...f, parentId: e.target.value || null }))}
              className="w-full h-8 rounded-md border border-foreground/10 bg-background text-sm px-2 outline-none focus:border-primary/50"
            >
              <option value="">— Root (no parent) —</option>
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
            onClick={() => onSave({ ...form, id: initial.id } as any)}
            disabled={!form.name?.trim() || saving}
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
            {isEdit ? 'Save Changes' : 'Add Node'}
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

  const handleAddRoot = () => setDialog({ open: true, initial: { parentId: null } });
  const handleAddChild = (parentId: string) => setDialog({ open: true, initial: { parentId } });
  const handleEdit = (node: OrgNode) => setDialog({ open: true, initial: { ...node } });

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
            <button
              onClick={handleAddRoot}
              className="ml-auto flex items-center gap-1 text-xs text-primary hover:text-primary/70 font-medium transition-colors"
            >
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
              <Button size="sm" variant="outline" onClick={handleAddRoot} className="mt-1">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Root Node
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="flex gap-12 min-w-fit items-start justify-center py-4 px-6">
                {roots.map(root => (
                  <OrgTree
                    key={root.id}
                    node={root}
                    allNodes={nodes}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onAddChild={handleAddChild}
                    onUploadPhoto={handleUploadPhoto}
                  />
                ))}
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
