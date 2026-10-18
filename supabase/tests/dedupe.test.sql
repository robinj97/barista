-- One entry per coffee: dedupe key, unique rule, add_bag reuse and similar_beans. Rolled back at
-- the end (raises DEDUPE_TESTS_PASSED). Uses a made-up roaster so real catalogue beans cannot
-- change the counts.

do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  bag1 uuid := gen_random_uuid();
  bag2 uuid := gen_random_uuid();
  n int;
  failed boolean;
begin
  assert public.bean_dedupe_key('Zyx', 'Elto') = public.bean_dedupe_key('Zyx Coffee Roasters', 'Elto'), 'filler words are ignored';
  assert public.bean_dedupe_key('Café Sey', 'Gato') = public.bean_dedupe_key('cafe sey', 'GATO'), 'accents and case are ignored';
  assert public.bean_dedupe_key('The Coffee Co.', 'X') <> '', 'a roaster of only filler still has a key from the name';
  assert public.bean_dedupe_key('Sey', 'Gatomboya AA') <> public.bean_dedupe_key('Sey', 'Gatomboya AB'), 'different names differ';

  insert into auth.users (id, email) values (a, 'a@test.local'), (b, 'b@test.local');

  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.add_bag(p_new_bean := '{"roaster":"Zyx Coffee Roasters","name":"Dukorere Natural"}', p_bag_id := bag1);

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.add_bag(p_new_bean := '{"roaster":"Zyx","name":"dukorere  natural"}', p_bag_id := bag2);
  select count(*) into n from public.beans where dedupe_key = public.bean_dedupe_key('Zyx', 'Dukorere Natural');
  assert n = 1, 'a second spelling reuses the bean';
  select count(distinct bean_id) into n from public.user_beans where id in (bag1, bag2);
  assert n = 1, 'both bags point at the same bean';

  failed := false;
  begin
    insert into public.beans (roaster, name) values ('ZYX', 'Dukorere Natural');
  exception when unique_violation then failed := true; end;
  assert failed, 'the database refuses a second copy';

  perform public.add_bag(p_new_bean := '{"roaster":"Zyx","name":"Dukorere Natural"}', p_bag_id := bag2);
  select count(*) into n from public.beans where dedupe_key = public.bean_dedupe_key('Zyx', 'Dukorere Natural');
  assert n = 1, 'a retry adds nothing';

  select count(*) into n from public.similar_beans('Zyx Roasters', 'Dukorere Natural');
  assert n = 1, 'an exact match is found';
  select exact into failed from public.similar_beans('zyx', 'DUKORERE NATURAL') limit 1;
  assert failed, 'and flagged exact';
  select count(*) into n from public.similar_beans('Zyx', 'Dukorere Natural Lot 33');
  assert n = 1, 'a near match (a lot number added) is offered';
  select exact into failed from public.similar_beans('Zyx', 'Dukorere Natural Lot 33') limit 1;
  assert not failed, 'but not as exact';
  select count(*) into n from public.similar_beans('Qqq', 'Something Else Entirely');
  assert n = 0, 'unrelated beans are not offered';

  raise exception 'DEDUPE_TESTS_PASSED';
end;
$$;
