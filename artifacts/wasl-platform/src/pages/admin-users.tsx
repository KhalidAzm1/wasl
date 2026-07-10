import React, { useEffect, useState } from 'react';
import { NavControls } from '@/components/NavControls';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { formatDateTime } from '@/lib/utils';
import { Plus, Pencil, UserX, UserCheck, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { getAdminPinToken } from '@/components/AdminPinGate';

type Role = 'super_admin' | 'admin';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
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
};

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'admin' as Role });
  const { toast } = useToast();
  const { session } = useAuth();
  const currentUserId = session?.user.id;

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

  useEffect(() => {
    loadUsers();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: '', email: '', password: '', role: 'admin' });
    setDialogOpen(true);
  }

  function openEdit(user: AdminUser) {
    setEditing(user);
    setForm({ name: user.name, email: user.email, password: '', role: user.role });
    setDialogOpen(true);
  }

  async function handleSave() {
    try {
      if (editing) {
        await authedFetch(`/api/admin/users/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: form.name, role: form.role }),
        });
        toast({ title: 'Success', description: 'User updated successfully.' });
      } else {
        if (form.password.length < 8) {
          toast({ title: 'Error', description: 'Temporary password must be at least 8 characters.', variant: 'destructive' });
          return;
        }
        await authedFetch('/api/admin/users', { method: 'POST', body: JSON.stringify(form) });
        toast({ title: 'Success', description: 'User created successfully.' });
      }
      setDialogOpen(false);
      loadUsers();
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    }
  }

  async function handleDeactivate(user: AdminUser) {
    try {
      await authedFetch(`/api/admin/users/${user.id}/deactivate`, { method: 'POST' });
      loadUsers();
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    }
  }

  async function handleReactivate(user: AdminUser) {
    try {
      await authedFetch(`/api/admin/users/${user.id}/reactivate`, { method: 'POST' });
      loadUsers();
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    }
  }

  async function handleDelete(user: AdminUser) {
    if (!confirm(`User "${user.name}" will be permanently deleted. Are you sure?`)) return;
    try {
      await authedFetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      loadUsers();
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    }
  }

  return (
    <div className="p-8 pb-24 max-w-7xl mx-auto w-full space-y-8">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-l from-white to-white/60 mb-2">
            Admin User Management
          </h1>
          <p className="text-white/50 text-lg">Create, edit, and deactivate administrator accounts</p>
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
          <div className="p-8 text-center text-white/50">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-white/60 text-left">
              <tr>
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Email</th>
                <th className="p-4 font-medium">Role</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Last Updated</th>
                <th className="p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((user) => (
                <tr key={user.id} className="border-t border-white/5">
                  <td className="p-4 text-white">{user.name}</td>
                  <td className="p-4 text-white/70" dir="ltr">{user.email}</td>
                  <td className="p-4 text-white/70">{roleLabel[user.role]}</td>
                  <td className="p-4">
                    {user.deleted_at ? (
                      <span className="text-red-400">Inactive</span>
                    ) : (
                      <span className="text-emerald-400">Active</span>
                    )}
                  </td>
                  <td className="p-4 text-white/50">{formatDateTime(user.updated_at)}</td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(user)} title="Edit">
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {user.id === currentUserId ? (
                        <span className="text-white/30 text-xs px-2 py-1">Your Account</span>
                      ) : (
                        <>
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
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users?.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-white/40">No users found</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit User' : 'New User'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-white/60">Full Name</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/60">Email Address</label>
              <Input
                type="email"
                dir="ltr"
                value={form.email}
                disabled={Boolean(editing)}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            {!editing && (
              <div className="space-y-2">
                <label className="text-sm text-white/60">Temporary Password</label>
                <Input
                  type="password"
                  dir="ltr"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <p className="text-xs text-white/40">The user will be required to change this on first login.</p>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm text-white/60">Role</label>
              <select
                className="w-full bg-white/5 border border-white/10 rounded-md p-2 text-white"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
              >
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave}>{editing ? 'Save Changes' : 'Create User'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
