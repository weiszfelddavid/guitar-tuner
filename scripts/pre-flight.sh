#!/bin/bash
set -e

echo "🚀 Starting Pre-Flight Checklist..."

# 1. Generate Test Signals
echo "📊 Generating fresh test fixtures..."
npx tsx scripts/generate_test_signals.ts

# 2. Run Unit Tests
echo "🧪 Running unit tests (Vitest)..."
npm run test

# 2.5. Type Check
echo "🔍 Running TypeScript type check..."
npx tsc --noEmit

# 3. Build Check
echo "🏗️  Running production build check..."
# Check if we can actually run a wasm build (needs wasm-pack AND cargo)
if command -v wasm-pack >/dev/null 2>&1 && command -v cargo >/dev/null 2>&1; then
    echo "Found wasm-pack and cargo, running full build..."
    npm run build
else
    echo "⚠️  wasm-pack or cargo not found. Running Vite build only to check TS/imports..."
    # We use npx to run vite directly to avoid the 'npm run build' which triggers wasm-pack
    npx vite build --emptyOutDir false
fi

echo "✅ Pre-flight successful! Ready to commit."