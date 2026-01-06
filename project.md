# Project Specification: Precision Web Tuner

**Version:** 2.0.0
**Last Updated:** January 6, 2026
**Status:** Active Development

## 1. Project Overview
A high-performance, professional-grade instrument tuner running entirely in the browser. It combines the accuracy of hardware tuners with the accessibility of the web.

### Philosophy
*   **"Precision for Pros, Simplicity for Everyone":** Accurate enough for audio engineers, simple enough for beginners.
*   **"Nobuild" Design System:** Vanilla CSS, native DOM features, zero runtime styling overhead.
*   **Performance First:** Zero-bloat, instant load, efficient AudioWorklet processing.
*   **Global Reach:** Fully localized (i18n).

---

## 2. Technology Stack

### Core Application
*   **Framework:** React 19
*   **Language:** TypeScript (~5.9)
*   **Build Tool:** Vite 7 (ESBuild/Rollup)
*   **Routing:** React Router v7
*   **State Management:** React Hooks (`useAudioTuner`, `useState`, `useRef`) + Zustand (available)
*   **Audio Engine:** Native Web Audio API (`AudioContext`, `AudioWorklet`)

### Testing & Quality
*   **Unit Testing:** Vitest
*   **DOM Testing:** React Testing Library
*   **Linting:** ESLint (React/TS configs)

### Mobile & Deployment
*   **Mobile Wrapper:** Capacitor 8 (iOS/Android ready)
*   **Server:** Caddy (Reverse Proxy/Static File Server)
*   **Infrastructure:** DigitalOcean Droplet
*   **CI/CD:** GitHub Actions

---

## 3. Architecture

### 3.1 Audio Pipeline
To ensure UI thread responsiveness and low latency, heavy signal processing is offloaded to a dedicated thread.
1.  **Input:** `navigator.mediaDevices.getUserMedia` captures microphone stream.
2.  **Audio Context:** Creates the graph.
3.  **Audio Worklet (`PitchProcessor.js`):** Runs custom autocorrelation/YIN-like algorithms on the audio thread.
    *   Calculates Pitch (Hz), Clarity (Confidence), and RMS (Volume).
    *   Sends `MessagePort` updates to the main thread (~60fps).
4.  **React Hook (`useAudioTuner`):**
    *   Receives worklet messages.
    *   Smoothes data (moving average).
    *   Updates React state for UI components.

### 3.2 Routing
The app uses a specific URL structure for instrument and tuning selection.
*   **Pattern:** `/:instrument/:tuning`
*   **Behavior:**
    *   **Root (`/`):** Redirects to default tuning (e.g., `/guitar/standard`).
    *   **Dynamic Route:** Loads `TuningPage`.
    *   **Auto-Configuration:** The URL determines the active tuning mode immediately.

### 3.3 Internationalization (i18n)
*   **Strategy:** Subdirectory-based (`/es/`, `/fr/`, etc.).
*   **Implementation:** `useTranslation` hook loads JSON files from `src/locales/`.
*   **Locales:** en, es, fr, de, it, pt, ru, ja, zh, ko.

---

## 4. Design System ("Nobuild")

Adheres to a strict **Vanilla CSS** methodology to ensure future-proofing and performance.

*   **CSS Variables:** Defined in `:root` (e.g., `--bg-main`, `--accent-locked`).
*   **Typography:** System font stack (`system-ui`, `-apple-system`) for native feel and zero network latency.
*   **Layout:** CSS Grid for macro layout, Flexbox for components.
*   **Responsiveness:** Mobile-first media queries.
*   **Constraint:** NO Sass, NO Tailwind, NO CSS-in-JS libraries.

---

## 5. Feature Specification

### 5.1 Core Tuner
*   **Pitch Detection:** Accurate to < 1 cent.
*   **Silence Gate:** Prevents background noise from triggering the tuner.
*   **Locking Mechanism:** Visual feedback (Green color/UI shift) when pitch is stable and correct.
*   **Auto-Resume:** Handles visibility changes to save battery/CPU.

### 5.2 Visualizations
*   **Analog Meter:** Skeuomorphic needle indicating cents deviation.
*   **Note Display:** Large, high-contrast current note readout.
*   **Sparkline:** Real-time history graph of pitch stability.
*   **Waveform Scope:** Oscilloscope view of the raw audio signal.
*   **String Visualizer:** Visual representation of instrument headstock/strings highlighting the target string.
*   **Sound Level:** Simple bar/LED indicator for input gain.

### 5.3 Technical Pages
*   **Technical Overview:** `/technical-overview` page detailing the engineering approach (for portfolio/transparency).

---

## 6. Directory Structure

```
/root/guitar-tuner/
├── public/                 # Static assets (favicons)
│   └── PitchProcessor.js   # Audio Worklet Code (Must be public)
├── src/
│   ├── components/         # React Components
│   │   ├── tuner/          # Tuner-specific sub-components
│   │   └── ...
│   ├── hooks/              # Custom Hooks (useAudioTuner, useTranslation)
│   ├── layouts/            # Page Layouts (MainLayout)
│   ├── locales/            # i18n JSON files
│   ├── pages/              # Route Targets (TuningPage)
│   ├── utils/              # Helper functions (math, frequency maps)
│   ├── App.css             # Global styles
│   └── main.tsx            # Entry point
├── .github/                # CI/CD Workflows
├── capacitor.config.ts     # Mobile build config
└── vite.config.ts          # Build configuration
```

## 7. Development & Deployment

### Commands
*   `npm run dev`: Start local development server.
*   `npm run build`: Type-check and build for production.
*   `npm run preview`: Preview the production build locally.
*   `npm run test`: Run unit tests via Vitest.

### Environment
*   **Node:** >= 20.x recommended.
*   **Browser:** Requires AudioWorklet support (Modern Chrome, Firefox, Safari, Edge).

### Deployment
*   **Platform:** DigitalOcean Droplet (Ubuntu).
*   **Server:** Caddy Web Server (handles SSL, Gzip, SPA routing).
*   **Process:** GitHub Action builds functionality, SCPs artifacts to server, reloads Caddy.
