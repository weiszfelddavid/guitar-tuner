// Tuner configuration constants
// Centralized location for all tuning parameters

/**
 * Strict mode (Pro) - for experienced players
 * - High clarity threshold: rejects breathy/noisy signals
 * - Low smoothing: fast, responsive needle (may be jittery)
 */
export const STRICT_MODE_CONFIG = {
  mode: 'strict' as const,
  clarityThreshold: 0.9,    // Only accept very clean signals
  smoothingFactor: 0.1      // Minimal smoothing for instant response
} as const;

/**
 * Forgiving mode (Easy) - for beginners
 * - Lower clarity threshold: accepts breathy/noisy signals
 * - Higher smoothing: stable, smooth needle (slower response)
 */
export const FORGIVING_MODE_CONFIG = {
  mode: 'forgiving' as const,
  clarityThreshold: 0.6,    // Accept noisier signals
  smoothingFactor: 0.3      // More smoothing for stable reading
} as const;

/**
 * Attack smoothing - fast response during pluck transients
 * Used during the initial attack phase (first 200ms after pluck)
 */
export const ATTACK_SMOOTHING_FACTOR = 0.5;

/**
 * Kalman filter measurement noise
 * Controls how much we trust incoming measurements vs predicted values
 */
export const KALMAN_MEASUREMENT_NOISE = 0.1;
