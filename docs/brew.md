# Barista: the Brew tab

Status: **set-up, recipe, brewing and logging built.** Feeding saved recipes back into the suggestion is the next piece.

## The loop

1. **Set up** (`/brew`): bean, method, goal, gear.
2. **Recipe** (`/brew/recipe`): the engine's suggestion with the grind in your grinder's units.
3. **Brewing** (the Pours view of the recipe screen): the timer, the next pour, tick-offs, screen kept awake.
4. **Log it** (`/brew/log`): how it tasted, compared with last time, yield, notes; optionally lock the recipe in with a rating.

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

The screen has two views behind a Recipe / Pours toggle under the ring: Recipe (values, grind, cups) and Pours (the schedule and its editor). A swipe between pages was rejected: it is not discoverable, collides with the iOS back-swipe and with sheets and sliders. Every value card, including the grind card, is tappable.

Tap a value to edit it in a sheet (steppers or type; applies on Done; "Back to the suggestion" puts that value back). Edited values get a dot and the pill reads "Your edits · started from a suggestion". "Reset all to the suggestion" clears every edit. The engine still builds the rest around your numbers (`engine/overrides.ts`), and "Why these numbers" lists what you set as "You set this". Limits guard against typos only (coffee 5 to 60 g, water 30 to 1500 g, ratio 1:8 to 1:30, 50 to 100 °C, up to 12 pours).

How the numbers link (`src/brew/edits.ts`):

- **Coffee:** water follows the ratio you see. A switch in the sheet keeps the water instead, so the ratio changes.
- **Water:** your coffee stays and the ratio changes; or switch to **Keep: Ratio** and the coffee is calculated, so you can brew for a target amount of water (400 g at 1:16 is 25 g of coffee). **Ratio:** your coffee stays and the water changes; or **Keep: Water** and the coffee is calculated. Calculated coffee is rounded to 0.1 g, and a target needing less than 5 g or more than 60 g is refused. The switch is per edit and resets each time you open a sheet. Water is what you pour; the amount in the cup is smaller (coffee holds back about twice its weight), and there is no cup-yield input yet.
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

## Brewing and logging

**Start.** "Start brewing" sits under the coffee stepper on the Recipe view. It saves your working recipe and opens the Pours view, which has a **Start timer** button: tap as the first pour begins.

**Without the timer.** Under Start timer there is **Finished brewing**, for people who do not use it. It does exactly what the drawdown tap does (the coffee comes out of the bag, a new bag becomes dialing in) and goes to the log, with no total time recorded.

**While brewing.** The timer follows the schedule by itself, with no taps between pours. A big timer, what is happening ("Pour 2: up to 120 g", then "Pour 3 in 0:32" between pours, then "Drawdown: let it drain"), the ring and list moving on at each scheduled time, and a beep as each pour begins if sounds are on. The current pour stays highlighted until the next one begins and is ticked at that moment. The last one is ticked when its water has gone in, estimated at 4 g/s (`src/brew/progress.ts`), which is also when the screen switches to the drawdown. The clock shows whole seconds, so it reaches 0:45 exactly at 45 s. The one remaining tap is **Drawdown finished**, because only you can see when the bed is dry. Total time is measured from the wall clock, and the session lives in `localStorage` (`barista.brew-session`), so closing the app or locking the phone loses nothing; reopening the recipe picks the timer up. The screen is kept awake with the Wake Lock API where the browser has it (iOS Safari does, from 16.4). The recipe cannot be edited while brewing, and cancel asks twice. The optional beep is off by default, switched in Profile > Brewing, and stored on the device (browsers only allow sound after a tap, so the timer's start tap enables it).

**The bag.** When the drawdown ends (the tap on **Drawdown finished**) the coffee is spent, so the dose is taken out of "Left in the bag" (never below 0; skipped if you never said how much was in it) and a bag that was *New* becomes *Dialing in*. A cancelled brew changes nothing. Locking a recipe in marks the bag *Locked*. The changes show at once and, offline, wait in the same queue as the other writes (the newest amount wins).

**Log.** The log is a gate: once a brew is finished (the drawdown tap or **Finished brewing**), every route sends you to `/brew/log` and the tab bar is hidden until it is done, so you cannot forget it. The finished brew lives in `localStorage`, so closing the app and coming back hours later lands on the same screen; data refreshes, a dropped connection or the bag update do not move you off it. If the bag is gone or the beans cannot be loaded the screen says so (with Try again, or Discard this brew), so you are never stuck.

It asks, all as chips where more than one can be picked:

- **How did it taste?** Good, Sour, Bitter, Weak, Heavy, Astringent, Flat. *Good* stands alone (picking it clears the rest, picking another clears it). At least one is needed to save.
- **What do you want to improve next time?** More sweetness, More acidity, More body, More clarity, Less bitterness, Less sourness, Stronger, Weaker, *Nothing, it's good* (stands alone).
- "Compared with last time: sweeter, more acidity, about the same" (only when there is a previous brew; this is the data that tests whether the goal slider does anything, stored with the first-pour size), yield in the cup, notes.
- **Lock this as my recipe** with the rating (rating is only asked when locking).
- **Skip, I didn't taste it**: records the brew itself (time, numbers, what changed) with no taste, and lets you on.

**The reminder.** The next time you open that bean's recipe, a **Last brew** card sits at the top: the date, how it tasted, what you wanted, your note, the settings brewed (the grind in your grinder's units) and what changed from the brew before (coffee, water, ratio, temperature, grind direction). The same lines show under "Where you left off" on the bean page. A skipped log shows nothing. It only reminds: the app does not suggest a tweak from it (that is assisted tuning, later). Taste, improve, notes, the brewed numbers and the changes are stored on the working recipe's last brew (`recipe_drafts.last_brew`, overwritten each brew), and the taste, improve and notes are also in a locked brew's `feedback`. Brews saved earlier with a single `taste` are still read.

**What is stored.**

- **Working recipe** (`recipe_drafts`): ONE row per user, bean and method, overwritten every time (when you start brewing, and again with the brew result). It holds the Brew screen's choices and edits and the latest brew's result. No history, so the table cannot grow with half-tuned attempts.
- **Locked recipe**: toggling "Lock this as my recipe" and rating calls the `lock_recipe` function: one transaction that creates the recipe (the first time), a new **immutable** version (parent = the previous locked version), the brew with its rating, and moves the lock to it. Only locked versions are visible to friends, and locked brews are what the Library will list.
- Offline: both writes go to a queue on the phone (`barista.outbox`) and are sent on the next app start or when the connection returns. Drafts overwrite each other in the queue; locks are keyed by their brew id, so a retry cannot save twice. The screen says "Saved on this phone".

**Starting from last time.** The bean page lists "Where you left off" (the working recipe, with the last brew's taste) and any locked recipes with their stars. Tapping one opens the recipe with those settings filled in, ready to brew or tweak.

Yield is stored in the database's `yield_ml` column; 1 g of coffee is taken as 1 ml.

## Your own recipes feed the suggestion

Your locked recipe for a bean is what the next suggestion starts from: its temperature and grind (the engine's "own" source, high confidence, pill "Based on your own recipe"). The pour structure and ratio still follow the goal and strength you pick. Locked recipes for *other* beans also count as "similar beans" evidence, as the engine already supported.

**Your working recipe** replaces the locked one only when the last brew of it was marked **good** and is newer than the lock. A brew that tasted sour, bitter, weak or heavy is something to fix, not a starting point, so it is ignored here (that is assisted tuning's job, later). `src/brew/ownPriors.ts` builds the data; a recipe is worked out without any context, so it cannot be its own basis. The numbers brewed are stored in the brew session when the timer starts, so the log screen shows exactly what you brewed even if the basis changes afterwards. Friends' recipes are not used yet (no friends feature).

## Library

The **Library** tab lists the recipes you have locked in, across all beans, newest first: bean, stars, how many times you brewed it (all versions), dose, water and temperature. It differs from the bean page in that a recipe stays here when its bag is empty or gone, and it is where archiving lives. Tap a row to start a brew from it (the same pre-fill as the bean page). **Archive** asks first; it hides the recipe from friends and your lists but keeps your brews (the row is flagged `archived_at`, never deleted). A **Mine / Friends** switch will come with the friends feature.

## Brew starts where you left off

With nothing chosen in the link, Brew opens on the **bean you brewed most recently** (your most recently used working recipe whose bag is not finished), and uses the **grinder and filter of your last brew** instead of "first grinder, default filter". With no history it falls back to the newest bag, your first grinder and your default filter. "Start brewing" saves the gear actually in use with the working recipe so the next brew picks it up (it follows you across devices, since it lives with the recipe). Finished bags are never picked on their own and are left out of the bean picker.

## Still to do

- Friends and invites, then friends' locked recipes in the suggestion and the Library.
- Assisted tuning from logged brews ("it tasted sour, what should I change?").
- Opening Brew on the last brewed bean, and remembering the last grinder and filter.
- Checking "sweeter or more acidity" answers against the first-pour change, once there are enough brews.
