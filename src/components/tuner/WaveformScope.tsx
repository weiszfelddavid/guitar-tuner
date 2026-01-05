import React, { useEffect, useRef } from 'react';

interface WaveformScopeProps {
  waveform: Float32Array;
  active: boolean;
}

export const WaveformScope: React.FC<WaveformScopeProps> = ({ waveform, active }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize handling to match container
    if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        canvas.width = width * window.devicePixelRatio;
        canvas.height = height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
    }

    const width = canvas.width / window.devicePixelRatio;
    const height = canvas.height / window.devicePixelRatio;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);

    ctx.lineWidth = 2;
    // Use the CSS variable for accent color, but we need to access it in JS or hardcode for Canvas
    // Using a style getter to fetch the variable
    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-locked').trim();
    ctx.strokeStyle = accentColor || '#00E676';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    
    // Draw only a centered segment if waveform is empty/flat
    // or draw the full wave
    const sliceWidth = width / (waveform.length - 1);
    let x = 0;

    for (let i = 0; i < waveform.length; i++) {
      const v = waveform[i]; // -1 to 1
      const y = centerY + (v * (height * 0.4)); // Scale amplitude to 80% height

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.stroke();

  }, [waveform, active]);

  return (
    <div 
        ref={containerRef}
        style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '300px',
            height: '100px',
            zIndex: 0,
            opacity: active ? 0.3 : 0,
            transition: 'opacity 0.3s ease',
            pointerEvents: 'none'
        }}
    >
      <canvas ref={canvasRef} />
    </div>
  );
};
