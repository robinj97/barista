# Supabase

- `migrations/`: the schema, applied in filename order. Do not edit an applied migration; add a new one.
- `tests/rls.test.sql`, `tests/profile.test.sql` and `tests/beans.test.sql`: policy and invariant checks (profile preferences and gear; bean search and adding bags). Run it in the SQL editor (or any SQL client) against a database with the migrations applied. They end by raising `RLS_TESTS_PASSED` or `PROFILE_TESTS_PASSED` or `BEANS_TESTS_PASSED`, which rolls everything back so no test data is kept. Any other error message is a real failure.

## Checks after a schema change

1. Run `tests/rls.test.sql`, `tests/profile.test.sql` and `tests/beans.test.sql`.
2. Run the Supabase security and performance advisors. Expected leftovers:
   - `create_invite` and `accept_invite` are callable by signed-in users on purpose.
   - Leaked-password protection does not apply because sign-in is Google only.
   - Unused-index notices on an empty database.
3. Regenerate `src/lib/database.types.ts` (Supabase generate-types) after every schema change.

## Edge Functions

### `scan-bag`

Reads a coffee bag photo with Claude Haiku 5.5 and returns the label as bag fields (the add-bag sheet's camera button). The prompt and schema live in `functions/scan-bag/label.ts`, shared with `scripts/scan-eval.ts`.

- Signed-in users only: the gateway checks the JWT, so deploy without `--no-verify-jwt`.
- Needs an Anthropic API key from the Claude Console (billed per token, separate from a Claude subscription). Set it as a function secret; it never reaches the app.
- Photos are not stored. Each scan costs roughly $0.0005 at low effort.

```bash
supabase secrets set ANTHROPIC_API_KEY=<your key> --project-ref rjzewbeodonqxxltsbrf
supabase functions deploy scan-bag --project-ref rjzewbeodonqxxltsbrf
```

To compare low and medium effort on your own photos, see the header of `scripts/scan-eval.ts` (`bun run scan-eval <folder>`).
