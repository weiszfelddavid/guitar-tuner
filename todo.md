# Pro-Guitar Tuner Roadmap

## 1. Input Tolerance Modes (Strict vs. Forgiving)
**Goal:** Make the tuner usable for humming/singing or noisy environments ("Forgiving") while retaining precision for instrument setup ("Strict"). The current implementation is too strict for casual use.

### Specifications
- **Strict Mode (Current/Default):**
  - **Clarity Threshold:** 0.9 (90%).
  - **Visual Decay:** Instant (0ms hold).
  - **Smoothing:** Low latency, raw feedback.
  - **Use Case:** Setting intonation, fresh strings, high-quality audio interface.

- **Forgiving Mode (New "Easy" Mode):**
  - **Clarity Threshold:** 0.6 (60%) to accept breathy signals or humming.
  - **Visual Hold:** "Stick" the note on screen for ~500ms if the signal drops (volume present, but clarity dips) to prevent flashing.
  - **Smoothing:** Increase Kalman filter smoothing factor to reduce needle jitter on unstable inputs.

### Implementation Tasks
- [x] **UI:** Add a toggle switch in the UI (e.g., "Mode: Pro" / "Mode: Easy").
- [x] **Logic:** Refactor `getTunerState` to accept a configuration object or mode flag.
- [x] **State:** Persist the mode selection in local storage.
- [x] **Visual Hold:** Implement 500ms visual hold for Forgiving mode.
- [x] **Kalman Smoothing:** Adjust Kalman filter smoothing factor based on mode (0.1 for strict, 0.3 for forgiving).

### Testing Strategy
- [x] **Fixture:** Create `pitch_breathy_hum.json` (Sine wave mixed with 35% white noise, resulting in ~0.65 clarity).
- [x] **Test Case 1 (Strict):** Ensure the breathy fixture returns "No Note" (Clarity < 0.9).
- [x] **Test Case 2 (Forgiving):** Ensure the breathy fixture returns the correct Note Name (Clarity > 0.6).
- [x] **Test Case 3 (Hysteresis):** Feed a signal that cuts out briefly (100ms gap); verify Forgiving Mode holds the display while Strict Mode drops it.

### ✅ Completed Implementation

All tasks have been completed and tested. The feature includes:
- **Mode Toggle UI** in top-right corner (Pro/Easy)
- **Dual clarity thresholds** (0.9 for Pro, 0.6 for Easy)
- **Visual hold mechanism** (500ms in Easy mode)
- **Enhanced smoothing** (0.3 vs 0.1) in Easy mode
- **Local storage persistence** for mode selection
- **Comprehensive test coverage** with 24 passing tests:
  - Unit tests for mode configurations
  - Fixture-based integration tests using generated audio signals
  - Hysteresis/hold behavior tests
  - All tests passing with TypeScript type checking
