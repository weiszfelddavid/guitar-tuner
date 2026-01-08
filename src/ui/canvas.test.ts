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
    };
    canvas.render(state, 0);
    expect(ctx.fillText).toHaveBeenCalledWith('--', expect.any(Number), expect.any(Number));
  });

  it('should draw the needle in the center for 0 cents offset', () => {
    const state: TunerState = {
      noteName: 'E',
      cents: 0,
      clarity: 1,
      volume: 0.5,
      isLocked: false,
      frequency: 82.41,
    };
    canvas.render(state, 0);

    // For 0 cents, the angle is -90 degrees (pointing straight up).
    // The tapered needle should have its tip at (centerX, pivotY - radius)
    const pivotY = (canvas as any).height / 2 + (Math.min((canvas as any).width, (canvas as any).height) * 0.4) * 0.6;
    const centerX = (canvas as any).width / 2;
    const radius = Math.min((canvas as any).width, (canvas as any).height) * 0.4;

    // Check that the needle tip coordinates appear in lineTo calls
    // The needle triangle uses lineTo for the tip point
    const lineToCallsWithTip = (ctx.lineTo as any).mock.calls.filter((call: number[]) => {
      return Math.abs(call[0] - centerX) < 1 && Math.abs(call[1] - (pivotY - radius)) < 1;
    });
    expect(lineToCallsWithTip.length).toBeGreaterThan(0);
  });

  it('should draw the needle to the right for positive cents', () => {
    const state: TunerState = {
      noteName: 'E',
      cents: 25,
      clarity: 1,
      volume: 0.5,
      isLocked: false,
      frequency: 85,
    };
    canvas.render(state, 25);

    // For +25 cents, the angle is > -90 degrees. The x coordinate should be > centerX.
    const centerX = (canvas as any).width / 2;
    const pivotY = (canvas as any).height / 2 + (Math.min((canvas as any).width, (canvas as any).height) * 0.4) * 0.6;
    const radius = Math.min((canvas as any).width, (canvas as any).height) * 0.4;

    // Find lineTo calls that are near the arc radius (needle tip)
    const needleTipCalls = (ctx.lineTo as any).mock.calls.filter((call: number[]) => {
      const distFromPivot = Math.sqrt(Math.pow(call[0] - centerX, 2) + Math.pow(call[1] - pivotY, 2));
      return Math.abs(distFromPivot - radius) < 10; // Within 10px of radius
    });

    // Check that at least one needle tip is to the right of center
    const hasRightwardNeedle = needleTipCalls.some((call: number[]) => call[0] > centerX);
    expect(hasRightwardNeedle).toBe(true);
  });

  it('should draw the needle to the left for negative cents', () => {
    const state: TunerState = {
      noteName: 'E',
      cents: -25,
      clarity: 1,
      volume: 0.5,
      isLocked: false,
      frequency: 80,
    };
    canvas.render(state, -25);

    // For -25 cents, the angle is < -90 degrees. The x coordinate should be < centerX.
    const centerX = (canvas as any).width / 2;
    const pivotY = (canvas as any).height / 2 + (Math.min((canvas as any).width, (canvas as any).height) * 0.4) * 0.6;
    const radius = Math.min((canvas as any).width, (canvas as any).height) * 0.4;

    // Find lineTo calls that are near the arc radius (needle tip)
    const needleTipCalls = (ctx.lineTo as any).mock.calls.filter((call: number[]) => {
      const distFromPivot = Math.sqrt(Math.pow(call[0] - centerX, 2) + Math.pow(call[1] - pivotY, 2));
      return Math.abs(distFromPivot - radius) < 10; // Within 10px of radius
    });

    // Check that at least one needle tip is to the left of center
    const hasLeftwardNeedle = needleTipCalls.some((call: number[]) => call[0] < centerX);
    expect(hasLeftwardNeedle).toBe(true);
  });

  it('should render the volume meter correctly', () => {
    const state: TunerState = {
      noteName: 'A',
      cents: 0,
      clarity: 1,
      volume: 0.1, // This will be scaled
      isLocked: false,
      frequency: 440,
    };
    canvas.render(state, 0);

    const SENSITIVITY_SCALE = 0.3;
    const expectedVolume = Math.min(state.volume / SENSITIVITY_SCALE, 1.0);
    const barWidth = (canvas as any).width * 0.6;

    // The last call to fillRect is the volume bar
    const fillRectCalls = (ctx.fillRect as any).mock.calls;
    const volumeBarCall = fillRectCalls[fillRectCalls.length - 2];
    
    expect(volumeBarCall[2]).toBeCloseTo(barWidth * expectedVolume); // Check the width
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
