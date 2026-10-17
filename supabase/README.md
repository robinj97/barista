# Supabase

- `migrations/`: the schema, applied in filename order. Do not edit an applied migration; add a new one.
- `tests/rls.test.sql` and `tests/profile.test.sql`: policy and invariant checks (the second covers profile preferences and the default-filter function). Run it in the SQL editor (or any SQL client) against a database with the migrations applied. They end by raising `RLS_TESTS_PASSED` or `PROFILE_TESTS_PASSED`, which rolls everything back so no test data is kept. Any other error message is a real failure.

## Checks after a schema change

1. Run `tests/rls.test.sql` and `tests/profile.test.sql`.
2. Run the Supabase security and performance advisors. Expected leftovers:
   - `create_invite` and `accept_invite` are callable by signed-in users on purpose.
   - Leaked-password protection does not apply because sign-in is Google only.
   - Unused-index notices on an empty database.
3. Regenerate `src/lib/database.types.ts` (Supabase generate-types) after every schema change.
