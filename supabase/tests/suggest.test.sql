-- "Suggest a tweak": feature access, claim_suggestion and the 20-a-day cap, and the suggestion
-- column on drafts. Same style as the other tests: one DO block, ends by raising
-- SUGGEST_TESTS_PASSED so everything rolls back.

do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  bean uuid;
  left_today int;
  n int;
  failed boolean;
begin
  insert into auth.users (id, email) values (a, 'a@test.local'), (b, 'b@test.local');
  insert into public.feature_access (user_id, feature) values (a, 'suggest_tweak');
  select id into bean from public.beans limit 1;

  -- Signed out: no suggestions
  failed := false;
  begin perform public.claim_suggestion(); exception when others then failed := true; end;
  assert failed, 'claim_suggestion needs a signed-in user';

  -- A has the feature
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  assert public.has_feature('suggest_tweak'), 'A has suggest_tweak';
  assert not public.has_feature('something_else'), 'A has no other feature';
  select count(*) into n from public.feature_access;
  assert n = 1, 'A sees only their own feature rows';

  -- A cannot grant, change or remove features from the app (no write policies)
  failed := false;
  begin
    insert into public.feature_access (user_id, feature) values (b, 'suggest_tweak');
  exception when others then failed := true;
  end;
  assert failed, 'feature rows cannot be inserted from the app';
  delete from public.feature_access where user_id = a;
  update public.feature_access set granted_at = now() - interval '1 day' where user_id = a;
  assert public.has_feature('suggest_tweak'), 'feature rows cannot be deleted from the app';

  -- A gets twenty a day, then is stopped
  left_today := public.claim_suggestion();
  assert left_today = 19, 'the first suggestion leaves nineteen';
  for i in 2..20 loop
    left_today := public.claim_suggestion();
  end loop;
  assert left_today = 0, 'the twentieth suggestion leaves none';
  assert public.claim_suggestion() = -1, 'the twenty-first is refused';
  select suggestions into n from public.suggest_usage where user_id = a;
  assert n = 20, 'a refused suggestion is not counted';

  -- A cannot reset or pre-create the count
  update public.suggest_usage set suggestions = 0 where user_id = a;
  delete from public.suggest_usage where user_id = a;
  select suggestions into n from public.suggest_usage where user_id = a;
  assert n = 20, 'the count cannot be reset or deleted from the app';
  failed := false;
  begin
    insert into public.suggest_usage (user_id, day, suggestions) values (a, current_date + 1, 0);
  exception when others then failed := true;
  end;
  assert failed, 'usage rows cannot be inserted directly';

  -- A's draft keeps a suggestion, and saving the draft again leaves it alone
  if bean is not null then
    insert into public.recipe_drafts (bean_id, method, choices, last_brew)
    values (bean, 'v60', '{}', '{"brewedAt": "2026-10-19T08:00:00Z"}');
    update public.recipe_drafts set suggestion = '{"forBrewedAt": "2026-10-19T08:00:00Z", "kind": "advice"}'
    where bean_id = bean and method = 'v60';
    insert into public.recipe_drafts (bean_id, method, choices) values (bean, 'v60', '{"cups": 2}')
    on conflict (user_id, bean_id, method) do update set choices = excluded.choices;
    select count(*) into n from public.recipe_drafts where bean_id = bean and suggestion->>'kind' = 'advice';
    assert n = 1, 'saving the draft keeps the suggestion';
    failed := false;
    begin
      update public.recipe_drafts set suggestion = '[]' where bean_id = bean;
    exception when others then failed := true;
    end;
    assert failed, 'a suggestion must be an object';
  end if;

  -- B has no feature: nothing is counted, and B cannot see A's rows
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  assert not public.has_feature('suggest_tweak'), 'B does not have suggest_tweak';
  assert public.claim_suggestion() = -1, 'without the feature, suggestions are refused';
  select count(*) into n from public.suggest_usage;
  assert n = 0, 'B sees no usage rows, and none were made for B';
  select count(*) into n from public.feature_access;
  assert n = 0, 'B cannot see A''s feature rows';
  select count(*) into n from public.recipe_drafts where user_id = a;
  assert n = 0, 'B cannot see A''s draft or its suggestion';

  raise exception 'SUGGEST_TESTS_PASSED';
end;
$$;
