// Global type extensions

import type { TunerState } from '../ui/tuner';
import type { PitchDetector, initSync } from '../audio/pure_tone_lib.mjs';

/**
 * Extend Window interface with test helpers
 */
declare global {
  interface Window {
    /**
     * Get current tuner state (exposed for testing)
     * Only available in development builds
     */
    getTunerState?: () => TunerState;

    /**
     * Toggle debug console visibility
     * Only available in development builds
     */
    toggleDebugConsole?: () => boolean;
  }

  // Extend AudioWorkletGlobalScope
  interface AudioWorkletGlobalScope {
    initSync: typeof initSync;
    PitchDetector: typeof PitchDetector;
    TextDecoder: typeof TextDecoder;
    wasm: any; // The raw WASM exports object
  }
}

export {};
