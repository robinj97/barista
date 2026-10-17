# Barista: recommendation engine (v1)

Status: **v1 implemented** in `engine/` (V60 only). Assisted tuning (`tuning.md`) is not built yet. No UI uses the engine yet.

## 1. Goals and limits

- Suggest a starting recipe for a bean, method and target flavour, and explain why.
- After each brew, support two tuning modes: manual (full control) and assisted (questions, diagnosis, **one** suggested change with a reason). See `tuning.md`.
- No LLM. Deterministic, pure TypeScript, unit-tested, runs server-side (inputs include shared data) and, for the pure parts, on the client.
- Honest about what it knows. We have no good dataset yet, so v1 is **encoded brewing guidance plus a small amount of data**, not a learned model. Output always carries a confidence statement. The learned part comes later from users' own brews and feedback (see `architecture.md`, `brews` table).

## 2. Contract

Stable so internals can be replaced later. The types live in `engine/types.ts`; the entry point is `suggest(input)` in `engine/suggest.ts`, which validates the input and hands it to the method's recommender (`engine/v60.ts`; a new method is a new recommender registered there). Temperature and grind start from `engine/start.ts` (data, else guidance in `engine/priors.ts`). It is pure and deterministic (no clock, network or database): the same input always gives the same output, and the input is never modified.

**Input (`SuggestInput`)**

- `method`: `'v60'` today. Other methods throw `EngineError('unsupported_method')`; check with `supportsMethod()` and do not offer them yet.
- `bean`: the static facts (`origin`, `region`, `process`, `variety`, `roastLevel`, `altitudeM`, `notes`), plus `id` (to recognise recipes for the same bean) and `roastDate`.
- `target`: `balance` from -1 (sweeter) to +1 (brighter), `strength` (`light`, `medium`, `strong`) and `emphasise` (tasting notes to bring out).
- `cups` (one cup is 10 g of coffee, so 2 cups is the 20 g / 300 g reference) or an exact `doseG` (5 to 60 g).
- `filter` (optional): id, brand, model and `flowClass`.
- `context` (optional): `own` and `friends`, lists of locked recipes (`PriorRecipe`: method, bean id and traits, temperature, grind already in microns). Which list a recipe is in says whose it is.
- `asOf` (optional): today as `yyyy-mm-dd`, used only for roast freshness. It is a parameter so the engine stays pure.

**Output (`SuggestOutput`)**

- `recipe`: `doseG`, `waterG`, `ratio`, `tempC`, `grindUm` (microns; the grinder converter turns it into clicks), `filter`, `pours` (cumulative grams with start times), `agitation` (null) and `targetTimeS`.
- `structure`: the balance and later-pour count actually used, after the notes' nudge and clamping.
- `ranges`: for `tempC`, `grindUm`, `ratio` and `targetTimeS`. The recipe values always sit inside them.
- `reasons`: one or more per decision, each with `param`, `what`, `why` and a `source` (`method`, `guidance`, `data` or `assumption`). The reason for a value always states the value in the recipe.
- `confidence`: `low`, `medium` or `high`, plus a plain-language `basis` sentence for the UI.

Tuning (manual and assisted) has its own contract in `tuning.md` section 6; `diagnose` is not built yet.

## 3. Pour structure: a parametric 4:6

Reference: Tetsu Kasuya's 4:6 method. The pour schedule is a function of two inputs, not a lookup of templates (templates remain ordinary data).

What the sources say (verified online, links at the end):

- Total water is split **40 / 60**.
- The **first 40%** is poured in two pours and sets the sweetness/acidity balance: a smaller first pour (and larger second) gives more sweetness; a larger first pour gives more acidity.
- The **last 60%** is divided into equal pours and sets strength: more pours, stronger cup; fewer pours, lighter.
- Reference recipe: 20 g coffee, 300 g water (1:15), coarse grind, water around 92-93 °C, pours roughly 40-45 s apart, finishing around 3:30.

Where sources disagree (so we model it rather than hard-code it):

- The **baseline** number of pours in the last 60%. Pull & Pour treats three as the base (two weaker, four stronger); Honest Coffee Guide lists one / two / three as lighter / medium / stronger. All agree on the direction. We therefore treat pour count as a monotone dial and test it against the dataset.
- Exact example splits differ slightly (50/70 vs 60/60 base vs 40/80 sweeter).
- "Strength" is not formally defined by the method (it is not a TDS target). We use it as a user-facing dial and learn what it actually produces from feedback.
- We found one unverified forum comment that the method is hard to repeat consistently. We have not confirmed it, so we do not rely on it.

### Mapping

Let `W` = total water, `b` = balance in `[-1, 1]` (-1 sweeter, +1 brighter).

```
phase1 = 0.4 * W
pour1  = phase1 * (0.5 + b / 6)      // b = -1 -> 1/3 (40 of 120), b = +1 -> 2/3 (80 of 120), b = 0 -> 60/60
pour2  = phase1 - pour1

phase2 = 0.6 * W
n      = light: 2 (1 = "tea-like"), medium: 3, strong: 4
each later pour = phase2 / n
```

Pour times: first pour at 0 s (it doubles as the bloom), then every 40-45 s, longer gaps on later pours. In the source material each pour starts when the bed has mostly drained, so times are guidance, not a clock. The brew screen shows the schedule, not a live timer.

This is the starting structure only. Other structures (a single bloom plus continuous pour, AeroPress inversion, espresso pressure/time profiles) get their own mappings behind the same contract. Espresso and AeroPress mappings are future work and will need their own research pass.

## 4. Other parameters: priors

Everything below is **encoded guidance, not validated science**. Each carries a range, not a point, and the `reasons` output says which prior fired. Initial values are starting points to be refined against real brews.

| Parameter | Prior (v1) | Source / status |
|---|---|---|
| Dose / water / ratio | 1:15 always; strength changes the number of pours, not the ratio (you can still edit it) | 4:6 reference and dataset (1:15, 1:16.7) |
| Temperature | Light 94 °C (92 to 96), medium 90 (88 to 92), dark 85 (83 to 88). Unknown roast level is assumed light, and the reasons say so. | Pull & Pour table (93, 88, 83) and Kasuya's ~92 °C, nudged up to match the dataset's light washed coffees (93 to 96 °C). |
| Process nudges | Natural or anaerobic: 1 °C cooler. Washed light roast: 1 °C hotter. A cooler nudge moves the range down; a hotter one keeps it (light stays 92 to 96, the dataset's light washed range). Processes are grouped in `engine/traits.ts` ("pulped natural" counts as honey). | Common guidance, **unverified**, kept small |
| Grind | About 820 µm (range 100 µm either side), 30 µm coarser for medium roasts and 60 µm for dark. | The 4:6 sources say coarse; 820 µm matches the DF54 dataset. The grinder converter turns it into clicks. |
| Bloom / first pour | Roasted in the last 7 days: the gap before the second pour is 55 s instead of 45 s. Only when `asOf` is given. | Common guidance, **unverified** |
| Target time | Last pour start plus a drawdown that scales with the water (210 s, about 3:30, for the reference brew), range 25 s either side. | 4:6 reference; dataset 2:50. The scaling for smaller brews is **unverified**. |
| Agitation | None by default | Method reference |
| Filter paper | Fast papers start 30 µm finer, slow papers 30 µm coarser. Medium papers and an unknown flow class mean no adjustment, and the reasons say which. Metal and cloth are not treated separately yet. Small and **unverified**. | One source notes some third-party V60 papers are thinner and faster than Hario's |

(Not used by the UI at the moment: the effect of notes on the cup is unproven, see `brew.md`.) Tasting notes you want to bring out nudge the balance by at most 0.35 (bright notes such as bergamot, citrus and florals lean brighter; chocolate, caramel and nuts lean sweeter; mixed notes cancel). Compound and plural forms count ("blueberry", "nutty"). The mapping is a hand-written lookup in `engine/notes.ts`, and your own balance setting still leads. 

## 5. Using data

1. **Locked recipes for the same bean** are the strongest prior. If you have one, temperature and grind start from it (the median if there are several), with a narrow range, and confidence is high. If only friends do, the same applies with a slightly wider range and medium confidence, because their grind was converted from their grinder. The pour structure and the ratio still follow your own balance and strength dials. The grind is not adjusted for your paper, since the recipe already worked, and the reasons say so.
2. **Similar beans** (a similarity score on origin, process group, roast level, variety group, notes and altitude, at least 0.6) blend into the guidance: each neighbour pulls the starting temperature and grind, up to 40% in total. Process and variety compare on their group when known, otherwise on the text itself. Only fields both coffees have are compared, and two coffees sharing too little information are not compared at all. One or two neighbours leave confidence low and say so; three or more tighten the range and give medium. Offline analysis on the first dataset showed that kNN did not beat "predict the average" at ~22 recipes, so neighbours only *nudge and narrow*, never override the structure.
3. **Own history** wins over everything else for the same bean.

Seed data: the 4:6 recipes in `data/recipes.json` (8 entries, 6 unique, mostly one creator, one grinder, little outcome data) are test fixtures, not training data.

## 6. Confidence

```
high    -> you locked a recipe for this very bean
medium  -> a friend locked this very bean, or three or more similar beans informed it
low     -> mostly the encoded guidance (the default while data is thin)
```

The UI shows `basis` in plain words, e.g. "Based on the 4:6 method and general light-roast guidance; no similar beans yet. Expect 2-3 brews."

## 7. Tuning

Two modes, both available on any brew. Full design, research and contract are in [`tuning.md`](tuning.md).

- **Manual tuning:** every parameter editable, with effect hints, history kept as immutable versions.
- **Assisted tuning:** the engine asks a few plain-language questions, ranks competing causes (under-extracted, over-extracted, uneven, too weak, too strong, delicate notes masked, water, old beans, equipment, expectation), and suggests exactly one change with a reason and what to look for next. When the evidence is ambiguous (for example the temperature question for delicate coffees, where sources disagree) it says so, lowers confidence and labels the change a test.

Quick feedback rules (the simple, always-available layer that assisted tuning builds on):

| Feedback | Change (in order of preference) |
|---|---|
| Sour / thin / fast drawdown | finer grind, then hotter water |
| Bitter / dry / slow drawdown | coarser grind, then cooler water |
| Sour and bitter together | not a grind problem: technique and bed evenness first |
| Weak (but balanced) | tighter ratio, or one more pour |
| Too strong / heavy | looser ratio, or one fewer pour |
| Notes missing but balanced | ambiguous: see `tuning.md` (`masked`) |

Rules:

- Exactly one change per assisted suggestion, with the reason shown ("sour and drained in 2:10, so 2 clicks finer, everything else unchanged").
- Step size shrinks as the range narrows (large, then medium, then small). Reversals (we overshot) halve the step.
- Grind steps are computed in microns and displayed in the user's grinder units, using their personal offset.
- Causes that are not recipe parameters (water, bean age, equipment) produce advice instead of a parameter change.

## 8. Test plan

Implemented in `engine/*.test.ts` (pour structure, suggestions, helpers and the recorded recipes). Items 5 and 7 below are still to do with assisted tuning.

1. **Structure round trip.** For each unique recipe in `data/recipes.json`, derive `(b, n)` from its pours (e.g. 70/50 then three 60s gives b = 0.5, n = 3; 40/80 gives b = -1; 80/40 then one 180 gives b = 1, n = 1) and assert the engine regenerates the same cumulative grams (within 1 g). Timing is checked only within a tolerance because the creator's timings are irregular.
2. **Method reference.** `balance = 0, strength = medium, 300 g` gives 60, 120, 180, 240, 300.
3. **Monotonic properties.** More `b` means larger pour 1; stronger means more pours; sums always equal `W`; every pour is positive.
4. **Scaling.** Cups scale water and dose; ratio unchanged.
5. **Adjustment and diagnosis.** Each feedback combination yields exactly one change, in the right direction, with a smaller step after a reversal. Table-driven diagnosis scenarios (including the ambiguous Geisha case) are listed in `tuning.md` section 8.
6. **Confidence.** Changes with the data present (none / similar / friend-locked).
7. **Contract.** Types are validated at the boundary (shared schema).
8. **Later, offline.** A notebook-based leave-one-out comparison against "predict the average" once there are several hundred diverse recipes or real brew-plus-feedback pairs.

## 9. Open questions

- Baseline pour count for "medium" (3 per most sources, but disagreement exists). Start with 3, adjust from feedback.
- The 1-pour "tea-like" structure exists in `buildPours` and in the dataset but is not reachable from the strength dial yet.
- Friends' recipes are trusted at medium confidence; how much a large grinder difference should widen the range is still open.
- How much weight a friend's locked recipe gets when the grinder differs a lot (conversion error grows). Surface the grind as a range in that case.
- Method mappings for AeroPress and espresso need separate research before design.

## Sources

- Pull & Pour: [V60 4:6 method](https://pullandpourcoffee.com/v60-4-to-6-method-pour-over/) (40/60 split, example splits, pours by strength, temperatures by roast).
- Hario UK: [Interview with Tetsu Kasuya](https://www.hario.co.uk/blogs/hario-ambassadors/hario-v60-recipe-interview-with-hario-ambassador-tetsu-kasuya) (his reference recipe and the first-pour rule).
- Honest Coffee Guide: [Tetsu Kasuya 4:6 method](https://honestcoffeeguide.com/brew-recipes/tetsu-kasuya-4-6-method/) (alternative pour-count mapping, drain-based timing).
- Kurasu: [2016 World Brewers Cup champion Tetsu Kasuya](https://kurasu.kyoto/blogs/kurasu-journal/2016-world-brewers-cup-champion-tetsu-kasuya) (background).
- Tuning research (taste-to-cause mapping, lever effects, water) is listed with links in [`tuning.md`](tuning.md) section 2, including where sources disagree and which are espresso-only.
