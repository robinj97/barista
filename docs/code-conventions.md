# Barista: code conventions

How the code is organised, so new work reuses what exists instead of copying it. If you are about to paste a block of markup or logic a second time, look here first.

## Shared UI (`src/components`)

| Need | Use | Notes |
|---|---|---|
| A pill button | `<Button variant size>` (`primary`, `soft`, `accent`, `quiet`; `md`, `lg`, `xl`) | A link that looks like a button: `className={buttonClass(opts, true)}` from `buttonStyle.ts`. Margins stay with the caller. |
| A small grey title above a group of cards | `<SectionHeading>` | |
| A loading state | `<LoadingNote>` | |
| "Are you sure?" | `<ConfirmSheet>` | Pass the sentence as children. |
| A bottom sheet | `<Sheet>` | Choices and short forms live in sheets, not new pages. |
| A labelled number (Coffee 20 g) | `<Spec>` inside `<SpecGrid>` | Pass `onEdit` to make it editable. |
| A round back arrow | `<BackLink>` | |
| An (i) explaining something | `<InfoButton>` | |
| An on/off toggle | `<Switch>` | |
| One or many chips | `<ChipGroup>` / `<MultiChipGroup>` | |

Domain pieces: `<BeanHeader>` (a screen about one bean), `<PourList>` (planned, running and a friend's pours), and in `src/brew/format.ts` `recipeText` / `recipeSummary` (a recipe's numbers as text, in the person's temperature unit; never format `°C` by hand).

## Principles we hold ourselves to

- **One place for each fact.** Styling in the primitives, number formatting in `format.ts`, who-sees-what in the database rules and the single loaders (`loadLockedRows`), recipe linking rules in `brew/edits.ts`, the engine's guidance in `engine/`. The screen only composes.
- **Small units with one job.** A screen reads data (hooks), decides (pure functions in `brew/`, `beans/`, `engine/`) and renders (components). Rules worth testing live in plain functions with unit tests, not inside components.
- **Depend on narrow interfaces.** Screens and hooks use the `Api` the app provides (real or mock); new data access is added to the area it belongs to.
- **Extend by adding, not editing.** A new variant of a button, a new kind of confirm, a new chip list is a new value passed to a primitive, not a copy of its markup.
- **Behaviour changes need a test; refactors keep the tests green and do not change them.**

## The data layer (`src/data`)

- **`api.ts`**: the backend, in five areas that stand alone: `ProfileApi`, `GearApi`, `BeansApi`, `RecipesApi`, `FriendsApi` (and `Api`, all of them). A new call goes in the area it belongs to.
- **`supabase/`**: the real implementation, one file per area, with `shared.ts` (`fail`, `currentUserId`, `toBean`) and `lockedRows.ts` (the one loader for yours and friends' locked recipes). `supabaseApi.ts` only composes them. The fake in `dev/mockApi.ts` implements the same `Api`.
- **`hooks/`**: React Query hooks, one file per area, each asking only for its area's API (`useBeansApi()`, `useFriendsApi()`, ...), so a bean hook cannot call a friends method. `keys.ts` is the one place query keys are written. Screens import from `../data/hooks`.
- **Two helpers do the repeated work.** `useOptimisticMutation` (show the change at once, roll back on failure, refetch what it touched) and `saveOrQueue` (send a write, or keep it on the phone if the connection is down). New mutations use them instead of repeating the dance.
## Screens: container, model, parts

A big screen is split by job, as the recipe screen is (`src/pages/RecipePage.tsx` and `src/recipe/`):

- **The page** loads data and works the answer out (a few dozen lines): loading and not-found states, then `buildRecipeModel`.
- **The model** (`recipe/model.ts`) is everything the parts need, computed once and handed down as one prop, so parts neither take a long list of props nor recalculate.
- **A hook per behaviour** (`useBrewRun`: the timer and the moves between planning, brewing and logging).
- **Small parts that do one thing** (`RecipeView`, `PoursView`, `GrindCard`, `SizeControls`, `RecipeEditSheets`, `ConfidencePill`), each tested on its own.
- **The screen** (`RecipeScreen`) only owns what is on screen: which view, which sheet is open.

Follow the same shape when another screen grows past a couple of hundred lines.
