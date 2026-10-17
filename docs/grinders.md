# Barista: grinders and the converter

Status: converter implemented (`engine/grinder.ts`), seed data applied. Per-user offset learning is not built yet.

## How it works

- Every recipe stores grind as approximate particle size in **microns**. Each grinder is described by a few calibration points (`setting -> microns`), and the converter interpolates linearly between them.
- `settingToMicrons` and `micronsToSetting` convert one way each; `convertSetting(from, setting, to)` goes from one grinder to another through microns.
- Results are rounded to the grinder's `setting_step` and clamped to its min/max range when known.
- `extrapolated` is true when the answer lies outside the calibrated range, and `clamped` is true when it hit the grinder's limits. The UI should show a warning for either.
- A personal `offset_um` (stored on `user_grinders`) shifts a user's grinder from the catalogue curve: positive means their grounds are coarser at the same setting. It is applied when converting both ways. Learning the offset from feedback is future work.
- Every result carries a `confidence`: **low** when the answer was extrapolated or clamped, or when either grinder's points are only `estimated`; **medium** for in-range answers from charted or manufacturer points; **high** only when every point was learned from real user pairs. The UI should show "rough estimate" for low.
- Grinders with fewer than two calibration points are listed but cannot be converted (`isCalibrated` is false). Calling a conversion on them throws `GrinderCalibrationError`.
- The curve must get strictly coarser as the setting increases. Bad data fails loudly instead of producing nonsense.

## Seed data and its limits

Applied by `supabase/migrations/*_grinder_seed.sql` and mirrored in `engine/grinderSeed.ts`; a test keeps the two in sync.

| Grinder | Points | Notes |
|---|---|---|
| Turin DF54 | 4 (60, 76, 80, 85) | The only multi-point curve. Hand-collected. |
| Comandante C40 | 2 (27 at 820 µm, 28 at 850 µm) | Two-point pair, rough. |
| 1Zpresso K-Ultra | 2 (41, 43) | Two-point pair, rough. |
| 1Zpresso JX-Pro | 2 (65, 68) | Two-point pair, rough. |
| Timemore C2 | 2 (26, 27) | Two-point pair, rough. |
| Baratza Encore | 2 (24, 25) | Two-point pair, rough. |
| 1Zpresso ZP6 Special | none | Only a step size (about 22 µm/click) and a rough range; no anchor setting. |
| Timemore Bricks 01S | none | Only a step size (about 10 µm/step); no anchor setting. |
| Lopder MAXA | none | 60-click dial; no microns data. |
| Kingrinder K2 | none | Not convertible; see the Kingrinder section. |
| Kingrinder K7 | 2 (30, 80), **estimated** | Provisional; low confidence. See the Kingrinder section. |

Why this matters:

- Two-point grinders pin the slope only between about 820 and 850 µm. Anything outside that range is extrapolated and flagged. The recipes people actually brew (light-roast filter) should mostly fall inside it, but espresso and French press will not.
- With integer rounding, a fine-step grinder like the JX-Pro lands within about one click of the truth at best. The tests allow for this.
- All the "equivalent setting" pairs share the same two reference sizes, so they are consistent with each other by construction. They are not independent measurements.

## Kingrinder K7 (estimated) and K2

### K7: provisional, low confidence

The K7 manual says: zero the grinder by turning the adjustment nut counterclockwise to its stop and aligning the zero nut with 0; settings are clicks counted clockwise from there; one round is 100 clicks; never grind below 15 clicks. It lists recommended click bands per method (Turkish 20 to 30, espresso 30 to 40, moka and AeroPress 40 to 50, pour-over 60 to 80, French press 80 to 100) but gives **no microns**.

We combined that with the roughly 15 µm per click figure you gave us, and put the zero of the size scale at 15 clicks (the manual's floor, where the burrs effectively meet):

`size ≈ 15 µm × (clicks − 15)`, stored as two points, 30 clicks = 225 µm and 80 clicks = 975 µm, source `estimated`.

| Method | Manual clicks | Estimated size |
|---|---|---|
| Turkish | 20 to 30 | 75 to 225 µm |
| Espresso | 30 to 40 | 225 to 375 µm |
| Moka, AeroPress | 40 to 50 | 375 to 525 µm |
| Pour-over | 60 to 80 | 675 to 975 µm |
| French press | 80 to 100 | 975 to 1275 µm |

Example: a DF54 85 (850 µm) recipe converts to **72 clicks (0.72 turns)**, mid pour-over band.

How much to trust it:

- The zero at 15 clicks is an inference from the safety floor, not a measurement.
- The "normal size per method" ranges used to sanity-check the bands are general coffee knowledge, not from the manual. The fit is good to roughly ±100 µm.
- One reviewer reports daily brewing at 105 to 120 clicks, which this model contradicts. Unresolved; low weight.
- The converter marks every K7 result as **low confidence**, and the K7 has a `min_setting` of 15, so it never suggests a setting that could damage the burrs.
- The coarsest stop is not in the manual, so there is no maximum yet.

To replace it: one real pair ("K7 at N clicks gives the same cup as C40 at 28") fixes the slope; two also fix the zero. Use source `learned` or `chart` for measured data.

### K2: not convertible

Sources disagree on microns per click and give no setting-to-size anchor:

- The maker's page reportedly gives 18 µm per click, but one guide quotes a 0 to 1030 µm range over up to about 140 clicks, which is near 7 µm per click.
- A review of a related model (Kingrinder P2) found the advertised per-click figure described axial burr travel, not the change in grind size.
- Published "clicks from zero" tables exist (V60 55 to 95 clicks on the K2) but are not microns. A K2 manual might allow the same treatment as the K7.

## Data issues found (please check)

Two DF54 entries were left out because they do not fit the rest of the curve:

- **82 -> 820 µm** conflicts with 80 -> 814 µm: two dial steps would add only 6 µm, against roughly 7 to 9 µm per step everywhere else.
- **86 -> 880 µm** implies a 30 µm jump from 85 -> 850 µm in a single step.

If you can confirm either (a measurement, or a manufacturer chart), add the point in a new migration. The curve validator will reject the set if it stops getting coarser.

## Next

- Learn each user's `offset_um` from cross-user pairs (two friends lock the same bean on different grinders) and from feedback.
- Add calibration for the three uncalibrated grinders once we have an anchor point for each.
- Surface the conversion range to users ("about 27 to 28 clicks") instead of a single number when the data is thin.
