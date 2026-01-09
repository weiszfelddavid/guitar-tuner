# Pro-Guitar Tuner Roadmap

## CRITICAL PRIORITY (Ship-Blocking)
**Impact:** Performance bugs, architectural flaws, production issues

- [x] **Move audio processing pipeline to AudioWorklet** ✅ COMPLETED
  - **Problem:** 7-stage processing runs on main thread (60fps) blocking rendering
  - **Impact:** Causes frame drops, janky UI on slower devices
  - **Fix:** Move NoiseGate, PitchStabilizer, OctaveDiscriminator, etc. into tuner-processor.ts
  - **Benefit:** Main thread freed up (5ms → 0ms), silky 60fps, better battery life
  - **Result:** Worklet: 5.03 kB → 10.25 kB, Main: 28.05 kB → 22.08 kB
  - **Commit:** d5d254f

- [x] **Fix state synchronization for manual string lock** ✅ COMPLETED
  - **Problem:** Manual lock mutates state after pipeline calculates it (main.ts:275-284)
  - **Impact:** Breaks single source of truth, logic split across 2 locations
  - **Fix:** String lock should be input to pipeline, not post-processing override
  - **Result:** String lock now sent to worklet via message, processed in pipeline
  - **Commit:** d5d254f

- [x] **Add loading state during WASM initialization** ✅ COMPLETED
  - **Problem:** 1-2 seconds of frozen UI after clicking "Start Tuner"
  - **Impact:** Users think app crashed, abandon before it starts
  - **Fix:** Show spinner/progress during fetch + validation (lines 92-105)
  - **Result:** Professional loading overlay with animated spinner, progress messages, error handling
  - **Bundle:** +2.12 kB (acceptable for critical UX fix)
  - **Commit:** f3f7ab6

- [x] **Remove debug console from production build** ✅ COMPLETED
  - **Problem:** 110-line debug console ships to all users (debug-console.ts)
  - **Impact:** Increases bundle size, confuses end users, unprofessional
  - **Fix:** Wrap in `if (import.meta.env.DEV)` or separate build target
  - **Result:** Bundle reduced 22.08 kB → 18.59 kB (-15.8%), debug code tree-shaken
  - **Commit:** cb79df4

---

## HIGH PRIORITY (Major Quality Issues)
**Impact:** Code maintainability, type safety, performance

- [x] **Consolidate guitar string definitions** ✅ COMPLETED
  - **Problem:** Strings defined 3x with different property names (tuner.ts:4-11, string-selector.ts:11-18)
  - **Impact:** Changes require editing multiple files,易出错
  - **Fix:** Single source of truth in shared constants file
  - **Result:** Created src/constants/guitar-strings.ts with unified interface, helper functions
  - **Commit:** e31ceff

- [ ] **Simplify processing pipeline classes**
  - **Problem:** 8 separate classes (KalmanFilter, PluckDetector, etc.) with tight coupling
  - **Impact:** Initialization overhead, complexity, hard to modify
  - **Fix:** Consolidate into 2-3 classes with clear responsibilities
  - **Files:** src/ui/tuner.ts (400+ lines)

- [ ] **Fix dual smoothing systems**
  - **Problem:** Kalman filter + PluckDetector both smooth cents independently
  - **Impact:** Conflicting filters produce unpredictable needle behavior
  - **Fix:** Single smoothing strategy with configurable parameters per mode
  - **Files:** src/main.ts (line 38), src/ui/tuner.ts

- [ ] **Add proper TypeScript types (eliminate @ts-ignore)**
  - **Problem:** 11 occurrences suppressing legitimate type errors
  - **Impact:** No type safety, runtime errors possible, hard to refactor
  - **Fix:** Define proper types for Worklet API, WASM imports, Window globals
  - **Files:** tuner-processor.ts (9 instances), src/main.ts (2 instances)

- [ ] **Centralize mode configuration**
  - **Problem:** Config retrieved 3x per frame (lines 22, 271, 307), scattered logic
  - **Impact:** Unnecessary allocations (60x/sec), inconsistent behavior
  - **Fix:** Single reactive config object that updates when mode changes
  - **Files:** src/main.ts, src/ui/tuner.ts

- [ ] **Memoize expensive calculations**
  - **Problem:** `getDefaultConfig()` returns new object every frame, array sorts in hot path
  - **Impact:** GC pressure, 0.5-1ms wasted per frame
  - **Fix:** Cache config, use circular buffer instead of sorted arrays
  - **Files:** src/ui/tuner.ts (line 73), PitchStabilizer (line 168)

---

## MEDIUM PRIORITY (Polish & UX)
**Impact:** User experience, perceived quality

- [ ] **Redesign app start flow**
  - **Problem:** Immediate mic permission prompt scares users away
  - **Impact:** High abandonment rate, no explanation of purpose
  - **Fix:** Show tuner UI first, explain mic usage, request permission on first pluck detection
  - **Files:** src/main.ts (lines 335-392), index.html

- [ ] **Improve mode toggle clarity**
  - **Problem:** "Pro"/"Easy" with no explanation of difference
  - **Impact:** Users don't understand what changed, trial-and-error
  - **Fix:** Add tooltip/help text: "Pro = instant response, Easy = holds note for 4s"
  - **Files:** src/main.ts (line 32), CSS for tooltip

- [ ] **Add visual feedback for optimal volume**
  - **Problem:** "Good" volume zone shows no feedback (canvas.ts:299)
  - **Impact:** User unsure if microphone is working correctly
  - **Fix:** Show "Ready" or checkmark icon when in optimal range
  - **Files:** src/ui/canvas.ts (lines 290-303)

- [ ] **Show volume meter always (not just during signal)**
  - **Problem:** Meter hidden when volume < 0.01 (canvas.ts:280)
  - **Impact:** Can't verify microphone is connected/working before playing
  - **Fix:** Always show meter background, dim when no signal
  - **Files:** src/ui/canvas.ts

- [ ] **Add visual indicator when string is locked**
  - **Problem:** String selector shows "active" but main display doesn't
  - **Impact:** Easy to forget lock is engaged, confusing behavior
  - **Fix:** Show lock icon or badge near note display
  - **Files:** src/ui/canvas.ts, src/main.ts

- [ ] **Fix microphone recovery on tab switch**
  - **Problem:** Fully releases mic → new permission prompt every tab switch (lines 335-392)
  - **Impact:** Annoying, breaks workflow
  - **Fix:** Suspend AudioContext but keep MediaStream alive
  - **Files:** src/main.ts

- [ ] **Canvas performance optimization**
  - **Problem:** Full clearRect + redraw every frame, colors loaded on resize
  - **Impact:** Wastes 1-2ms per frame on unchanged elements
  - **Fix:** Dirty region tracking, cache static arc/labels in offscreen canvas
  - **Files:** src/ui/canvas.ts

- [ ] **Add error recovery for WASM loading**
  - **Problem:** Generic error text replaces body if WASM fails (line 397)
  - **Impact:** No retry, no fallback, dead end for users
  - **Fix:** Retry with exponential backoff, fallback to JS-based detection
  - **Files:** src/main.ts

- [ ] **Add OKLCH color fallbacks for older browsers**
  - **Problem:** OKLCH requires Safari 16.4+, Chrome 111+, Firefox 113+
  - **Impact:** Broken colors on older devices (renders as black)
  - **Fix:** Add hex fallbacks before OKLCH declarations
  - **Files:** src/styles/colors.css

---

## LOW PRIORITY (Features & Nice-to-Have)
**Impact:** Feature completeness, delight

### Essential Tuner Features
- [x] **Manual String Selection:** Clickable string buttons to lock tuner
- [ ] **Reference Pitch Adjustment:** Support 432Hz, 442Hz, custom A4 frequencies
- [ ] **Alternate Tunings:** Drop D, Open G, DADGAD, etc. via menu

### Enhancements
- [ ] **PWA Support (offline capability)**
  - Add service worker, manifest.json, install prompt
  - Enable "Add to Home Screen" on mobile
  - Works without internet after first load

- [ ] **Accessibility (WCAG AA)**
  - Add ARIA labels to canvas, buttons
  - Keyboard navigation for string selector
  - Screen reader announcements for tuning state
  - Non-color indicators (shapes, text) for tuning accuracy

- [ ] **Haptic feedback on mobile**
  - Vibrate when note within ±5 cents (in tune)
  - Different pattern for in-tune vs adjusting

- [ ] **Audio feedback option**
  - Play reference tone when string is locked
  - Useful for ear training, alternate to visual

- [ ] **Needle sensitivity adjustment**
  - Currently shows ±50 cents (too wide for precision tuning)
  - Add zoom modes: ±10, ±25, ±50 cents

- [ ] **Transposition support**
  - Display notes relative to capo position
  - Example: Capo 2 shows G string as "A"

### Technical Improvements
- [ ] **Move test fixtures out of git**
  - 3 JSON files with binary data committed (bad practice)
  - Generate fixtures on-demand during test runs

- [ ] **Add integration tests**
  - Currently only unit tests (no worklet, no full pipeline)
  - Test WASM ↔ TypeScript integration
  - Test mode switching, string locking end-to-end

- [ ] **Create constants file for magic numbers**
  - 15 dB threshold, 4096 buffer, 0.8 volume, etc.
  - Centralize with explanatory comments

- [ ] **Add linting configuration**
  - ESLint for TypeScript, Rustfmt for Rust
  - Enforce consistent code style (semicolons, spacing)

- [ ] **Fix build process error handling**
  - Currently: `wasm-pack && vite` (sequential, no recovery)
  - If wasm-pack fails, Vite runs anyway → broken bundle

- [ ] **Environment-based configuration**
  - Deployment uses hardcoded IP (deploy-droplet.yml:42)
  - Use env vars or DNS for flexibility

- [ ] **Analytics/crash reporting**
  - No telemetry on feature usage, errors
  - Add privacy-respecting analytics (e.g., Plausible)

- [ ] **Update project.md claims**
  - "Zero Jitter" - false (main thread pipeline)
  - "Visual Latency <16ms" - unverified
  - Fix or remove inaccurate performance claims

---

## Code Quality Quick Wins
**Small refactors with high impact:**

- [ ] Remove `window.getTunerState()` global (main.ts:51) - test pollution in production
- [ ] Extract frequency ↔ note conversion to shared utility
- [ ] Unify timestamp tracking (3 separate `performance.now()` calls)
- [ ] Replace magic `1000` interval with named constant `MONITORING_INTERVAL_MS`
- [ ] Add namespace prefix to localStorage keys (`tuner:mode`, `tuner:debug`)
- [ ] Remove commented code in tuner-processor.ts (lines 17, 32, 48-51)

---

## Done ✓
- [x] Manual string selection bar with visual states
- [x] String indicator shows detected/active state
- [x] Bead-style gauge indicator (minimalist design)
- [x] 37signals Nobuild CSS architecture with OKLCH colors
- [x] Anti-flicker hold (400ms strict mode)
- [x] Desktop UI fixes (font scaling, positioning)
- [x] Desktop viewport test coverage
