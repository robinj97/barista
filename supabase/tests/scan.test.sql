-- Bag photo scans: claim_scan and the 10-a-day cap. Same style as the other tests: one DO
-- block, ends by raising SCAN_TESTS_PASSED so everything rolls back.

do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  left_today int;
  n int;
  failed boolean;
begin
  insert into auth.users (id, email) values (a, 'a@test.local'), (b, 'b@test.local');

  -- Signed out: no scans
  failed := false;
  begin perform public.claim_scan(); exception when others then failed := true; end;
  assert failed, 'claim_scan needs a signed-in user';

  -- A scans ten times, then is stopped
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  left_today := public.claim_scan();
  assert left_today = 9, 'the first scan leaves nine';
  for i in 2..10 loop
    left_today := public.claim_scan();
  end loop;
  assert left_today = 0, 'the tenth scan leaves none';
  assert public.claim_scan() = -1, 'the eleventh scan is refused';
  select scans into n from public.scan_usage where user_id = a;
  assert n = 10, 'a refused scan is not counted';

  -- A cannot reset, remove or pre-create the count (no write policies)
  update public.scan_usage set scans = 0 where user_id = a;
  delete from public.scan_usage where user_id = a;
  select scans into n from public.scan_usage where user_id = a;
  assert n = 10, 'the count cannot be reset or deleted from the app';
  failed := false;
  begin
    insert into public.scan_usage (user_id, day, scans) values (a, current_date + 1, 0);
  exception when others then failed := true;
  end;
  assert failed, 'scan rows cannot be inserted directly';

  -- B has their own ten and cannot see A's count
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  assert public.claim_scan() = 9, 'each person has their own daily count';
  select count(*) into n from public.scan_usage where user_id = a;
  assert n = 0, 'you cannot see someone else''s scan count';

  raise exception 'SCAN_TESTS_PASSED';
end;
$$;
