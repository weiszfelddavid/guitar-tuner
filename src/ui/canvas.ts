// src/ui/canvas.ts
import { TunerState } from './tuner';

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

  constructor(canvasId: string) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) throw new Error(`Canvas with id ${canvasId} not found`);
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!; // alpha: false for performance
    
    // Handle resizing
    this.resize();
    window.addEventListener('resize', () => this.resize());
    
    this.lastFrameTime = performance.now();
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
  }

  public render(state: TunerState, smoothedCents: number) {
    const now = performance.now();
    const dt = (now - this.lastFrameTime) / 1000; // Delta time in seconds
    this.lastFrameTime = now;

    this.ctx.clearRect(0, 0, this.width, this.height);
    
    // Background
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, 0, this.width, this.height);

    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const radius = Math.min(this.width, this.height) * 0.4;
    const fontSize = Math.floor(radius * 0.75);
    const verticalOffset = radius * 0.6; // Push text up and needle down

    // Determine Color
    let color = '#ffffff'; // White (Searching)
    if (state.noteName !== '--') {
        if (state.isLocked) {
            color = '#00ff00'; // Green (Locked)
        } else if (Math.abs(state.cents) > 2) {
             color = '#ff0000'; // Red (Out of tune)
        } else {
            color = '#ffa500'; // Orange (Close/Detection)
        }
    }

    // Draw Note Name
    this.ctx.font = `bold ${fontSize}px sans-serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = color;
    this.ctx.fillText(state.noteName, centerX, centerY - verticalOffset);

    // Draw Needle (Arc Meter)
    // Pivot point
    const pivotY = centerY + verticalOffset;
    
    // Draw Scale Arc
    this.ctx.beginPath();
    this.ctx.strokeStyle = '#444';
    this.ctx.lineWidth = 4;
    // Arc from -45 to +45 degrees
    this.ctx.arc(centerX, pivotY, radius, Math.PI * 1.25, Math.PI * 1.75);
    this.ctx.stroke();

    // Draw Target Zone (±5 cents) - Green highlight in center
    this.ctx.beginPath();
    this.ctx.strokeStyle = '#00ff0033'; // Semi-transparent green
    this.ctx.lineWidth = 8;
    // ±5 cents = ±4.5 degrees out of the ±45 degree range
    const targetAngleRange = (5 / 50) * (Math.PI / 4); // 4.5 degrees in radians
    const centerAngle = Math.PI * 1.5; // Straight up (270 degrees)
    this.ctx.arc(centerX, pivotY, radius, centerAngle - targetAngleRange, centerAngle + targetAngleRange);
    this.ctx.stroke();

    // Draw Tick Marks at ±10, ±25, ±50 cents
    const tickPositions = [-50, -25, -10, 0, 10, 25, 50]; // cents
    tickPositions.forEach(cents => {
        const angleDeg = (cents / 50) * 45; // Map cents to degrees
        const angleRad = (angleDeg - 90) * (Math.PI / 180); // Convert to radians

        // Determine tick size (longer for major marks)
        const isCenter = cents === 0;
        const tickLength = isCenter ? 20 : (Math.abs(cents) === 50 ? 15 : 10);
        const tickWidth = isCenter ? 3 : 2;

        // Calculate tick position on arc
        const innerRadius = radius - 5;
        const outerRadius = radius + tickLength - 5;
        const startX = centerX + innerRadius * Math.cos(angleRad);
        const startY = pivotY + innerRadius * Math.sin(angleRad);
        const endX = centerX + outerRadius * Math.cos(angleRad);
        const endY = pivotY + outerRadius * Math.sin(angleRad);

        // Draw tick mark
        this.ctx.beginPath();
        this.ctx.strokeStyle = isCenter ? '#00ff00' : '#666';
        this.ctx.lineWidth = tickWidth;
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();
    });

    if (state.noteName !== '--') {
        // Map cents (-50 to +50) to angle (-45 to +45 degrees)
        // Clamp cents
        const clampedCents = Math.max(-50, Math.min(50, smoothedCents));
        const angleDeg = (clampedCents / 50) * 45;

        // Convert to radians for math (0 is up, -PI/2 is left)
        const angleRad = (angleDeg - 90) * (Math.PI / 180);

        // Calculate needle tip
        const tipX = centerX + radius * Math.cos(angleRad);
        const tipY = pivotY + radius * Math.sin(angleRad);

        // Draw tapered needle with drop shadow
        const needleWidth = 8; // Base width
        const needleLength = radius;

        // Calculate perpendicular vector for needle width
        const perpAngle = angleRad + Math.PI / 2;
        const halfWidth = needleWidth / 2;

        // Needle base points (at pivot)
        const baseLeft = {
            x: centerX + halfWidth * Math.cos(perpAngle),
            y: pivotY + halfWidth * Math.sin(perpAngle)
        };
        const baseRight = {
            x: centerX - halfWidth * Math.cos(perpAngle),
            y: pivotY - halfWidth * Math.sin(perpAngle)
        };

        // Needle tip (tapered to a point)
        const tip = { x: tipX, y: tipY };

        // Draw shadow first
        this.ctx.save();
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        this.ctx.shadowBlur = 8;
        this.ctx.shadowOffsetX = 2;
        this.ctx.shadowOffsetY = 2;

        // Draw needle shape
        this.ctx.beginPath();
        this.ctx.fillStyle = color;
        this.ctx.moveTo(baseLeft.x, baseLeft.y);
        this.ctx.lineTo(baseRight.x, baseRight.y);
        this.ctx.lineTo(tip.x, tip.y);
        this.ctx.closePath();
        this.ctx.fill();

        // Draw needle outline for definition
        this.ctx.shadowColor = 'transparent';
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 1;
        this.ctx.stroke();

        this.ctx.restore();

        // Draw center pivot circle
        this.ctx.beginPath();
        this.ctx.fillStyle = color;
        this.ctx.arc(centerX, pivotY, 6, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();

        // Text for Cents
        this.ctx.font = `${Math.floor(fontSize * 0.2)}px sans-serif`;
        this.ctx.fillStyle = '#888';
        this.ctx.fillText(`${state.cents > 0 ? '+' : ''}${state.cents.toFixed(1)} ¢`, centerX, pivotY + 50);

        // Text for Frequency (Hz)
        this.ctx.font = `${Math.floor(fontSize * 0.15)}px sans-serif`;
        this.ctx.fillStyle = '#666';
        this.ctx.fillText(`${state.frequency.toFixed(1)} Hz`, centerX, pivotY + 70);
    } else {
        // Draw "Listening" text
         this.ctx.font = `${Math.floor(fontSize * 0.2)}px sans-serif`;
         this.ctx.fillStyle = '#666';
         this.ctx.fillText("Listening...", centerX, pivotY);
    }
    
    // ---------------------------------------------------------
    // "Input Health" Meter (Signal Quality)
    // ---------------------------------------------------------
    
    // 1. Normalize Volume (0.0 to 1.0)
    // RMS is typically small. We scale it up. 
    // 0.3 RMS is treated as "Max/Clipping" for visualization.
    const SENSITIVITY_SCALE = 0.3; 
    const targetVolume = Math.min(state.volume / SENSITIVITY_SCALE, 1.0);

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
    // Only draw if there is *some* signal history (prevent UI clutter in dead silence)
    if (this.displayedVolume > 0.01 || this.peakVolume > 0.01) {
        const barWidth = this.width * 0.6;
        const barHeight = 4;
        const barX = (this.width - barWidth) / 2;
        const barY = this.height - 40;

        // Background Track (Subtle)
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);

        // Determine Zone Color & Feedback Text
        let zoneColor = '#666'; // Default Weak
        let feedbackText = "";
        
        if (this.displayedVolume > 0.8) {
            zoneColor = '#ff3333'; // Hot/Clip (Red)
            feedbackText = "TOO LOUD / MOVE BACK";
        } else if (this.displayedVolume > 0.15) {
            zoneColor = '#00ff00'; // Good (Green)
            feedbackText = ""; // Silence is Golden (Reward)
        } else {
            zoneColor = '#aaaaaa'; // Weak (Grey/White)
            feedbackText = "MOVE CLOSER";
        }

        // Draw Active Volume Bar
        this.ctx.fillStyle = zoneColor;
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = zoneColor;
        this.ctx.fillRect(barX, barY, barWidth * this.displayedVolume, barHeight);
        this.ctx.shadowBlur = 0; // Reset

        // Draw Peak Marker (White Line)
        const peakX = barX + (barWidth * this.peakVolume);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(peakX, barY - 2, 2, barHeight + 4);

        // Draw Feedback Text
        if (feedbackText) {
            this.ctx.font = `bold 12px sans-serif`;
            this.ctx.fillStyle = zoneColor;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(feedbackText, centerX, barY - 10);
        }
    }
  }
}
