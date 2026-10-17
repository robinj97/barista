-- Hardening after the first security and performance advisor run.
--
-- are_friends is only needed by RLS policies, so it moves out of the API-exposed
-- public schema. Existing policies keep working because they reference it by OID.
-- create_invite and accept_invite stay in public on purpose: they are the API.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.are_friends(uuid, uuid) set schema private;

create index if not exists invites_accepted_by_idx on public.invites (accepted_by);
create index if not exists recipes_locked_version_idx on public.recipes (locked_version_id, id);
