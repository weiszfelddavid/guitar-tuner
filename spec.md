
## 6. Frontend UI Specification (Minimalist)
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
- **Behavior:**
  - Displays the detected note (e.g., "A", "F#").
  - **Color Transition:** Smoothly transitions from White (Listening) -> Green (Locked).

#### 2. `<CentsGauge />` (The Indicator)
- **Style:** A minimal horizontal SVG bar or arc below the note.
- **Range:** -50 cents (left) to +50 cents (right).
- **Center Marker:** A distinct notch or gap at 0 cents.
- **Indicator:** A simple circle or pill shape that slides along the track.
- **Smoothing:** CSS `transition` applied to the `transform` property to prevent "jittery" needle movement.

#### 3. `<ControlPanel />`
- **Idle State:** A single, clean "Start Tuner" button (Ghost style: outlined, transparent fill).
- **Active State:** Shows raw frequency (e.g., "440.2 Hz") in small, technical text at the bottom.

### C. Interaction States
1.  **Idle:** Screen is black. Button visible.
2.  **Listening (Silence):** Note display shows "--". Gauge is dimmed.
3.  **Detecting (Out of Tune):** Note appears white. Gauge indicator moves. Background remains black.
4.  **Locked (In Tune):**
    - Gauge snaps to center.
    - Note turns Neon Green.
    - (Optional) Entire background flashes a very subtle dark green.
