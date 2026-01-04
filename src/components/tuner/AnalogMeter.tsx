import React, { useEffect, useState, useRef } from 'react';
import { type TunerStatus } from './NoteDisplay';

interface AnalogMeterProps {
  cents: number;
  status: TunerStatus;
}

export const AnalogMeter: React.FC<AnalogMeterProps> = ({ cents, status }) => {
  const [displayCents, setDisplayCents] = useState(0);
  const requestRef = useRef<number>(0);
  const velocityRef = useRef<number>(0);
  
  const isVisible = status !== 'idle';
  const isLocked = status === 'locked' || status === 'holding';

  // Physics-based needle damping
  useEffect(() => {
    const animate = () => {
      const target = isVisible ? cents : 0;
      const springK = 0.15;
      const damping = 0.8;

      const force = (target - displayCents) * springK;
      velocityRef.current = (velocityRef.current + force) * damping;
      setDisplayCents(prev => prev + velocityRef.current);

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [cents, isVisible, displayCents]);

  const rotation = (displayCents / 50) * 45; // Max 45 degrees

  return (
    <div className={`analog-meter-container ${isVisible ? 'visible' : ''}`}>
      <div className="meter-face">
        <svg viewBox="0 0 200 120" className="meter-svg">
          {/* Cent Scale Arc */}
          <path 
            d="M 20 100 A 80 80 0 0 1 180 100" 
            fill="none" 
            stroke="#444" 
            strokeWidth="1" 
          />
          
          {/* Ticks */}
          {Array.from({ length: 51 }).map((_, i) => {
            const cent = (i - 25) * 2;
            const angle = (cent / 50) * 45;
            const rad = (angle - 90) * (Math.PI / 180);
            const x1 = 100 + Math.cos(rad) * 80;
            const y1 = 100 + Math.sin(rad) * 80;
            
            let length = 3; // default minor
            if (i % 5 === 0) length = 10; // every 10 cents
            if (i % 25 === 0) length = 15; // 0 and +/- 50

            const x2 = 100 + Math.cos(rad) * (80 - length);
            const y2 = 100 + Math.sin(rad) * (80 - length);
            
            return (
              <line 
                key={cent}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={i === 25 ? "#fff" : (i % 5 === 0 ? "#bbb" : "#666")}
                strokeWidth={i % 5 === 0 ? "1.5" : "1"}
              />
            );
          })}

          {/* Scale Labels */}
          {[-50, -25, 0, 25, 50].map(val => {
            const angle = (val / 50) * 45;
            const rad = (angle - 90) * (Math.PI / 180);
            const x = 100 + Math.cos(rad) * 60;
            const y = 100 + Math.sin(rad) * 60;
            return (
              <text 
                key={val}
                x={x} y={y} 
                textAnchor="middle" 
                fontSize="8" 
                fill="#666"
                dominantBaseline="middle"
              >
                {val === 0 ? '0' : (val > 0 ? `+${val}` : val)}
              </text>
            );
          })}

          {/* The Eye (Status Light) */}
          <circle 
            cx="100" cy="100" r="12" 
            className={`status-eye ${isLocked ? 'locked' : (Math.abs(cents) < 5 ? 'near' : 'out')}`}
          />
          <circle 
            cx="100" cy="100" r="12" 
            fill="none" stroke="#222" strokeWidth="2"
          />

          {/* Needle */}
          <g transform={`rotate(${rotation}, 100, 100)`}>
            <line 
              x1="100" y1="100" x2="100" y2="25" 
              stroke="#e53935" 
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle cx="100" cy="100" r="3" fill="#e53935" />
          </g>
        </svg>
      </div>
      <div className="cents-value">
        {isVisible ? `${cents > 0 ? '+' : ''}${Math.round(cents)}` : ''}
      </div>
    </div>
  );
};
