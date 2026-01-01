
## 8. Premium UI Enhancements (Level Up)
**Goal:** Elevate the minimal design to a professional "instrument" quality.

### Features
1.  **Frequency Sparkline (The "Evolution"):**
    -   **Visual:** A subtle, thin SVG path running across the background.
    -   **Behavior:** Plots the pitch deviation over the last 100 frames (~2 seconds).
    -   **Style:** Low opacity (20%) white line. Smooth curve (Bezier).
2.  **Precision Ruler Gauge:**
    -   Replace the simple track with a **Graduated Ruler**.
    -   **Ticks:** Small markers at -50, -25, 0, +25, +50 cents.
    -   **Center Mark:** Prominent, glowing "diamond" or "notch" at 0.
3.  **Reactive Glow (Bloom):**
    -   The `<NoteDisplay />` should have a dynamic text-shadow.
    -   **Far:** No glow.
    -   **Close:** Soft green glow.
    -   **Locked:** Intense neon green pulse.
