import React from 'react';
import { Redirect } from 'wouter';
import { useAuth } from '@/lib/authContext';
import type { AppRole } from '@/lib/supabaseClient';

export function RequireAuth({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: AppRole[];
}) {
  const { session, loading, mustChangePassword, role } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-white/60">
        جارٍ التحقق من الجلسة...
      </div>
    );
  }

  if (!session) {
    return <Redirect to="/login" />;
  }

  if (mustChangePassword) {
    return <Redirect to="/change-password" />;
  }

  if (roles && (!role || !roles.includes(role))) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-white/60">
        ليس لديك صلاحية الوصول إلى هذه الصفحة.
      </div>
    );
  }

  return <>{children}</>;
}
