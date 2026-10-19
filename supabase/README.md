# Supabase

- `migrations/`: the schema, applied in filename order. Do not edit an applied migration; add a new one.
- `tests/rls.test.sql`, `tests/profile.test.sql` and `tests/beans.test.sql`: policy and invariant checks (profile preferences and gear; bean search and adding bags). Run it in the SQL editor (or any SQL client) against a database with the migrations applied. They end by raising `RLS_TESTS_PASSED` or `PROFILE_TESTS_PASSED` or `BEANS_TESTS_PASSED`, which rolls everything back so no test data is kept. Any other error message is a real failure.

## Checks after a schema change

1. Run `tests/rls.test.sql`, `tests/profile.test.sql`, `tests/beans.test.sql`, `tests/scan.test.sql` and `tests/suggest.test.sql`.
2. Run the Supabase security and performance advisors. Expected leftovers:
   - `create_invite` and `accept_invite` are callable by signed-in users on purpose.
   - `claim_scan` is too: calling it directly only uses up your own daily scans.
   - So are `claim_suggestion` and `has_feature`: they only count or read your own rows.
   - Leaked-password protection does not apply because sign-in is Google only.
   - Unused-index notices on an empty database.
3. Regenerate `src/lib/database.types.ts` (Supabase generate-types) after every schema change.

## Edge Functions

### `scan-bag`

Reads a coffee bag photo with Claude Haiku 5.5 and returns the label as bag fields (the add-bag sheet's camera button). The prompt and schema live in `functions/scan-bag/label.ts`, shared with `scripts/scan-eval.ts`.

- Signed-in users only: the gateway checks the JWT, so deploy without `--no-verify-jwt`.
- Needs an Anthropic API key from the Claude Console (billed per token, separate from a Claude subscription). Set it as a function secret; it never reaches the app.
- 10 scans per person per day (UTC), counted by `claim_scan` before Claude is called; past that the function answers 429 `daily_limit`. Change `daily_limit` in that function to adjust.
- Photos are not stored. Each scan costs roughly $0.0005 at low effort.
- Each scan writes one JSON log line (`"event":"scan"`) with the outcome, time and token counts, nothing personal.

```bash
supabase secrets set ANTHROPIC_API_KEY=<your key> --project-ref rjzewbeodonqxxltsbrf
supabase functions deploy scan-bag --project-ref rjzewbeodonqxxltsbrf
```

To compare low and medium effort on your own photos, see the header of `scripts/scan-eval.ts` (`bun run scan-eval <folder>`).

### `suggest-tweak`

"Suggest a tweak" on the Recipe screen: reads the draft's last brew and suggests one or two changes with Claude Haiku 5.5 at medium effort (see `docs/suggest-tweak.md`). The prompt, schema and guardrails live in `functions/suggest-tweak/suggest.ts`, shared with `scripts/suggest-eval.ts`; the steps are in `handler.ts`, tested in `handler.test.ts`.

- Signed-in users with the `suggest_tweak` feature only. Grant it per person in SQL:
  `insert into public.feature_access (user_id, feature) values ('<profile id>', 'suggest_tweak');`
- 20 suggestions per person per day (UTC), counted by `claim_suggestion`; a saved suggestion for the same brew is returned without counting.
- Uses the same `ANTHROPIC_API_KEY` secret as `scan-bag`. Each suggestion costs roughly $0.0005.
- Each call writes one JSON log line (`"event":"suggest"`) with the outcome, changes, time and token counts, never the note.

```bash
supabase functions deploy suggest-tweak --project-ref rjzewbeodonqxxltsbrf
```

