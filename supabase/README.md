# Supabase migration ownership

The Supabase project contains two isolated application domains. The legal workflow remains in `public` and `private`; the trading platform remains in `nexus_private`. The trading schema is not moved into the public API schema.

This repository is the canonical migration ledger for the shared Supabase project. All 25 migration records currently applied to the connected project are represented under `supabase/migrations` using their exact database version and migration name. Their SQL bodies were recovered from `supabase_migrations.schema_migrations.statements`, not reconstructed from assumptions.

Ten earlier files used timestamps that did not match the versions recorded by Supabase. Their original contents are preserved under `supabase/migration-archive`; the old migration paths now contain only `select 1;` so a future migration run cannot replay their DDL under a second version. The archive directory is outside the Supabase migration discovery path.

The database contains two identical `agent_queue_and_operational_views` migration records. Both exact versions are retained because both are present in the database history; their statements use idempotent index creation and replaceable views.

The migration ledger predates a complete clean-room baseline for the original legal application tables. A fresh-project bootstrap has not been certified by replaying this ledger against an empty database. Do not claim clean-room reproducibility until the pre-existing legal schema baseline is captured and tested.

All future DDL changes must be applied through a versioned migration and committed here with the exact resulting version. Do not independently push migrations from the legal or Honeycomb application repositories to this shared project.
