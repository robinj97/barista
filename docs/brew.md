# Barista: the Brew tab

Status: **set-up and recipe built** (this doc). Brewing mode, logging and saving are the next PR.

## The loop

1. **Set up** (`/brew`): bean, method, goal, notes to bring out, gear.
2. **Recipe** (`/brew/recipe`): the engine's suggestion with the grind in your grinder's units.
3. **Brewing** (next): the pour list with tick-offs, screen kept awake, no live timer.
4. **Log it** (next): drawdown time, yield, a rating. Saving creates your first recipe for the bean and the brew, which is the data assisted tuning learns from.

## Decisions

| Topic | Decision |
|---|---|
| Scope of the first PR | Set-up and recipe together. Nothing is saved yet. |
| Goal control | Three chips (Sweeter, Balanced, Brighter) mapping to -0.6, 0 and +0.6, plus Light, Medium, Strong. A "Fine-tune" slider (-1 to +1) under the chips gives exact control; a value between the presets leaves no chip selected. |
| Bring out | The bean's own tasting notes as toggles (up to six). They nudge the balance (see `engine.md`). Switching bean clears them. |
| No grinder | An inline "Add your grinder" button opens the same picker as Profile. Until then the grind shows in microns. |
| Opening state | The bean you came from on its page (`Start dialing in` links to `/brew?bag=<id>`), otherwise your newest bag. Once brews are saved this becomes the last brewed bean. No beans: "Add a bean first". |
| Methods | V60 only. AeroPress and Espresso appear disabled as "soon". If your profile default is not V60, a line says V60 is used. |

## How it works

- Every choice lives in the URL (`bag`, `balance`, `strength`, `notes`, `grinder`, `filter`, `cups`), so the back button, reloads and links all agree. `src/brew/params.ts` reads and writes it and ignores junk.
- The recipe screen builds the engine input from your bag, choices and filter (`src/brew/buildInput.ts`), calls `suggest()` on every render (it is instant and pure) and shows the result. `today` is fixed when the screen opens so the recipe does not change under you.
- **Grind in your units:** the engine gives microns; `micronsToSetting` converts using the grinder's calibration and your personal offset. The screen says "Rough estimate" when the confidence is low (for example the K7), warns when the result is outside the grinder's known range or at its limit, and falls back to microns for grinders without calibration data or when you have no grinder.
- **Confidence pill** in plain words: low "Starting point, expect 2 to 3 brews", medium "Informed by similar brews", high "Based on your own recipe". Tapping it, or "Why these numbers", opens every reason with its source (method, general guidance, your recipes, assumed) and the engine's confidence sentence.
- **Cups** (1 to 4) rescales dose and water at 10 g of coffee per cup. Temperature shows in your unit.
- Recipes for similar beans are not available yet (nothing is saved), so the engine runs on guidance alone and says so.

## Still to do (next PR)

- Brewing mode (pour tick-offs, wake lock) and the log screen.
- Saving a recipe, its first version and the brew in one transaction, with the offline queue from `architecture.md` section 6.
- Opening on the last brewed bean once brews exist.
- Feeding your locked and friends' recipes into the engine's `context`.
- Remembering the last grinder and filter used.
