#!/bin/sh
set -e

echo "Starting Timbre application..."

# Run database migrations before starting the Phoenix server
echo "Running database migrations..."
/app/bin/timbre eval "Timbre.Release.migrate()"

echo "Starting Timbre server on port ${PORT:-10000}..."
exec /app/bin/timbre start
