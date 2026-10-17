-- Provisional Kingrinder K7 calibration. ESTIMATED, not measured.
--
-- From the K7 manual: settings are clicks counted from the finest stop, 100 clicks per round,
-- and the grinder must not be used below 15 clicks. With the stated ~15 um per click and the
-- size scale starting at 15 clicks (size = 15 * (clicks - 15)), the manual's per-method click
-- bands land on normal grind sizes. Replace with measured pairs when available.
-- See docs/grinders.md.

alter table public.grinder_calibration drop constraint grinder_calibration_source_check;
alter table public.grinder_calibration
  add constraint grinder_calibration_source_check
  check (source in ('manufacturer', 'chart', 'learned', 'estimated'));

update public.grinders set min_setting = 15 where brand = 'Kingrinder' and model = 'K7';

insert into public.grinder_calibration (grinder_id, setting, microns, source)
select g.id, v.setting, v.microns, 'estimated'
from (
  values
    ('Kingrinder', 'K7', 30, 225),
    ('Kingrinder', 'K7', 80, 975)
) as v (brand, model, setting, microns)
join public.grinders g on g.brand = v.brand and g.model = v.model
on conflict (grinder_id, setting) do nothing;
