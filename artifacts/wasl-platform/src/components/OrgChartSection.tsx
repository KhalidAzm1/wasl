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
  Plus, Pencil, Trash2, Loader2, Network, Phone, UserPlus, UploadCloud, X,
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

// ── Avatar ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500',
  'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-red-500',
];

function getColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function Avatar({ node, size = 'md' }: { node: OrgNode; size?: 'sm' | 'md' | 'lg' }) {
  const initials = node.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');

  const sizeClass = size === 'lg' ? 'w-16 h-16 text-xl' : size === 'sm' ? 'w-8 h-8 text-xs' : 'w-12 h-12 text-sm';

  if (node.photoUrl) {
    return (
      <img
        src={node.photoUrl}
        alt={node.name}
        className={cn('rounded-full object-cover border-2 border-background shrink-0', sizeClass)}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }

  return (
    <div className={cn(
      'rounded-full flex items-center justify-center font-semibold text-white border-2 border-background shrink-0',
      sizeClass, getColor(node.name)
    )}>
      {initials || '?'}
    </div>
  );
}

// ── Node Card ────────────────────────────────────────────────────────────────

function OrgNodeCard({
  node, onEdit, onDelete, onAddChild, onUploadPhoto,
}: {
  node: OrgNode;
  onEdit: () => void;
  onDelete: () => void;
  onAddChild: () => void;
  onUploadPhoto: (file: File) => void;
}) {
  const photoInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="group relative flex flex-col items-center gap-1.5 rounded-xl border border-foreground/10 bg-card p-3 w-36 text-center shadow-sm hover:border-primary/30 transition-colors">
      {/* Photo — click to upload */}
      <button
        onClick={() => photoInputRef.current?.click()}
        className="relative"
        title="Click to upload photo"
      >
        <Avatar node={node} size="lg" />
        <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <UploadCloud className="w-5 h-5 text-white" />
        </div>
      </button>
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onUploadPhoto(f); e.target.value = ''; }}
      />

      {/* Name / Title */}
      <div className="min-w-0 w-full">
        <p className="text-xs font-semibold leading-tight line-clamp-2">{node.name}</p>
        {node.title && <p className="text-[10px] text-foreground/50 mt-0.5 line-clamp-1">{node.title}</p>}
        {node.department && <p className="text-[10px] text-primary/70 mt-0.5 line-clamp-1">🏢 {node.department}</p>}
        {node.phone && (
          <a href={`tel:${node.phone}`} className="text-[10px] text-primary flex items-center justify-center gap-0.5 mt-0.5" dir="ltr">
            <Phone className="w-2.5 h-2.5" /> {node.phone}
          </a>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onAddChild} title="Add child node"
          className="w-5 h-5 rounded flex items-center justify-center text-foreground/30 hover:text-primary hover:bg-primary/10 transition-colors">
          <UserPlus className="w-3 h-3" />
        </button>
        <button onClick={onEdit} title="Edit node"
          className="w-5 h-5 rounded flex items-center justify-center text-foreground/30 hover:text-blue-400 hover:bg-blue-400/10 transition-colors">
          <Pencil className="w-3 h-3" />
        </button>
        <button onClick={onDelete} title="Delete node"
          className="w-5 h-5 rounded flex items-center justify-center text-foreground/30 hover:text-red-400 hover:bg-red-400/10 transition-colors">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ── Tree Renderer ────────────────────────────────────────────────────────────

function OrgTree({
  node, allNodes, onEdit, onDelete, onAddChild, onUploadPhoto,
}: {
  node: OrgNode;
  allNodes: OrgNode[];
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

// ── Node Edit Dialog ─────────────────────────────────────────────────────────

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

  // Reset form when dialog reopens
  React.useEffect(() => {
    if (open) setForm({ ...EMPTY_NODE, ...initial });
  }, [open, initial]);

  const field = (key: keyof OrgNode, placeholder: string, dir?: 'ltr') => (
    <Input
      placeholder={placeholder}
      value={(form[key] as string) ?? ''}
      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
      className="bg-background border-foreground/10 text-sm h-8"
      dir={dir}
    />
  );

  // Available parents: all nodes except this node's subtree (to prevent cycles)
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
        <div className="space-y-2 py-1">
          <div className="grid grid-cols-2 gap-2">
            {field('name', 'Full Name *')}
            {field('title', 'Title / Role')}
            {field('department', 'Department')}
            {field('phone', 'Phone', 'ltr')}
            {field('email', 'Email', 'ltr')}
          </div>

          {/* Parent selector */}
          <div>
            <label className="text-[10px] font-semibold text-foreground/40 uppercase tracking-wider block mb-1">
              Reports To
            </label>
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

// ── Main Section ─────────────────────────────────────────────────────────────

export function OrgChartSection({ bank }: { bank: any }) {
  const [nodes, setNodes] = useState<OrgNode[]>(() => bank.orgChart ?? []);
  const [dialog, setDialog] = useState<{ open: boolean; initial: Partial<OrgNode> & { id?: string } } | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateBank = useUpdateBank();
  const uploadPhoto = useSetOrgChartNodePhoto();

  // ── Save helper ──
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

  // ── Add node ──
  const handleAddRoot = () => setDialog({ open: true, initial: { parentId: null } });
  const handleAddChild = (parentId: string) => setDialog({ open: true, initial: { parentId } });
  const handleEdit = (node: OrgNode) => setDialog({ open: true, initial: { ...node } });

  const handleDialogSave = (data: Omit<OrgNode, 'id'> & { id?: string }) => {
    let next: OrgNode[];
    if (data.id) {
      // Edit
      next = nodes.map(n => n.id === data.id ? { ...n, ...data, id: n.id } : n);
    } else {
      // Add
      const id = `node-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      next = [...nodes, { ...data, id } as OrgNode];
    }
    setNodes(next);
    save(next, { onSuccess: () => setDialog(null) });
  };

  // ── Delete ──
  const handleDelete = (node: OrgNode) => {
    // Promote children to deleted node's parent
    const next = nodes
      .filter(n => n.id !== node.id)
      .map(n => n.parentId === node.id ? { ...n, parentId: node.parentId ?? null } : n);
    setNodes(next);
    save(next);
  };

  // ── Photo upload ──
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

  // ── Roots ──
  const roots = nodes.filter(n => !n.parentId);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Network className="w-4 h-4 text-primary" />
            Organizational Chart
            {(updateBank.isPending || uploadPhoto.isPending) && (
              <Loader2 className="w-3 h-3 animate-spin text-foreground/40" />
            )}
            <button
              onClick={handleAddRoot}
              className="ml-auto flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
              <Network className="w-10 h-10 text-foreground/10" />
              <p className="text-sm text-foreground/30">No org chart yet</p>
              <Button size="sm" variant="outline" onClick={handleAddRoot}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Root Node
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto pb-2">
              <div className="org-chart-root flex gap-8 min-w-fit items-start justify-center px-4 py-2">
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
