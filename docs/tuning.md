# Barista: tuning (manual and assisted)

Status: design draft. Nothing here is implemented. Extends `engine.md` (replaces its old "feedback adjustment" section).

## 1. The idea

After a brew the user can improve the recipe in two ways, and can use either on any brew:

- **Manual tuning.** Full control. Every parameter is editable, with hints about what each change tends to do. No questions asked.
- **Assisted tuning.** The app asks a few plain-language questions the user may not know they need to answer ("did it get drying at the end?"), works out the most likely cause, and suggests one change with a reason. It is built for someone new to brewing whose cup "tasted ok but not the best".

The hard part is assisted tuning, because **taste is an ambiguous signal**. Several different causes produce the same cup. A flat Geisha might be under-extracted, or over-extracted, or made with the wrong water, or just old. So the assisted flow is a *diagnosis*: keep a set of competing explanations, ask the question that best tells them apart, then suggest the change that fits the most likely one, and say how sure we are.

## 2. What the research supports (and doesn't)

Sources are mostly roaster, retailer and barista-education pages. There is little controlled testing, and much of it is espresso-focused. Treat everything below as encoded guidance, not validated science, and weight it accordingly.

### Solid enough to build on (sources agree)

- **Extraction and strength are different problems.** Sour and bitter are about *extraction* (how much has been pulled out of the coffee). Watery or heavy is about *strength* (how concentrated the cup is). Fix them with different levers: grind/temperature/time for extraction, ratio for strength. ([Seattle Coffee Gear](https://www.seattlecoffeegear.com/blogs/learning-center/why-does-my-espresso-taste-sour-or-bitter), [Atlas Coffee](https://www.atlascoffee.com/encyclopedia/extraction-fundamentals-3-the-brewing-control-chart/))
- **Under-extracted tends to taste sour, thin, sometimes salty or grassy, lacking sweetness. Over-extracted tends to taste bitter, harsh, drying or astringent.** The SCA brewing control chart is the standard frame: an ideal window of extraction yield (often quoted around 18-22%) and strength (TDS) with under, over, weak and strong regions around it. The exact numbers need checking against SCA's own chart, because the figures we found come from secondary sources. ([Open Exam Prep summary of the SCA chart](https://open-exam-prep.com/study-guides/sca-q-grader/brewing-science-water-chemistry/brewing-control-chart))
- **Sour and bitter *together* (or a hollow middle with sharp front and bitter finish, with little sweetness) usually means uneven extraction** (channeling, poor bed, uneven grind), not a grind problem. Changing grind won't fix it; technique and grinder quality do. ([Complete Home Barista](https://completehomebarista.com/guides/taste-based-extraction-diagnosis/), [Complete Home Barista on V60](https://completehomebarista.com/problems/pour-over-failure/))
- **Astringency (a drying, puckery finish) is easy to mistake for sourness.** Users need a way to tell them apart. ([Home-Barista thread](https://www.home-barista.com/brewing/is-it-sourness-or-astringency-t62634.html), anecdotal but a common beginner confusion)
- **Drawdown time is evidence.** For a V60, much faster than about 2:30 points to a coarse grind or channeling; slower than about 3:30-4:00 points to a fine grind or clogging by fines. Stirring during the main pour and pouring hard push fines and cut channels. ([Complete Home Barista on V60](https://completehomebarista.com/problems/pour-over-failure/))
- **Beans that are old (or too fresh) taste flat or uneven, and no recipe change fixes that.** One source suggests grinding coarser for stale beans; this was espresso-specific. ([Complete Home Barista](https://completehomebarista.com/guides/taste-based-extraction-diagnosis/))
- **Change one variable at a time.** Universal advice and our existing rule.

### Real disagreement (so the app should not pretend to know)

- **Temperature and delicate, floral coffees.** Most sources say light roasts need the hot end of the range (roughly 93-96 °C) because dense coffee resists extraction, and that muted cups are more often under-extracted than "too hot". A minority says excessive heat dulls floral and fruity aromatics and shifts the balance towards acidity and bitterness. Both could be true in different cups. This is exactly the "maybe the temperature is too high, maybe too low" case, so the engine must hold both hypotheses and not choose confidently. ([Planetary Design](https://planetarydesign.com/blogs/news/pour-over-coffee-water-temperature-the-complete-guide), [Brew Coffee Home](https://www.brewcoffeehome.com/?p=14409))
- **Espresso guidance is not filter guidance.** Several tables we found cover espresso only, including temperature ranges and fixes such as tamping. We use their *logic* (taste maps to cause) and avoid their numbers for V60.

### Water

Soft water (low mineral content) tends to give thin, flat or sharp cups, and high alkalinity mutes acidity and tastes dull. Quoted SCA-style targets are roughly 50-175 ppm general hardness and 40-75 ppm alkalinity as CaCO3, but sources differ. The mineral mix matters more than total dissolved solids. It's a plausible cause of "flat" that users rarely consider, so the assisted flow asks about it once and remembers the answer. ([SCA: Water and the taste of coffee](https://sca.coffee/sca-news/news-from-our-partners/water-and-the-taste-of-coffee), [Home-Barista](https://www.home-barista.com/water/alkalinity-and-taste-t7578.html))

### Gaps still to research

- Filter-specific (V60) evidence for temperature and grind effects on delicate coffees, ideally from controlled or published sensory work rather than blogs.
- The official SCA control chart numbers and the SCA flavour wheel's defect mapping.
- AeroPress and espresso cause-and-effect (separate lists; do not reuse the V60 one).
- How accurately new tasters report what they taste. This shapes how we word the questions, and we should test the wording with real people.

## 3. Manual tuning

- Every recipe parameter is editable at any time (grind, temperature, dose, water, ratio, pours, bloom, agitation notes).
- Under each control sits a short **effect hint** drawn from the lever table below, for example for grind: "Finer: more extraction, slower drawdown, more bitterness risk."
- Manual tuning may change several things at once. We don't block it. The app records exactly what changed (a diff against the previous version), because that is useful history and future training data.
- Manual mode never calls the diagnosis. A small "Get a suggestion" button on the same screen switches to assisted tuning for that brew.
- Edits create a new immutable recipe version (see `architecture.md`); nothing is lost.

## 4. Lever effects

What each lever tends to do. Direction is reliable; magnitude is not, which is why steps start moderate and shrink.

| Lever | Increases extraction | Effect on flow and strength | Typical risk | Notes |
|---|---|---|---|---|
| Grind finer | Yes, strongly | Slower drawdown, more fines | Bitter, astringent, clogging | Biggest lever. Use drawdown time as evidence. |
| Grind coarser | Reduces | Faster drawdown | Sour, thin, hollow | Also the fix for choking. |
| Temperature up | Yes, rate | None directly | Harsh, bitter; possibly muted delicate aromatics (disputed) | Secondary lever. Light roasts start high. |
| Temperature down | Reduces | None directly | Sour, flat | Evidence for aroma benefit is mixed. |
| Ratio tighter (less water) | Slightly | Stronger, heavier | Heavy, dull if overdone | Mostly a strength lever. |
| Ratio looser | Slightly | Weaker | Watery | |
| More / longer pours (4:6 strength dial) | Yes | Stronger | Over-extraction | Specific to the 4:6 structure. |
| First-pour split (4:6 balance dial) | Shifts character | Sweeter vs brighter | | See `engine.md`. |
| Agitation (stir, swirl, hard pour) | Yes | Pushes fines to the filter, can slow flow | Channeling when overdone | Keep to bloom unless needed. |
| Bloom time | Affects evenness | | Uneven if skipped on fresh coffee | Fresher beans need more. |
| Water minerals | Changes extraction and taste | | Flat (high alkalinity), thin or sharp (soft) | Not a recipe parameter; a context fact. |
| Bean freshness | Changes everything | | Flat when old | Not tunable; flagged, not fixed. |

## 5. Assisted tuning: how it works

### 5.1 Hypotheses (causes)

A fixed catalogue, stored as data (versioned), each with a plain-language name:

| Id | What we think is happening | Typical levers |
|---|---|---|
| `under` | Under-extracted | finer grind, then hotter water, then more contact |
| `over` | Over-extracted | coarser grind, then cooler water |
| `uneven` | Uneven extraction (channeling, bad bed, uneven grind) | pour gentler, reduce agitation, level bed; grinder if persistent |
| `dilute` | Balanced but too weak | tighter ratio, or one more pour |
| `heavy` | Balanced but too strong | looser ratio, or one fewer pour |
| `masked` | Delicate notes not showing, taste is balanced | ambiguous: temperature either way, grind slightly coarser for clarity, water, freshness |
| `water` | Water is flattening or sharpening the cup | change water (not a recipe change) |
| `age` | Beans too old or too fresh | no recipe fix; flag it and adjust bloom |
| `gear` | Dirty equipment, worn burrs | maintenance, not a recipe change |
| `expectation` | The cup is fine; the notes on the bag are a stretch | no change; set expectations |

`masked` is the honest home of the Geisha example. It is allowed to stay ambiguous.

### 5.2 Questions

Each question is data: wording, answer options, an example for each option, and a likelihood table saying how likely each answer is under each hypothesis. Questions are written for people who don't know the vocabulary, with **anchored examples** instead of jargon:

- **Overall:** loved it / ok / not great.
- **Balance:** "sharp and sour, like biting a lemon" / "balanced and sweet" / "bitter or dry, like strong tea or dark chocolate" / "both sharp and bitter" / "flat, not much of anything".
- **Finish:** "clean and sweet" / "drying, puckery" / "bitterness that lingers" / "disappears quickly".
- **Body:** watery / about right / heavy.
- **Notes:** per bean note: tasted it / hint / not at all.
- **Sweetness:** was there any? yes / a little / no.
- **Observations (from the brew screen, not asked if already logged):** drawdown time against target; bed after brewing (flat / uneven / dark ring or crater); clumps or visible dry patches.
- **Context (asked once, remembered):** water (tap / filtered / bottled / not sure), bean age (taken from roast date), grinder.
- **Cooling:** "did it taste different as it cooled?" (low weight, our own hypothesis, unverified).

### 5.3 Choosing the next question

- Start from priors set by the recipe and bean (for example, a drawdown far off target shifts weight to `under`, `over` or `uneven` before any question is asked).
- Each answer multiplies the hypothesis weights by that answer's likelihood and renormalises.
- Ask the question with the highest **expected information gain** over the remaining hypotheses (the one whose answers best separate them). Never repeat a question, and skip questions already answered by logged data.
- Stop when the top hypothesis is clearly ahead, or after five questions, whichever comes first. Novices should rarely face more than three or four.

### 5.4 The suggestion

The output is one recommendation with its reasoning, never a list of things to try at once:

1. **What I think is happening**, in plain words, with a confidence label.
2. **One change** (lever, direction, size) with the reason tied to what the user said ("you said it was sharp and drained in 2:10, so I think the water ran through too fast. Try 2 clicks finer.").
3. **What to look for next time**: the specific signal that shows it worked (sourness down, finish sweeter).
4. **If it doesn't help**: the next lever, so the user knows the path.
5. **When confidence is low**, say so. Where the top two hypotheses recommend *opposite* directions (the temperature case), suggest the change from the more likely one, label it a **test**, and ask the user to compare it side by side with the previous cup before the next round.

Rules:
- Exactly one change per assisted suggestion.
- Never suggest a change that is out of range or would undo the last accepted change.
- Step sizes shrink as history accumulates and after a reversal (see `engine.md` section 7).
- Non-recipe causes (`water`, `age`, `gear`, `expectation`) produce advice, not a parameter change, and we say so honestly rather than inventing a tweak.

### 5.5 Worked example: the Geisha that didn't sing

Recipe: washed Geisha, light roast, notes jasmine, bergamot and peach, 20 g in 300 g at 94 °C, drawdown 2:50 (on target), roasted 12 days ago.

User answers: overall "ok"; balance "balanced and sweet-ish, a bit flat"; body about right; notes: none came through; finish "disappears quickly"; bed flat and even; water "filtered, not sure"; no change on cooling.

Reasoning: drawdown on target and bed even lower `uneven`, `under` and `over` (balanced, no sharpness, no dryness). The cup is neither thin nor heavy. That leaves `masked`, `water` and `age` ahead, with `expectation` behind. Freshness is fine for a light roast. Water is unknown.

What the app says: "Your brew looks well-extracted and balanced, so the flavours are probably there but quiet. I can't tell from one cup whether the water is flattening it or whether it needs a small tweak. First, check your water: if it's very soft or very alkaline, that can flatten delicate coffees (here's how to check). If your water is fine, try 2 °C cooler as a test and taste it next to this cup." The confidence label is low, and the temperature direction is flagged as disputed. The result (did the user prefer the new cup?) is stored and later used to adjust the weights.

Why this is better than guessing: it avoids confidently telling a novice to change the temperature in one direction on thin evidence, it surfaces a cause (water) the user might never consider, and it turns the uncertain case into an experiment that generates data.

## 6. Contract

Pure TypeScript, deterministic, no I/O. Question bank, hypothesis catalogue and likelihood tables are versioned data that the module receives.

```ts
type Answer = string | number | Record<string, string>

interface DiagnoseInput {
  recipe: Recipe                       // the version brewed
  bean: BeanAttrs
  brew: { actualTimeS?: number; yieldMl?: number; observations?: Observation[] }
  answers: Record<QuestionId, Answer>  // answered so far
  context: { water?: WaterInfo; beanAgeDays?: number; grinder?: GrinderRef }
  history: BrewResult[]                // earlier brews of this lineage, including past suggestions and outcomes
  bank: { version: string; questions: Question[]; hypotheses: Hypothesis[] }
}

type DiagnoseOutput =
  | { type: 'question'; question: Question; why: string }       // plain-language reason for asking
  | { type: 'result'; result: Diagnosis }

interface Diagnosis {
  hypotheses: { id: HypothesisId; share: number }[]             // ranked, shares sum to 1
  confidence: 'low' | 'medium' | 'high'
  suggestion:
    | { kind: 'change'; param: string; from: number; to: number; reason: string;
        test: boolean; lookFor: string; ifNot: string }
    | { kind: 'advice'; topic: 'water' | 'age' | 'gear' | 'expectation'; text: string }
  bankVersion: string
}
```

Manual tuning does not use `diagnose`. It uses the pure helper `describeEffect(param, direction)` for hints and `diffRecipes(before, after)` for history.

## 7. Data captured (the learning loop)

Every tuning round stores, on the brew:

- the questions asked and the answers given, with the question-bank version;
- the hypothesis shares and confidence at the time;
- the suggestion made, whether the user accepted, modified or ignored it;
- for manual changes, the diff;
- on the **next** brew, whether the user's overall rating improved (the outcome of the suggestion).

That makes the dataset we lack: cause guessed, change made, result. After enough of it we can compare the hand-set likelihoods against what actually helped and replace them with learned weights, using the leave-one-out test described in `engine.md`. Until then the weights are our best reading of public guidance.

## 8. Tests

Table-driven scenarios, written before the module:

1. `sour + thin + drawdown 2:00` ranks `under` first and suggests a finer grind.
2. `bitter + drying + drawdown 4:10` ranks `over` and suggests coarser, with `uneven` below it.
3. `sour and bitter + uneven bed` ranks `uneven` first and suggests a technique change, not grind.
4. `balanced + weak` ranks `dilute` and suggests a tighter ratio or one more pour.
5. The Geisha example above returns `masked`/`water` ahead, low confidence, and a test-labelled suggestion (or water advice when water is unknown).
6. `old beans + flat` returns `age` as advice, not a parameter change.
7. Invariants: at most one parameter change; the suggested value is within range; never reverses the last accepted change; question selection never repeats a question; every `question` result includes a reason.
8. Stable ordering for ties, so results are deterministic.

## 9. Open questions

- Question wording and answer anchors need testing with real novices before we trust them. Plan: try the flow on a few friends and compare their answers with what an experienced person says about the same cup.
- Should the app offer a "taste it side by side" guided A/B step explicitly, or leave it as advice?
- How should assisted tuning behave for AeroPress and espresso? Different hypothesis catalogues; separate research needed.
- Do we want a short "calibrate your palate" mini-exercise (taste a deliberately under- and over-extracted cup) to improve answer quality? Nice for novices, but it adds friction.
