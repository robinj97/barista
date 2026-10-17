-- Revised Kingrinder K7 calibration. Still ESTIMATED, not measured.
--
-- The first estimate (15 um per click from a 15-click zero) put pour-over at 60 to 80 clicks,
-- the manual's band. Real use and several reviews put filter brewing at 95 to 120 clicks, and
-- espresso at 35 to 40 as the manual says. Both fit only if a click moves the grind about 9 um,
-- not 15 (the advertised figure is probably burr travel, as found for other Kingrinders).
-- Anchors: espresso ~38 clicks = ~250 um, filter ~100 clicks = ~800 um. See docs/grinders.md.

delete from public.grinder_calibration c
using public.grinders g
where c.grinder_id = g.id and g.brand = 'Kingrinder' and g.model = 'K7';

insert into public.grinder_calibration (grinder_id, setting, microns, source)
select g.id, v.setting, v.microns, 'estimated'
from (
  values
    ('Kingrinder', 'K7', 38, 250),
    ('Kingrinder', 'K7', 100, 800)
) as v (brand, model, setting, microns)
join public.grinders g on g.brand = v.brand and g.model = v.model;
