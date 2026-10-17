-- People: profiles, friendships, invites. See docs/architecture.md sections 3 and 4.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- profiles -------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Barista user'
    ),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- users who signed in before this migration
insert into public.profiles (id, display_name, avatar_url)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    nullif(u.raw_user_meta_data ->> 'name', ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'Barista user'
  ),
  coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
from auth.users u
on conflict (id) do nothing;

-- friendships: one row per pair, stored with user_a < user_b ---------------
create table public.friendships (
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index friendships_user_b_idx on public.friendships (user_b);

create function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.friendships f
    where f.user_a = least(a, b) and f.user_b = greatest(a, b)
  );
$$;

-- invites: single-use tokens, stored hashed ------------------------------
create table public.invites (
  token_hash text primary key,
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null,
  accepted_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz
);
create index invites_inviter_idx on public.invites (inviter_id);

-- Creates an invite and returns the raw token ONCE. Only its hash is stored.
create function public.create_invite()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  token text;
begin
  if me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  token := encode(extensions.gen_random_bytes(16), 'hex');
  insert into public.invites (token_hash, inviter_id, expires_at)
  values (
    encode(extensions.digest(token, 'sha256'), 'hex'),
    me,
    now() + interval '7 days'
  );
  return token;
end;
$$;

-- Accepts an invite: creates the friendship and consumes the token.
-- One generic error for every failure so tokens cannot be probed.
create function public.accept_invite(token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  invite public.invites;
  inviter_name text;
begin
  if me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select *
  into invite
  from public.invites
  where token_hash = encode(extensions.digest(token, 'sha256'), 'hex')
  for update;

  if not found
     or invite.accepted_at is not null
     or invite.expires_at <= now()
     or invite.inviter_id = me then
    raise exception 'invalid_or_expired_invite' using errcode = 'P0001';
  end if;

  insert into public.friendships (user_a, user_b)
  values (least(me, invite.inviter_id), greatest(me, invite.inviter_id))
  on conflict do nothing;

  update public.invites
  set accepted_by = me, accepted_at = now()
  where token_hash = invite.token_hash;

  select display_name into inviter_name from public.profiles where id = invite.inviter_id;

  return jsonb_build_object('inviter_id', invite.inviter_id, 'display_name', inviter_name);
end;
$$;

-- Row-level security -----------------------------------------------------
alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.invites enable row level security;

create policy "profiles: self and friends can read"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.are_friends(id, (select auth.uid())));

create policy "profiles: self can update"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "friendships: participants can read"
  on public.friendships for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));

create policy "friendships: participants can delete"
  on public.friendships for delete to authenticated
  using ((select auth.uid()) in (user_a, user_b));

create policy "invites: inviter can read"
  on public.invites for select to authenticated
  using (inviter_id = (select auth.uid()));

-- Privileges: nothing for anon; clients only get what the policies allow.
revoke all on public.profiles, public.friendships, public.invites from anon;
revoke insert, update, delete on public.profiles from authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
revoke insert, update, truncate, references, trigger on public.friendships from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.invites from authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.are_friends(uuid, uuid) from public, anon;
grant execute on function public.are_friends(uuid, uuid) to authenticated;
revoke execute on function public.create_invite() from public, anon;
grant execute on function public.create_invite() to authenticated;
revoke execute on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;
