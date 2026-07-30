import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavControls } from '@/components/NavControls';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { formatDateTime, cn } from '@/lib/utils';
import {
  Plus,
  Pencil,
  UserX,
  UserCheck,
  Trash2,
  User,
  Mail,
  KeyRound,
  ShieldCheck,
  ChevronDown,
  Check,
  Sparkles,
  Eye,
  EyeOff,
  Users as UsersIcon,
  FileText,
  Calendar,
  Lock,
  LayoutDashboard,
  Crown,
  Infinity,
  Building2,
  X,
  Search,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/authContext';
import { getAdminPinToken } from '@/components/AdminPinGate';
import { analytics } from '@/lib/analytics';

type Role = 'super_admin' | 'admin' | 'manager' | 'editor' | 'viewer';

interface Permissions {
  user_management: boolean;
  documents: boolean;
  meetings: boolean;
  security: boolean;
  dashboard_access: boolean;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: Permissions;
  assigned_bank_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface BankOption {
  id: string;
  nameAr: string;
  nameEn: string;
}

async function authedFetch(path: string, options: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const pinToken = getAdminPinToken();
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(pinToken ? { 'X-Admin-Pin-Token': pinToken } : {}),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

const roleLabel: Record<Role, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  manager: 'Manager',
  editor: 'Editor',
  viewer: 'Viewer',
};

const ASSIGNABLE_ROLES: { value: Role; label: string; hint: string; superAdminOnly?: boolean }[] = [
  { value: 'super_admin', label: 'Super Admin', hint: 'Full control over everything — no restrictions', superAdminOnly: true },
  { value: 'admin', label: 'Admin', hint: 'Full access to all sections' },
  { value: 'manager', label: 'Manager', hint: 'Manage content, no user administration' },
  { value: 'editor', label: 'Editor', hint: 'Create and edit content only' },
  { value: 'viewer', label: 'Viewer', hint: 'Read-only dashboard access' },
];

const DEFAULT_PERMISSIONS_BY_ROLE: Record<Role, Permissions> = {
  super_admin: { user_management: true, documents: true, meetings: true, security: true, dashboard_access: true },
  admin: { user_management: true, documents: true, meetings: true, security: true, dashboard_access: true },
  manager: { user_management: false, documents: true, meetings: true, security: false, dashboard_access: true },
  editor: { user_management: false, documents: true, meetings: true, security: false, dashboard_access: true },
  viewer: { user_management: false, documents: false, meetings: false, security: false, dashboard_access: true },
};

const PERMISSION_CARDS: { key: keyof Permissions; label: string; description: string; icon: React.ElementType }[] = [
  { key: 'user_management', label: 'User Management', description: 'Create, edit & deactivate accounts', icon: UsersIcon },
  { key: 'documents', label: 'Documents', description: 'View and upload bank documents', icon: FileText },
  { key: 'meetings', label: 'Meetings', description: 'Schedule & manage meetings', icon: Calendar },
  { key: 'security', label: 'Security', description: 'View activity logs & audit trail', icon: Lock },
  { key: 'dashboard_access', label: 'Dashboard Access', description: 'View the main portfolio dashboard', icon: LayoutDashboard },
];

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let out = '';
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 14; i++) out += chars[bytes[i] % chars.length];
  return out;
}

// --- Floating-label glass input --------------------------------------------
function GlassField({
  icon: Icon,
  label,
  value,
  onChange,
  type = 'text',
  dir,
  disabled,
  hint,
  trailing,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  dir?: 'ltr' | 'rtl';
  disabled?: boolean;
  hint?: string;
  trailing?: React.ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const active = focused || value.length > 0;
  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          'relative flex items-center rounded-2xl border transition-all duration-200',
          'bg-white/[0.04] backdrop-blur-xl',
          focused
            ? 'border-primary/60 shadow-[0_0_0_4px_rgba(124,58,237,0.15),0_8px_24px_-8px_rgba(124,58,237,0.35)]'
            : 'border-foreground/10 hover:border-foreground/20',
          disabled && 'opacity-50'
        )}
      >
        <Icon className={cn('w-[18px] h-[18px] ms-4 shrink-0 transition-colors', focused ? 'text-primary' : 'text-foreground/40')} />
        <div className="relative flex-1 px-3 pt-5 pb-2 min-w-0">
          <label
            className={cn(
              'absolute left-3 pointer-events-none transition-all duration-200 text-foreground/40',
              active ? 'top-1.5 text-[10px] font-medium tracking-wide uppercase text-primary/80' : 'top-1/2 -translate-y-1/2 text-sm'
            )}
          >
            {label}
          </label>
          <input
            type={type}
            dir={dir}
            disabled={disabled}
            value={value}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-transparent outline-none text-sm text-foreground disabled:cursor-not-allowed"
          />
        </div>
        {trailing && <div className="pe-3 flex items-center gap-1 shrink-0">{trailing}</div>}
      </div>
      {hint && <p className="text-[11px] text-foreground/35 ps-1">{hint}</p>}
    </div>
  );
}

// --- Custom animated role dropdown -----------------------------------------
function RoleDropdown({
  value,
  onChange,
  showSuperAdmin = false,
}: {
  value: Role;
  onChange: (r: Role) => void;
  showSuperAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const visibleRoles = ASSIGNABLE_ROLES.filter((r) => !r.superAdminOnly || showSuperAdmin);
  const current = visibleRoles.find((r) => r.value === value) ?? visibleRoles[0];
  const isSuperAdminSelected = value === 'super_admin';

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="space-y-1.5" ref={ref}>
      <label className="text-[10px] font-medium tracking-wide uppercase text-foreground/40 ps-1">Role</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-start transition-all duration-200',
            'bg-white/[0.04] backdrop-blur-xl',
            isSuperAdminSelected
              ? 'border-amber-400/40 shadow-[0_0_0_4px_rgba(251,191,36,0.12)]'
              : open
              ? 'border-primary/60 shadow-[0_0_0_4px_rgba(124,58,237,0.15)]'
              : 'border-foreground/10 hover:border-foreground/20'
          )}
        >
          {isSuperAdminSelected ? (
            <Crown className="w-[18px] h-[18px] shrink-0 text-amber-400" />
          ) : (
            <ShieldCheck className={cn('w-[18px] h-[18px] shrink-0', open ? 'text-primary' : 'text-foreground/40')} />
          )}
          <div className="flex-1 min-w-0">
            <div className={cn('text-sm font-medium', isSuperAdminSelected ? 'text-amber-300' : 'text-foreground')}>
              {current?.label}
            </div>
            <div className="text-[11px] text-foreground/40 truncate">{current?.hint}</div>
          </div>
          <ChevronDown className={cn('w-4 h-4 text-foreground/40 transition-transform duration-200', open && 'rotate-180')} />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute z-20 mt-2 w-full rounded-2xl border border-foreground/10 bg-background/95 backdrop-blur-2xl shadow-2xl overflow-hidden"
            >
              {visibleRoles.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => { onChange(r.value); setOpen(false); }}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-start transition-colors',
                    r.value === value
                      ? r.value === 'super_admin' ? 'bg-amber-400/10' : 'bg-primary/15'
                      : r.value === 'super_admin' ? 'hover:bg-amber-400/5' : 'hover:bg-foreground/5'
                  )}
                >
                  {r.value === 'super_admin' ? (
                    <Crown className="w-4 h-4 shrink-0 text-amber-400" />
                  ) : (
                    <div className="w-4 h-4 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className={cn('text-sm font-medium', r.value === 'super_admin' ? 'text-amber-300' : 'text-foreground')}>
                      {r.label}
                    </div>
                    <div className="text-[11px] text-foreground/40">{r.hint}</div>
                  </div>
                  {r.value === value && (
                    <Check className={cn('w-4 h-4 shrink-0', r.value === 'super_admin' ? 'text-amber-400' : 'text-primary')} />
                  )}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// --- Selectable glowing permission card -------------------------------------
function PermissionCard({
  icon: Icon,
  label,
  description,
  active,
  onToggle,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'relative text-start rounded-2xl border p-3.5 transition-all duration-200 overflow-hidden group',
        active
          ? 'border-primary/50 bg-primary/10 shadow-[0_0_24px_-6px_rgba(124,58,237,0.5)]'
          : 'border-foreground/10 bg-white/[0.03] hover:border-foreground/20 hover:bg-white/[0.05]'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors',
            active ? 'bg-primary/25 text-primary' : 'bg-foreground/5 text-foreground/40'
          )}
        >
          <Icon className="w-[18px] h-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className={cn('text-sm font-medium', active ? 'text-foreground' : 'text-foreground/70')}>{label}</div>
          <div className="text-[11px] text-foreground/40 leading-snug mt-0.5">{description}</div>
        </div>
        <div
          className={cn(
            'w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-all',
            active ? 'bg-primary border-primary' : 'border-foreground/20'
          )}
        >
          {active && <Check className="w-3 h-3 text-primary-foreground" />}
        </div>
      </div>
    </button>
  );
}

interface FormState {
  name: string;
  email: string;
  password: string;
  role: Role;
  permissions: Permissions;
}

// ── Bank Assignment Dialog ───────────────────────────────────────────────────
function BankAssignDialog({
  user,
  banks,
  onClose,
  onAssign,
}: {
  user: AdminUser;
  banks: BankOption[];
  onClose: () => void;
  onAssign: (bankId: string | null) => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const filtered = banks.filter(
    (b) =>
      b.nameAr.includes(search) ||
      b.nameEn.toLowerCase().includes(search.toLowerCase()) ||
      b.id.toLowerCase().includes(search.toLowerCase())
  );

  async function pick(bankId: string | null) {
    setSaving(true);
    try {
      await onAssign(bankId);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="p-0 border-0 bg-transparent shadow-none max-w-[480px] w-[calc(100%-2rem)] sm:rounded-none [&>button]:hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="relative rounded-[24px] border border-white/10 bg-background/95 backdrop-blur-2xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)] overflow-hidden"
        >
          <div className="pointer-events-none absolute -top-20 -right-20 w-48 h-48 rounded-full bg-blue-500/15 blur-[70px]" />
          {/* Header */}
          <div className="relative px-6 pt-6 pb-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-500/15 border border-blue-400/20 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">تعيين بنك</h2>
                <p className="text-xs text-foreground/40">{user.name}</p>
              </div>
            </div>
            <button
              onClick={() => !saving && onClose()}
              className="w-8 h-8 rounded-full flex items-center justify-center text-foreground/40 hover:text-foreground hover:bg-foreground/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="px-4 pt-4">
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-foreground/5 border border-foreground/10">
              <Search className="w-4 h-4 text-foreground/40 shrink-0" />
              <input
                autoFocus
                placeholder="ابحث عن بنك..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-foreground/30 text-foreground"
                dir="rtl"
              />
            </div>
          </div>

          {/* Bank list */}
          <div className="px-4 py-3 max-h-[300px] overflow-y-auto space-y-1">
            {filtered.length === 0 && (
              <p className="text-center text-foreground/30 text-sm py-6">لا توجد نتائج</p>
            )}
            {filtered.map((bank) => {
              const isSelected = user.assigned_bank_id === bank.id;
              return (
                <button
                  key={bank.id}
                  type="button"
                  disabled={saving}
                  onClick={() => pick(bank.id)}
                  className={cn(
                    'w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-start transition-all',
                    isSelected
                      ? 'bg-blue-500/15 border border-blue-400/25 text-foreground'
                      : 'hover:bg-foreground/5 border border-transparent text-foreground/80'
                  )}
                  dir="rtl"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{bank.nameAr}</div>
                    <div className="text-[11px] text-foreground/40 truncate">{bank.nameEn} · {bank.id}</div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-4 pb-4 border-t border-white/5 pt-3 flex justify-between items-center gap-3">
            {user.assigned_bank_id ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => pick(null)}
                className="text-xs text-red-400/70 hover:text-red-400 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                إلغاء التعيين
              </button>
            ) : (
              <span className="text-xs text-foreground/30">لا يوجد بنك مخصص حالياً</span>
            )}
            <button
              onClick={() => !saving && onClose()}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm text-foreground/60 border border-foreground/10 hover:bg-foreground/5 transition-colors disabled:opacity-50"
            >
              إغلاق
            </button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    password: '',
    role: 'admin',
    permissions: DEFAULT_PERMISSIONS_BY_ROLE.admin,
  });
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [assignBankTarget, setAssignBankTarget] = useState<AdminUser | null>(null);
  const { toast } = useToast();
  const { session, role: currentRole } = useAuth();
  const currentUserId = session?.user.id;
  const isSuperAdmin = currentRole === 'super_admin';

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await authedFetch('/api/admin/users');
      setUsers(data.users);
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function loadBanks() {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch('/api/banks', {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) return;
      const json = await res.json();
      setBanks((json.banks ?? []).map((b: { id: string; nameAr: string; nameEn: string }) => ({
        id: b.id, nameAr: b.nameAr, nameEn: b.nameEn,
      })));
    } catch { /* silent — banks list is optional UI */ }
  }

  async function handleAssignBank(userId: string, bankId: string | null) {
    await authedFetch(`/api/admin/users/${userId}/assign-bank`, {
      method: 'PATCH',
      body: JSON.stringify({ bankId }),
    });
    await loadUsers();
  }

  useEffect(() => {
    loadUsers();
    loadBanks();
  }, []);

  function openCreate() {
    setEditing(null);
    setShowPassword(false);
    setSuccess(false);
    setForm({ name: '', email: '', password: '', role: 'admin', permissions: DEFAULT_PERMISSIONS_BY_ROLE.admin });
    setDialogOpen(true);
  }

  function openEdit(user: AdminUser) {
    setEditing(user);
    setShowPassword(false);
    setSuccess(false);
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      permissions: user.permissions ?? DEFAULT_PERMISSIONS_BY_ROLE[user.role],
    });
    setDialogOpen(true);
  }

  function handleRoleChange(role: Role) {
    setForm((f) => ({ ...f, role, permissions: DEFAULT_PERMISSIONS_BY_ROLE[role] }));
  }

  function togglePermission(key: keyof Permissions) {
    setForm((f) => ({ ...f, permissions: { ...f.permissions, [key]: !f.permissions[key] } }));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast({ title: 'Error', description: 'Full name is required.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await authedFetch(`/api/admin/users/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: form.name, role: form.role, permissions: form.permissions }),
        });
        if (editing.role !== form.role) {
          analytics.userRoleChanged({ target_user_id: editing.id, old_role: editing.role, new_role: form.role });
        }
        analytics.userUpdated({ target_user_id: editing.id, target_name: form.name });
      } else {
        if (form.password.length < 8) {
          toast({ title: 'Error', description: 'Temporary password must be at least 8 characters.', variant: 'destructive' });
          setSaving(false);
          return;
        }
        await authedFetch('/api/admin/users', {
          method: 'POST',
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            password: form.password,
            role: form.role,
            permissions: form.permissions,
          }),
        });
        analytics.userCreated({ target_email: form.email, target_role: form.role });
      }
      setSuccess(true);
      loadUsers();
      setTimeout(() => {
        setDialogOpen(false);
        setSuccess(false);
      }, 900);
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(user: AdminUser) {
    try {
      await authedFetch(`/api/admin/users/${user.id}/deactivate`, { method: 'POST' });
      toast({ title: 'User Deactivated', description: `${user.name} has been deactivated.` });
      loadUsers();
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    }
  }

  async function handleReactivate(user: AdminUser) {
    try {
      await authedFetch(`/api/admin/users/${user.id}/reactivate`, { method: 'POST' });
      toast({ title: 'User Reactivated', description: `${user.name} has been reactivated.` });
      loadUsers();
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    }
  }

  async function handleDelete(user: AdminUser) {
    if (!confirm(`User "${user.name}" will be permanently deleted. Are you sure?`)) return;
    try {
      await authedFetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      analytics.userDeleted({ target_user_id: user.id, target_name: user.name });
      toast({ title: 'User Deleted', description: `${user.name} has been permanently deleted.` });
      loadUsers();
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    }
  }

  async function handlePromote(user: AdminUser) {
    if (!confirm(`Promote "${user.name}" to Super Admin?\nThis grants full unrestricted access.`)) return;
    try {
      await authedFetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          role: 'super_admin',
          permissions: DEFAULT_PERMISSIONS_BY_ROLE.super_admin,
        }),
      });
      analytics.userRoleChanged({ target_user_id: user.id, old_role: user.role, new_role: 'super_admin' });
      toast({ title: '✓ Promoted', description: `${user.name} is now a Super Admin.` });
      loadUsers();
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    }
  }

  const permissionCount = useMemo(() => Object.values(form.permissions).filter(Boolean).length, [form.permissions]);

  return (
    <div className="p-8 pb-24 max-w-7xl mx-auto w-full space-y-8">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-l from-foreground to-foreground/60 mb-2">
            Admin User Management
          </h1>
          <p className="text-foreground/50 text-lg">Create, edit, and deactivate administrator accounts</p>
        </div>
        <NavControls />
      </header>

      <div className="flex justify-end">
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> New User
        </Button>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-foreground/50">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-foreground/5 text-foreground/60 text-left">
              <tr>
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Email</th>
                <th className="p-4 font-medium">Role / Assigned Bank</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Last Updated</th>
                <th className="p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((user) => {
                const assignedBank = banks.find(b => b.id === user.assigned_bank_id);
                return (
                <tr key={user.id} className="border-t border-foreground/5">
                  <td className="p-4 text-foreground">{user.name}</td>
                  <td className="p-4 text-foreground/70" dir="ltr">{user.email}</td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1.5">
                      {user.role === 'super_admin' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-400/10 text-amber-300 border border-amber-400/25 w-fit">
                          <Crown className="w-3 h-3" />
                          Super Admin
                        </span>
                      ) : (
                        <span className="text-foreground/70 text-sm">{roleLabel[user.role]}</span>
                      )}
                      {assignedBank && (
                        <div className="flex items-center gap-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-400/20 max-w-[150px]">
                            <Building2 className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{assignedBank.nameAr}</span>
                          </span>
                          {isSuperAdmin && (
                            <button
                              type="button"
                              onClick={() => handleAssignBank(user.id, null).catch(() => toast({ title: 'Error', description: 'Failed to remove assignment', variant: 'destructive' }))}
                              className="w-4 h-4 rounded-full flex items-center justify-center text-foreground/30 hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0"
                              title="Remove bank assignment"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    {user.deleted_at ? (
                      <span className="text-red-600 dark:text-red-400">Inactive</span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400">Active</span>
                    )}
                  </td>
                  <td className="p-4 text-foreground/50">{formatDateTime(user.updated_at)}</td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(user)} title="Edit">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {isSuperAdmin && user.role !== 'super_admin' && !user.deleted_at && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setAssignBankTarget(user)}
                          title="Assign Bank"
                          className={cn(
                            user.assigned_bank_id
                              ? 'text-blue-400/80 hover:text-blue-400 hover:bg-blue-400/10'
                              : 'text-foreground/40 hover:text-blue-400 hover:bg-blue-400/10'
                          )}
                        >
                          <Building2 className="w-4 h-4" />
                        </Button>
                      )}
                      {user.id === currentUserId ? (
                        <span className="text-foreground/30 text-xs px-2 py-1">Your Account</span>
                      ) : (
                        <>
                          {isSuperAdmin && user.role !== 'super_admin' && !user.deleted_at && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handlePromote(user)}
                              title="Promote to Super Admin"
                              className="text-amber-500/60 hover:text-amber-400 hover:bg-amber-400/10"
                            >
                              <Crown className="w-4 h-4" />
                            </Button>
                          )}
                          {user.deleted_at ? (
                            <Button size="icon" variant="ghost" onClick={() => handleReactivate(user)} title="Reactivate">
                              <UserCheck className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button size="icon" variant="ghost" onClick={() => handleDeactivate(user)} title="Deactivate">
                              <UserX className="w-4 h-4" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(user)} title="Delete Permanently">
                            <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
              {users?.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-foreground/40">No users found</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Card>

      {/* Bank Assignment Dialog */}
      {assignBankTarget && (
        <BankAssignDialog
          user={assignBankTarget}
          banks={banks}
          onClose={() => setAssignBankTarget(null)}
          onAssign={async (bankId) => {
            try {
              await handleAssignBank(assignBankTarget.id, bankId);
              toast({
                title: bankId ? 'تم تعيين البنك' : 'تم إلغاء التعيين',
                description: bankId
                  ? `تم تعيين ${banks.find(b => b.id === bankId)?.nameAr ?? bankId} لـ ${assignBankTarget.name}`
                  : `تم إلغاء تعيين البنك من ${assignBankTarget.name}`,
              });
              setAssignBankTarget(null);
            } catch (err) {
              toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
            }
          }}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => !saving && setDialogOpen(o)}>
        <DialogContent className="p-0 border-0 bg-transparent shadow-none max-w-[650px] w-[calc(100%-2rem)] sm:rounded-none [&>button]:hidden">
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="relative rounded-[28px] border border-white/10 bg-background/90 backdrop-blur-2xl shadow-[0_30px_90px_-20px_rgba(0,0,0,0.6)] overflow-hidden max-h-[88vh] flex flex-col"
          >
            {/* ambient glow */}
            <div className="pointer-events-none absolute -top-24 -left-24 w-64 h-64 rounded-full bg-primary/25 blur-[90px]" />
            <div className="pointer-events-none absolute -bottom-24 -right-24 w-64 h-64 rounded-full bg-secondary/20 blur-[90px]" />

            <AnimatePresence mode="wait">
              {success ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="relative flex flex-col items-center justify-center gap-4 py-24 px-8"
                >
                  <motion.div
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                    className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center shadow-[0_0_50px_-10px_rgba(16,185,129,0.6)]"
                  >
                    <Check className="w-10 h-10 text-emerald-400" strokeWidth={3} />
                  </motion.div>
                  <p className="text-foreground/80 font-medium">{editing ? 'User updated successfully' : 'User created successfully'}</p>
                </motion.div>
              ) : (
                <motion.div key="form" initial={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative flex flex-col min-h-0">
                  {/* Header */}
                  <div className="relative px-6 sm:px-8 pt-7 pb-5 border-b border-white/5 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-[0_0_24px_-4px_rgba(124,58,237,0.6)]">
                        <Sparkles className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-foreground">{editing ? 'Edit User' : 'New User'}</h2>
                        <p className="text-xs text-foreground/40">
                          {editing ? 'Update role, permissions and details' : 'Provision a new administrator account'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => !saving && setDialogOpen(false)}
                      className="absolute right-6 top-7 w-8 h-8 rounded-full flex items-center justify-center text-foreground/40 hover:text-foreground hover:bg-foreground/10 transition-colors"
                      aria-label="Close"
                    >
                      ×
                    </button>
                  </div>

                  {/* Body */}
                  <div className="relative px-6 sm:px-8 py-6 space-y-5 overflow-y-auto">
                    <GlassField icon={User} label="Full Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
                    <GlassField
                      icon={Mail}
                      label="Email Address"
                      type="email"
                      dir="ltr"
                      value={form.email}
                      disabled={Boolean(editing)}
                      onChange={(v) => setForm({ ...form, email: v })}
                    />

                    {!editing && (
                      <GlassField
                        icon={KeyRound}
                        label="Temporary Password"
                        type={showPassword ? 'text' : 'password'}
                        dir="ltr"
                        value={form.password}
                        onChange={(v) => setForm({ ...form, password: v })}
                        hint="The user will be required to change this on first login."
                        trailing={
                          <>
                            <button
                              type="button"
                              onClick={() => setForm((f) => ({ ...f, password: generatePassword() }))}
                              title="Generate password"
                              className="p-1.5 rounded-lg text-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors"
                            >
                              <Sparkles className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowPassword((s) => !s)}
                              title={showPassword ? 'Hide password' : 'Show password'}
                              className="p-1.5 rounded-lg text-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors"
                            >
                              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </>
                        }
                      />
                    )}

                    <RoleDropdown value={form.role} onChange={handleRoleChange} showSuperAdmin={isSuperAdmin} />

                    {form.role === 'super_admin' ? (
                      <div className="rounded-2xl border border-amber-400/25 bg-amber-400/5 px-5 py-4 flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-400/15 flex items-center justify-center shrink-0 mt-0.5">
                          <Infinity className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-amber-300 mb-0.5">Unrestricted access</p>
                          <p className="text-[12px] text-foreground/50 leading-relaxed">
                            Super Admin automatically has full permissions — users, documents, meetings, security, and the control panel — with no restrictions.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between ps-1">
                          <label className="text-[10px] font-medium tracking-wide uppercase text-foreground/40">Permissions</label>
                          <span className="text-[11px] text-foreground/35">{permissionCount} of {PERMISSION_CARDS.length} enabled</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {PERMISSION_CARDS.map((p) => (
                            <PermissionCard
                              key={p.key}
                              icon={p.icon}
                              label={p.label}
                              description={p.description}
                              active={form.permissions[p.key]}
                              onToggle={() => togglePermission(p.key)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="relative px-6 sm:px-8 py-5 border-t border-white/5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 shrink-0">
                    <button
                      onClick={() => !saving && setDialogOpen(false)}
                      disabled={saving}
                      className="px-5 py-2.5 rounded-xl text-sm font-medium text-foreground/60 border border-foreground/10 hover:bg-foreground/5 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className={cn(
                        'relative px-6 py-2.5 rounded-xl text-sm font-semibold text-white overflow-hidden transition-transform',
                        'bg-gradient-to-r from-primary to-secondary shadow-[0_8px_24px_-6px_rgba(124,58,237,0.6)]',
                        'hover:shadow-[0_10px_32px_-6px_rgba(124,58,237,0.8)] hover:-translate-y-0.5 active:translate-y-0',
                        saving && 'opacity-70 cursor-wait'
                      )}
                    >
                      {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create User'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
