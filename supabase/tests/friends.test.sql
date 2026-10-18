-- Friends UI functions: peek_invite, cancel_invite and the full invite loop. Rolled back at the
-- end (raises FRIENDS_TESTS_PASSED).

do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  t1 text;
  t2 text;
  hash2 text;
  got jsonb;
  n int;
  failed boolean;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (a, 'a@test.local', '{"full_name":"Alice"}'), (b, 'b@test.local', '{"full_name":"Bob"}'), (c, 'c@test.local', '{"full_name":"Cy"}');

  -- Alice makes two invites
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  t1 := public.create_invite();
  t2 := public.create_invite();
  select count(*) into n from public.invites where accepted_at is null and expires_at > now();
  assert n = 2, 'the inviter sees both pending invites';

  -- she cannot peek at her own invite
  failed := false;
  begin perform public.peek_invite(t1); exception when others then failed := true; end;
  assert failed, 'you cannot peek at your own invite';

  -- Bob peeks, then accepts
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  got := public.peek_invite(t1);
  assert got ->> 'display_name' = 'Alice', 'peek names the inviter';
  select count(*) into n from public.invites;
  assert n = 0, 'a stranger cannot read invites';
  perform public.accept_invite(t1);
  select count(*) into n from public.friendships;
  assert n = 1, 'they are friends';

  -- a used token is the same generic failure
  failed := false;
  begin perform public.peek_invite(t1); exception when others then failed := true; end;
  assert failed, 'a used invite cannot be peeked';
  failed := false;
  begin perform public.peek_invite('not-a-token'); exception when others then failed := true; end;
  assert failed, 'an unknown token fails the same way';

  -- Bob can now read Alice's profile (friends), Cy cannot
  select count(*) into n from public.profiles where id = a;
  assert n = 1, 'a friend can read the profile';
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select count(*) into n from public.profiles where id = a;
  assert n = 0, 'a stranger cannot read the profile';

  -- Alice cancels the second invite; nobody else can cancel it
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select token_hash into hash2 from public.invites where accepted_at is null;
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  perform public.cancel_invite(hash2);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.invites where accepted_at is null;
  assert n = 1, 'another user cannot cancel it';
  perform public.cancel_invite(hash2);
  select count(*) into n from public.invites where accepted_at is null;
  assert n = 0, 'the inviter can cancel it';

  -- a cancelled link no longer works
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  failed := false;
  begin perform public.accept_invite(t2); exception when others then failed := true; end;
  assert failed, 'a cancelled invite cannot be accepted';

  raise exception 'FRIENDS_TESTS_PASSED';
end;
$$;
