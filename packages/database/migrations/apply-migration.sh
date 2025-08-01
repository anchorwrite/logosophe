#!/bin/bash

# Migration Application Script for Logosophe
# Usage: ./apply-migration.sh <migration-file> [--remote]

set -e

MIGRATION_FILE=$1
REMOTE_FLAG=$2

if [ -z "$MIGRATION_FILE" ]; then
    echo "Usage: $0 <migration-file> [--remote]"
    echo "Example: $0 001-initial-schema.sql --remote"
    exit 1
fi

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "Error: Migration file '$MIGRATION_FILE' not found"
    exit 1
fi

echo "Applying migration: $MIGRATION_FILE"

# Change to worker directory
cd ../../apps/worker

# Build the command
CMD="yarn wrangler d1 execute logosophe --file=../../packages/database/migrations/$MIGRATION_FILE"

if [ "$REMOTE_FLAG" = "--remote" ]; then
    CMD="$CMD --remote"
    echo "Target: Remote database"
else
    echo "Target: Local database"
fi

echo "Executing: $CMD"
echo "This may take some time..."

# Execute the migration
echo "y" | $CMD

echo "Migration completed successfully!"
echo "Database: $(if [ "$REMOTE_FLAG" = "--remote" ]; then echo "Remote"; else echo "Local"; fi)"
echo "File: $MIGRATION_FILE" 