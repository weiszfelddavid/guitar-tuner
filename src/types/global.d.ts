// Global type extensions

import type { TunerState } from '../ui/tuner';

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
  }
}

export {};
