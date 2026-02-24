#!/bin/bash
# Usage: ./scripts/migrate.sh "ALTER TABLE items ADD COLUMN test text;"
# Creates a timestamped migration file and pushes it to the remote database.

set -e

if [ -z "$1" ]; then
  echo "Error: no SQL provided."
  echo "Usage: ./scripts/migrate.sh \"ALTER TABLE items ADD COLUMN test text;\""
  exit 1
fi

TIMESTAMP=$(date +%Y%m%d%H%M%S)
MIGRATIONS_DIR="$(dirname "$0")/../supabase/migrations"
FILE="${MIGRATIONS_DIR}/${TIMESTAMP}_migration.sql"

echo "$1" > "$FILE"
echo "Created migration: $FILE"

supabase db push
