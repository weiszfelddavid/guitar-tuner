import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    };
    canvas.render(state, 0);

    // For 0 cents, the angle is -90 degrees (pointing straight up).
    // The line should be from the pivot to a point directly above it.
    const pivotY = (canvas as any).height / 2 + (Math.min((canvas as any).width, (canvas as any).height) * 0.4) * 0.6;
    const centerX = (canvas as any).width / 2;
    const radius = Math.min((canvas as any).width, (canvas as any).height) * 0.4;
    
    // We expect lineTo(centerX, pivotY - radius)
    const lineToCall = (ctx.lineTo as any).mock.calls[1];
    expect(lineToCall[0]).toBeCloseTo(centerX);
    expect(lineToCall[1]).toBeCloseTo(pivotY - radius);
  });

  it('should draw the needle to the right for positive cents', () => {
    const state: TunerState = {
      noteName: 'E',
      cents: 25,
      clarity: 1,
      volume: 0.5,
      isLocked: false,
    };
    canvas.render(state, 25);

    // For +25 cents, the angle is > -90 degrees. The x coordinate should be > centerX.
    const centerX = (canvas as any).width / 2;
    const lineToCall = (ctx.lineTo as any).mock.calls[1];
    expect(lineToCall[0]).toBeGreaterThan(centerX);
  });

  it('should draw the needle to the left for negative cents', () => {
    const state: TunerState = {
      noteName: 'E',
      cents: -25,
      clarity: 1,
      volume: 0.5,
      isLocked: false,
    };
    canvas.render(state, -25);

    // For -25 cents, the angle is < -90 degrees. The x coordinate should be < centerX.
    const centerX = (canvas as any).width / 2;
    const lineToCall = (ctx.lineTo as any).mock.calls[1];
    expect(lineToCall[0]).toBeLessThan(centerX);
  });

  it('should render the volume meter correctly', () => {
    const state: TunerState = {
      noteName: 'A',
      cents: 0,
      clarity: 1,
      volume: 0.1, // This will be scaled
      isLocked: false,
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
});
