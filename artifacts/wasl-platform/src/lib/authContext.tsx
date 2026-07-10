import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, type AppRole } from './supabaseClient';

interface AuthState {
  session: Session | null;
  loading: boolean;
  mustChangePassword: boolean;
  role: AppRole | null;
}

const AuthContext = createContext<AuthState>({
  session: null,
  loading: true,
  mustChangePassword: false,
  role: null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadRole(userId: string) {
    const { data } = await supabase.from('profiles').select('role').eq('id', userId).single();
    setRole((data?.role as AppRole | undefined) ?? null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await loadRole(data.session.user.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        loadRole(newSession.user.id);
      } else {
        setRole(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const mustChangePassword = Boolean(session?.user.user_metadata?.must_change_password);

  return (
    <AuthContext.Provider value={{ session, loading, mustChangePassword, role }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
