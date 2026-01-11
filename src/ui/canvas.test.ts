import { createCanvas } from 'canvas';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { TunerCanvas } from './canvas';
import { TunerState } from './tuner';

describe('TunerCanvas', () => {
  let canvas: TunerCanvas;
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    document.body.innerHTML = '<canvas id="tuner"></canvas>';
    canvas = new TunerCanvas('tuner');
    ctx = (canvas as any).ctx;
    
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  it('should render the correct note name', () => {
    const state: TunerState = {
      noteName: 'A',
      cents: 0,
      clarity: 1,
      volume: 0.5,
      isLocked: false,
      frequency: 440,
      isAttacking: false,
    };
    canvas.render(state, 0);
    expect(ctx.fillText).toHaveBeenCalledWith('A', expect.any(Number), expect.any(Number));
  });

  it('should render "--" when the note is not determined', () => {
    const state: TunerState = {
      noteName: '--',
      cents: 0,
      clarity: 0,
      volume: 0,
      isLocked: false,
      frequency: 0,
      isAttacking: false,
    };
    canvas.render(state, 0);
    expect(ctx.fillText).toHaveBeenCalledWith('--', expect.any(Number), expect.any(Number));
  });

  it('should draw the bead in the center for 0 cents offset', () => {
    const state: TunerState = {
      noteName: 'E2',
      cents: 0,
      clarity: 1,
      volume: 0.5,
      isLocked: false,
      frequency: 82.41,
      isAttacking: false,
    };
    canvas.render(state, 0);

    // For 0 cents, the bead should be at (centerX, pivotY - radius)
    const pivotY = (canvas as any).height * 0.5 + (Math.min((canvas as any).width, (canvas as any).height) * 0.35) * 0.6;
    const centerX = (canvas as any).width / 2;
    const radius = Math.min((canvas as any).width, (canvas as any).height) * 0.35;

    // Check that the bead (arc) is drawn near the expected position
    const arcCalls = (ctx.arc as any).mock.calls.filter((call: number[]) => {
      const x = call[0];
      const y = call[1];
      const r = call[2];
      // Bead should be small circle (radius < 20) at the indicator position
      return r < 20 && Math.abs(x - centerX) < 5 && Math.abs(y - (pivotY - radius)) < 5;
    });
    expect(arcCalls.length).toBeGreaterThan(0);
  });

  it('should draw the bead to the right for positive cents', () => {
    const state: TunerState = {
      noteName: 'E2',
      cents: 25,
      clarity: 1,
      volume: 0.5,
      isLocked: false,
      frequency: 85,
      isAttacking: false,
    };
    canvas.render(state, 25);

    // For +25 cents, the bead should be to the right of center
    const centerX = (canvas as any).width / 2;
    const pivotY = (canvas as any).height * 0.5 + (Math.min((canvas as any).width, (canvas as any).height) * 0.35) * 0.6;
    const radius = Math.min((canvas as any).width, (canvas as any).height) * 0.35;

    // Find arc calls that represent the bead (small radius < 20)
    const beadCalls = (ctx.arc as any).mock.calls.filter((call: number[]) => {
      const x = call[0];
      const y = call[1];
      const r = call[2];
      const distFromPivot = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - pivotY, 2));
      // Bead is small circle on the arc
      return r < 20 && Math.abs(distFromPivot - radius) < 20;
    });

    // Check that at least one bead is to the right of center
    const hasRightwardBead = beadCalls.some((call: number[]) => call[0] > centerX);
    expect(hasRightwardBead).toBe(true);
  });

  it('should draw the bead to the left for negative cents', () => {
    const state: TunerState = {
      noteName: 'E2',
      cents: -25,
      clarity: 1,
      volume: 0.5,
      isLocked: false,
      frequency: 80,
      isAttacking: false,
    };
    canvas.render(state, -25);

    // For -25 cents, the bead should be to the left of center
    const centerX = (canvas as any).width / 2;
    const pivotY = (canvas as any).height * 0.5 + (Math.min((canvas as any).width, (canvas as any).height) * 0.35) * 0.6;
    const radius = Math.min((canvas as any).width, (canvas as any).height) * 0.35;

    // Find arc calls that represent the bead (small radius < 20)
    const beadCalls = (ctx.arc as any).mock.calls.filter((call: number[]) => {
      const x = call[0];
      const y = call[1];
      const r = call[2];
      const distFromPivot = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - pivotY, 2));
      // Bead is small circle on the arc
      return r < 20 && Math.abs(distFromPivot - radius) < 20;
    });

    // Check that at least one bead is to the left of center
    const hasLeftwardBead = beadCalls.some((call: number[]) => call[0] < centerX);
    expect(hasLeftwardBead).toBe(true);
  });

  it('should match the visual snapshot for a given state', () => {
    const snapshotCanvas = createCanvas(1024, 768);
    (snapshotCanvas as any).style = {}; // Mock the style property
    const getElementByIdSpy = vi.spyOn(document, 'getElementById').mockReturnValue(snapshotCanvas as any);

    const tunerCanvas = new TunerCanvas('tuner');
    
    const state: TunerState = {
      noteName: 'A',
      cents: 15,
      clarity: 1,
      volume: 0.5,
      isLocked: false,
      frequency: 450,
      isAttacking: false,
    };
    tunerCanvas.render(state, 15);

    const image = snapshotCanvas.toBuffer('image/png');
    
    const snapshotDir = path.resolve(__dirname, '__snapshots__');
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir);
    }
    
    const snapshotPath = path.resolve(snapshotDir, 'tuner-canvas-snapshot.png');
    
    if (!fs.existsSync(snapshotPath)) {
      fs.writeFileSync(snapshotPath, image);
      throw new Error('✨ Snapshot created. Please review the image and run the test again.');
    } else {
      const snapshot = fs.readFileSync(snapshotPath);
      expect(image).toEqual(snapshot);
    }

    getElementByIdSpy.mockRestore();
  });
});
