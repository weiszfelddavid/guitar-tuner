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
        <p className="subtitle">How I built a pro-grade tuner entirely on my phone.</p>
      </header>

      <div className="tech-content">
        <section>
          <h2>1. The Challenge: A Mobile-First "Lab"</h2>
          <p>
            I decided to try something a bit crazy: building a professional-grade, high-precision guitar tuner 
            without ever touching a laptop. This entire project—from the first <code>npm init</code> to the 
            final CSS tweak—was built on my phone using <strong>Termux</strong>, <strong>Gemini CLI</strong>, and a lot of persistence.
          </p>
          <p>
            The goal wasn't just to make it work; it was to make it the most accurate tuner on the web, 
            optimized specifically for the devices we actually use at home or in the studio.
          </p>
        </section>

        <section>
          <h2>2. The Audio Engine (Signal Processing)</h2>
          <p>
            I knew I needed absolute zero latency. Most web tuners feel "laggy" because they fight with the 
            browser's UI thread. To solve this, I implemented a standalone **McLeod Pitch Method (MPM)** 
            algorithm directly within an **AudioWorklet**.
          </p>
          
          <div className="diagram-wrapper">
            <AudioEngineDiagram />
          </div>

          <h3>The "Pure Engine" Refactor</h3>
          <p>
             I originally refactored the engine to use external libraries, but discovered that specialized 
             Worklet environments (especially on mobile) are sensitive to complex dependency trees. To 
             guarantee reliability, I wrote a zero-dependency **MPM** detector in pure JavaScript. This 
             algorithm is exceptionally robust against inharmonicity—making it perfect for the physical 
             vibrations of guitar and bass strings.
          </p>
          <div className="code-block">
            <pre>{`// Standalone Zero-Dependency Logic (MPM):
class PitchProcessor extends AudioWorkletProcessor {
  // ... Ring Buffer Logic ...
  detectPitch() {
    // 1. Calculate Normalized Square Difference Function (NSDF)
    // 2. Perform Peak Picking with Parabolic Interpolation
    // 3. Post smoothed frequency to UI thread
  }
}`}</pre>
          </div>
          <p>
            I use a **4096-sample buffer** to ensure enough data is captured to identify low frequencies 
            like the 31Hz of a 5-string bass's Low B, while maintaining high precision for the 329Hz 
            High E of a guitar.
          </p>
        </section>

        <section>
          <h2>3. My Core Stack</h2>
          <ul className="tech-list">
            <li>
              <strong>React 19 + TypeScript:</strong> I chose React for the UI because I wanted 60fps 
              responsiveness and a clean, declarative way to handle complex tuning states.
            </li>
            <li>
              <strong>Zustand:</strong> I needed a minimalist way to bridge the gap between high-frequency 
              audio events and the React rendering tree without the overhead of Redux.
            </li>
            <li>
              <strong>Vite:</strong> Instant HMR (Hot Module Replacement) was a lifesaver when I was 
              live-tweaking the "Diamond Gauge" visuals on my phone screen.
            </li>
          </ul>
        </section>

        <section>
          <h2>4. Quality & Verification</h2>
          <p>
            Building on a phone doesn't mean skipping best practices. I integrated a full suite of tools 
            to ensure every commit is rock solid.
          </p>
          <ul className="tech-list">
            <li>
              <strong>Vitest:</strong> I use this to unit-test my audio logic. I feed known frequency 
              buffers into my processor to verify it locks onto 440Hz with 0.1 cent tolerance.
            </li>
            <li>
              <strong>Playwright:</strong> Cross-browser E2E testing. I need to know the mic permissions 
              and routing work on Safari (iOS) just as well as Chrome (Android).
            </li>
          </ul>
        </section>

        <section>
          <h2>5. Infrastructure & CI/CD</h2>
          <p>
            My deployment pipeline is fully automated. When I push code from my phone:
          </p>
          <ul className="tech-list">
            <li>
              <strong>GitHub Actions:</strong> My workflow triggers a build, runs tests, and SSHs 
              into my <strong>DigitalOcean Droplet</strong>.
            </li>
            <li>
              <strong>Caddy Server:</strong> I use Caddy to handle automatic HTTPS and SPA routing. 
              I even added a custom <code>try_files</code> rule to ensure deep links (like <code>/en/guitar/drop-d</code>) 
              don't 404.
            </li>
          </ul>
        </section>

        <section>
          <h2>6. Native Mobile Strategy</h2>
          <p>
            While the web version is our primary focus, the architecture is "App Ready".
          </p>
          <ul className="tech-list">
            <li>
              <strong>Capacitor:</strong> The project is configured with <code>@capacitor/core</code>. 
              This allows us to wrap the existing React/Vite codebase into a native Android/iOS 
              container, giving us access to native audio APIs if the Web Audio API falls short.
            </li>
          </ul>
        </section>

        <section>
          <h2>7. My "Exotic" Development Setup</h2>
          <p>
            This is my favorite part of the story. I don't own a laptop for this project.
          </p>
          <div className="diagram-wrapper">
            <DevEnvDiagram />
          </div>
          <p>
            I develop in <strong>Termux</strong> on my Android phone. I use a <strong>Gemini CLI Agent</strong> 
            to help me refactor code, manage Git, and run shell commands. It's an incredibly fluid way to build 
            software—I can fix a bug in the audio engine while sitting in a cafe with just my phone in my hand.
          </p>

          <h3>A Real-World Example: Fixing the Pitch Bug</h3>
          <p>
            The recent pitch detection failure is a perfect example of this workflow in action. Here’s a condensed look at the commands I used via the Gemini CLI to resolve the issue:
          </p>
          <div className="code-block">
            <pre>{`# 1. Investigate: Find the relevant files
> glob '**/processor.ts'
> read_file src/audio/engine/processor.ts

# 2. Fix: Apply the code change (conceptual)
> replace --file 'src/audio/engine/processor.ts' ...

# 3. Verify: Run the updated unit test
> npm test

# 4. Deploy: Commit and push the fix
> git status
> git add .
> git commit -m "fix(audio): resolve critical pitch detection failure"
> git push`}</pre>
          </div>
        </section>

        <section>
          <h2>8. Privacy & Open Source</h2>
          <p>
            I'm a big believer in privacy. That's why your audio never leaves your device. Everything—the 
            pitch detection, the FFT analysis, the rendering—happens locally in your browser. 
          </p>
        </section>
      </div>

      <footer className="tech-footer">
        <p>© 2026 David Weiszfeld. Built with precision (and a smartphone).</p>
      </footer>
    </div>
  );
};

export default TechnicalOverview;