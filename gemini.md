# Project Context: Guitar Tuner

## 1. Project Overview
A web and mobile-capable guitar tuner application built with React, Vite, and Capacitor. It uses modern web audio APIs (AudioWorklet) for high-performance pitch detection.

**Design Goal:** Elevate the minimal design to a professional "instrument" quality. Ensure all UI updates contribute to a polished, high-fidelity user experience.

## 2. Tech Stack
-   **Framework:** React 19
-   **Language:** TypeScript
-   **Build Tool:** Vite
-   **Mobile Runtime:** Capacitor 8
-   **State Management:** Zustand (`src/store`)
-   **Testing:** Vitest, React Testing Library
-   **Styling:** CSS Modules / Standard CSS (App.css, index.css) with `clsx` for class management.

## 3. Directory Structure
```
/src
  /assets         # Static assets (images, SVGs)
  /audio          # Core Audio Logic
    /engine       # AudioWorklet processors and audio context management
  /store          # Zustand state stores
  /utils          # Helper functions (pitch calculations, math)
  App.tsx         # Main entry component
  main.tsx        # Application mount point
/tests            # Integration and E2E tests
```

## 4. Coding Conventions
-   **Components:** Use Functional Components with Hooks.
-   **Typing:** Strict TypeScript. Avoid `any`. Define interfaces for props and state.
-   **State:** Use local state (`useState`) for UI-only transient state. Use **Zustand** for global app state (tuner settings, active note, etc.).
-   **Audio:** Audio processing logic belongs in `src/audio`. UI components should only visualize data, not process audio directly.
-   **Testing:** Write unit tests for logic in `src/utils` and `src/audio`. Write component tests using `@testing-library/react`.

## 5. Key Commands
-   **Start Dev Server:** `npm run dev`
-   **Run Tests:** `npm run test`
-   **Build for Production:** `npm run build`
-   **Lint:** `npm run lint`

## 6. Architecture Notes
-   The application likely uses an `AudioWorklet` to process raw microphone data off the main thread to ensure smooth UI rendering.
-   Global state is managed via Zustand to synchronize the UI with the audio engine's detected pitch.
