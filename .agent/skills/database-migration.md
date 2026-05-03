---
description: Step-by-step guide for Supabase database migrations. Read when adding or modifying tables.
---

# Database Migration Guide

Read this skill when adding new tables, modifying columns, or adding indexes/functions to the database.

## Step 1: Design Schema

- Check `docs/database-schema.md` for existing tables and relationships
- Avoid breaking changes to existing columns (add new, don't rename/drop)
- Use `TIMESTAMPTZ` (not `TIMESTAMP`) for all date columns
- Use `UUID` primary keys via `gen_random_uuid()`
- Use `TEXT` for string columns (not `VARCHAR`)

## Step 2: Write Migration File

**Location**: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`

**Naming convention**: timestamp + snake_case description

- Example: `20260503170000_add_voice_settings.sql`

**Idempotency rules**:

```sql
-- New tables
CREATE TABLE IF NOT EXISTS my_table (...);

-- New columns
ALTER TABLE my_table ADD COLUMN IF NOT EXISTS new_col TEXT;

-- New indexes
CREATE INDEX IF NOT EXISTS idx_name ON my_table(column);

-- Policies (drop + create for updates)
DROP POLICY IF EXISTS "policy_name" ON my_table;
CREATE POLICY "policy_name" ON my_table ...;
```

## Step 3: Row Level Security (RLS)

Always enable RLS on new tables:

```sql
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;
```

**Choose the access pattern**:

| Pattern           | When to use                    | Policy needed?    |
| ----------------- | ------------------------------ | ----------------- |
| Service-role only | API routes handle auth in code | No                |
| User-owned data   | Client-side queries possible   | Yes               |
| Read-only config  | Lookup tables                  | Yes (SELECT only) |

**User-owned data policy template**:

```sql
CREATE POLICY "Users manage own data" ON my_table
  FOR ALL TO authenticated
  USING (user_id = auth.jwt() ->> 'email');
```

## Step 4: Indexes

- Add indexes for all FK columns
- Add indexes for columns used in WHERE clauses
- Use partial indexes where applicable:

```sql
-- Only index active records
CREATE INDEX idx_active_items ON items(status) WHERE status = 'active';
```

## Step 5: Update Documentation

**Mandatory** — update ALL of the following:

| Doc                       | What to update                            |
| ------------------------- | ----------------------------------------- |
| `docs/database-schema.md` | ERD diagram + table detail section        |
| `docs/security.md`        | RLS status table                          |
| `docs/contracts.md`       | TypeScript interface (if exposed via API) |
| `docs/CHANGELOG.md`       | Migration entry                           |

## Step 6: Verify

- Apply migration via Supabase Dashboard SQL Editor or `supabase db push`
- Verify tables/columns exist with expected constraints
- Test queries from API routes
