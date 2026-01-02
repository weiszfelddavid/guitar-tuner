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

## UI/UX Design Expectations
- **Minimal & Direct:** The interface must be clutter-free. The primary focus is the tuning visualization.
- **App-Like Hero Experience:** On both mobile and desktop, the tuner interface should occupy the primary viewport (approx. 85-90vh), creating a "hero" section that feels like a native application. 
- **Below-the-Fold SEO:** Content intended for SEO (descriptions, tables, tips) must live below the main tuner interface to avoid distracting the user from the tool's utility.
- **Responsive Fluidity:** Typography (especially the note display) must use fluid sizing (e.g., clamp) to remain impactful but well-proportioned across all device widths.
- **Zero Friction:** Avoid unnecessary clicks. If permissions are granted, the tool should be ready or active immediately.