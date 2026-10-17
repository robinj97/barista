# Barista: architecture

Status: draft for review. Nothing here is built yet except the Vite/React starter.

## 1. Decisions log

Settled in planning sessions with Robin.

| Topic | Decision |
|---|---|
| App name | **Barista** |
| Sign-in | Google SSO now; Apple later (needs paid Apple Developer account) |
| Sharing | **Friends only.** Friends are added through single-use invite links. No public links in v1. |
| Methods | V60 first, then AeroPress and espresso. The schema must be method-agnostic. |
| Visibility | Recipes are private to their owner. **Only a locked version is visible to friends.** |
| Friend recipes | A friend can save a locked recipe to their library, tweak it, save it as a duplicate with a new name, and reset it back to the original. |
| Beans | Shared catalogue (no duplicates) plus a personal library layered on top. If a friend has a bean dialed, you are told. |
| Engine | Server-side, pure TypeScript module, no LLM. See `engine.md`. |
| Server language | **TypeScript** (Supabase Edge Functions run on Deno; there is no Python/Java option there, and a TS engine can be shared with the client). |
| Equipment | Users keep a personal list of **grinders** and **filters** (drippers deferred) in their profile. Recipe screens pick from those lists in a bottom sheet (with "add" at the end). Same pattern for both. |
| Tuning | Two modes on any brew: **manual** (full control, effect hints) and **assisted** (the app asks plain-language questions, diagnoses the likely cause, suggests one change). See `tuning.md`. |
| Offline | Brewing and logging must work offline and sync later. |
| Training data | Every brew stores the exact recipe parameters used plus feedback answers, never a reference to something editable. |
| Frontend | React + Vite + TypeScript PWA on Netlify, Tailwind v4, bun. |
| Backend | Supabase (Postgres, Auth, Storage, RLS, Edge Functions). |

## 2. System overview

```
Phone (PWA, React)
  |  TanStack Query cache + IndexedDB outbox (offline)
  v
Supabase
  - Auth (Google)
  - Postgres + RLS  <- source of truth, enforces who sees what
  - Storage (bag photos)
  - Edge Functions (TypeScript)
        suggest-recipe   -> engine.suggest()
        adjust-recipe    -> engine.adjust()
```

- The browser talks to Postgres directly (through the Supabase client) for ordinary reads and writes. RLS is the security boundary, not the client.
- Invites are two database functions (`create_invite`, `accept_invite`) called over RPC, so creating the friendship and consuming the token happen in one transaction. Edge Functions exist for work that needs data the caller cannot read directly (engine aggregates). They run with the caller's JWT unless noted.
- Scaling cups, rendering the step list and converting grind units run on the client from the same pure modules, so they work offline.

## 3. Schema sketch

Illustrative, not final migrations. All primary keys are UUIDs (v7, so the client can mint them offline).

```sql
-- people ---------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table friendships (
  user_a uuid not null references profiles,
  user_b uuid not null references profiles,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)            -- one row per pair
);

create table invites (
  token_hash text primary key,       -- store a hash, never the token
  inviter_id uuid not null references profiles,
  expires_at timestamptz not null,
  accepted_by uuid references profiles,
  accepted_at timestamptz
);

-- grinders -------------------------------------------------------------
create table grinders (
  id uuid primary key,
  brand text not null,
  model text not null,
  unit_label text not null,          -- 'clicks', 'dial', 'steps'
  min_setting numeric, max_setting numeric,
  unique (brand, model)
);

create table grinder_calibration (   -- setting -> approximate microns
  grinder_id uuid references grinders,
  setting numeric not null,
  microns numeric not null,
  source text not null,              -- 'manufacturer', 'chart', 'learned'
  primary key (grinder_id, setting)
);

create table user_grinders (
  user_id uuid references profiles,
  grinder_id uuid references grinders,
  offset_um numeric not null default 0,   -- personal correction learned from feedback
  nickname text,
  primary key (user_id, grinder_id)
);

-- filters (V60 paper, same pattern as grinders) --------------------------
create table filters (                -- shared catalogue, seeded and user-addable
  id uuid primary key,
  brand text not null,
  model text not null,                -- 'T-90', 'Abaca', 'Hario V60 paper', ...
  size text,                          -- '01', '02', '03' for V60 cones
  material text not null default 'paper'
    check (material in ('paper','metal','cloth')),
  flow_class text
    check (flow_class in ('fast','medium','slow')),  -- rough, null = unknown
  bleached boolean,
  match_key text not null,            -- normalised, so 'CAFEC T-90' and 'CAFEC T90' match
  created_by uuid references profiles,
  unique (match_key, size)
);

create table user_filters (           -- "my gear": the dropdown source
  user_id uuid references profiles,
  filter_id uuid references filters,
  nickname text,
  is_default boolean not null default false,   -- preselected on new recipes
  primary key (user_id, filter_id)
);

-- beans ----------------------------------------------------------------
create table beans (                 -- shared catalogue: facts about the coffee
  id uuid primary key,
  roaster text not null,
  name text not null,
  origin text, region text, producer text, variety text,
  process text, altitude_m int,
  roaster_notes text[] not null default '{}',
  match_key text not null,           -- normalised roaster+name, for dedupe
  created_by uuid references profiles,
  created_at timestamptz not null default now()
);
create index on beans (match_key);

create table user_beans (            -- personal library entry (a batch you bought)
  id uuid primary key,
  user_id uuid not null references profiles,
  bean_id uuid not null references beans,
  roast_date date,
  grams_remaining numeric,
  status text not null default 'new'
    check (status in ('new','dialing_in','locked')),
  collection text,                   -- your own structure (shelf, folder, tag)
  notes text
);

-- recipes --------------------------------------------------------------
create table recipes (               -- identity: owned, named, tied to a bean
  id uuid primary key,
  owner_id uuid not null references profiles,
  bean_id uuid not null references beans,
  method text not null,              -- 'v60' | 'aeropress' | 'espresso'
  name text not null,
  locked_version_id uuid,            -- FK added below; null = not shared
  created_at timestamptz not null default now()
);

create table recipe_versions (       -- IMMUTABLE parameter snapshots
  id uuid primary key,
  recipe_id uuid not null references recipes,
  parent_version_id uuid references recipe_versions,    -- branch history
  forked_from_version_id uuid,       -- pointer to a friend's version, informational only
  params jsonb not null,             -- validated by the shared TS schema
  grind_um numeric not null,
  created_at timestamptz not null default now()
);
alter table recipes add foreign key (locked_version_id) references recipe_versions;

-- brews ----------------------------------------------------------------
create table brews (                 -- append-only log; the future training data
  id uuid primary key,               -- minted on the device
  user_id uuid not null references profiles,
  user_bean_id uuid not null references user_beans,
  recipe_version_id uuid not null references recipe_versions,
  params jsonb not null,             -- copy of what was actually brewed
  actual_time_s int, yield_ml numeric,
  feedback jsonb,                    -- taste axes, strength, per-note hit/miss
  tuning jsonb,                      -- mode, questions asked + answers, question-bank version,
                                     -- hypothesis shares, suggestion, accepted/modified/ignored,
                                     -- manual diff; see tuning.md section 7
  change_applied jsonb,              -- the change actually made after this brew
  outcome_improved boolean,          -- set when the next brew is logged (did the suggestion help?)
  brewed_at timestamptz not null default now()
);
```

### What is actually built

The schema above is implemented in `supabase/migrations/` and applied to the Supabase project. Differences from the sketch, all deliberate:

- `private.are_friends` lives in a non-exposed `private` schema so signed-in users cannot call it over the API. Policies reference it by OID.
- Recipes are **archived, never hard-deleted** (`recipes.archived_at`). Versions and brews reference each other with `on delete restrict`, so history cannot disappear. Archived recipes are hidden from friends.
- A composite foreign key `(locked_version_id, id) -> recipe_versions(id, recipe_id)` guarantees a locked version belongs to its own recipe.
- `recipe_versions` has no client `update` or `delete` privilege and a trigger that rejects updates, so snapshots are immutable (the trigger applies to every role).
- `brews` is insert-only for the parameters that were brewed. After insert, clients may update only `actual_time_s`, `yield_ml`, `feedback`, `tuning`, `change_applied` and `outcome_improved`. A brew can only reference the user's own bag and their own recipe versions (fork a friend's recipe first).
- Catalogue rows (`beans`, `filters`) record `created_by` and cannot be edited or deleted by clients. `match_key` is a generated column; beans have a trigram index for "did you mean" matching, filters have a unique `(match_key, size)`.
- Grinders and calibration data are curated by migrations. The seed (eleven grinders, six with calibration) is in `*_grinder_seed*.sql`; `grinders.setting_step` records the smallest adjustment. See `grinders.md` for provenance and caveats.
- `supabase/tests/rls.test.sql` checks the policies with three simulated users inside one rolled-back transaction.

### Invariants

- `recipe_versions` rows are never updated or deleted (enforced by a trigger). The only mutable pointer is `recipes.locked_version_id`.
- **Equipment in recipes.** A recipe version's `params` stores a snapshot of the filter used (`{ filterId, brand, model, flowClass }`), and the grinder as microns, so versions stay meaningful if the catalogue changes. The user's current choice comes from `user_filters`.
- **Fork = copy.** Saving a friend's recipe copies their locked version's `params` into a new recipe of yours as its root version, and records `forked_from_version_id`. If the friend's filter is not in your `user_filters`, the fork screen shows it with a prompt to pick one of yours (or add it); the engine adjusts for the difference in flow class. Grind is converted the same way as before. After that your copy has no dependency on the friend's data, so "reset to original" is just "point back at your root version". It keeps working even if the friend re-locks or deletes.
- "The friend has a newer version" is a read of their current `locked_version_id` compared with what you forked. It never overwrites anything.
- `brews.tuning` records what the assisted flow asked, concluded and suggested, and `outcome_improved` is filled in from the next brew's overall rating. Together they are the cause/change/result data we lack today.
- Question banks, hypothesis catalogues and likelihood tables are versioned data shipped with the engine, not rows users can edit. `brews.tuning` stores the bank version so old answers stay interpretable.
- `brews.params` is a snapshot, so later edits can never change what a brew means.
- Grind is stored in microns everywhere and converted for display.

## 4. Row-level security

Helper:

```sql
create function private.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from friendships
    where user_a = least(a, b) and user_b = greatest(a, b)
  );
$$;
```

| Table | select | insert / update / delete |
|---|---|---|
| `profiles` | self and friends | self only |
| `friendships` | participants | none from clients (created by `accept_invite`); participants may delete |
| `invites` | inviter | none from clients; created by `create_invite()` and consumed by `accept_invite(token)` |
| `grinders`, `grinder_calibration` | any signed-in user | none (curated by migrations) |
| `user_grinders` | owner | owner |
| `filters` | any signed-in user | insert by any signed-in user (deduped on `match_key`); no update/delete |
| `user_filters` | owner | owner |
| `beans` | any signed-in user | insert by any signed-in user; **no update/delete** (personal edits go in `user_beans`) |
| `user_beans` | owner | owner |
| `recipes` | owner, **or** (`locked_version_id is not null` and `are_friends(owner_id, auth.uid())`) | owner |
| `recipe_versions` | owner, **or** it is the current `locked_version_id` of a friend's recipe | owner inserts; no update/delete |
| `brews` | owner | owner inserts; owner may delete own |

Notes:

- Friends can read a recipe only while it is locked. Un-locking hides it again. Experiments and history are never visible to anyone else.
- **Friend signal** ("Sam has this dialed in") is a plain query: recipes for this `bean_id` that RLS already lets me see. No new policy needed.
- Aggregates across users (engine similar-bean matching) run in Edge Functions using the service role and must return only derived numbers. **v1 rule: the engine uses my own history, my friends' locked recipes, and the seed data. It does not mine non-friends' brews.** That keeps the privacy story simple while the user base is small.
- Invite tokens: 128-bit random, shown once, stored hashed, single-use, expire after 7 days. `accept_invite` verifies the hash, creates the friendship and marks the invite used in one transaction, and returns one generic error for every failure so tokens cannot be probed.

## 5. Beans: catalogue plus personal library

- `beans` is identity (what the coffee is). `user_beans` is your copy (which bag, roast date, grams left, your own organisation). The same coffee bought twice is two `user_beans` rows, one `beans` row.
- **Dedupe on add:** normalise roaster + name into `match_key`, fuzzy-match against the catalogue (trigram similarity), and show the closest matches ("Is this one of these?") before creating a new catalogue entry. Photo OCR (build step 9) feeds the same matcher.
- **Friend signal order:** exact catalogue match first ("Sam has this dialed in: V60"), then similar beans by origin/process ("Sam dialed a washed Ethiopian"). The same similarity logic feeds the engine.
- Open edge case: two friends enter the same coffee with slightly different spellings before matching exists. Accepted for now; a merge tool can come later because everything references `bean_id`.

## 6. Offline and sync

Requirement: logging a brew on weak signal must feel instant and never lose data.

- Client mints UUIDv7 ids, so rows can be created offline and inserted idempotently (`insert ... on conflict (id) do nothing`).
- Writes go to an **IndexedDB outbox** first, then the UI updates optimistically (TanStack Query), then a sync loop drains the outbox when online.
- Conflicts are mostly designed away: brews and recipe versions are append-only, so two devices can't clash. The only mutable fields are `recipes.locked_version_id` and `user_beans` fields; those are last-write-wins.
- The service worker precaches the app shell and the grinder and filter catalogues. Engine suggestions need the network; if offline, the last suggestion for the bean stays available and a "will refresh when online" note is shown.
- Wake lock while on the brew screen; it must be requested from a user gesture on iOS.

## 7. Engine placement

- `engine/` is a pure TypeScript package: no UI, no DB, no network, deterministic given inputs. It has a stable input/output contract (see `engine.md`) so a trained model can replace internals later.
- Edge Function `suggest-recipe` loads the data the engine needs (bean, my history, friends' locked recipes), calls the engine, and returns the result. The client never sees other people's rows beyond what RLS allows.
- The same package is imported by the client for scaling and grind conversion.

## 8. Build order impact

Unchanged from the kickoff plan: shell (2), Supabase + auth + schema + RLS (3), grinder converter (4), beans (5), recipe + brew logging (6), engine v1 (7), feedback loop (8), OCR (9), friends (10). Two changes:

1. The invite flow and `friendships` move earlier in design (schema in step 3) but the UI stays in step 10.
2. Offline outbox is introduced with the first write path (step 5), not retrofitted.

## 9. Open questions

- **Decided: grinders and filters only for now.** The dripper (V60 plastic, ceramic, glass, Neo and so on) is deferred. It also affects flow and the fixtures record it, so revisit it later, preferably as a generic `equipment` table with a `kind` column rather than a third copy of the same pattern.
- The fixture data spells one filter two ways (`CAFEC T-90` and `CAFEC T90`); importing it should go through `filters.match_key`.
- Assisted tuning questions need testing with real novices (see `tuning.md` section 9).
- Should a friend be able to see which of their friends' locked recipes I've saved? Default: no.
- Do we let users delete their account and what happens to recipes friends forked? Fork-as-copy means the forks survive; confirm that is acceptable.
- Rate limits and abuse on the shared catalogue are ignored while the user base is friends only.
