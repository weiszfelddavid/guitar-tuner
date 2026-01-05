import React, { useEffect, useRef } from 'react';

interface WaveformScopeProps {
  waveform: Float32Array;
  active: boolean;
}

export const WaveformScope: React.FC<WaveformScopeProps> = ({ waveform, active }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Configuration
  const SCROLL_SPEED = 2; // Pixels per frame
  // At 60fps, 2px/frame = 120px/sec. 
  // For 10s history, we need ~1200px width, or adjust speed/width accordingly.
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // 1. Initial Setup / Resize
    if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        // Only resize if dimensions change to avoid clearing history
        if (canvas.width !== width * window.devicePixelRatio) {
            canvas.width = width * window.devicePixelRatio;
            canvas.height = height * window.devicePixelRatio;
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            
            // Clear on resize
            ctx.clearRect(0, 0, width, height);
        }
    }

    if (!active) {
        // Fade out or dim? For now, we just stop updating.
        return;
    }

    const width = canvas.width / window.devicePixelRatio;
    const height = canvas.height / window.devicePixelRatio;
    const centerY = height / 2;

    // 2. Shift History (Scroll Left)
    // We draw the current canvas content back onto itself, shifted left
    ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(canvas, 
        SCROLL_SPEED * window.devicePixelRatio, 0, // Source X, Y
        (width - SCROLL_SPEED) * window.devicePixelRatio, height * window.devicePixelRatio, // Source W, H
        0, 0, // Dest X, Y
        width - SCROLL_SPEED, height // Dest W, H
    );
    ctx.globalCompositeOperation = 'source-over';

    // 3. Clear the new slice area on the right
    ctx.clearRect(width - SCROLL_SPEED, 0, SCROLL_SPEED, height);

    // 4. Calculate Min/Max of current buffer (Peak Detection)
    // We are compressing 256 samples into a narrow slice.
    // To look like a DAW, we need the Peak Positive and Peak Negative.
    let min = 0;
    let max = 0;
    
    // Simple loop to find range
    for (let i = 0; i < waveform.length; i++) {
        const val = waveform[i];
        if (val < min) min = val;
        if (val > max) max = val;
    }

    // 5. Draw the Slice
    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-locked').trim();
    ctx.fillStyle = accentColor || '#00E676';
    
    // Draw the vertical bar representing the range of this frame
    const topY = centerY - (max * (height * 0.45)); 
    const bottomY = centerY - (min * (height * 0.45));
    const barHeight = Math.max(1, bottomY - topY); // Ensure at least 1px

    // We draw a solid block for the envelope
    ctx.fillRect(width - SCROLL_SPEED, topY, SCROLL_SPEED, barHeight);

    // Optional: Draw a faint center line for silence
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(width - SCROLL_SPEED, centerY, SCROLL_SPEED, 1);

  }, [waveform, active]); // Runs every time waveform updates (approx 60fps)

  return (
    <div 
        ref={containerRef}
        style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '100%',     // Full width of parent
            maxWidth: '600px', // Match main tuner constraint
            height: '160px',   // Taller for DAW look
            zIndex: 0,
            opacity: active ? 0.6 : 0.2, // Always visible but dim when idle
            transition: 'opacity 0.5s ease',
            pointerEvents: 'none',
            maskImage: 'linear-gradient(to right, transparent, black 20%, black 100%)', // Fade out tail
            WebkitMaskImage: 'linear-gradient(to right, transparent, black 20%, black 100%)'
        }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
};
