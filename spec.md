
## 9. Visual Testing & Debugging
**Goal:** Automated visual verification of the UI on different devices.

### Workflow
1.  **Tool:** Playwright is used to capture screenshots of the deployed application.
2.  **Script:** `scripts/capture-ui.js` automates the process.
3.  **Targets:**
    -   **Mobile:** iPhone 13 (Viewport: 390x844)
    -   **Desktop:** Standard 1920x1080
4.  **Analysis:** The AI Agent analyzes the captured screenshots in `debug-screenshots/` to identify layout issues, cropping, or visual bugs.

## UI/UX Design Expectations
- **Minimal & Direct:** The interface must be clutter-free. The primary focus is the tuning visualization.
- **App-Like Hero Experience:** On both mobile and desktop, the tuner interface should occupy the primary viewport (approx. 85-90vh), creating a "hero" section that feels like a native application. 
- **Below-the-Fold SEO:** Content intended for SEO (descriptions, tables, tips) must live below the main tuner interface to avoid distracting the user from the tool's utility.
- **Responsive Fluidity:** Typography (especially the note display) must use fluid sizing (e.g., clamp) to remain impactful but well-proportioned across all device widths.
- **Zero Friction:** Avoid unnecessary clicks. If permissions are granted, the tool should be ready or active immediately.
