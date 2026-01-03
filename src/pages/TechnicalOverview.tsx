import React from 'react';
import { Link } from 'react-router-dom';
import '../App.css';

// --- Diagrams ---

const AudioEngineDiagram = () => (
  <svg viewBox="0 0 800 300" className="tech-diagram">
    <defs>
      <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,6 L9,3 z" fill="#666" />
      </marker>
    </defs>
    
    {/* Background Grid */}
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#333" strokeWidth="0.5"/>
    </pattern>
    <rect width="800" height="300" fill="url(#grid)" opacity="0.2" />

    {/* Nodes */}
    <g transform="translate(50, 100)">
      <rect width="120" height="80" rx="10" fill="#1e1e1e" stroke="#00e676" strokeWidth="2" />
      <text x="60" y="45" fill="#fff" textAnchor="middle" fontSize="14">Microphone</text>
      <text x="60" y="65" fill="#888" textAnchor="middle" fontSize="10">Source</text>
    </g>

    <path d="M170,140 L220,140" stroke="#666" strokeWidth="2" markerEnd="url(#arrow)" />

    <g transform="translate(230, 80)">
      <rect width="140" height="120" rx="10" fill="#2a2a2a" stroke="#2196f3" strokeWidth="2" />
      <text x="70" y="30" fill="#fff" textAnchor="middle" fontSize="14">AudioWorklet</text>
      <text x="70" y="50" fill="#2196f3" textAnchor="middle" fontSize="10">Main Thread Blocked</text>
      
      {/* Buffer Inner */}
      <rect x="20" y="70" width="100" height="30" fill="#000" stroke="#555" />
      <rect x="20" y="70" width="70" height="30" fill="#2196f3" opacity="0.3" />
      <text x="70" y="90" fill="#aaa" textAnchor="middle" fontSize="10">Ring Buffer (4096)</text>
    </g>

    <path d="M370,140 L420,140" stroke="#666" strokeWidth="2" markerEnd="url(#arrow)" />

    <g transform="translate(430, 60)">
      <rect width="160" height="160" rx="10" fill="#1e1e1e" stroke="#ff9100" strokeWidth="2" />
      <text x="80" y="30" fill="#fff" textAnchor="middle" fontSize="14">YIN Algorithm</text>
      
      <text x="80" y="60" fill="#ddd" textAnchor="middle" fontSize="10">1. Autocorrelation</text>
      <text x="80" y="80" fill="#ddd" textAnchor="middle" fontSize="10">2. Normalization</text>
      <text x="80" y="100" fill="#ddd" textAnchor="middle" fontSize="10">3. Parabolic Interp.</text>
      <text x="80" y="130" fill="#ff9100" textAnchor="middle" fontSize="11" fontWeight="bold">Output: Pitch (Hz)</text>
    </g>

    <path d="M590,140 L640,140" stroke="#666" strokeWidth="2" markerEnd="url(#arrow)" />

    <g transform="translate(650, 100)">
      <rect width="100" height="80" rx="10" fill="#1e1e1e" stroke="#fff" strokeWidth="2" />
      <text x="50" y="45" fill="#fff" textAnchor="middle" fontSize="14">React UI</text>
      <text x="50" y="65" fill="#888" textAnchor="middle" fontSize="10">60 FPS Render</text>
    </g>
  </svg>
);

const DevEnvDiagram = () => (
  <svg viewBox="0 0 800 250" className="tech-diagram">
     <defs>
      <marker id="arrow2" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,6 L9,3 z" fill="#444" />
      </marker>
    </defs>
    <rect x="50" y="50" width="200" height="150" rx="15" fill="#111" stroke="#333" strokeWidth="2" />
    <text x="150" y="40" fill="#888" textAnchor="middle">Android Device</text>
    <text x="150" y="130" fill="#00e676" textAnchor="middle" fontSize="20" fontFamily="monospace">Termux</text>
    <text x="150" y="155" fill="#666" textAnchor="middle" fontSize="12" fontFamily="monospace">Node.js + Git</text>

    <path d="M250,125 L350,125" stroke="#444" strokeWidth="2" markerEnd="url(#arrow2)" strokeDasharray="5,5" />

    <rect x="350" y="50" width="200" height="150" rx="15" fill="#222" stroke="#2196f3" strokeWidth="2" />
    <text x="450" y="40" fill="#2196f3" textAnchor="middle">AI Agent</text>
    <text x="450" y="130" fill="#fff" textAnchor="middle" fontSize="20" fontFamily="monospace">Gemini CLI</text>
    <text x="450" y="155" fill="#aaa" textAnchor="middle" fontSize="12" fontFamily="monospace">Code Logic & Refactor</text>

    <path d="M550,125 L650,125" stroke="#444" strokeWidth="2" markerEnd="url(#arrow2)" />

    <rect x="650" y="50" width="100" height="150" rx="15" fill="#111" stroke="#fff" strokeWidth="2" />
    <text x="700" y="40" fill="#fff" textAnchor="middle">Production</text>
    <text x="700" y="130" fill="#fff" textAnchor="middle" fontSize="16" fontFamily="monospace">Vite Build</text>
  </svg>
);

// --- Component ---

export const TechnicalOverview: React.FC = () => {
  return (
    <div className="tech-overview-container">
      <nav className="tech-nav">
        <Link to="/" className="back-link">← Back to Tuner</Link>
      </nav>

      <header className="tech-header">
        <h1>Under the Hood</h1>
        <p className="subtitle">Architecture, Signal Processing, and the "Exotic" Stack.</p>
      </header>

      <div className="tech-content">
        <section>
          <h2>1. The Goal: "Absolute Zero" Latency</h2>
          <p>
            Most online tuners suffer from "jitter"—the needle jumps around because the pitch detection logic 
            fights with the browser's main thread (UI rendering). We wanted to build a tuner that feels 
            native, with the responsiveness of an analog pedal.
          </p>
          <p>
            To achieve this, we bypassed standard libraries and wrote a custom 
            <strong> AudioWorklet</strong> implementation of the YIN algorithm in TypeScript.
          </p>
        </section>

        <section>
          <h2>2. Audio Engine Architecture</h2>
          <p>
            The core logic lives in a separate thread (AudioWorklet) to prevent UI blocking. 
            We use a <strong>Ring Buffer</strong> (Circular Buffer) strategy to handle continuous audio streams.
          </p>
          
          <div className="diagram-wrapper">
            <AudioEngineDiagram />
          </div>

          <h3>The "48kHz Problem" & The Solution</h3>
          <p>
            During development, we discovered a critical bug: the tuner was consistently flat on mobile devices. 
            <strong> The Diagnosis:</strong> Hardcoded sample rates (44.1kHz) clashed with modern hardware defaults (48kHz). 
            If the math expects 44,100 samples/sec but the hardware delivers 48,000, the calculated pitch drops by ~8%.
          </p>
          <div className="code-block">
            <pre>{`// The Fix: Dynamic Sample Rate & Parabolic Interpolation
const effectiveSampleRate = sampleRate / 2; // Downsampled
const pitch = effectiveSampleRate / betterTau;

// "BetterTau" uses parabolic interpolation to find the
// true peak *between* two digital samples.`}</pre>
          </div>
          <p>
            We implemented <strong>2x Downsampling</strong> and <strong>Parabolic Interpolation</strong>. 
            This allows us to process a massive 4096-sample buffer (great for Bass accuracy) 
            while keeping CPU usage low enough for mobile browsers.
          </p>
        </section>

        <section>
          <h2>3. The Tech Stack</h2>
          <ul className="tech-list">
            <li>
              <strong>Frontend:</strong> React 19 + TypeScript. We use React not for the audio, but for the 
              60fps canvas-less DOM rendering of the UI.
            </li>
            <li>
              <strong>Build Tool:</strong> Vite. Instant HMR is crucial when tweaking audio algorithms.
            </li>
            <li>
              <strong>State:</strong> Zustand. Minimalist state management to bridge the gap between 
              the high-frequency AudioWorklet events and the React UI.
            </li>
            <li>
              <strong>Hosting:</strong> DigitalOcean Droplet + Caddy Server (for automatic HTTPS and SPA routing).
            </li>
          </ul>
        </section>

        <section>
          <h2>4. "Exotic" Development Environment</h2>
          <p>
            This entire project is built and maintained in a non-traditional environment. 
            There is no VS Code, no MacBook.
          </p>
          <div className="diagram-wrapper">
            <DevEnvDiagram />
          </div>
          <p>
            <strong>The Rig:</strong>
          </p>
          <ul>
            <li><strong>Hardware:</strong> Android Smartphone + Termux (Linux environment).</li>
            <li><strong>Interface:</strong> Gemini CLI Agent.</li>
            <li><strong>Workflow:</strong> The developer converses with the AI agent, which executes shell commands, 
            edits files via `sed`/`cat`, and manages Git directly on the phone's filesystem. 
            Testing is done via `curl` and local servers running on the device.</li>
          </ul>
        </section>

        <section>
          <h2>5. Why Open Source?</h2>
          <p>
            We believe accurate tuning tools should be accessible to everyone. 
            The code is auditable, free, and designed to respect user privacy (no audio data ever leaves your device).
          </p>
        </section>
      </div>

      <footer className="tech-footer">
        <p>© 2026 Weiszfeld. Built with precision.</p>
      </footer>
    </div>
  );
};

export default TechnicalOverview;
