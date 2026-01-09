// ============================================================================
// TUNER CONFIGURATION CONSTANTS
// ============================================================================
// Centralized location for all tuning parameters, thresholds, and magic numbers
// This file eliminates scattered numeric literals throughout the codebase

// ============================================================================
// MODE CONFIGURATIONS
// ============================================================================

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

// ============================================================================
// KALMAN FILTER CONSTANTS
// ============================================================================

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

// ============================================================================
// AUDIO BUFFER CONSTANTS
// ============================================================================

/**
 * Audio buffer size for pitch detection (samples)
 * 4096 samples at 48kHz = ~85ms window
 * Larger = better frequency resolution but higher latency
 */
export const AUDIO_BUFFER_SIZE = 4096;

/**
 * Update interval for pitch detection (samples)
 * Process pitch every 800 samples at 48kHz = ~16.7ms (~60Hz)
 */
export const PITCH_UPDATE_INTERVAL_SAMPLES = 800;

// ============================================================================
// SIGNAL PROCESSING CONSTANTS
// ============================================================================

/**
 * Pitch stabilizer buffer size (frames)
 * Stores last 11 pitch measurements for median filtering
 */
export const PITCH_STABILIZER_BUFFER_SIZE = 11;

/**
 * Pitch ratio tolerance for outlier rejection (±3%)
 * Samples within 0.97-1.03x of median are considered valid
 */
export const PITCH_RATIO_TOLERANCE_MIN = 0.97;
export const PITCH_RATIO_TOLERANCE_MAX = 1.03;

/**
 * Minimum clarity required for pitch stabilizer to accept samples
 * Only high-clarity pitches (>0.9) are added to the buffer
 */
export const PITCH_CLARITY_THRESHOLD = 0.9;

// ============================================================================
// NOISE GATE CONSTANTS
// ============================================================================

/**
 * Noise gate threshold above noise floor (dB)
 * Signal must be 6dB louder than adaptive noise floor to pass
 */
export const NOISE_GATE_THRESHOLD_DB = 6;

/**
 * Noise floor smoothing factor (0-1)
 * Lower = slower adaptation, higher = faster tracking
 */
export const NOISE_GATE_ALPHA = 0.1;

/**
 * Fast adaptation rate for rising noise
 * Used when volume exceeds noise floor during low-clarity periods
 */
export const NOISE_FLOOR_FAST_ADAPT_RATE = 0.05;

/**
 * Slow adaptation rate for falling noise
 * Default tracking rate during low-clarity periods
 */
export const NOISE_FLOOR_SLOW_ADAPT_RATE = 0.1;

/**
 * Noise floor decay rate during clean signal
 * Multiplier applied when clarity > 0.8
 */
export const NOISE_FLOOR_DECAY_RATE = 0.95;

/**
 * Clarity threshold for noise floor adaptation
 * Below this, adapt noise floor; above this, decay noise floor
 */
export const NOISE_DETECTION_CLARITY_THRESHOLD = 0.8;

// ============================================================================
// ATTACK DETECTION CONSTANTS
// ============================================================================

/**
 * Pluck detection threshold (dB increase)
 * Volume must increase by 15dB to trigger attack state
 */
export const ATTACK_DB_THRESHOLD = 15;

/**
 * Attack duration (milliseconds)
 * How long to maintain "attacking" state after pluck detection
 */
export const ATTACK_DURATION_MS = 200;

/**
 * Smoothing factor during attack phase
 * Fast response for pluck transients
 */
export const ATTACK_FACTOR = 0.1;

/**
 * Smoothing factor during sustain phase
 * Normal response after attack window
 */
export const SUSTAIN_FACTOR = 1.0;

// ============================================================================
// STRING LOCKING CONSTANTS
// ============================================================================

/**
 * Hysteresis threshold for string locking (frames)
 * New string must be detected for 15 consecutive frames to switch
 * Prevents rapid jumping between adjacent strings
 */
export const STRING_LOCK_HYSTERESIS_FRAMES = 15;

// ============================================================================
// VISUAL HOLD CONSTANTS
// ============================================================================

/**
 * Note display hold duration in forgiving mode (milliseconds)
 * Holds last valid note for 4 seconds to account for guitar sustain
 */
export const FORGIVING_HOLD_DURATION_MS = 4000;

/**
 * Note display hold duration in strict mode (milliseconds)
 * Brief 400ms hold to prevent visual flicker
 */
export const STRICT_HOLD_DURATION_MS = 400;

// ============================================================================
// PITCH DETECTION CONSTANTS
// ============================================================================

/**
 * Minimum valid pitch frequency (Hz)
 * Below this is considered invalid/noise (60Hz is below E2 @ 82.41Hz)
 */
export const MIN_VALID_PITCH_HZ = 60;

/**
 * Maximum valid pitch frequency (Hz)
 * Above this is considered invalid/harmonic (500Hz is above E4 @ 329.63Hz)
 */
export const MAX_VALID_PITCH_HZ = 500;

/**
 * Minimum volume threshold for pitch detection
 * Below this, signal is considered silence
 */
export const MIN_VOLUME_THRESHOLD = 0.01;

/**
 * Clarity threshold for "tuned" lock indicator
 * Clarity must exceed 0.95 for visual lock indication
 */
export const TUNED_CLARITY_THRESHOLD = 0.95;

/**
 * Cents threshold for "tuned" lock indicator
 * Pitch must be within ±2 cents for visual lock indication
 */
export const TUNED_CENTS_THRESHOLD = 2;

// ============================================================================
// OCTAVE DISCRIMINATION CONSTANTS
// ============================================================================

/**
 * Clarity threshold for octave discrimination
 * Below 0.98, prefer fundamental over harmonic
 */
export const OCTAVE_DISCRIMINATION_CLARITY = 0.98;

/**
 * Cents tolerance for string matching (±100 cents = ±1 semitone)
 * Used to detect if a pitch matches a guitar string frequency
 */
export const OCTAVE_CENTS_TOLERANCE = 100;

// ============================================================================
// UI & TIMING CONSTANTS
// ============================================================================

/**
 * AudioContext state check interval (milliseconds)
 * How often to check if AudioContext needs resuming
 */
export const AUDIO_CONTEXT_CHECK_INTERVAL_MS = 1000;

/**
 * WASM initialization timeout (milliseconds)
 * Maximum time to wait for WASM module to initialize
 */
export const WASM_INIT_TIMEOUT_MS = 5000;

/**
 * Volume meter sensitivity scale
 * RMS volume of 0.3 is treated as maximum for visualization
 */
export const VOLUME_METER_SENSITIVITY_SCALE = 0.3;

/**
 * Volume meter display threshold
 * Volume must exceed this to show meter as active
 */
export const VOLUME_METER_DISPLAY_THRESHOLD = 0.01;

/**
 * Volume threshold for "good" signal indicator
 * Volume above 0.8 (after sensitivity scaling) indicates optimal input
 */
export const VOLUME_GOOD_THRESHOLD = 0.8;

/**
 * Cents display range (±50 cents)
 * Visual needle shows ±50 cents from center
 */
export const CENTS_DISPLAY_RANGE = 50;

/**
 * Maximum needle angle (degrees)
 * Needle rotates ±45 degrees from vertical
 */
export const NEEDLE_MAX_ANGLE_DEG = 45;
