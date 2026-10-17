# Barista: the Brew tab

Status: **set-up and recipe built** (this doc). Brewing mode, logging and saving are the next PR.

## The loop

1. **Set up** (`/brew`): bean, method, goal, gear.
2. **Recipe** (`/brew/recipe`): the engine's suggestion with the grind in your grinder's units.
3. **Brewing** (next): the pour list with tick-offs, screen kept awake, no live timer.
4. **Log it** (next): drawdown time, yield, a rating. Saving creates your first recipe for the bean and the brew, which is the data assisted tuning learns from.

## Decisions

| Topic | Decision |
|---|---|
| Scope of the first PR | Set-up and recipe together. Nothing is saved yet. |
| Goal control | One always-visible slider (-1 to +1) three preset pills on top (**Sweeter, Balanced, More acidity** = -0.6, 0, +0.6) and the slider below for exact control, with a small grey readout under it ("Balanced", "40% sweeter", "60% more acidity"). Between presets none is selected. The pills sit above the slider with space between, so dragging does not hit them. Strength is Light, Medium, Strong chips. |
| Editing | Everything on the recipe is editable: coffee, water, ratio, temperature, total time, grind and each pour. You accept a suggestion and change what you like, or build the whole recipe by hand; both use the same screen. |
| Bring out | **Removed.** The first version let you tick the bean's tasting notes, which nudged the balance by about 7 g on the first pour. See "Does the goal change the taste?" below: the method can only lean a cup sweeter or towards more acidity, it cannot aim at a specific flavour, and the nudge was far too small to taste. Old links that still carry `notes=` are ignored. |
| No grinder | An inline "Add your grinder" button opens the same picker as Profile. Until then the grind shows in microns. |
| Opening state | The bean you came from on its page (`Start dialing in` links to `/brew?bag=<id>`), otherwise your newest bag. Once brews are saved this becomes the last brewed bean. No beans: "Add a bean first". |
| Methods | V60 only. AeroPress and Espresso appear disabled as "soon". If your profile default is not V60, a line says V60 is used. |

## How it works

- Every choice lives in the URL (`bag`, `balance`, `strength`, `grinder`, `filter`, `cups`, plus any edits: `dose`, `water`, `ratio`, `temp`, `grind` in µm, `time` in seconds and `pours` as `atS:toG` pairs), so the back button, reloads and links all agree. `src/brew/params.ts` reads and writes it and ignores junk.
- The recipe screen builds the engine input from your bag, choices and filter (`src/brew/buildInput.ts`), calls `suggest()` on every render (it is instant and pure) and shows the result. `today` is fixed when the screen opens so the recipe does not change under you.
- **Grind in your units:** the engine gives microns; `micronsToSetting` converts using the grinder's calibration and your personal offset. The screen says "Rough estimate" when the confidence is low (for example the K7), warns when the result is outside the grinder's known range or at its limit, and falls back to microns for grinders without calibration data or when you have no grinder.
- **Confidence pill** in plain words: low "Starting point, expect 2 to 3 brews", medium "Informed by similar brews", high "Based on your own recipe". Tapping it, or "Why these numbers", opens every reason with its source (method, general guidance, your recipes, assumed) and the engine's confidence sentence.
- **Cups** (1 to 4) is a shortcut that rescales dose and water at 10 g of coffee per cup; the gram stepper beside it nudges the coffee by 1 g. Temperature shows in your unit.

## Editing the recipe

Tap a value to edit it in a sheet (steppers or type; applies on Done; "Back to the suggestion" puts that value back). Edited values get a dot and the pill reads "Your edits · started from a suggestion". "Reset all to the suggestion" clears every edit. The engine still builds the rest around your numbers (`engine/overrides.ts`), and "Why these numbers" lists what you set as "You set this". Limits guard against typos only (coffee 5 to 60 g, water 30 to 1500 g, ratio 1:8 to 1:30, 50 to 100 °C, up to 12 pours).

How the numbers link (`src/brew/edits.ts`):

- **Coffee:** water follows the ratio you see. A switch in the sheet keeps the water instead, so the ratio changes.
- **Water:** your coffee stays; the ratio changes. **Ratio:** your coffee stays; the water changes.
- **Pours:** the last pour is the water. Editing water or ratio afterwards rescales your pours, keeping their times.
- **Cups** clears your coffee and water edits. Picking a different bean on the set-up screen clears them. Edits are not saved until logging exists.
- **Grind** is edited in your grinder's own units when it is calibrated, otherwise in µm.
- Recipes for similar beans are not available yet (nothing is saved), so the engine runs on guidance alone and says so.

## Vocabulary: acidity, bright, sour

The third goal is called **More acidity**, which is the 4:6 method's own wording. In coffee, *acidity* (roasters also say *bright*) means the pleasant, lively, juicy tang, like orange juice. **Sour** is the unpleasant end: sharp and puckering, like a squeezed lime, and usually a sign of under-extraction.

- The goal means "more of the pleasant tang, less sugar-like sweetness". It never means "more sour".
- Assisted tuning (`tuning.md`) keeps using **sour** for the defect, which is fixed with grind, temperature or technique, never with this goal. The internal name for +1 balance in the code is still `brighter`.
- "Sweetness against acidity" is a simplification: in a cup they are not strict opposites. The method's claim is only that the first pour trades one for the other.

## Does the goal change the taste?

Be honest about what the goal chips and slider do. They move one thing: how the first 40% of the water is split between pour 1 and pour 2 (on 300 g: 40 g / 80 g at full sweeter, 60 / 60 balanced, 80 / 40 at full more acidity; the chips are 48 / 72 and 72 / 48). Temperature, grind, ratio, total water and the later pours do not change.

- The idea (a bigger first pour gives more acidity, a smaller one more sweetness) comes from Tetsu Kasuya and recipe blogs. Kasuya reportedly tested it informally; we found no controlled study that varies the first pour while measuring TDS, extraction and blind taste. One small student paper measured acidity and TDS peaking in the first 40% of a 4:6 brew, which is consistent but not a test of the split.
- So the direction is plausible and the full-slider swing may well be noticeable, but the size of the effect on taste is unproven, and pouring technique, grinder and drawdown time probably move the cup more.
- Specific flavours (vanilla, jasmine) cannot be targeted this way at all, which is why "Bring out" was removed. The engine still has a note-to-balance nudge (`engine/notes.ts`) with a hand-written, unvalidated bright/sweet list; the UI does not use it.

**How we will find out:** the logging screen (next PR) asks, after any brew with a previous brew of the same bean, "Compared with last time, was it sweeter, did it have more acidity, or about the same?", and stores it next to the first-pour change. That is the data to check whether the slider works for you and your friends.

## Still to do (next PR)

- Brewing mode (pour tick-offs, wake lock) and the log screen, including the "sweeter, more acidity or the same as last time?" question and the first-pour change it should be compared against.
- Saving a recipe, its first version and the brew in one transaction, with the offline queue from `architecture.md` section 6.
- Opening on the last brewed bean once brews exist.
- Feeding your locked and friends' recipes into the engine's `context`.
- Remembering the last grinder and filter used.
