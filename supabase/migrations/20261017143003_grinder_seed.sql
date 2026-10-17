-- Grinder seed and calibration for the converter (engine/grinder.ts).
-- Kept in sync with engine/grinderSeed.ts by a test. Provenance and caveats: docs/grinders.md.

alter table public.grinders
  add column setting_step numeric not null default 1 check (setting_step > 0);

insert into public.grinders (brand, model, unit_label, setting_step, max_setting)
values
  ('Turin', 'DF54', 'dial', 1, null),
  ('Comandante', 'C40', 'clicks', 1, null),
  ('1Zpresso', 'K-Ultra', 'clicks', 1, null),
  ('1Zpresso', 'JX-Pro', 'clicks', 1, null),
  ('Timemore', 'C2', 'clicks', 1, null),
  ('Baratza', 'Encore', 'steps', 1, null),
  ('1Zpresso', 'ZP6 Special', 'clicks', 1, null),
  ('Timemore', 'Bricks 01S', 'steps', 1, null),
  ('Lopder', 'MAXA', 'clicks', 1, 60)
on conflict (brand, model) do nothing;

-- Calibration points: setting -> approximate microns. Two-point entries are rough.
insert into public.grinder_calibration (grinder_id, setting, microns, source)
select g.id, v.setting, v.microns, 'chart'
from (
  values
    ('Turin', 'DF54', 60, 640),
    ('Turin', 'DF54', 76, 779),
    ('Turin', 'DF54', 80, 814),
    ('Turin', 'DF54', 85, 850),
    ('Comandante', 'C40', 27, 820),
    ('Comandante', 'C40', 28, 850),
    ('1Zpresso', 'K-Ultra', 41, 820),
    ('1Zpresso', 'K-Ultra', 43, 850),
    ('1Zpresso', 'JX-Pro', 65, 820),
    ('1Zpresso', 'JX-Pro', 68, 850),
    ('Timemore', 'C2', 26, 820),
    ('Timemore', 'C2', 27, 850),
    ('Baratza', 'Encore', 24, 820),
    ('Baratza', 'Encore', 25, 850)
) as v (brand, model, setting, microns)
join public.grinders g on g.brand = v.brand and g.model = v.model
on conflict (grinder_id, setting) do nothing;
