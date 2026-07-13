/**
 * Admin page: Implementation Settings
 * - Toggle Dynamic / Fixed percentage mode
 * - Manage default stage template (add / rename / delete / reorder via DnD)
 */
import React, { useState, useCallback } from 'react';
import { Link } from 'wouter';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  useGetImplSettingsV2, usePatchImplSettingsV2, type ImplementationSettingsV2,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { analytics } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { GripVertical, Plus, Trash2, Save, ArrowLeft, Settings2, Loader2 } from 'lucide-react';

// ── Sortable item ────────────────────────────────────────────────────────────

interface SortableStageNameProps {
  id: string;
  name: string;
  index: number;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

function SortableStageName({ id, name, index, onRename, onDelete }: SortableStageNameProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-2 rounded-xl border border-foreground/10 bg-background/50 group">
      <button {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing p-1 text-foreground/30 hover:text-foreground/60">
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="text-xs text-foreground/40 w-5 shrink-0">{index + 1}</span>
      <Input
        className="h-8 text-sm bg-transparent border-transparent focus:border-foreground/20 flex-1"
        defaultValue={name}
        onBlur={(e) => { if (e.target.value !== name) onRename(id, e.target.value.trim() || name); }}
      />
      <button
        onClick={() => onDelete(id)}
        className="p-1 text-foreground/20 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminImplementationSettings() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useGetImplSettingsV2();
  const patchSettings = usePatchImplSettingsV2();

  // Local state (mutations are applied to local state; Save commits to server)
  const [mode, setMode] = useState<'dynamic' | 'fixed'>('dynamic');
  const [stages, setStages] = useState<{ id: string; name: string }[]>([]);
  const [newStageName, setNewStageName] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Hydrate local state from server once
  React.useEffect(() => {
    if (settings && !initialized) {
      setMode((settings.percentage_mode as 'dynamic' | 'fixed') ?? 'dynamic');
      try {
        const parsed: string[] = JSON.parse(settings.default_stages);
        setStages(parsed.map((name, i) => ({ id: `${i}_${name}`, name })));
      } catch {
        setStages([]);
      }
      setInitialized(true);
    }
  }, [settings, initialized]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setStages((prev) => {
        const oldIdx = prev.findIndex((s) => s.id === active.id);
        const newIdx = prev.findIndex((s) => s.id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  }, []);

  const handleRename = useCallback((id: string, name: string) => {
    setStages((prev) => prev.map((s) => s.id === id ? { ...s, name } : s));
  }, []);

  const handleDelete = useCallback((id: string) => {
    setStages((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleAddStage = () => {
    const trimmed = newStageName.trim();
    if (!trimmed) return;
    setStages((prev) => [...prev, { id: `new_${Date.now()}`, name: trimmed }]);
    setNewStageName('');
  };

  const handleSave = async () => {
    const payload: Partial<ImplementationSettingsV2> = {
      percentage_mode: mode,
      default_stages: JSON.stringify(stages.map((s) => s.name)),
    };
    patchSettings.mutate(payload, {
      onSuccess: () => {
        toast({ title: 'Settings saved', description: 'Default stages and percentage mode updated.' });
        analytics.implSettingsChanged({ percentage_mode: mode });
      },
      onError: (err: any) => {
        toast({ title: 'Failed to save', description: err?.message, variant: 'destructive' });
      },
    });
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 space-y-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/users">
          <button className="p-2 rounded-xl hover:bg-foreground/10 text-foreground/50 hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
        </Link>
        <Settings2 className="w-6 h-6 text-primary/70" />
        <div>
          <h1 className="text-xl font-bold">Implementation Settings</h1>
          <p className="text-sm text-foreground/40">Configure default stages and percentage mode for all banks</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-foreground/40 py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading settings…
        </div>
      ) : (
        <>
          {/* Percentage mode */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-foreground/40">Percentage Mode</h2>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: 'dynamic', label: 'Dynamic', desc: 'Skipped stages are excluded from both numerator and denominator. Remaining stages share 100%.' },
                { value: 'fixed',   label: 'Fixed',   desc: 'Skipped stages contribute 0% but are counted in the denominator. Total always sums to 100% when all active stages complete.' },
              ] as const).map(({ value, label, desc }) => (
                <button
                  key={value}
                  onClick={() => setMode(value)}
                  className={cn(
                    'rounded-2xl border p-4 text-left transition-all',
                    mode === value ? 'border-primary/50 bg-primary/5 ring-2 ring-primary/20' : 'border-foreground/10 bg-foreground/5 hover:border-foreground/20',
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0',
                      mode === value ? 'border-primary' : 'border-foreground/30')}>
                      {mode === value && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <span className="font-semibold text-sm">{label}</span>
                  </div>
                  <p className="text-xs text-foreground/50 leading-relaxed">{desc}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Default stages */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-foreground/40">Default Stages Template</h2>
            <p className="text-xs text-foreground/40">
              These stages are seeded for new banks that have no implementation stages yet. Drag to reorder.
            </p>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {stages.map((s, idx) => (
                    <SortableStageName
                      key={s.id}
                      id={s.id}
                      name={s.name}
                      index={idx}
                      onRename={handleRename}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {/* Add stage */}
            <div className="flex gap-2">
              <Input
                placeholder="New stage name…"
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                className="h-9 text-sm"
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddStage(); }}
              />
              <Button variant="outline" size="sm" onClick={handleAddStage} className="h-9 shrink-0">
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
          </section>

          {/* Save */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={patchSettings.isPending}
              className="h-10 px-6 font-semibold"
            >
              {patchSettings.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
