// src/ui/canvas.ts
import { TunerState, getStringInfo } from './tuner';
import {
  VOLUME_METER_SENSITIVITY_SCALE,
  VOLUME_METER_DISPLAY_THRESHOLD,
  VOLUME_GOOD_THRESHOLD,
  CENTS_DISPLAY_RANGE,
  NEEDLE_MAX_ANGLE_DEG
} from '../constants/tuner-config';

export class TunerCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number = 0;
  private height: number = 0;
  private needleAngle: number = 0; // Current smoothed angle in degrees

  // Volume Meter State (Ballistics)
  private displayedVolume: number = 0;
  private peakVolume: number = 0;
  private peakTimer: number = 0;
  private lastFrameTime: number = 0;

  // Performance optimization: Offscreen canvas for static elements
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;
  private staticElementsCached: boolean = false;

  // Performance optimization: Dirty tracking for selective redraws
  private lastState: {
    noteName: string;
    cents: number;
    frequency: number;
    volume: number;
  } = {
    noteName: '--',
    cents: 0,
    frequency: 0,
    volume: 0
  };

  // CSS Custom Properties cache
  private colors: {
    bg: string;
    text: string;
    textMuted: string;
    textSubtle: string;
    success: string;
    warning: string;
    danger: string;
    accent: string;
    border: string;
  };

  constructor(canvasId: string) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) throw new Error(`Canvas with id ${canvasId} not found`);
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!; // alpha: false for performance

    // Load colors from CSS custom properties
    this.colors = this.loadColors();

    // Handle resizing
    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.lastFrameTime = performance.now();
  }

  private loadColors() {
    const style = getComputedStyle(document.documentElement);
    return {
      bg: style.getPropertyValue('--color-bg').trim() || '#1a1a1a',
      text: style.getPropertyValue('--color-text').trim() || '#ffffff',
      textMuted: style.getPropertyValue('--color-text-muted').trim() || '#888888',
      textSubtle: style.getPropertyValue('--color-text-subtle').trim() || '#666666',
      success: style.getPropertyValue('--color-success').trim() || '#00ff00',
      warning: style.getPropertyValue('--color-warning').trim() || '#ffaCENTS_DISPLAY_RANGE0',
      danger: style.getPropertyValue('--color-danger').trim() || '#ff0000',
      accent: style.getPropertyValue('--color-accent').trim() || '#4a9eff',
      border: style.getPropertyValue('--color-border').trim() || 'rgba(255,255,255,0.2)',
    };
  }

  private resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    // 1. Set Physical Resolution (High DPI)
    this.canvas.width = this.width * window.devicePixelRatio;
    this.canvas.height = this.height * window.devicePixelRatio;

    // 2. Set Logical Display Size (CSS)
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    // 3. Normalize Coordinate System
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // 4. Invalidate static elements cache (dimensions changed)
    this.staticElementsCached = false;

    // 5. Recreate offscreen canvas with new dimensions
    this.createOffscreenCanvas();
  }

  /**
   * Create offscreen canvas for caching static elements
   */
  private createOffscreenCanvas() {
    if (!this.offscreenCanvas) {
      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCtx = this.offscreenCanvas.getContext('2d', { alpha: true })!;
    }

    // Match dimensions of main canvas
    this.offscreenCanvas.width = this.canvas.width;
    this.offscreenCanvas.height = this.canvas.height;

    // Reset transform and scale to match main canvas
    this.offscreenCtx!.resetTransform();
    this.offscreenCtx!.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  /**
   * Helper method to draw static elements to any context
   */
  private drawStaticElementsToContext(ctx: CanvasRenderingContext2D) {
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const radius = Math.min(this.width, this.height) * 0.4;
    const fontSize = Math.min(Math.floor(radius * 0.75), 80);
    const verticalOffset = radius * 0.6;
    const pivotY = centerY + verticalOffset;

    // Draw Scale Arc
    ctx.beginPath();
    ctx.strokeStyle = this.colors.textSubtle;
    ctx.lineWidth = 4;
    ctx.arc(centerX, pivotY, radius, Math.PI * 1.25, Math.PI * 1.75);
    ctx.stroke();

    // Draw Target Zone (±5 cents) - Green highlight in center
    ctx.beginPath();
    ctx.strokeStyle = this.colors.success + '33';
    ctx.lineWidth = 8;
    const targetAngleRange = (5 / CENTS_DISPLAY_RANGE) * (Math.PI / 4);
    const centerAngle = Math.PI * 1.5;
    ctx.arc(centerX, pivotY, radius, centerAngle - targetAngleRange, centerAngle + targetAngleRange);
    ctx.stroke();

    // Draw Tick Marks - only center marker
    const tickPositions = [0];
    tickPositions.forEach(cents => {
      const angleDeg = (cents / CENTS_DISPLAY_RANGE) * NEEDLE_MAX_ANGLE_DEG;
      const angleRad = (angleDeg - 90) * (Math.PI / 180);

      const tickLength = 20;
      const tickWidth = 3;

      const innerRadius = radius - 5;
      const outerRadius = radius + tickLength - 5;
      const startX = centerX + innerRadius * Math.cos(angleRad);
      const startY = pivotY + innerRadius * Math.sin(angleRad);
      const endX = centerX + outerRadius * Math.cos(angleRad);
      const endY = pivotY + outerRadius * Math.sin(angleRad);

      ctx.beginPath();
      ctx.strokeStyle = this.colors.success;
      ctx.lineWidth = tickWidth;
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    });

    // Draw Flat symbol (♭) at the left end of the arc
    const flatAngleDeg = -NEEDLE_MAX_ANGLE_DEG;
    const flatAngleRad = (flatAngleDeg - 90) * (Math.PI / 180);
    const flatRadius = radius + 25;
    const flatX = centerX + flatRadius * Math.cos(flatAngleRad);
    const flatY = pivotY + flatRadius * Math.sin(flatAngleRad);

    const symbolFontSize = Math.min(Math.floor(fontSize * 0.25), 20);
    ctx.font = `${symbolFontSize}px sans-serif`;
    ctx.fillStyle = this.colors.textSubtle;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♭', flatX, flatY);

    // Draw Sharp symbol (#) at the right end of the arc
    const sharpAngleDeg = NEEDLE_MAX_ANGLE_DEG;
    const sharpAngleRad = (sharpAngleDeg - 90) * (Math.PI / 180);
    const sharpRadius = radius + 25;
    const sharpX = centerX + sharpRadius * Math.cos(sharpAngleRad);
    const sharpY = pivotY + sharpRadius * Math.sin(sharpAngleRad);

    ctx.fillText('#', sharpX, sharpY);
  }

  /**
   * Render static elements to offscreen canvas (arc, target zone, tick marks, symbols)
   * This is only called when dimensions change, not every frame
   */
  private renderStaticElements() {
    if (!this.offscreenCtx || this.staticElementsCached) return;

    // Clear offscreen canvas
    this.offscreenCtx.clearRect(0, 0, this.width, this.height);

    // Draw static elements to offscreen canvas
    this.drawStaticElementsToContext(this.offscreenCtx);

    // Mark cache as valid
    this.staticElementsCached = true;
  }

  public render(state: TunerState, smoothedCents: number) {
    const now = performance.now();
    const dt = (now - this.lastFrameTime) / 1000; // Delta time in seconds
    this.lastFrameTime = now;

    // Ensure static elements are cached
    this.renderStaticElements();

    // Clear canvas
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Background
    this.ctx.fillStyle = this.colors.bg;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Draw cached static elements from offscreen canvas
    if (this.offscreenCanvas && this.staticElementsCached) {
      try {
        this.ctx.drawImage(this.offscreenCanvas, 0, 0);
      } catch (e) {
        // Fallback: If drawImage fails (e.g., in some test environments),
        // draw static elements directly to main canvas
        this.drawStaticElementsToContext(this.ctx);
      }
    } else if (!this.staticElementsCached) {
      // If cache is not available, draw directly
      this.drawStaticElementsToContext(this.ctx);
    }

    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const radius = Math.min(this.width, this.height) * 0.4;

    // Clamp font size to prevent excessive scaling on desktop
    const fontSize = Math.min(Math.floor(radius * 0.75), 80);
    const verticalOffset = radius * 0.6; // Push text up and needle down

    // Draw Note Name - just the letter, positioned above the arc
    const noteNameY = centerY - verticalOffset - fontSize * 0.35;

    if (state.noteName !== '--') {
      // Extract just the note letter (E, A, D, G, B) without octave number
      const noteLetter = state.noteName.charAt(0);

      this.ctx.font = `bold ${fontSize}px sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillStyle = this.colors.text;
      this.ctx.fillText(noteLetter, centerX, noteNameY);

      // Draw Hz and Cents side-by-side below the note letter
      const infoFontSize = Math.min(Math.floor(fontSize * 0.18), 16);
      const infoY = noteNameY + fontSize * 0.55;

      this.ctx.font = `${infoFontSize}px sans-serif`;
      this.ctx.fillStyle = this.colors.textMuted;
      this.ctx.fillText(`${state.frequency.toFixed(1)} Hz  •  ${state.cents > 0 ? '+' : ''}${state.cents.toFixed(1)}¢`, centerX, infoY);
    } else {
      // Show "--" when no note detected
      this.ctx.font = `bold ${fontSize}px sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillStyle = this.colors.text;
      this.ctx.fillText('--', centerX, noteNameY);
    }

    // Pivot point for needle
    const pivotY = centerY + verticalOffset;

    if (state.noteName !== '--') {
        // Map cents (-CENTS_DISPLAY_RANGE to +CENTS_DISPLAY_RANGE) to angle (-NEEDLE_MAX_ANGLE_DEG to +NEEDLE_MAX_ANGLE_DEG degrees)
        // Clamp cents
        const clampedCents = Math.max(-CENTS_DISPLAY_RANGE, Math.min(CENTS_DISPLAY_RANGE, smoothedCents));
        const angleDeg = (clampedCents / CENTS_DISPLAY_RANGE) * NEEDLE_MAX_ANGLE_DEG;

        // Convert to radians for math (0 is up, -PI/2 is left)
        const angleRad = (angleDeg - 90) * (Math.PI / 180);

        // Calculate bead position on the arc
        const beadX = centerX + radius * Math.cos(angleRad);
        const beadY = pivotY + radius * Math.sin(angleRad);

        // Determine bead color based on tuning accuracy
        let beadColor;
        if (Math.abs(clampedCents) <= 5) {
            beadColor = this.colors.success; // Green - in tune
        } else if (Math.abs(clampedCents) <= 15) {
            beadColor = this.colors.warning; // Orange - close
        } else {
            beadColor = this.colors.danger; // Red - out of tune
        }

        // Draw bead (solid circle on the arc)
        const beadRadius = Math.min(12, radius * 0.05); // Responsive bead size

        this.ctx.save();
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        this.ctx.shadowBlur = 8;
        this.ctx.shadowOffsetX = 2;
        this.ctx.shadowOffsetY = 2;

        this.ctx.beginPath();
        this.ctx.fillStyle = beadColor;
        this.ctx.arc(beadX, beadY, beadRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // Add subtle border to bead
        this.ctx.shadowColor = 'transparent';
        this.ctx.strokeStyle = this.colors.text;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        this.ctx.restore();
    } else {
        // Draw "Listening" text
        const listeningFontSize = Math.min(Math.floor(fontSize * 0.2), 18);
        this.ctx.font = `${listeningFontSize}px sans-serif`;
        this.ctx.fillStyle = this.colors.textSubtle;
        this.ctx.fillText("Listening...", centerX, pivotY);
    }
    
    // ---------------------------------------------------------
    // "Input Health" Meter (Signal Quality)
    // ---------------------------------------------------------
    
    // 1. Normalize Volume (0.0 to 1.0)
    // RMS is typically small. We scale it up.
    // VOLUME_METER_SENSITIVITY_SCALE RMS is treated as "Max/Clipping" for visualization.
    const targetVolume = Math.min(state.volume / VOLUME_METER_SENSITIVITY_SCALE, 1.0);

    // 2. Ballistics: Instant Rise, Slow Decay
    const DECAY_RATE = 0.5; // Units per second
    if (targetVolume > this.displayedVolume) {
        this.displayedVolume = targetVolume; // Instant rise
    } else {
        this.displayedVolume = Math.max(0, this.displayedVolume - (DECAY_RATE * dt)); // Slow decay
    }

    // 3. Peak Hold Logic
    if (this.displayedVolume > this.peakVolume) {
        this.peakVolume = this.displayedVolume;
        this.peakTimer = 1.0; // Hold for 1 second
    } else {
        this.peakTimer -= dt;
        if (this.peakTimer <= 0) {
             // Drop peak slowly after hold
             this.peakVolume = Math.max(this.displayedVolume, this.peakVolume - (DECAY_RATE * dt));
        }
    }

    // 4. Draw The Meter
    // Always show meter so users can verify microphone is working
    const barWidth = this.width * 0.6;
    const barHeight = 4;
    const barX = (this.width - barWidth) / 2;
    const barY = this.height - 40;

    const hasSignal = this.displayedVolume > VOLUME_METER_DISPLAY_THRESHOLD || this.peakVolume > VOLUME_METER_DISPLAY_THRESHOLD;

    // Background Track - Always visible
    // Dim when no signal, brighter when active
    this.ctx.fillStyle = hasSignal ? this.colors.textSubtle : 'rgba(255, 255, 255, 0.1)';
    this.ctx.fillRect(barX, barY, barWidth, barHeight);

    // Show "READY" indicator when no signal (mic is working but silent)
    if (!hasSignal) {
        this.ctx.font = `11px sans-serif`;
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('MIC READY', centerX, barY - 10);
    }

    if (hasSignal) {
        // Determine Zone Color & Feedback Text
        let zoneColor = this.colors.textSubtle; // Default Weak
        let feedbackText = "";
        let feedbackIcon = "";

        if (this.displayedVolume > VOLUME_GOOD_THRESHOLD) {
            zoneColor = this.colors.danger; // Hot/Clip (Red)
            feedbackText = "TOO LOUD / MOVE BACK";
            feedbackIcon = "⚠";
        } else if (this.displayedVolume > 0.15) {
            zoneColor = this.colors.success; // Good (Green)
            feedbackText = "OPTIMAL";
            feedbackIcon = "✓";
        } else {
            zoneColor = this.colors.textMuted; // Weak (Grey)
            feedbackText = "MOVE CLOSER";
            feedbackIcon = "↑";
        }

        // Draw Active Volume Bar
        this.ctx.fillStyle = zoneColor;
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = zoneColor;
        this.ctx.fillRect(barX, barY, barWidth * this.displayedVolume, barHeight);
        this.ctx.shadowBlur = 0; // Reset

        // Draw Peak Marker (White Line)
        const peakX = barX + (barWidth * this.peakVolume);
        this.ctx.fillStyle = this.colors.text;
        this.ctx.fillRect(peakX, barY - 2, 2, barHeight + 4);

        // Draw Feedback Text with Icon
        if (feedbackText) {
            // Draw icon
            this.ctx.font = `bold 14px sans-serif`;
            this.ctx.fillStyle = zoneColor;
            this.ctx.textAlign = 'center';

            // Add subtle glow effect for optimal zone
            if (feedbackIcon === "✓") {
                this.ctx.shadowBlur = 8;
                this.ctx.shadowColor = this.colors.success;
            }

            this.ctx.fillText(feedbackIcon, centerX - 35, barY - 8);
            this.ctx.shadowBlur = 0; // Reset

            // Draw text
            this.ctx.font = `bold 11px sans-serif`;
            this.ctx.fillStyle = zoneColor;
            this.ctx.fillText(feedbackText, centerX + 5, barY - 10);
        }
    }
  }
}
