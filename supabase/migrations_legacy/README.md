# Supabase migrations (squashed)

This project used to have 180+ incremental migration files.

For launch-readiness and faster `supabase db reset`, those migrations have been **squashed** into a single baseline migration:

- `0001_baseline.sql`

## How to work with this

- For a fresh local database: `supabase db reset` will run `0001_baseline.sql` and then `supabase/seed.sql`.
- For new changes going forward, create a **new** migration file with a later name (timestamp is recommended), e.g.
  - `20260210000000_add_new_feature.sql`

## What’s inside the baseline

`0001_baseline.sql` is a concatenation of all legacy migrations in lexicographic order.
The header at the top of the file lists every original migration that was included.
