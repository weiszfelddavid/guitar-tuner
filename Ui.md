# UI Analysis Report

## Current Test Coverage
**Question:** Do our tests cover both mobile and desktop screenshots?
**Answer:** **No.** 
- The current test scripts (`screenshot.js` and `tests/melody_test.js`) explicitly hardcode the viewport to `390x844` (iPhone 12 Pro). 
- There is currently **no** automated desktop viewport screenshot generation configured in the repository.

## Detected UI Issues (Desktop)

Analysis of the `src/ui/canvas.ts` rendering logic reveals several geometric conflicts that manifest primarily on larger screens (Desktop) due to linear scaling.

### 1. Note Name and Needle Arc Overlap
- **Severity:** High
- **Description:** The "Note Name" text (e.g., "E2") overlaps with the top of the tuning needle arc and the 0-cent tick mark.
- **Technical Cause:** 
  - The vertical positioning is calculated relative to `centerY` and `radius`.
  - **Text Center Y:** `centerY - (radius * 0.6)`
  - **Arc Top Y:** `centerY + (radius * 0.6) - radius` = `centerY - (radius * 0.4)`
  - **Conflict:** The text is positioned higher (smaller Y) than the arc, but the gap is only `0.2 * radius`. 
  - The font size is set to `0.75 * radius`. This is extremely large. Half the font height is approx `0.375 * radius`.
  - **Result:** The bottom of the text extends to roughly `centerY - 0.225 * radius`. Since the Arc Top starts at `centerY - 0.4 * radius`, the text physically extends *below* the top of the arc by approximately `0.175 * radius`. On a 1080p screen (radius ~432px), this is ~75 pixels of overlap.

### 2. String Information Text Obscured
- **Severity:** High
- **Description:** The secondary text showing the string number (e.g., "6th String") is rendered directly inside the needle's sweep area.
- **Technical Cause:**
  - **Position:** `centerY - (radius * 0.6) + (fontSize * 0.6)`.
  - With `fontSize = 0.75 * radius`, this resolves to `centerY - 0.15 * radius`.
  - This position is significantly lower (larger Y) than the Arc Top (`centerY - 0.4 * radius`), placing the text deep within the active needle display area.

### 3. Excessive Font Scaling
- **Severity:** Medium
- **Description:** Text elements scale linearly with the screen size (`radius`), leading to comically large text on desktop displays.
- **Technical Cause:** `const fontSize = Math.floor(radius * 0.75);` without any clamping or maximum size limit.
