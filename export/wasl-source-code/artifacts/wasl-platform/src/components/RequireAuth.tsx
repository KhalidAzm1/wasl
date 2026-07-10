import React from 'react';
import { Redirect } from 'wouter';
import { useAuth } from '@/lib/authContext';
import type { AppRole, AppPermissions } from '@/lib/supabaseClient';

export function RequireAuth({
  children,
  roles,
  permission,
  allowMustChangePassword,
}: {
  children: React.ReactNode;
  roles?: AppRole[];
  // When set, the user must also have this permission flag enabled on their
  // profile (in addition to passing the `roles` check, if any).
  permission?: keyof AppPermissions;
  // The /change-password route itself must render even while
  // mustChangePassword is true — otherwise RequireAuth redirects it to
  // itself in an infinite loop that renders nothing (a blank/black screen).
  allowMustChangePassword?: boolean;
}) {
  const { session, loading, mustChangePassword, role, permissions } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-foreground/60">
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

  const roleAllowed = !roles || (role && roles.includes(role));
  const permissionAllowed = !permission || Boolean(permissions?.[permission]);

  if (!roleAllowed || !permissionAllowed) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-foreground/60">
        You don't have permission to access this page.
      </div>
    );
  }

  return <>{children}</>;
}
