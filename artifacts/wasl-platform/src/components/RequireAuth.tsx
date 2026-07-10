import React from 'react';
import { Redirect } from 'wouter';
import { useAuth } from '@/lib/authContext';
import type { AppRole } from '@/lib/supabaseClient';

export function RequireAuth({
  children,
  roles,
  allowMustChangePassword,
}: {
  children: React.ReactNode;
  roles?: AppRole[];
  // The /change-password route itself must render even while
  // mustChangePassword is true — otherwise RequireAuth redirects it to
  // itself in an infinite loop that renders nothing (a blank/black screen).
  allowMustChangePassword?: boolean;
}) {
  const { session, loading, mustChangePassword, role } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-white/60">
        Checking session...
      </div>
    );
  }

  if (!session) {
    return <Redirect to="/login" />;
  }

  if (mustChangePassword && !allowMustChangePassword) {
    return <Redirect to="/change-password" />;
  }

  if (roles && (!role || !roles.includes(role))) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-white/60">
        You don't have permission to access this page.
      </div>
    );
  }

  return <>{children}</>;
}
