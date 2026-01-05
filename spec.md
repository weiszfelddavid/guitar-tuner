# SYSTEM SPECIFICATION: The "Nobuild" Design System
**Version:** 1.0 (Jan 2026)
**Context:** Tuner Application (Desktop & Mobile)
**Philosophy:** Vanilla CSS, No Build Tools, Native Web Platform Features.

---

## 1. CORE DIRECTIVES (Strict Adherence Required)
When generating or refactoring code for the Tuner Application, you must adhere to the following constraints.

1.  **NO Build Tools:** Do not suggest Sass, SCSS, Less, PostCSS, or Tailwind. Output standard, modern CSS files.
2.  **NO JavaScript for Style:** Do not use JS for UI state that can be handled by CSS (e.g., `:hover`, `:focus`, `:active`, `details`/`summary`, sticky positioning). Use JS only for toggling class names (e.g., `.is-active`).
3.  **Native Features:** Prioritize `clamp()`, `calc()`, `grid`, `flex`, and CSS Custom Properties (Variables).
4.  **Semantic Markup:** Use proper HTML5 tags (`<main>`, `<nav>`, `<article>`, `<button>`) to ensure accessibility without heavy ARIA patching.

## 2. Design Tokens (CSS Variables)
All design values must be defined in `:root` and consumed via `var(--...)`.

### Color Palette
-   `--bg-main`: The deep OLED black background.
-   --bg-panel`: Slightly lighter black for cards/containers.
-   `--text-primary`: High contrast white/off-white.
-   `--text-secondary`: Muted grey for labels.
-   `--accent-primary`: The main brand color (e.g., Green/Orange).

### Typography
-   `--font-stack`: System UI font stack for max performance.
-   `--text-hero`: Fluid size for the main note display.

## 3. Component Patterns
-   **Layouts:** Use CSS Grid for page structure, Flexbox for internal component alignment.
-   **Spacing:** Use `rem` for all spacing to respect user font settings.
-   **Responsiveness:** Mobile-first media queries.