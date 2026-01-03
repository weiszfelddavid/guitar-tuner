import React from 'react';

export const Sparkline: React.FC<{ history: number[] }> = ({ history }) => {
  if (history.length < 2) return null;
  const width = 300;
  const height = 100;
  const normalizeY = (cents: number) => {
    const clamped = Math.max(-50, Math.min(50, cents));
    return height - ((clamped + 50) / 100 * height);
  };

  const getPath = (data: number[]) => {
    if (data.length === 0) return "";
    const points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = normalizeY(val);
      return [x, y];
    });

    return points.reduce((acc, [x, y], i, arr) => {
      if (i === 0) return `M ${x},${y}`;
      const [prevX, prevY] = arr[i - 1];
      const cp1x = prevX + (x - prevX) / 2;
      const cp1y = prevY;
      const cp2x = prevX + (x - prevX) / 2;
      const cp2y = y;
      return `${acc} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${x},${y}`;
    }, "");
  };

  return (
    <div className="sparkline-container">
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <line x1="0" y1={height/2} x2={width} y2={height/2} stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 4" />
        <path d={getPath(history)} fill="none" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
};
