# Barista: grinders and the converter

Status: converter implemented (`engine/grinder.ts`), seed data applied. Per-user offset learning is not built yet.

## How it works

- Every recipe stores grind as approximate particle size in **microns**. Each grinder is described by a few calibration points (`setting -> microns`), and the converter interpolates linearly between them.
- `settingToMicrons` and `micronsToSetting` convert one way each; `convertSetting(from, setting, to)` goes from one grinder to another through microns.
- Results are rounded to the grinder's `setting_step` and clamped to its min/max range when known.
- `extrapolated` is true when the answer lies outside the calibrated range, and `clamped` is true when it hit the grinder's limits. The UI should show a warning for either.
- A personal `offset_um` (stored on `user_grinders`) shifts a user's grinder from the catalogue curve: positive means their grounds are coarser at the same setting. It is applied when converting both ways. Learning the offset from feedback is future work.
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
| Kingrinder K2 | none | See the Kingrinder note below. |
| Kingrinder K7 | none | See the Kingrinder note below. |

Why this matters:

- Two-point grinders pin the slope only between about 820 and 850 µm. Anything outside that range is extrapolated and flagged. The recipes people actually brew (light-roast filter) should mostly fall inside it, but espresso and French press will not.
- With integer rounding, a fine-step grinder like the JX-Pro lands within about one click of the truth at best. The tests allow for this.
- All the "equivalent setting" pairs share the same two reference sizes, so they are consistent with each other by construction. They are not independent measurements.

## Kingrinder K2 and K7

Both are in the catalogue but not convertible, because we could not find a trustworthy "this setting gives this size" anchor, and the per-click figures disagree:

- **K2:** the maker's product page reportedly gives 18 µm per click, but one guide quotes a 0 to 1030 µm range over up to about 140 clicks, which works out near 7 µm per click. Click counts depend on where "zero" is set, and the dial number may not match counted clicks.
- **K7:** one retailer lists 16 µm per click and 160 settings; another source says about 10 µm per click. We found no official spec page.
- A review of a related model (Kingrinder P2) found the advertised per-click figure described axial burr travel, not the change in grind size, so these numbers could describe the wrong thing.
- Published "clicks from zero" tables for brew methods exist (for example V60 55 to 95 clicks on the K2), but they are not microns and depend on the zero point.

What would fix it: a measured or manufacturer-published pair such as "K7 at N clicks is about X µm", or users on these grinders locking recipes next to friends on calibrated grinders, so offsets can be learned.

## Data issues found (please check)

Two DF54 entries were left out because they do not fit the rest of the curve:

- **82 -> 820 µm** conflicts with 80 -> 814 µm: two dial steps would add only 6 µm, against roughly 7 to 9 µm per step everywhere else.
- **86 -> 880 µm** implies a 30 µm jump from 85 -> 850 µm in a single step.

If you can confirm either (a measurement, or a manufacturer chart), add the point in a new migration. The curve validator will reject the set if it stops getting coarser.

## Next

- Learn each user's `offset_um` from cross-user pairs (two friends lock the same bean on different grinders) and from feedback.
- Add calibration for the three uncalibrated grinders once we have an anchor point for each.
- Surface the conversion range to users ("about 27 to 28 clicks") instead of a single number when the data is thin.
