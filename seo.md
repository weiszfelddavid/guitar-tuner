# SEO Dominance Strategy: Guitar Tuner

## 1. Executive Summary
**Goal:** Achieve #1 ranking for high-volume keywords ("Guitar Tuner", "Bass Tuner", "Online Tuner") without compromising the instant-utility UX of the root domain.

**Strategy:** "Hub & Spoke" Architecture.
-   **The Hub (Root `/`):** Instant, zero-friction tool. No SEO bloat above the fold.
-   **The Spokes (Landing Pages):** Dedicated, content-rich pages for specific instruments (e.g., `/bass-tuner`, `/ukulele-tuner`) that target long-tail keywords and funnel users to the Hub with pre-selected settings.

---

## 2. Technical SEO (The Foundation)

### A. Meta Tags & Schema (Root & Pages)
Every page must include:
1.  **Title Tags:** Formula: `[Instrument] Tuner | Free Online Microphone Tuner | [Brand]`
2.  **Meta Description:** Action-oriented. "Tune your [Instrument] in seconds. Accurate, free, and no download required. Works with your microphone."
3.  **JSON-LD Structured Data:**
    -   `WebApplication`: Telling Google this is software.
    -   `HowTo`: Step-by-step tuning instructions (Google often features these in "Position Zero" snippets).
    -   `FAQPage`: Common questions (e.g., "Standard tuning Hz?").

### B. Performance (Core Web Vitals)
-   **LCP (Largest Contentful Paint):** Must be < 2.5s. Our minimalist SVG UI gives us a massive advantage over ad-heavy competitors.
-   **CLS (Cumulative Layout Shift):** 0. The tuner must be rock solid.
-   **Mobile-First:** Google indexes mobile versions first. Our responsive design is critical.

### C. Sitemap & Robots
-   `sitemap.xml`: Auto-generated list of all landing pages.
-   `robots.txt`: Allow full crawling.

---

## 3. Landing Page Architecture (The "Spokes")

We will create dedicated routes (using React Router) for specific search intents. These pages will serve two purposes: **Ranking** (via text content) and **Utility** (pre-setting the tuner).

### Proposed URL Structure
| URL Path | Target Keyword | Tuning Preset (Auto-loaded) |
| :--- | :--- | :--- |
| `/` | "Online Tuner", "Chromatic Tuner" | Last used / Standard Guitar |
| `/guitar-tuner` | "Guitar Tuner", "Standard Tuning" | Guitar (Standard) |
| `/bass-tuner` | "Bass Tuner", "Tune Bass Guitar" | Bass (Standard) |
| `/ukulele-tuner` | "Ukulele Tuner" | Ukulele |
| `/drop-d-tuner` | "Drop D Tuner", "Metal Tuning" | Guitar (Drop D) |
| `/cello-tuner` | "Cello Tuner" | Cello |

### Landing Page Content Layout (Below the Fold)
The "Tuner" remains at the top. *Below* the fold, we inject 800-1200 words of semantic HTML content:
1.  **H1:** "Free Online [Instrument] Tuner"
2.  **H2:** "How to tune a [Instrument]" (Step-by-step list).
3.  **H2:** "Standard [Instrument] String Frequencies" (HTML Table).
    *   *Why:* Google loves tables for "featured snippets".
4.  **H2:** "Common Problems" (FAQ section).

---

## 4. Competitor Audit & Attack Plan

| Competitor | Weakness | Our Attack |
| :--- | :--- | :--- |
| **GuitarTuna / Fender** | Heavy apps, push paid subscriptions, slow web load. | **Speed & Free.** We load instantly. No ads. |
| **Google Tuner** | Basic, embedded in search, hard to find on mobile. | **Precision & Visuals.** Our "Diamond Gauge" and "Sparkline" offer better feedback. |
| **Generic Sites** | Ad-riddled, ugly, require Flash (legacy). | **Modern UX.** Clean, dark mode, professional UI. |

---

## 5. Implementation Roadmap

### Phase 1: The Root Upgrade (Completed)
-   [x] Inject "Global" SEO tags into `index.html`.
-   [x] Add `sitemap.xml` and `robots.txt`.
-   [x] Add a discreet "SEO Footer" to the root page with links to future landing pages (Internal Linking).

### Phase 2: React Router & Dynamic Routes (Completed)
-   [x] Install `react-router-dom`.
-   [x] Refactor `App.tsx` to handle routes (e.g., visiting `/bass` automatically sets `selectedTuning` to Bass).
-   [x] Create a `ContentSection` component (`SEOFooter.tsx`) that renders text *below* the tuner based on the current route.
-   [x] Implement server-side routing fix (Caddy `try_files` or SPA fallback) to prevent 404s on deep links.

### Phase 3: Content & Schema (Completed)
-   [x] Generate high-quality copy for Guitar, Bass, Ukulele, and Drop D (Localized in `locales/*.json`).
-   [x] Create HTML tables for frequencies (Hz) for each instrument.
-   [x] **DONE:** Inject Dynamic JSON-LD Structured Data (`HowTo`, `FAQPage`) into `TuningPage.tsx` using `react-helmet-async`.
    *   *Why:* Critical for "Featured Snippets" and "People Also Ask" boxes.

### Phase 4: Verification (Pending)
-   [ ] Verify using Google Search Console (External Action).
-   [ ] Monitor "Impressions" vs "Clicks".
