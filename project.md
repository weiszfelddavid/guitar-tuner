# Project Specification: "Pure Tone" – The Bare Metal Tuner

**Version:** 1.0.0 (Gold)
**Status:** Ready for Implementation
**Target:** 2026 Web Standards (WASM + AudioWorklet)

## 1. Project Overview
A single-purpose, reference-grade acoustic guitar tuner. It prioritizes mathematical purity and input latency over UI features. It runs the industry-standard YIN algorithm inside a Rust-based WebAssembly module, directly on the audio thread.

### Core Philosophy
*   **Zero Jitter:** Deterministic WASM processing eliminates Garbage Collection pauses.
*   **Input Purity:** Aggressively bypasses OS-level audio filters (Echo Cancellation/AGC).
*   **Visual Latency:** <16ms (1 frame) from audio event to pixel update.

## 2. Technology Stack
*   **Language (DSP):** Rust (Edition 2024/2026).
*   **Compiler:** `wasm-pack` targetting web.
*   **Language (Glue):** Vanilla TypeScript (No framework).
*   **UI:** HTML5 Canvas API (2D Context).
*   **Audio:** Web Audio API (`AudioWorkletProcessor`).
*   **Build:** Vite (Used only for minification/dev server, NO React/Vue).

## 3. Architecture

### 3.1 The Audio Pipeline (The Engine)
The application runs two distinct threads.

**Thread A: The Audio Worklet (Real-time)**
*   **Input:** `navigator.mediaDevices.getUserMedia` (Mono, Float32).
*   **Processor:** `WasmAudioProcessor` (Rust).
*   **Algorithm (YIN):**
    *   **Difference Function:** Calculates signal periodicity.
    *   **Cumulative Mean Normalized Difference:** Removes octave errors (the "jumpy" bug).
    *   **Parabolic Interpolation:** Refines pitch accuracy to 0.01 Hz.
*   **Output:** Posts a struct `TunerResult { pitch: f32, clarity: f32 }` to Main Thread every ~16ms (aligned with 60Hz refresh).

**Thread B: The Main Thread (UI)**
*   **Receiver:** Listens for message events from Worklet.
*   **Smoothing (Kalman):** Applies a lightweight 1D Kalman filter to the visual needle only, keeping the underlying math raw.
*   **Renderer:** `requestAnimationFrame` loop drawing to `<canvas>`.

### 3.2 Input Handling (The "Sustain" Fix)
We explicitly override mobile defaults to prevent the "decay drop-off."

```typescript
const constraints = {
  audio: {
    echoCancellation: false,
    autoGainControl: false,
    noiseSuppression: false,
    channelCount: 1,
    latency: { ideal: 0 },
    sampleRate: { ideal: 48000 } // Prefer native to avoid resampling
  }
};
```

## 4. UI/UX Specification

### 4.1 Interface (Minimalist)
*   **Center:** Large, high-contrast Note Character (e.g., "A").
*   **Indicator:** A smooth, high-resolution needle (Canvas vector).
*   **Feedback:**
    *   **White:** No signal / Searching.
    *   **Orange:** Detection (Low Confidence).
    *   **Green:** Locked (Clarity > 0.95) & In Tune (+/- 2 cents).
    *   **Red:** Out of Tune (> 2 cents).

### 4.2 Auto-Detection Logic (Standard E)
The tuner is hard-coded for the 6 strings of a standard guitar to maximize lookup speed.

| String | Frequency (Hz) | Window (Hz) |
| :--- | :--- | :--- |
| E2 | 82.41 | 70 - 95 |
| A2 | 110.00 | 95 - 125 |
| D3 | 146.83 | 125 - 170 |
| G3 | 170.00 | 170 - 220 |
| B3 | 246.94 | 220 - 280 |
| E4 | 329.63 | 280 - 380 |

## 5. Directory Structure
Kept flat to enforce simplicity.

```
/pure-tone/
├── src/
│   ├── dsp/
│   │   ├── lib.rs            # Rust Entry point
│   │   └── yin.rs            # The YIN Algorithm
│   ├── audio/
│   │   ├── worklet.ts        # Processor wrapper
│   │   └── setup.ts          # Mic permissions & Context
│   ├── ui/
│   │   ├── canvas.ts         # Drawing logic
│   │   └── tuner.ts          # Smoothing/Note logic
│   ├── main.ts               # Entry
│   └── style.css
├── public/
│   └── favicon.svg
├── index.html
├── Cargo.toml                # Rust Config
└── vite.config.ts            # Build Config
```

## 6. Development Roadmap
*   **Phase 1: The Rust Core**
    *   Implement Yin struct in Rust.
    *   Expose `process_buffer` function to WASM.
    *   Unit test with recorded guitar audio.
*   **Phase 2: The Glue**
    *   Set up Vite + `wasm-pack`.
    *   Implement `AudioWorklet` loading strategy.
    *   Verify `navigator.mediaDevices` constraints.
*   **Phase 3: The Paint**
    *   Implement high-performance Canvas renderer.
    *   Add Kalman smoothing for the needle.