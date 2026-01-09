#!/bin/bash
# Build script with proper error handling
# Ensures Vite only runs if wasm-pack succeeds

set -e  # Exit on any error

echo "============================================"
echo "Building WASM module with wasm-pack..."
echo "============================================"

# Run wasm-pack and capture exit code
if wasm-pack build --target web; then
    echo ""
    echo "✓ WASM build successful"
    echo ""
    echo "============================================"
    echo "Building application with Vite..."
    echo "============================================"

    # Run vite build
    if npx vite build; then
        echo ""
        echo "✓ Vite build successful"
        echo ""
        echo "============================================"
        echo "✓ BUILD COMPLETE"
        echo "============================================"
        exit 0
    else
        echo ""
        echo "✗ ERROR: Vite build failed"
        echo "============================================"
        exit 1
    fi
else
    echo ""
    echo "✗ ERROR: wasm-pack build failed"
    echo "The Vite build has been skipped to prevent a broken bundle."
    echo ""
    echo "Common causes:"
    echo "  - Rust compilation errors in src-wasm/"
    echo "  - Missing wasm-pack (install: curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh)"
    echo "  - Cargo.toml configuration issues"
    echo ""
    echo "Run 'wasm-pack build --target web' to see detailed error messages."
    echo "============================================"
    exit 1
fi
