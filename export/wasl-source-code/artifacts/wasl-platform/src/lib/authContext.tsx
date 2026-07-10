import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, type AppRole, type AppPermissions } from './supabaseClient';

interface AuthState {
  session: Session | null;
  loading: boolean;
  mustChangePassword: boolean;
  role: AppRole | null;
  permissions: AppPermissions | null;
}

const AuthContext = createContext<AuthState>({
  session: null,
  loading: true,
  mustChangePassword: false,
  role: null,
  permissions: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [permissions, setPermissions] = useState<AppPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Guards against a stale response overwriting a newer one when auth state
    // changes rapidly (e.g. sign-out fired while a role fetch is in flight).
    let requestId = 0;

    async function loadRole(userId: string) {
      const myRequestId = ++requestId;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role, permissions')
          .eq('id', userId)
          .single();
        if (myRequestId !== requestId) return;
        if (error) {
          setRole(null);
          setPermissions(null);
          return;
        }
        setRole((data?.role as AppRole | undefined) ?? null);
        setPermissions((data?.permissions as AppPermissions | undefined) ?? null);
      } catch {
        if (myRequestId === requestId) {
          setRole(null);
          setPermissions(null);
        }
      }
    }

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) {
        await loadRole(data.session.user.id);
      } else {
        requestId += 1;
        setRole(null);
        setPermissions(null);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        loadRole(newSession.user.id);
      } else {
        requestId += 1;
        setRole(null);
        setPermissions(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const mustChangePassword = Boolean(session?.user.user_metadata?.must_change_password);

  return (
    <AuthContext.Provider value={{ session, loading, mustChangePassword, role, permissions }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
