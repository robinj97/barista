-- Kingrinder K2 and K7. Listed so people can add them to their gear, but not convertible
-- yet: sources disagree on microns per click and give no setting-to-size anchor.
-- See docs/grinders.md.

insert into public.grinders (brand, model, unit_label, setting_step, max_setting)
values
  ('Kingrinder', 'K2', 'clicks', 1, null),
  ('Kingrinder', 'K7', 'clicks', 1, null)
on conflict (brand, model) do nothing;
