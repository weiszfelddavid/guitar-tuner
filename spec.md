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

## 4. User Interface (UI)
**File:** `src/ui/components/TunerInterface.tsx`

### Requirements
1.  **Component Type:** Functional React Component.
2.  **Props:**
    - `pitch`: number (detected frequency in Hz).
    - `clarity`: number (0.0 to 1.0 confidence).
    - `status`: 'idle' | 'listening' | 'locked'.
3.  **Visual Logic:**
    - Convert Hz to **Note Name** (e.g., 440Hz -> "A4").
    - Calculate **Cents Off** (difference from perfect pitch).
    - **Visual Indicator:** Display a needle or bar showing how sharp/flat the note is.
    - **Color Coding:**
        - Green: Locked / In Tune (within 5 cents).
        - Yellow: Close.
        - Red: Out of tune.

## 5. Integration & Architecture
**Files:** `src/App.tsx`, `src/vite-env.d.ts`

### Requirements
1.  **Worklet Loading Strategy:**
    - Must use Vite's `?url` import suffix (e.g., `import processorUrl from '...?url'`) to load the AudioWorkletProcessor.
2.  **Type Safety:**
    - Create `src/vite-env.d.ts` to declare that `*.ts?url` returns a string.
3.  **App Orchestration (`src/App.tsx`):**
    - Initialize `AudioContext` only after a user interaction (Click "Start").
    - Connect the `PitchProcessor` node to the `TunerInterface` state.