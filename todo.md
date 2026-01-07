# Pro-Guitar Tuner Roadmap (Remaining Core Stability)

## 1. String Locking (Sticky Logic)
**Goal:** Prevent flickering between notes (e.g., oscillating between "A" and "A#" if slightly sharp).
- [ ] **Implementation:** Create `StringLocker` class in `src/ui/tuner.ts`.
  - Maintain a `currentString` state and a `hysteresisCounter`.
  - **Logic:**
    - If a new string is detected, do *not* switch immediately.
    - Increment `hysteresisCounter`.
    - Only switch `currentString` if the new string is detected consistently for **300ms** (approx 15-20 frames).
    - If the pitch returns to the `currentString` range within that time, reset the counter.
- [ ] **Testing:** Update `scripts/generate_test_signals.ts` and `src/ui/tuner.test.ts`.
  - **Fixture:** `pitch_jittery_boundary.json`: Signal that oscillates +/- 5 cents around the boundary between E2 (82.4Hz) and F2 (87.3Hz).
  - **Test:** Verify that the `StringLocker` reports "E2" consistently despite the boundary crossings, and only switches to "F2" after a sustained period.

## 2. Octave Priority (Fundamental Bias)
**Goal:** Correctly identify Low E (E2) vs High E (E4) or harmonics, preventing "octave jumping".
- [ ] **Implementation:** Modify `getTunerState` or creating `OctaveDiscriminator`.
  - **Logic:**
    - If multiple potential notes match (e.g., 82Hz vs 164Hz), strictly prefer the **lower** frequency unless the clarity/confidence of the higher note is significantly (e.g., >20%) higher.
    - Implement a "History Bias": If we were just tuning E2, require strong evidence to jump to E3.
- [ ] **Testing:** Update `scripts/generate_test_signals.ts`.
  - **Fixture:** `harmonic_ambiguity.json`: Signal with strong 2nd harmonic (164Hz) amplitude but present fundamental (82Hz).
  - **Test:** Verify tuner locks to E2 (Fundamental) and resists jumping to E3.

## 3. Dynamic Noise Gate
**Goal:** Don't detect fan noise, traffic, or talking as a guitar note.
- [ ] **Implementation:** Create `NoiseGate` class.
  - **Logic:**
    - Maintain a rolling average of the "noise floor" (volume when `clarity` is low).
    - Set the detection threshold to `NoiseFloor + 6dB`.
    - If `CurrentVolume < Threshold`, force state to "Listening..." (mute).
    - **Decay:** Slowly lower the threshold (1dB/sec) if no signal is present, to ensure we don't get stuck in a high-threshold state after a loud noise event.
- [ ] **Testing:** Update `scripts/generate_test_signals.ts`.
  - **Fixture:** `noise_floor_rise.json`: Silence -> Rising Background Noise -> Guitar Pluck -> Falling Noise.
  - **Test:** Verify tuner ignores the rising noise until the actual guitar pluck breaks the dynamic threshold.