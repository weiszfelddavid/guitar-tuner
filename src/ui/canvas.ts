// src/ui/canvas.ts
import { TunerState } from './tuner';

export class TunerCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private needleAngle: number = 0; // Current smoothed angle in degrees

  constructor(canvasId: string) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) throw new Error(`Canvas with id ${canvasId} not found`);
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!; // alpha: false for performance
    
    // Handle resizing
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * window.devicePixelRatio;
    this.canvas.height = this.height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    // Adjust logical width/height
    this.width = this.width;
    this.height = this.height;
  }

  public render(state: TunerState, smoothedCents: number) {
    this.ctx.clearRect(0, 0, this.width, this.height);
    
    // Background
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, 0, this.width, this.height);

    const centerX = this.width / 2;
    const centerY = this.height / 2;

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
    this.ctx.font = 'bold 120px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = color;
    this.ctx.fillText(state.noteName, centerX, centerY - 50);

    // Draw Needle (Arc Meter)
    const radius = Math.min(this.width, this.height) * 0.4;
    
    // Draw Scale
    this.ctx.beginPath();
    this.ctx.strokeStyle = '#444';
    this.ctx.lineWidth = 4;
    // Arc from -45 to +45 degrees
    this.ctx.arc(centerX, centerY + 100, radius, Math.PI * 1.25, Math.PI * 1.75); 
    this.ctx.stroke();
    
    // Draw Center Marker
    this.ctx.beginPath();
    this.ctx.strokeStyle = '#666';
    this.ctx.lineWidth = 2;
    this.ctx.moveTo(centerX, centerY + 100 - radius - 10);
    this.ctx.lineTo(centerX, centerY + 100 - radius + 10);
    this.ctx.stroke();

    if (state.noteName !== '--') {
        // Map cents (-50 to +50) to angle (-45 to +45 degrees)
        // Clamp cents
        const clampedCents = Math.max(-50, Math.min(50, smoothedCents));
        const angleDeg = (clampedCents / 50) * 45; 
        
        // Convert to radians for math (0 is up, -PI/2 is left)
        // Our arc center is (centerX, centerY+100).
        // 0 degrees is "up" (1.5 PI). 
        // We want angle relative to vertical.
        
        const angleRad = (angleDeg - 90) * (Math.PI / 180); 
        
        // Calculate needle tip
        // Pivot is at centerY + 100
        const tipX = centerX + radius * Math.cos(angleRad);
        const tipY = (centerY + 100) + radius * Math.sin(angleRad);

        this.ctx.beginPath();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 6;
        this.ctx.moveTo(centerX, centerY + 100);
        this.ctx.lineTo(tipX, tipY);
        this.ctx.stroke();
        
        // Text for Cents
        this.ctx.font = '20px sans-serif';
        this.ctx.fillStyle = '#888';
        this.ctx.fillText(`${state.cents > 0 ? '+' : ''}${state.cents.toFixed(1)} ¢`, centerX, centerY + 150);
    } else {
        // Draw "Listening" text
         this.ctx.font = '20px sans-serif';
         this.ctx.fillStyle = '#666';
         this.ctx.fillText("Listening...", centerX, centerY + 100);
    }
  }
}
