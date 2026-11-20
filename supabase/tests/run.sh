#!/usr/bin/env bash
# Run every migration on a fresh database and check the access rules.
#   supabase/tests/run.sh            (needs a local PostgreSQL; set PSQL to override, e.g. PSQL="psql -h localhost -U postgres")
set -euo pipefail
cd "$(dirname "$0")/.."
PSQL=${PSQL:-psql}
DB=${DB:-brainwave_migrations_test}
$PSQL -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
run() { PGOPTIONS='-c client_min_messages=warning' $PSQL -v ON_ERROR_STOP=1 -q -d "$DB" -f "$1"; }
run tests/00_supabase_stub.sql
for f in migrations/*.sql; do echo "migration: $f"; run "$f"; done
# Migrations that say "Safe to re-run" must be: prove it.
for f in $(grep -l "Safe to re-run" migrations/*.sql); do run "$f"; done
# Supabase gives the API roles table access by default; RLS decides the rows.
$PSQL -v ON_ERROR_STOP=1 -q -d "$DB" -c "grant select, insert, update, delete on all tables in schema public to anon, authenticated; grant all on all tables in schema public to service_role;"
echo "checks: tests/rls_test.sql"
PGOPTIONS='-c client_min_messages=warning' $PSQL -v ON_ERROR_STOP=1 -q -o /dev/null -d "$DB" -f tests/rls_test.sql
echo "All migrations ran and every access check passed."
