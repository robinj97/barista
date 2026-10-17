# Barista: recommendation engine (v1)

Status: design draft. Nothing is implemented yet.

## 1. Goals and limits

- Suggest a starting recipe for a bean, method and target flavour, and explain why.
- After each brew, support two tuning modes: manual (full control) and assisted (questions, diagnosis, **one** suggested change with a reason). See `tuning.md`.
- No LLM. Deterministic, pure TypeScript, unit-tested, runs server-side (inputs include shared data) and, for the pure parts, on the client.
- Honest about what it knows. We have no good dataset yet, so v1 is **encoded brewing guidance plus a small amount of data**, not a learned model. Output always carries a confidence statement. The learned part comes later from users' own brews and feedback (see `architecture.md`, `brews` table).

## 2. Contract

Stable so internals can be replaced later.

```ts
type Method = 'v60' | 'aeropress' | 'espresso'

interface SuggestInput {
  method: Method
  bean: {
    origin?: string; region?: string; process?: string; variety?: string
    roastLevel?: 'light' | 'medium' | 'dark'
    altitudeM?: number
    roastDate?: string            // for bloom / degassing prior
    notes: string[]               // roaster's tasting notes
  }
  target: {
    balance: number               // -1 sweeter ... +1 brighter
    strength: 'light' | 'medium' | 'strong'
    emphasise: string[]           // subset of bean notes
  }
  cups: number                    // scales dose and water
  grinder: GrinderRef             // used only for display conversion, not by the engine
  filter?: FilterRef              // from the user's filters; flowClass feeds the priors below
  context: {
    own: PriorRecipe[]            // my locked/past recipes (any bean)
    friends: PriorRecipe[]        // friends' locked recipes visible to me
  }
}

interface SuggestOutput {
  recipe: {
    doseG: number; waterG: number; ratio: number
    tempC: number
    grindUm: number               // microns; clients convert to grinder units
    filter: FilterRef | null
    pours: { atS: number; toG: number }[]   // cumulative grams, as in the dataset
    agitation: string | null
    targetTimeS: number
  }
  ranges: Partial<Record<'tempC' | 'grindUm' | 'ratio' | 'targetTimeS', [number, number]>>
  reasons: Reason[]               // one per decision: what, why, source
  confidence: { level: 'low' | 'medium' | 'high'; basis: string }
}

// Tuning (manual and assisted) has its own contract: see tuning.md section 6.
// Assisted tuning is diagnose(input) -> next question | diagnosis with one suggested change.
```

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
| Dose / water / ratio | 1:15 default; stronger target tightens towards 1:14, light loosens towards 1:16 | 4:6 reference and dataset (1:15, 1:16.7) |
| Temperature | Light roast ~93 °C, medium ~88 °C, dark ~83 °C | Pull & Pour table; Kasuya himself uses ~92 °C. The dataset's light washed coffees use 93-96 °C, so light roasts start in 92-96. |
| Process nudges | Natural / anaerobic: slightly cooler or coarser; washed light: top of range | Common guidance, **unverified**, kept small |
| Grind | Coarse for 4:6 (French-press-like per the sources), expressed in microns; start range ~750-950 µm | The grinder converter turns this into clicks; calibrated per user over time |
| Bloom / first pour | Fresher roast (<7 days) gets more bloom time | Common guidance, **unverified** |
| Target time | ~3:00-3:30 total for 300 g | 4:6 reference; dataset 2:50 |
| Agitation | None by default | Method reference |
| Filter paper | Faster papers (thin, open) start a touch finer and expect a shorter drawdown; slower papers start slightly coarser. Metal and cloth are separate cases. Magnitude is small and **unverified**; `flowClass` unknown means no adjustment. | One source notes some third-party V60 papers are thinner and faster than Hario's |

Targets for notes ("emphasise tangerine") nudge `balance` (citrus/floral toward brighter, chocolate/caramel toward sweeter) and the reasons text. This mapping is a hand-written lookup and is easy to test.

## 5. Using data

1. **Friends' locked recipes for the same bean** are the strongest prior. If one exists, the suggestion starts from it, with grind converted to the user's grinder, and the reason says so.
2. **Similar beans** (weighted k-nearest neighbours on origin, process group, roast level, altitude, variety group, notes) produce a range per parameter. With few samples the range is wide and the confidence is low. Offline analysis on the first dataset showed that kNN did not beat "predict the average" at ~22 recipes, so v1 uses neighbours to *narrow ranges and add reasons*, not to override the structure.
3. **Own history** wins over everything else for the same bean.

Seed data: the 4:6 recipes in `data/recipes.json` (8 entries, 6 unique, mostly one creator, one grinder, little outcome data) are test fixtures, not training data.

## 6. Confidence

```
high    -> I (or a friend) locked this bean, or >= N close matches with consistent results
medium  -> a few similar beans agree
low     -> mostly the structured priors (default while data is thin)
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

Written before the engine, from day one.

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
- How much weight a friend's locked recipe gets when the grinder differs a lot (conversion error grows). Surface the grind as a range in that case.
- Method mappings for AeroPress and espresso need separate research before design.

## Sources

- Pull & Pour: [V60 4:6 method](https://pullandpourcoffee.com/v60-4-to-6-method-pour-over/) (40/60 split, example splits, pours by strength, temperatures by roast).
- Hario UK: [Interview with Tetsu Kasuya](https://www.hario.co.uk/blogs/hario-ambassadors/hario-v60-recipe-interview-with-hario-ambassador-tetsu-kasuya) (his reference recipe and the first-pour rule).
- Honest Coffee Guide: [Tetsu Kasuya 4:6 method](https://honestcoffeeguide.com/brew-recipes/tetsu-kasuya-4-6-method/) (alternative pour-count mapping, drain-based timing).
- Kurasu: [2016 World Brewers Cup champion Tetsu Kasuya](https://kurasu.kyoto/blogs/kurasu-journal/2016-world-brewers-cup-champion-tetsu-kasuya) (background).
- Tuning research (taste-to-cause mapping, lever effects, water) is listed with links in [`tuning.md`](tuning.md) section 2, including where sources disagree and which are espresso-only.
