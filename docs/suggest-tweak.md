# Barista: "Suggest a tweak"

Status: spec draft, 2026-10-19. Nothing here is implemented. Model, cost and eval are in `ai-notes.md` (Claude Haiku 5.5 at `medium` effort, about $0.50 per 1,000 suggestions; prompt version 2). The prompt, schema and guardrails already exist in `supabase/functions/suggest-tweak/suggest.ts`.

## 1. What it does

On the Recipe screen, under the last brew of a bean, a button asks Claude what to change next time. Claude reads the last brew (numbers, chips, timer, note) and answers with **one or two** changes, each on a different problem (extraction, strength or balance), a reason in plain words, and what to look for. Two changes only come when the brew shows two separate problems, such as sour and watery. Small complaints get one small change. One tap applies it to the recipe on screen. Nothing runs unless the person taps the button.

V60 only, like the rest of the app today.

**Rollout: Robin Jain only.** The feature is behind a per-person flag and is on for one account at first: profile `ae9cdb8f-bbfd-412f-b2b8-ea1c3e04509a` (Robin Jain, the account with the Dukorere draft). Everyone else sees no button, and the function refuses them. See 1.1.

### 1.1 Feature access

There is no feature-flag system yet, so this adds a small one that later features can reuse:

```sql
create table public.feature_access (
  user_id uuid not null references public.profiles (id) on delete cascade,
  feature text not null check (feature in ('suggest_tweak')),
  granted_at timestamptz not null default now(),
  primary key (user_id, feature)
);
alter table public.feature_access enable row level security;
-- People can see their own flags. Nobody can write them from the app: grants are made in SQL.
create policy "feature_access: owner reads" on public.feature_access
  for select to authenticated using (user_id = (select auth.uid()));

-- Whether the caller has a feature. Used by claim_suggestion and the Edge Function.
create function public.has_feature(name text) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.feature_access where user_id = auth.uid() and feature = name)
$$;

-- Robin Jain. A no-op on databases where that profile doesn't exist (local, branches).
insert into public.feature_access (user_id, feature)
select id, 'suggest_tweak' from public.profiles where id = 'ae9cdb8f-bbfd-412f-b2b8-ea1c3e04509a'
on conflict do nothing;
```

- **Grants by profile id, not by name.** Display names can change and aren't unique.
- **The server decides.** The Edge Function calls `has_feature('suggest_tweak')` before anything else and answers 403 `not_enabled` when it's false. `claim_suggestion()` also returns -1 without the flag, so the cap can't be reached around the function.
- **The app only hides the button.** It reads the person's own rows from `feature_access` once, alongside the profile, and shows the button only with `suggest_tweak`. A person without the flag sees nothing new: no button, no privacy line.
- **Opening up later** is one SQL insert per person, or a migration that grants everyone. Nothing in the app changes.
- **Local dev:** the mock API (`src/dev/mockApi.ts`) turns the flag on for the dev user, so the card can be built and tested without a database.

## 2. When the button shows

The button shows on the Recipe screen when all of these hold:

| Condition | Why |
|---|---|
| The person has the `suggest_tweak` feature (1.1) | Rollout to Robin Jain only |
| This bean has a working recipe (draft) for V60 with a `lastBrew` | "Tried once" |
| `lastBrew.recipe` is present | The numbers that were brewed. Results saved before the app kept them have none, so there's nothing to change from. |
| `lastBrew` has at least one taste chip or a note | A skipped log says nothing about the cup |
| Not brewing (the timer isn't running) and on the Recipe view | Same as `LastBrewCard` today |

The draft's `choices` hold the brewed balance and strength: the log screen saves the brewed choices with the result.

If the conditions don't hold, the button is not shown at all (no disabled button). Of today's 4 prod drafts, only Dukorere qualifies. The others start qualifying from their next logged brew.

## 3. Flow

```
Recipe screen
└─ Last brew card
   ├─ It was weak, flat · You wanted more sweetness, more body
   ├─ "Need to go finer next time and look into how to bring out the notes more."
   ├─ 16.9 g · 270 g · 92 °C · 711 µm
   └─ [ ✦ Suggest a tweak ]        ← tap
              │
              ▼
        Thinking…  (button disabled, ~3 s)
              │
   ┌──────────┼───────────────┬──────────────┐
   ▼          ▼               ▼              ▼
 change      lock           advice         error
```

### 3.1 States of the card

| State | What the person sees | Actions |
|---|---|---|
| Ready | "✦ Suggest a tweak", and below it in small text: "AI reads this brew and your note." | Tap: ask |
| Thinking | Button reads "Thinking…", with a spinner, and can't be tapped | None. Leaving the screen is fine and the answer is still saved (3.4). |
| Change | Headline in the person's own units: "Try 2 clicks finer" · "Try 1 °C cooler" · "Try 5 s longer between pours" · "Try 1:15.5 (262 g water)" · "Try a sweeter balance" · "Try one more pour (stronger)". Two changes read as "Try 2 clicks finer and 1:15.5". When `test` is set, the headline has a "Test" tag, and the reason says to taste it next to this cup. Then the reason, then "Look for: …" | **Apply to recipe** (applies both) · Not now |
| Applied | The same card with "Applied · Undo". Each changed value on the recipe gets the usual edited dot. | Undo (undoes both) |
| Lock | "This one sounds like a keeper." and the reason. "Brew it the same way, and turn on Lock in when you log it." | OK |
| Advice | "Try this first:" and the reason. No change to apply. | OK |
| Can't apply | The change is impossible here (already the strongest, or at a grinder or temperature limit): show the reason with "That's already at the limit, so there's nothing to change here." | OK |
| Offline | "You're offline. Suggestions need a connection." | Try again |
| Daily limit | "That's all your suggestions for today. More tomorrow." | None |
| Failed | "Couldn't get a suggestion just now." | Try again (once; after that the button is gone until the screen is reopened) |

"Not now" folds the card back to a "See suggestion" link, so it can be reopened without asking again.

### 3.2 One suggestion per brew

A suggestion belongs to the brew it read (keyed on `lastBrew.brewedAt`). Opening the Recipe screen again shows the saved suggestion straight away, with no new request and nothing counted against the cap. A new logged brew means a new suggestion can be asked for. There is no "try another idea" in v1, because asking again until you like the answer isn't dialing in.

### 3.3 Applying a change

The change is applied to **the value that was brewed**, not to whatever is on screen, so the step means what Claude meant. Each change becomes an absolute value and goes through the existing edit helpers, so coffee, water and ratio stay consistent:

| Direction | New value | Applied with | Rounded to |
|---|---|---|---|
| finer / coarser | `brewed.grindUm ∓ amount` | `setGrind` | The grinder's own step when calibrated (at least one step), else 5 µm |
| hotter / cooler | `brewed.tempC ± amount` | `setTemp` | 0.5 °C, shown in °F when that's the person's unit |
| tighter / looser | `brewed.ratio ∓ amount` | `setRatio(…, 'coffee')`: coffee stays, water follows | 0.5 |
| sweeter / brighter | `balance ∓ amount`, kept within -1 to 1 | `{ ...choices, balance }` | 0.1 |
| stronger / lighter | one step: light ↔ medium ↔ strong | `{ ...choices, strength }` | |
| longer / shorter gaps | every pour after the first starts `amount` seconds later (or earlier) than the one before it did, so the 2nd moves by 1×, the 3rd by 2×, and so on; water amounts unchanged | `setPours` with the brewed pours' `toG` and new `atS`; this makes them custom pours | 5 s; a gap is never shorter than 20 s |

With two changes, each is applied in turn to the result of the other. They are always on different axes, so the order doesn't matter, except that custom pours (from a gap change) always have the last word on water, as with any edit today.

The result is then kept within `LIMITS` (`engine/overrides.ts`). The headline is computed from the rounded value, so it always shows what Apply will set: "2 clicks finer" is two clicks on this person's grinder.

- **Already changed on screen.** If the person already edited that value away from what was brewed, the card says "You've already changed this to 3.5 clicks" and Apply sets the suggested value anyway.
- **Undo** puts the choices back exactly as they were before Apply, including any other edits.
- **Nothing is saved on Apply.** As with any edit, the new recipe is saved when the person starts brewing (`startBrewing` already saves the draft).

### 3.4 Where it runs and what is sent

The app calls the Edge Function `suggest-tweak` with `{ beanId, method: 'v60', brewedAt }`. Everything else is read on the server, as the caller (RLS applies):

0. `has_feature('suggest_tweak')`. If false: 403 `not_enabled`, with nothing else read and no Claude call.
1. Read the caller's draft for that bean and method. If there is none, or it isn't eligible (section 2): 409 `not_eligible`.
2. If `brewedAt` doesn't match the draft's `last_brew.brewedAt`, the phone has a brew that hasn't synced yet: 409 `stale`. The app flushes the outbox and asks again once.
3. If the draft already has a suggestion for that `brewedAt`, return it: 200 with `cached: true`, with no Claude call and nothing counted.
4. `claim_suggestion()`: 20 a day per person, the same pattern as `claim_scan`. If the day's limit is used up: 429 `daily_limit`.
5. Build the input from the draft and the bean (origin, process, roast level, roaster's notes) and call Haiku. Names, roaster, bean name and friends' data are never sent.
6. Check the answer with `readSuggestion` (cuts oversized steps down, drops quotes that aren't in the note). A refusal, an incomplete answer or JSON that won't parse: 502 `failed`, logged.
7. Save the suggestion on the draft (3.5) and return it.

The function logs one line per call, like `scan-bag`: outcome, model, effort, ms and tokens, and nothing personal.

### 3.5 What is stored

A new column, `recipe_drafts.suggestion jsonb`, written by the function:

```ts
interface StoredSuggestion {
  forBrewedAt: string            // the brew it read
  kind: 'change' | 'lock' | 'advice'
  changes: { direction: Direction; amount: number | null }[]   // 0-2, different axes
  test: boolean
  reason: string
  quote: string | null
  lookFor: string
  plan: 'none' | 'agrees' | 'differs'
  model: string; effort: string; promptVersion: string
  createdAt: string
  appliedAt: string | null       // set by the app on Apply, cleared on Undo
}
```

To learn whether suggestions help (`ai-notes.md` §9) without keeping a brew history:
- When the next brew is logged, the log screen copies a short `followed` record into the new result: `{ directions, applied: boolean }`, taken from the suggestion for the previous brew.
- That brew's tastes and its "compared with last time" answer then show how it went.

Setting `appliedAt` is a direct update of the draft row and is best effort. If it fails offline, it's skipped. It's for measurement only and never blocks anything.

## 4. Copy

- **Button:** "✦ Suggest a tweak". Small text below it: "AI reads this brew and your note."
- **Headlines:** start with "Try…" and say the change in the person's units ("2 clicks finer", "1 °F cooler"). Never "AI says".
- **Reason:** shown as Claude wrote it. If it quotes the note, the quote is in quotation marks.
- **Plans:** when the person wrote a plan and Claude agrees, the reason says so ("Your plan to go finer fits that."). When Claude differs, the reason names their plan. Applying is still their choice.
- **Profile:** a line on the profile page under privacy: "Suggest a tweak sends your last brew and its note to Anthropic's Claude to work out a suggestion. Nothing else about you is sent."

## 5. Tests

- **Eligibility** (pure): shown with recipe and chips; shown with recipe and note only; hidden without `recipe`; hidden for a skipped log; hidden while brewing.
- **Applying** (pure, table-driven): each direction gives the right choices. Grind snaps to grinder steps and always moves at least one step. Ratio keeps coffee. Balance and strength are limited at the ends ("Can't apply"). "Already changed on screen" still sets the suggested value. Undo restores the exact choices.
- **Recipe screen** (component, mocked function): ready → thinking → change → apply → undo; cached suggestion shown on reopen without a call; offline, daily limit, failed with one retry; `stale` triggers an outbox flush and a single re-ask.
- **Log screen:** `followed` is written when the previous brew had a suggestion, with `applied` true or false.
- **SQL** (`supabase/tests/suggest.test.sql`): `claim_suggestion` cap and reset by day; the suggestion column is owner-only through RLS.
- **Feature access** (SQL): `has_feature` is true only for a granted user; people can read their own rows and nobody else's; nobody can insert, update or delete a row from the app; `claim_suggestion` returns -1 without the flag.
- **Feature access** (app and function): the button is hidden without the flag, even on an eligible draft; the function returns 403 `not_enabled` without calling Claude.
- **Function:** the not-eligible, stale, cached, daily-limit and failed paths. The eval (`npm run suggest-eval`) stays the check for prompt or model changes.

## 6. Build order

1. Migration: `feature_access`, `has_feature()` and the grant for Robin Jain; `recipe_drafts.suggestion`, `suggest_usage` and `claim_suggestion()`, with SQL tests.
2. Edge Function `suggest-tweak` using `suggest.ts`, plus its function tests. Deploy it, with the existing `ANTHROPIC_API_KEY` secret.
3. Pure helpers: `canSuggest(draft)` and `applySuggestion(choices, brewed, suggestion, grinder)` returning `{ choices, headline } | { cantApply }`, with tests.
4. Recipe screen: the card states in `LastBrewCard` (or a `SuggestCard` under it), Apply and Undo.
5. Log screen: `followed`. Profile: the privacy line.
6. Try it on the Dukorere draft in the dev app, then in prod while signed in as Robin Jain. Check that another account (for example Mario's) sees no button and gets 403 from the function.

## 7. Open questions

1. **Daily cap:** 20 suggestions a day per person. Is that right? Each one costs about $0.0003, so the cap is about abuse, not money.
2. **Lock answers:** should a "lock" answer link straight to locking, without brewing again? Today locking only happens on the log screen, so the spec says "turn on Lock in when you log it".
3. **Older drafts:** drafts whose `lastBrew` has no numbers could use the draft's saved choices as "what was brewed". That would make 3 more of today's drafts eligible, at the risk of being slightly wrong if the person edited before brewing. The spec says no.
4. **When it shows:** should the button also appear on the log screen, right after saving a brew? The spec keeps it on the Recipe screen only, so it runs when the person is about to brew again.
