-- Extend the role system with granular roles and per-user permissions.
-- Adds: manager, editor, viewer roles (super_admin/admin unchanged), plus a
-- `permissions` jsonb column on profiles mirroring the 5 permission areas
-- surfaced in the "Create New User" modal (User Management, Documents,
-- Meetings, Security, Dashboard Access).

do $$
begin
  if not exists (select 1 from pg_enum where enumlabel = 'manager' and enumtypid = 'user_role'::regtype) then
    alter type user_role add value 'manager';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'editor' and enumtypid = 'user_role'::regtype) then
    alter type user_role add value 'editor';
  end if;
  if not exists (select 1 from pg_enum where enumlabel = 'viewer' and enumtypid = 'user_role'::regtype) then
    alter type user_role add value 'viewer';
  end if;
end $$;

alter table public.profiles
  add column if not exists permissions jsonb not null default jsonb_build_object(
    'user_management', false,
    'documents', true,
    'meetings', true,
    'security', false,
    'dashboard_access', true
  );

-- Existing admin/super_admin rows predate granular permissions -- grant them
-- full access so this migration doesn't silently lock anyone out of pages
-- they could already reach via their role.
update public.profiles
set permissions = jsonb_build_object(
  'user_management', true,
  'documents', true,
  'meetings', true,
  'security', true,
  'dashboard_access', true
)
where role in ('admin', 'super_admin');
