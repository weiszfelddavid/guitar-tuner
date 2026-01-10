# Pro-Guitar Tuner Roadmap

## NEW IMPROVEMENTS (Code Quality & Cleanup)
**Impact:** Reliability, maintainability, and professional polish

- [ ] **Remove excessive console logging**
  - **Problem:** `src/main.ts` and test files contain many `console.log` statements
  - **Impact:** Clutters console, unprofessional in production
  - **Fix:** Remove debug logs or use a proper logger with log levels (debug/info/warn/error) that can be stripped in prod
  - **Files:** `src/main.ts`, `tests/melody_test.js`, `test-production.mjs`

- [ ] **Refine AudioWorklet error handling**
  - **Problem:** `processBuffer` in `tuner-processor.ts` has a silent empty catch block
  - **Impact:** Runtime errors during audio processing are swallowed, making debugging "silent failures" impossible
  - **Fix:** Send error messages to main thread via port (throttled to avoid flooding)
  - **Files:** `src/audio/tuner-processor.ts`

- [ ] **Reduce `any` type usage**
  - **Problem:** 20+ instances of `any` or `as any` remaining
  - **Impact:** Bypasses type safety, hides potential bugs
  - **Fix:** define proper interfaces for:
    - `globalThis` in Worklet (add `TextDecoder`, `initSync`, `PitchDetector`)
    - Canvas context mocks in tests
    - Window globals (`toggleDebugConsole`)
  - **Files:** `src/audio/tuner-processor.ts`, `src/ui/canvas.test.ts`, `src/ui/debug-console.ts`

- [ ] **Refactor Canvas drawing logic**
  - **Problem:** `drawStaticElementsToContext` is a monolithic function mixing geometry, styling, and text
  - **Impact:** Hard to read, test, or modify specific visual elements
  - **Fix:** Extract helper methods: `drawTunerArc`, `drawTargetZone`, `drawTickMarks`, `drawFlatSharpSymbols`
  - **Files:** `src/ui/canvas.ts`

- [ ] **Consolidate Theme Constants**
  - **Problem:** Fallback hex colors in `src/ui/canvas.ts` are hardcoded strings
  - **Impact:** Changing the default theme requires editing JS code
  - **Fix:** Move default color palette to `src/constants/theme.ts` or `tuner-config.ts`
  - **Files:** `src/ui/canvas.ts`

---

## HIGH PRIORITY (Major Quality Issues)
**Impact:** Code maintainability, type safety, performance

- [ ] **Add OKLCH color fallbacks for older browsers**
  - **Problem:** OKLCH requires Safari 16.4+, Chrome 111+, Firefox 113+
  - **Impact:** Broken colors on older devices (renders as black)
  - **Fix:** Add hex fallbacks before OKLCH declarations
  - **Files:** src/styles/colors.css

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

- [ ] **Add visual indicator when string is locked**
  - **Problem:** String selector shows "active" but main display doesn't
  - **Impact:** Easy to forget lock is engaged, confusing behavior
  - **Fix:** Show lock icon or badge near note display
  - **Files:** src/ui/canvas.ts, src/main.ts

---

## LOW PRIORITY (Features & Nice-to-Have)
**Impact:** Feature completeness, delight

### Essential Tuner Features
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
- [ ] **Add linting configuration**
  - ESLint for TypeScript, Rustfmt for Rust
  - Enforce consistent code style (semicolons, spacing)

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

## Done ✓
- [x] **Move audio processing pipeline to AudioWorklet** (Commit: d5d254f)
- [x] **Fix state synchronization for manual string lock** (Commit: d5d254f)
- [x] **Add loading state during WASM initialization** (Commit: f3f7ab6)
- [x] **Remove debug console from production build** (Commit: cb79df4)
- [x] **Consolidate guitar string definitions** (Commit: e31ceff)
- [x] **Simplify processing pipeline classes** (Commit: 759d370)
- [x] **Fix dual smoothing systems** (Commit: 97793e5)
- [x] **Add proper TypeScript types** (Commit: 986a91d)
- [x] **Centralize mode configuration** (Commit: 11554a6)
- [x] **Memoize expensive calculations** (Commit: 3bf3e91)
- [x] **Add visual feedback for optimal volume** (Commit: 7a0b783)
- [x] **Show volume meter always** (Commit: bd69491)
- [x] **Fix microphone recovery on tab switch** (Commit: 9446ef0)
- [x] **Canvas performance optimization** (Commit: ad107fb)
- [x] **Add error recovery for WASM loading** (Commit: 1ec00ec)
- [x] **Move test fixtures out of git** (Commit: 7544a37)
- [x] **Add integration tests** (Commit: 4951380)
- [x] **Create constants file for magic numbers** (Commit: 4951380)
- [x] **Fix build process error handling** (Commit: 7544a37)
- [x] **Manual string selection bar with visual states**
- [x] **String indicator shows detected/active state**
- [x] **Bead-style gauge indicator**
- [x] **37signals Nobuild CSS architecture**
- [x] **Anti-flicker hold (400ms strict mode)**
- [x] **Desktop UI fixes**
- [x] **Desktop viewport test coverage**
- [x] **Code Quality Quick Wins:**
  - Remove `window.getTunerState()` global
  - Extract frequency ↔ note conversion to shared utility
  - Unify timestamp tracking
  - Replace magic `1000` interval with named constant
  - Add namespace prefix to localStorage keys
