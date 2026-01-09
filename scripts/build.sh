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
    echo "Copying fresh WASM files..."
    echo "============================================"

    # Copy the WASM binary to public/ (served at runtime)
    cp -v pkg/pure_tone_bg.wasm public/pure_tone_bg.wasm

    # Patch the JS glue code to remove import.meta.url (breaks in AudioWorklet)
    # We manually load WASM via postMessage, so we don't need automatic URL resolution
    sed '/new URL.*import\.meta\.url/d' pkg/pure_tone.js | \
    sed 's/if (typeof module_or_path === .undefined.) {/if (false) {/g' > src/audio/pure_tone_lib.mjs

    echo "Patched pure_tone.js to remove import.meta.url for AudioWorklet compatibility"

    echo ""
    echo "✓ WASM files updated"
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
