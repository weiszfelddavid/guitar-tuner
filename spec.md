## 7. Persistence & Smoothing (User Experience)
**Goal:** Allow users to see the tuning status even as the guitar string decays into silence.

### Requirements
1.  **Visual Persistence (Hold):**
    -   When the signal drops below `SILENCE_THRESHOLD`, do not immediately clear the screen.
    -   **Action:** Enter a "Hold State" for **1.5 seconds**.
    -   **Visual:** Dim the `NoteDisplay` and `CentsGauge` to 50% opacity.
    -   **Exit Conditions:**
        -   *Time Expired:* Clear to "Listening" (--) state.
        -   *New Signal:* If a valid pitch is detected, immediately update the display and restore 100% opacity.
2.  **Data Smoothing:**
    -   Apply a rolling average (or similar low-pass filter) to the `cents` value to prevent the needle from jumping erratically due to micro-fluctuations.