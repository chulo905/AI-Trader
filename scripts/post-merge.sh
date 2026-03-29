#!/bin/bash
set -e
pnpm install --frozen-lockfile
echo "y" | pnpm --filter @workspace/db run push || pnpm --filter @workspace/db run push --force || true
