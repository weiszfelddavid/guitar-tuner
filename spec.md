# Guitar Tuner Technical Specification (v2.0 - CTO Approved)

## 1. Core Architecture
- **Repo Structure:** Monorepo (Web/Mobile).
- **Framework:** React 18+ (Functional Components, Hooks).
- **Language:** TypeScript 5.x (Strict Mode).
- **Build Tool:** Vite (Fast HMR).
- **Mobile Bridge:** Capacitor 6.x.
- **State Management:** `Zustand` (Minimalist, handles high-frequency updates better than Context).

## 2. The Audio Engine (DSP)
**Algorithm:** YIN (Step-based implementation).
- **Sample Rate:** Default to 44.1kHz (Resample if hardware differs).
- **Buffer Size:** 2048 samples (approx 46ms latency, good balance).
- **Threshold:** 0.10 (Standard YIN tolerance).

### Threading Model
DSP logic runs exclusively in an `AudioWorklet`. The Main Thread (UI) **never** touches raw audio data.

### The "Worklet-to-UI" Contract
The Worklet posts a message **only when pitch is detected** (to save bridge traffic):
```typescript
type TunerUpdate = {
  pitch: number;      // e.g., 440.0
  clarity: number;    // 0.0 to 1.0 (Probability/Confidence)
  bufferrms: number;  // Volume level (for UI silence gate)
}
```

## 3. Application Logic (State Machine)
The app must implement a finite state machine (FSM) to prevent UI jitter.

1. **IDLE:** Mic permission not yet granted.
2. **LISTENING:** Mic active, but signal < -50dB (Silence).
3. **DETECTING:** Signal > -50dB, but clarity < threshold (Noise/Talking).
4. **LOCKED:** Clarity > threshold. Show Note & Cent deviation.

## 4. Testing Strategy (Zero Tolerance)
**Tooling:** Vitest (Unit) + Playwright (E2E).

### A. The "Golden Standard" Suite (Unit Tests)
We will commit a `tests/fixtures/audio` folder containing:
1. `sine_440.wav` -> Expect: 440Hz ±0.05
2. `guitar_E2_82hz.wav` -> Expect: 82.41Hz ±0.1
3. `white_noise.wav` -> Expect: No detection (null)

### B. Component Tests
- **Canvas:** Verify it renders 60fps loop.
- **A11y:** Verify `aria-live="polite"` updates with the note name for screen readers.

## 5. UI Requirements
- **Theme:** High contrast Dark Mode (OLED black).
- **Visuals:**
  - **Cent Gauge:** Linear horizontal bar (Android style) or Radial (iOS style).
  - **Note Name:** Massive Typography (>72pt).
- **Feedback:** Haptic feedback (vibration) when "Locked" within ±3 cents (Mobile only).

## 6. Constraints
- **Bundle Size:** < 2MB (Gzipped).
- **Permissions:** Handle "Microphone Denied" gracefully with a "Open Settings" deep link.
- **Offline:** Fully functional PWA with Service Worker.

## 7. Frontend UI Specification (Minimalist)
**Concept:** Digital Minimalist. No skeuomorphic textures (no fake wood/plastic). Pure data visualization using high-contrast colors on a dark background.

### A. Visual Identity
- **Palette:**
  - **Background:** Deep Matte Black (`#121212`) - OLED friendly.
  - **Text:** Off-White (`#E0E0E0`).
  - **Accents:**
    - *Flat:* Muted Orange/Red (`#FF8A65`)
    - *Sharp:* Muted Orange/Red (`#FF8A65`)
    - *In-Tune:* Neon Green (`#00E676`)
- **Typography:** System Sans-Serif (clean, performant).

### B. Component Breakdown
#### 1. `<NoteDisplay />` (The Hero Element)
- **Position:** Center screen.
- **Size:** Massive font (~10rem).
- **Behavior:** Displays the detected note (e.g., "A", "F#"). Transitions from White to Green when locked.

#### 2. `<CentsGauge />` (The Indicator)
- **Style:** A minimal horizontal SVG bar or arc below the note.
- **Smoothing:** CSS `transition` applied to prevent jitter.

## 8. Premium UI Enhancements (Level Up)
**Goal:** Elevate the minimal design to a professional "instrument" quality.

### Features
1.  **Frequency Sparkline:** Subtle SVG path plotting pitch deviation (20% opacity).
2.  **Precision Ruler Gauge:** Graduated ruler with ticks at -50, -25, 0, +25, +50 cents and a glowing diamond center.
3.  **Reactive Glow (Bloom):** Dynamic text-shadow glow on the Note Display based on proximity to perfect pitch.

## 9. Visual Testing & Debugging
**Goal:** Automated visual verification of the UI on different devices.

### Workflow
1.  **Tool:** Playwright is used to capture screenshots of the deployed application.
2.  **Script:** `scripts/capture-ui.js` automates the process and **must log the deployed version number** detected on the live site.
3.  **Verification:** Before analyzing screenshots, **always match the deployed version number** (from the screenshot logs) with the local `src/version.ts`. If they do not match, wait for deployment to complete.
4.  **Targets:**
    -   **Mobile:** iPhone 13 (Viewport: 390x844)
    -   **Desktop:** Standard 1920x1080
5.  **Analysis:** The AI Agent analyzes the captured screenshots in `debug-screenshots/` to identify layout issues, cropping, or visual bugs.

## UI/UX Design Expectations
- **Minimal & Direct:** The interface must be clutter-free. The primary focus is the tuning visualization.
- **App-Like Hero Experience:** On both mobile and desktop, the tuner interface should occupy the primary viewport (approx. 85-90vh), creating a "hero" section that feels like a native application. 
- **Below-the-Fold SEO:** Content intended for SEO (descriptions, tables, tips) must live below the main tuner interface to avoid distracting the user from the tool's utility.
- **Responsive Fluidity:** Typography (especially the note display) must use fluid sizing (e.g., clamp) to remain impactful but well-proportioned across all device widths.
- **Zero Friction:** Avoid unnecessary clicks. If permissions are granted, the tool should be ready or active immediately.