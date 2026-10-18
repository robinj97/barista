-- Two small functions for the friends screens.
--
-- peek_invite: who invited me? Lets the invite screen say "Sam invited you" before anyone
--   accepts. Same single generic error as accept_invite for every failure, so tokens cannot be
--   probed, and it returns nothing beyond the inviter's display name and photo.
-- cancel_invite: the inviter withdraws a link that has not been used. Invites are identified by
--   their stored hash, which only the inviter can read (RLS), never by the token itself.

create function public.peek_invite(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  invite public.invites;
  profile public.profiles;
begin
  if me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into invite
  from public.invites
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  if not found
     or invite.accepted_at is not null
     or invite.expires_at <= now()
     or invite.inviter_id = me then
    raise exception 'invalid_or_expired_invite' using errcode = 'P0001';
  end if;

  select * into profile from public.profiles where id = invite.inviter_id;
  return jsonb_build_object('display_name', profile.display_name, 'avatar_url', profile.avatar_url);
end;
$$;

create function public.cancel_invite(p_token_hash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  delete from public.invites
  where token_hash = p_token_hash and inviter_id = auth.uid() and accepted_at is null;
end;
$$;

revoke execute on function public.peek_invite(text) from public, anon;
grant execute on function public.peek_invite(text) to authenticated;
revoke execute on function public.cancel_invite(text) from public, anon;
grant execute on function public.cancel_invite(text) to authenticated;
