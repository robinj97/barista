-- Removing a friend and finishing a bag. Rolled back at the end (raises POLISH_TESTS_PASSED).

do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  n int;
  bag uuid := gen_random_uuid();
begin
  insert into auth.users (id, email) values (a, 'a@test.local'), (b, 'b@test.local'), (c, 'c@test.local');
  insert into public.friendships (user_a, user_b) values (least(a, b), greatest(a, b));
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- someone outside the pair cannot end it
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  delete from public.friendships where user_a = least(a, b) and user_b = greatest(a, b);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.friendships;
  assert n = 1, 'someone outside the pair cannot remove the friendship';

  -- either participant can; the other side sees it gone too
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  delete from public.friendships where user_a = least(a, b) and user_b = greatest(a, b);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.friendships;
  assert n = 0, 'a participant can remove it for both';
  select count(*) into n from public.profiles where id = b;
  assert n = 0, 'and they can no longer read each other profiles';

  -- finished_at: the owner can set it on their own bag, nobody else can
  perform public.add_bag(p_new_bean := '{"roaster":"Zyx","name":"Finish test"}', p_bag_id := bag);
  update public.user_beans set finished_at = now() where id = bag;
  select count(*) into n from public.user_beans where id = bag and finished_at is not null;
  assert n = 1, 'a bag can be marked finished';
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  update public.user_beans set finished_at = null where id = bag;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select count(*) into n from public.user_beans where id = bag and finished_at is not null;
  assert n = 1, 'nobody else can change it';

  raise exception 'POLISH_TESTS_PASSED';
end;
$$;
