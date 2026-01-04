/**
 * @vitest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAudioTuner } from './useAudioTuner';

// Mock the worker URL import
vi.mock('../audio/engine/processor?worker&url', () => ({
  default: 'mock-processor-url'
}));

// Mock useTranslation
vi.mock('./useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}));

describe('useAudioTuner Integration', () => {
  let mockAudioContext: any;
  let mockWorkletNode: any;
  let mockSourceNode: any;
  let mockPort: any;

  beforeEach(() => {
    // Setup Audio API Mocks
    mockPort = {
      onmessage: null,
      postMessage: vi.fn()
    };

    mockWorkletNode = {
      port: mockPort,
      connect: vi.fn(),
      disconnect: vi.fn()
    };

    mockSourceNode = {
      context: null, // set below
      connect: vi.fn(),
      disconnect: vi.fn()
    };

    mockAudioContext = {
      state: 'suspended',
      resume: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      createMediaStreamSource: vi.fn().mockReturnValue(mockSourceNode),
      audioWorklet: {
        addModule: vi.fn().mockResolvedValue(undefined)
      },
      destination: {},
      // Add constructor for "instanceof" checks if needed, but the hook uses duck typing or injected context
    };
    
    // Circular reference for context
    mockSourceNode.context = mockAudioContext;

    // Mock global AudioWorkletNode
    vi.stubGlobal('AudioWorkletNode', vi.fn(() => mockWorkletNode));
    
    // Mock navigator.mediaDevices for the default case
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }]
        })
      },
      writable: true
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useAudioTuner((k) => k));
    
    expect(result.current.tunerStatus).toBe('idle');
    expect(result.current.pitch).toBeNull();
    expect(result.current.noteData).toEqual({ note: '--', cents: 0 });
  });

  it('should start tuner and update state on pitch detection', async () => {
    const { result } = renderHook(() => useAudioTuner((k) => k));

    // 1. Start Tuner with injected source
    await act(async () => {
      await result.current.startTuner(mockSourceNode);
    });

    expect(result.current.tunerStatus).toBe('listening');
    expect(mockAudioContext.audioWorklet.addModule).toHaveBeenCalledWith('mock-processor-url');
    expect(mockSourceNode.connect).toHaveBeenCalled();

    // 2. Simulate Pitch Detection (A4 = 440Hz)
    // The hook has logic: if pitch && clarity > 0.8 -> update
    await act(async () => {
      if (mockPort.onmessage) {
        mockPort.onmessage({
          data: {
            pitch: 440,
            clarity: 0.95,
            bufferrms: 0.1
          }
        });
      }
    });

    expect(result.current.pitch).toBe(440);
    expect(result.current.noteData.note).toBe('A');
    // 440Hz is exactly A4, so cents should be close to 0
    expect(Math.abs(result.current.noteData.cents)).toBeLessThan(1);
  });

  it('should handle "holding" state when signal is lost', async () => {
    const { result } = renderHook(() => useAudioTuner((k) => k));

    await act(async () => {
      await result.current.startTuner(mockSourceNode);
    });

    // 1. Send strong signal
    await act(async () => {
      mockPort.onmessage({ data: { pitch: 440, clarity: 0.99, bufferrms: 0.1 } });
    });
    expect(result.current.pitch).toBe(440);

    // 2. Send silence (below threshold)
    // In hook: if (bufferrms < SILENCE_THRESHOLD [0.01]) ...
    await act(async () => {
      mockPort.onmessage({ data: { pitch: null, clarity: 0, bufferrms: 0.005 } });
    });

    // Should enter 'holding' state initially
    expect(result.current.tunerStatus).toBe('holding');
    
    // Pitch should still be held visible briefly
    expect(result.current.pitch).toBe(440);
  });

  it('should correctly tune E2 string (Low E)', async () => {
    const { result } = renderHook(() => useAudioTuner((k) => k));

    await act(async () => {
      await result.current.startTuner(mockSourceNode);
    });

    // E2 is ~82.41 Hz
    await act(async () => {
      mockPort.onmessage({ 
        data: { 
          pitch: 82.41, 
          clarity: 0.95, 
          bufferrms: 0.1 
        } 
      });
    });

    expect(result.current.noteData.note).toBe('E');
    expect(result.current.pitch).toBeCloseTo(82.41);
  });

  it('should detect notes with lower clarity (weak signal)', async () => {
    const { result } = renderHook(() => useAudioTuner((k) => k));

    await act(async () => {
      await result.current.startTuner(mockSourceNode);
    });

    // Clarity 0.65 would have failed before (threshold was 0.8)
    // Now it should succeed (threshold is 0.6)
    await act(async () => {
      mockPort.onmessage({ 
        data: { 
          pitch: 196.00, // G3
          clarity: 0.65, 
          bufferrms: 0.05 
        } 
      });
    });

    expect(result.current.noteData.note).toBe('G');
    expect(result.current.tunerStatus).toBe('detecting'); // Not locked (needs 0.85), but detecting
  });
});
